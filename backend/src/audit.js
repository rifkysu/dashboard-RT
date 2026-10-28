const crypto = require('crypto');
const prisma = require('./prisma');
const logger = require('./logger');
const live = require('./live');

// Riwayat aktivitas (audit trail): dipanggil route SETELAH perubahan berhasil disimpan. Mencatat pelaku
// (pegawai dari req.user / tamu Google dari req.guest), modul, aksi, data yang disentuh, dan daftar
// perubahan { label, dari, ke } yang sudah siap dibaca manusia. Tabel riwayat_aktivitas hanya bisa ditambah
// (trigger menolak UPDATE/DELETE, migration 0037). Gagal mencatat tidak pernah menggagalkan aksi pengguna.

const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const STATUS = { pending: 'Pending', on_progress: 'On Progress', selesai: 'Selesai' };
const SURAT = { belum: 'Belum ada surat', ditinjau: 'Surat ditinjau', diterima: 'Surat diterima' };
const MAX_TEKS = 300;

// Nilai mentah database -> teks tampilan (null = kosong).
function tampil(v, tipe) {
  if (v === null || v === undefined || v === '') return null;
  if (tipe === 'tanggal') {
    const s = v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
    const [y, m, d] = s.split('-');
    return y && m && d ? `${Number(d)} ${BULAN[Number(m) - 1]} ${y}` : s;
  }
  if (tipe === 'jam') return v instanceof Date ? v.toISOString().slice(11, 16) : String(v).slice(0, 5);
  if (tipe === 'uang') return `Rp ${Number(v).toLocaleString('id-ID')}`;
  if (tipe === 'status') return STATUS[v] || String(v);
  if (tipe === 'surat') return SURAT[v] || String(v);
  // "safir/garis-tegak" -> "Safir · Garis tegak" (label lengkap ada di frontend utils/temaRuang.js).
  if (tipe === 'tema') return String(v).split('/').map((x) => x.charAt(0).toUpperCase() + x.slice(1).replace(/-/g, ' ')).join(' · ');
  if (tipe === 'fasilitas') { const a = Array.isArray(v) ? v.map((f) => f?.label).filter(Boolean) : []; return a.length ? tampil(a.join(', ')) : null; }
  const s = String(v);
  return s.length > MAX_TEKS ? `${s.slice(0, MAX_TEKS)}…` : s;
}

