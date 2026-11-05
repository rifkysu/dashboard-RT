const prisma = require('./prisma');
const logger = require('./logger');
const { nowLocal } = require('./clock');
const { isMailConfigured } = require('./mailer');
const { emailBooking, rincianBooking, fmtHari, jam } = require('./bookingMail');

// Pengingat email ke tamu pengaju booking ruang rapat (kiosk):
//   - H-1  : sekitar 24 jam sebelum mulai (jenis 'ingat-h1')
//   - Jam  : REMINDER_JAM_SEBELUM jam sebelum mulai, default 2 (jenis 'ingat-jam')
// Dicek tiap 5 menit. Satu baris booking = satu pengingat per jenis, diingatkan untuk tanggal PERTAMA baris
// itu (booking beberapa hari berturut-turut hanya diingatkan di hari pertama; tanggal loncat-loncat adalah
// beberapa baris, jadi tiap tanggalnya diingatkan sendiri).
//
// Aman dijalankan lebih dari satu proses: pengirim "mengklaim" pengingat lebih dulu lewat UPDATE bersyarat
// (reminder_*_at masih null), hanya yang berhasil mengklaim yang mengirim -> tidak pernah terkirim dobel.
// Kalau pengiriman gagal, klaim dilepas dan dicoba lagi di putaran berikut (maks. MAX_COBA kali per baris).
// Pengajuan yang dibuat setelah batas pengingat lewat (mis. booking untuk besok pagi) tidak diingatkan lagi,
// karena email konfirmasinya baru saja dikirim.
const INTERVAL_MS = 5 * 60 * 1000;
const JAM_MS = 60 * 60 * 1000;
const H1_JAM = 24;
const MAX_COBA = 3;
const MAX_BARIS = 500;

const jamSebelum = () => Number(process.env.REMINDER_JAM_SEBELUM) || 2;

// Jam dinding (tanggal + HH:MM waktu kantor) sebagai angka ms. Dipakai membandingkan dua waktu dinding;
// kolom DATE/TIME di database juga disimpan sebagai jam dinding, jadi tidak ada konversi zona waktu.
const dinding = (dateIso, hm) => Date.parse(`${dateIso}T${hm}:00Z`);
const dindingDari = (d) => {
  const n = nowLocal(d);
  return dinding(n.date, n.hm);
};

// Kemungkinan: 'ingat-h1' | 'ingat-jam' | null. Fungsi murni, mudah dites.
function tentukanPengingat({ mulaiMs, dibuatMs, sekarangMs, sudahH1, sudahJam }) {
  const sisa = sekarangMs - mulaiMs; // negatif = belum mulai
  const jamBatas = jamSebelum() * JAM_MS;
  if (sisa >= 0) return null; // sudah mulai
  if (!sudahJam && -sisa <= jamBatas && dibuatMs <= mulaiMs - jamBatas) return 'ingat-jam';
  if (
    !sudahH1 &&
    -sisa <= H1_JAM * JAM_MS &&
    -sisa > jamBatas &&
    dibuatMs <= mulaiMs - H1_JAM * JAM_MS
  )
    return 'ingat-h1';
  return null;
}

const gagal = new Map(); // `${id}:${jenis}` -> jumlah gagal kirim (di memori; hilang saat restart)
let berjalan = false;

async function jalankanPengingat(sekarang = new Date()) {
  if (berjalan || !isMailConfigured()) return { terkirim: 0 };
  berjalan = true;
  let terkirim = 0;
  try {
    const now = nowLocal(sekarang);
    const sekarangMs = dinding(now.date, now.hm);
    const hariIni = new Date(`${now.date}T00:00:00Z`);
    const lusa = new Date(+hariIni + 2 * 24 * JAM_MS);
    const rows = await prisma.ruangRapat.findMany({
      where: {
        guest_id: { not: null },
        cancelled_at: null,
        booking_date: { gte: hariIni, lt: lusa }, // kandidat: mulai hari ini atau besok
        OR: [{ reminder_h1_at: null }, { reminder_jam_at: null }],
        guest: { is_blocked: false },
      },
      orderBy: { booking_date: 'asc' },
      take: MAX_BARIS,
      select: {
        id: true,
        agenda: true,
        room: true,
        pic: true,
        booking_date: true,
        end_date: true,
        start_time: true,
        end_time: true,
        created_at: true,
        reminder_h1_at: true,
        reminder_jam_at: true,
        guest: { select: { id: true, nama: true, email: true } },
      },
    });

    for (const r of rows) {
      const jenis = tentukanPengingat({
        mulaiMs: dinding(fmtHari(r.booking_date), jam(r.start_time)),
        dibuatMs: dindingDari(r.created_at),
        sekarangMs,
        sudahH1: !!r.reminder_h1_at,
        sudahJam: !!r.reminder_jam_at,
      });
      if (!jenis) continue;
      const kolom = jenis === 'ingat-h1' ? 'reminder_h1_at' : 'reminder_jam_at';
      const kunci = `${r.id}:${jenis}`;
      if ((gagal.get(kunci) || 0) >= MAX_COBA) continue;

      // Klaim dulu; hanya yang berhasil mengubah baris ini yang boleh mengirim.
      const { count } = await prisma.ruangRapat.updateMany({
        where: { id: r.id, cancelled_at: null, [kolom]: null },
        data: { [kolom]: new Date() },
      });
      if (!count) continue;

      const ok = await emailBooking(r.guest, jenis, {
        rincian: rincianBooking([r], [['PIC', r.pic]]),
        catatan:
          +r.end_date !== +r.booking_date
            ? 'Pengingat ini untuk hari pertama booking. Perubahan atau pembatalan bisa dilakukan dari kartu "Booking Anda" di kiosk.'
            : 'Perubahan atau pembatalan bisa dilakukan dari kartu "Booking Anda" di kiosk selama booking belum berjalan.',
      });
      if (ok) {
        terkirim += 1;
        gagal.delete(kunci);
      } else {
        gagal.set(kunci, (gagal.get(kunci) || 0) + 1);
        await prisma.ruangRapat.updateMany({ where: { id: r.id }, data: { [kolom]: null } }); // coba lagi nanti
      }
    }
    if (terkirim) logger.info('Pengingat booking terkirim', { jumlah: terkirim });
  } catch (err) {
    logger.error('Pengingat booking gagal dijalankan', { error: err });
  } finally {
    berjalan = false;
    if (gagal.size > 5000) gagal.clear();
  }
  return { terkirim };
}

function mulaiPengingat() {
  if (process.env.REMINDER_ENABLED === 'false') {
    logger.info('Pengingat booking dimatikan (REMINDER_ENABLED=false)');
    return;
  }
  if (!isMailConfigured()) {
    logger.info('Pengingat booking tidak aktif: SMTP belum diisi di .env');
    return;
  }
  setTimeout(jalankanPengingat, 30 * 1000).unref();
  setInterval(jalankanPengingat, INTERVAL_MS).unref();
  logger.info('Pengingat booking aktif', {
    tiapMenit: INTERVAL_MS / 60000,
    jamSebelum: jamSebelum(),
  });
}

module.exports = { mulaiPengingat, jalankanPengingat, tentukanPengingat };