// Kolom yang dicatat per modul. fields: { kolom: [label, tipe?] }.
// files: { kolom_path: [label, kolom_nama_file | null, 'daftar'?] } -- file dibandingkan lewat path di disk
// (tiap unggahan baru = path baru), isi Base64-nya tidak pernah ikut dicatat. 'daftar' = JSON array file;
// elemen ke-4 = kolom isi (JSON [{ data }]) untuk menghitung file yang ditambah/diganti/dihapus -- hanya dipakai
// bila route ikut membaca kolom itu (lihat pilihKolom(..., { isi: true })).
const MODUL = {
  pemeliharaan: {
    fields: {
      judul: ['Judul'], lokasi: ['Lokasi'], titik_lokasi: ['Titik lokasi'], kategori: ['Kategori'], deskripsi: ['Deskripsi'],
      tanggal: ['Tanggal', 'tanggal'], jenis_pekerjaan: ['Jenis pekerjaan'], urgensi: ['Urgensi'], metode_pengadaan: ['Metode pengadaan'],
      status: ['Status', 'status'], tahap1_status: ['Status tahap 1', 'status'], tahap2_status: ['Status tahap 2', 'status'], tahap3_status: ['Status tahap 3', 'status'],
      tanggal_selesai: ['Tanggal selesai', 'tanggal'], catatan: ['Catatan'], stage1_boq: ['BOQ'], stage1_hps: ['Nilai HPS', 'uang'],
      stage2_payment_method: ['Metode pembayaran'], stage2_payment_number: ['Nomor GUP/TUP'], stage2_ls_date: ['Tanggal LS', 'tanggal'],
      stage2_budget_source: ['Asal anggaran'], stage2_vendor: ['Vendor'], stage2_invoice_number: ['Nomor invoice'],
      stage2_invoice_date: ['Tanggal invoice', 'tanggal'], stage2_invoice_amount: ['Nilai invoice', 'uang'],
      stage3_documentation_names: ['Nama dokumentasi'], stage3_bast_notes: ['Catatan BAST'],
    },
    files: {
      request_document_file_path: ['Dokumen permintaan', 'request_document_name'],
      stage1_boq_file_path: ['File BOQ', null],
      stage1_document_file_path: ['Dokumen tahap 1', 'stage1_document_name'],
      stage2_invoice_document_file_path: ['Dokumen invoice', 'stage2_invoice_document_name'],
      stage3_documentation_file_paths: ['Dokumentasi final', null, 'daftar', 'stage3_documentation_files'],
    },
  },
  pengadaan: {
    fields: {
      nama_barang_jasa: ['Nama barang/jasa'], kategori: ['Kategori'], lokasi: ['Lokasi'], titik_lokasi: ['Titik lokasi'],
      metode_pengadaan: ['Metode pengadaan'], nilai_hps: ['Nilai HPS', 'uang'], deskripsi: ['Deskripsi'], tanggal: ['Tanggal', 'tanggal'],
      status: ['Status', 'status'], tahap1_status: ['Status tahap 1', 'status'], tahap2_status: ['Status tahap 2', 'status'], tahap3_status: ['Status tahap 3', 'status'],
      tanggal_selesai: ['Tanggal selesai', 'tanggal'], stage2_payment_method: ['Metode pembayaran'], stage2_payment_number: ['Nomor GUP/TUP'],
      stage2_ls_date: ['Tanggal LS', 'tanggal'], stage2_budget_source: ['Asal anggaran'], stage2_vendor: ['Vendor'],
      stage2_invoice_number: ['Nomor invoice'], stage2_invoice_date: ['Tanggal invoice', 'tanggal'], stage2_invoice_amount: ['Nilai invoice', 'uang'],
      catatan: ['Catatan'],
    },
    files: {
      request_document_file_path: ['Dokumen permintaan', 'request_document_name'],
      stage2_invoice_document_file_path: ['Dokumen invoice', 'stage2_invoice_document_name'],
      stage2_invoice_file_path: ['File invoice', 'stage2_invoice_document_name'],
      stage2_payment_proof_file_path: ['Bukti bayar', 'stage2_payment_proof_name'],
      stage3_final_document_file_path: ['Dokumen final', 'stage3_final_document_name'],
    },
  },
  kendaraan: {
    fields: {
      nama_barang: ['Nama barang'], merk: ['Merk'], tipe: ['Tipe'], plate: ['Nomor polisi'], plat_khusus: ['Plat khusus'],
      no_bpkb: ['Nomor BPKB'], jenis: ['Jenis'], sub: ['Keterangan'], status: ['Status'],
      tanggal_perolehan: ['Tanggal perolehan', 'tanggal'], masa_berlaku_stnk: ['Masa berlaku STNK', 'tanggal'], waktu_pajak: ['Waktu pajak', 'tanggal'],
    },
    files: {
      bpkb_document_file_path: ['Dokumen BPKB', 'bpkb_document_name'],
      stnk_document_file_path: ['Dokumen STNK', 'stnk_document_name'],
      photo_file_paths: ['Foto kendaraan', null, 'daftar', 'photos'],
    },
  },
  'kendaraan-service': {
    fields: { tanggal_service: ['Tanggal service', 'tanggal'], bagian_service: ['Bagian yang diservis'] },
    files: { invoice_document_file_path: ['Invoice service', 'invoice_document_name'] },
  },
  'ruang-rapat': {
    fields: {
      agenda: ['Agenda'], nomor_surat: ['Nomor surat'], room: ['Ruangan'], pic: ['PIC'], pic_phone: ['No. HP PIC'],
      booking_date: ['Tanggal mulai', 'tanggal'], end_date: ['Sampai tanggal', 'tanggal'], start_time: ['Jam mulai', 'jam'], end_time: ['Jam selesai', 'jam'],
      surat_status: ['Status surat', 'surat'],
    },
    files: { surat_file_path: ['Surat permohonan', 'surat_name'] },
  },
  ruangan: {
    fields: {
      room: ['Nama ruangan'], satuan_kerja: ['Satuan kerja'], kapasitas: ['Kapasitas (kursi)'], link_foto: ['Link dokumentasi foto'],
      tema: ['Tema layar', 'tema'], fasilitas: ['Fasilitas', 'fasilitas'],
    },
    files: {},
  },
};

// select Prisma untuk membaca data "sebelum" (tanpa isi file Base64 yang berat).
// isi: true -> ikut baca kolom isi file daftar (berat; hanya bila daftar file itu memang sedang diubah).
function pilihKolom(modul, extra = {}, { isi = false } = {}) {
  const cfg = MODUL[modul];
  const sel = { ...extra };
  for (const k of Object.keys(cfg.fields)) sel[k] = true;
  for (const [k, [, nama, , kolomIsi]] of Object.entries(cfg.files)) { sel[k] = true; if (nama) sel[nama] = true; if (isi && kolomIsi) sel[kolomIsi] = true; }
  return sel;
}

const bacaDaftar = (v) => { if (!v) return []; try { const a = typeof v === 'string' ? JSON.parse(v) : v; return Array.isArray(a) ? a : []; } catch { return []; } };
const jumlahDaftar = (v) => bacaDaftar(v).length;
// Sidik jari isi tiap file daftar (bukan path, yang selalu baru tiap disimpan ulang).
const sidikDaftar = (v) => bacaDaftar(v).map((f) => crypto.createHash('sha1').update(String(f?.data ?? '')).digest('hex'));
// Daftar file lama vs baru -> null (isi sama) atau teks "3 file (1 ditambah, 1 diganti)".
function bedaDaftar(lama, baru) {
  const a = sidikDaftar(lama), b = sidikDaftar(baru);
  const sisaA = [...a], tambah = [];
  for (const h of b) { const i = sisaA.indexOf(h); if (i >= 0) sisaA.splice(i, 1); else tambah.push(h); }
  if (!tambah.length && !sisaA.length) return a.join() === b.join() ? null : `${b.length} file (urutan diubah)`;
  const ganti = Math.min(tambah.length, sisaA.length);
  const parts = [ganti && `${ganti} diganti`, tambah.length - ganti && `${tambah.length - ganti} ditambah`, sisaA.length - ganti && `${sisaA.length - ganti} dihapus`].filter(Boolean);
  return `${b.length ? `${b.length} file` : 'kosong'} (${parts.join(', ')})`;
}
function tampilFile(row, kolom, [, nama, jenis]) {
  if (!row) return null;
  if (jenis === 'daftar') { const n = jumlahDaftar(row[kolom]); return n ? `${n} file` : null; }
  if (!row[kolom]) return null;
  return (nama && row[nama]) || 'ada file';
}

// Bandingkan dua baris -> [{ label, dari, ke }] untuk kolom yang benar-benar berubah.
function bandingkan(modul, sebelum, sesudah) {
  const cfg = MODUL[modul];
  const out = [];
  for (const [k, [label, tipe]] of Object.entries(cfg.fields)) {
    if (!(k in sesudah)) continue;
    const dari = tampil(sebelum?.[k], tipe), ke = tampil(sesudah[k], tipe);
    if (dari !== ke) out.push({ label, dari, ke });
  }
  for (const [k, spec] of Object.entries(cfg.files)) {
    if (!(k in sesudah)) continue;
    const pathLama = sebelum?.[k] ?? null, pathBaru = sesudah[k] ?? null;
    if (pathLama === pathBaru) continue;
    const kolomIsi = spec[3];
    if (kolomIsi && sebelum && kolomIsi in sebelum && kolomIsi in sesudah) {
      // Daftar file disimpan ulang seluruhnya tiap perubahan -> bandingkan isinya, bukan path-nya.
      const ke = bedaDaftar(sebelum[kolomIsi], sesudah[kolomIsi]);
      if (ke) out.push({ label: spec[0], dari: tampilFile(sebelum, k, spec), ke });
      continue;
    }
    const dari = tampilFile(sebelum, k, spec);
    let ke = tampilFile(sesudah, k, spec);
    if (ke && ke === dari) ke = `${ke} (diunggah ulang)`;
    out.push({ label: spec[0], dari, ke: ke || 'dihapus' });
  }
  return out;
}

// Isi satu baris sebagai daftar { label, ke } (tambah) atau { label, dari } (hapus); kolom kosong dilewati.
function ringkas(modul, row, arah = 'ke') {
  const cfg = MODUL[modul];
  const out = [];
  for (const [k, [label, tipe]] of Object.entries(cfg.fields)) {
    const v = tampil(row?.[k], tipe);
    if (v !== null) out.push({ label, [arah]: v });
  }
  for (const [k, spec] of Object.entries(cfg.files)) {
    const v = tampilFile(row, k, spec);
    if (v !== null) out.push({ label: spec[0], [arah]: v });
  }
  return out;
}

function aktorDari(req) {
  if (req?.user) return { aktor_tipe: 'pegawai', aktor_id: req.user.id, aktor_nama: req.user.nama_lengkap || null, aktor_role: req.user.role || null, aktor_email: req.user.email || null };
  if (req?.guest) return { aktor_tipe: 'tamu', aktor_id: req.guest.id, aktor_nama: req.guest.nama || null, aktor_role: 'tamu', aktor_email: req.guest.email || null };
  return { aktor_tipe: 'sistem', aktor_id: null, aktor_nama: 'Sistem', aktor_role: null, aktor_email: null };
}
const potong = (v, n) => (v == null ? null : String(v).slice(0, n));

/**
 * Catat satu aktivitas. Tidak pernah melempar error.
 *   modul   : 'pemeliharaan' | 'pengadaan' | 'kendaraan' | 'ruang-rapat' | 'ruangan' | 'akun'
 *   aksi    : 'tambah' | 'ubah' | 'hapus' | 'batal' | 'batal-sebagian' | 'service-tambah' | 'service-ubah' | 'service-hapus'
 *             | 'foto-tambah' | 'foto-ubah' | 'foto-hapus' | 'foto-urutan'
 *             | 'role' | 'ban' | 'aktifkan' | 'verifikasi-email' | 'link-reset' | 'blokir-tamu' | 'buka-blokir-tamu'
 *   ref     : { id, kode, label, grup? } data yang disentuh (grup = kunci "Riwayat data ini" lintas baris)
 *   bandingkanDengan: { modul, sebelum, sesudah } -> perubahan dihitung otomatis; atau langsung `perubahan`
 *   aktor   : opsional, menggantikan pelaku dari req (mis. pendaftar akun yang belum login)
 *   Aksi 'ubah' tanpa perubahan & tanpa keterangan (simpan tanpa mengubah apa pun) tidak dicatat.
 */
async function catat(req, { modul, aksi, ref = {}, perubahan, bandingkanDengan, keterangan, aktor }) {
  try {
    let list = perubahan;
    if (!list && bandingkanDengan) list = bandingkan(bandingkanDengan.modul, bandingkanDengan.sebelum, bandingkanDengan.sesudah);
    if (aksi.endsWith('ubah') && !list?.length && !keterangan) return;
    await prisma.riwayatAktivitas.create({
      data: {
        modul, aksi,
        ref_id: Number.isInteger(ref.id) ? ref.id : null,
        ref_kode: potong(ref.kode, 150),
        ref_label: potong(ref.label, 300),
        ref_grup: potong(ref.grup, 150),
        ...(aktor || aktorDari(req)),
        perubahan: list?.length ? list : undefined,
        keterangan: potong(keterangan, 1000),
        ip: potong(req?.ip, 64),
      },
    });
    live.broadcast('riwayat');
  } catch (err) {
    logger.error('Catat riwayat aktivitas gagal', { error: err, modul, aksi, ref_id: ref?.id });
  }
}

// Pelaku = pemilik akun itu sendiri (Daftar Akun / verifikasi lewat link, saat belum login).
const aktorAkun = (u) => ({ aktor_tipe: 'pegawai', aktor_id: u.id, aktor_nama: u.nama_lengkap || null, aktor_role: u.role || null, aktor_email: u.email || null });

module.exports = { catat, bandingkan, ringkas, pilihKolom, tampil, aktorAkun };
