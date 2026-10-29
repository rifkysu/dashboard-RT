const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');
const logger = require('../logger');
const { saveDataUrl } = require('../fileStorage');
const { isGenuineDocumentDataUrl, maxDataUrlLength } = require('../fileSignature');
const { requireAuth, requireRole, ADMIN_ROLES } = require('../middleware/auth');
const { booking: B } = require('./ruangRapat');
const { ruangValid, resetDaftarRuang, blokirKena, isoTgl, teksPeriode } = require('../ruangList');
const live = require('../live');
const { nowLocal } = require('../clock');
const { catat, ringkas, pilihKolom } = require('../audit');
// Ruangan di riwayat aktivitas: kode & grup = nama ruangan (ruang_profil tidak punya id angka).
const refRuang = (room, satker) => ({ kode: room, label: satker || null, grup: room });
const satkerOf = async (room) => (await prisma.ruangProfil.findUnique({ where: { room }, select: { satuan_kerja: true } }))?.satuan_kerja;

// Daftar ruang rapat (per satuan kerja) + foto & fasilitas tiap ruangan untuk jadwal, kiosk, form booking,
// dan slideshow layar ruangan (/ruang/:slug).
// Baca: publik (layar ruangan tanpa login). Ubah: hanya Admin/Kabag (menu "Foto & Fasilitas Ruang").
const router = express.Router();

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const MAX_FOTO = 12;                 // per ruangan
const MAX_FILE = 5 * 1024 * 1024;    // frontend sudah mengecilkan foto (maks. 1920px) sebelum upload
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FASILITAS = 16;
const ICON_RE = /^[a-z0-9_]{1,40}$/;  // nama ikon Material Symbols

// Kunci per ruangan (sampai transaksi selesai): upload/urutan bersamaan dari dua admin tidak bisa
// melewati batas MAX_FOTO atau menghasilkan sort_order kembar.
const lockRuang = (tx, room) => tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ruang_foto:' + room}))`;
class PenuhError extends Error {}

const validRoom = ruangValid; // async
// Nama ruangan dipakai sebagai kunci booking & di URL layar (/ruang/<slug>) -> karakter dibatasi.
const NAMA_RE = /^[\p{L}\p{N} .,()&'-]+$/u;
const slugOf = (r) => r.toLowerCase().trim().replace(/\s+/g, '-');
const MAX_KAPASITAS = 10000;
// Tema layar ruangan "<palet>/<motif>" -- sama dengan frontend/src/utils/temaRuang.js.
// 40 warna; 14 warna awal di depan (urutan isi awal migration 0034).
const TEMA_PALET = [
  'emas', 'zamrud', 'safir', 'marun', 'ungu', 'jingga', 'limau', 'toska', 'mawar', 'perak',
  'tembaga', 'nila', 'kuning', 'hutan', 'delima', 'ceri', 'koral', 'salem', 'magenta', 'cabai',
  'terakota', 'kunyit', 'mustard', 'sawo', 'kopi', 'mint', 'pandan', 'zaitun', 'lumut', 'giok',
  'pinus', 'langit', 'samudra', 'kobalt', 'lavender', 'violet', 'arang', 'batu', 'pasir', 'mutiara',
];
// 40 motif; 4 motif awal di depan supaya ruangan baru tetap mendapat motif itu lebih dulu (temaBebas).
const TEMA_MOTIF = [
  'kawung', 'garis', 'titik', 'kotak', 'parang', 'truntum', 'ceplok', 'megamendung', 'tumpal', 'sekar',
  'songket', 'sisik', 'tenun', 'garis-tegak', 'garis-datar', 'garis-silang', 'garis-tebal', 'garis-ganda', 'garis-halus', 'zigzag',
  'gelombang', 'chevron', 'titik-rapat', 'titik-besar', 'titik-selang', 'lingkaran', 'gelembung', 'konsentris', 'riak', 'bintang',
  'plus', 'kotak-kecil', 'catur', 'wajik', 'segitiga', 'heksagon', 'anyaman', 'bata', 'tangga', 'daun',
];
const validTema = (t) => typeof t === 'string' && TEMA_PALET.includes(t.split('/')[0]) && TEMA_MOTIF.includes(t.split('/')[1]) && t.split('/').length === 2;
// Tema pertama yang belum dipakai ruangan lain (ruangan baru otomatis tampil beda).
async function temaBebas(db) {
  const dipakai = new Set((await db.ruangProfil.findMany({ select: { tema: true } })).map((p) => p.tema));
  for (const m of TEMA_MOTIF) for (const p of TEMA_PALET) if (!dipakai.has(`${p}/${m}`)) return `${p}/${m}`;
  return null;
}
// maintenance = blokir masih berlaku (periode belum lewat); maintenance_hari_ini = hari ini termasuk periode blokir.
const profilOut = (p, hariIni = nowLocal().date) => ({
  satuan_kerja: p.satuan_kerja, kapasitas: p.kapasitas, link_foto: p.link_foto, tema: p.tema, fasilitas: Array.isArray(p.fasilitas) ? p.fasilitas : [],
  maintenance: blokirKena(p, hariIni, '9999-12-31'), maintenance_hari_ini: blokirKena(p, hariIni, hariIni),
  maintenance_mulai: isoTgl(p.maintenance_mulai), maintenance_sampai: isoTgl(p.maintenance_sampai),
  maintenance_ket: p.maintenance_ket ?? null, maintenance_at: p.maintenance_at ?? null,
});

// Detail ruangan dari body -> { data } atau { error }. `wajib`: satuan kerja harus ada (tambah ruangan).
function validDetail(b, wajib) {
  const data = {};
  if (wajib || b.satuan_kerja !== undefined) {
    const v = typeof b.satuan_kerja === 'string' ? b.satuan_kerja.trim().replace(/\s+/g, ' ') : '';
    if (!v || v.length > 150) return { error: 'Satuan kerja wajib diisi (maksimal 150 karakter).' };
    data.satuan_kerja = v;
  }
  if (b.kapasitas !== undefined) {
    const n = Number(b.kapasitas);
    if (b.kapasitas === null || b.kapasitas === '') data.kapasitas = null;
    else if (Number.isInteger(n) && n >= 1 && n <= MAX_KAPASITAS) data.kapasitas = n;
    else return { error: `Kapasitas harus angka 1–${MAX_KAPASITAS}.` };
  }
  if (b.link_foto !== undefined) {
    const v = typeof b.link_foto === 'string' ? b.link_foto.trim() : b.link_foto;
    if (v === null || v === '') data.link_foto = null;
    else {
      let ok = false;
      try { ok = typeof v === 'string' && v.length <= 500 && ['http:', 'https:'].includes(new URL(v).protocol); } catch { /* bukan URL */ }
      if (!ok) return { error: 'Link foto harus alamat web lengkap (https://...), maksimal 500 karakter.' };
      data.link_foto = v;
    }
  }
  if (b.tema !== undefined) {
    if (b.tema === null || b.tema === '') data.tema = null;
    else if (validTema(b.tema)) data.tema = b.tema;
    else return { error: 'Tema layar tidak valid.' };
  }
  return { data };
}

// Nama ruangan baru -> { nama } atau { error }. Tidak boleh sama (atau sama slug-nya) dengan ruangan lain.
async function validNamaBaru(nama, kecuali) {
  const v = typeof nama === 'string' ? nama.trim().replace(/\s+/g, ' ') : '';
  if (v.length < 2 || v.length > 150 || !NAMA_RE.test(v)) return { error: "Nama ruangan 2–150 karakter (huruf, angka, spasi, dan . , ( ) & ' -)." };
  const semua = await prisma.ruangProfil.findMany({ select: { room: true } });
  if (semua.some((p) => p.room !== kecuali && slugOf(p.room) === slugOf(v))) return { error: `Ruangan "${v}" sudah ada.` };
  return { nama: v };
}
const validCaption = (c) => c === undefined || (typeof c === 'string' && c.trim().length <= 200);
const fotoOut = (f) => ({ id: f.id, room: f.room, caption: f.caption, sort_order: f.sort_order, updated_at: f.updated_at });

function validFasilitas(list) {
  if (!Array.isArray(list) || list.length > MAX_FASILITAS) return null;
  const out = [];
  for (const f of list) {
    const label = typeof f?.label === 'string' ? f.label.trim() : '';
    const icon = typeof f?.icon === 'string' ? f.icon.trim() : '';
    if (!label || label.length > 60 || !ICON_RE.test(icon)) return null;
    if (!out.some((x) => x.label.toLowerCase() === label.toLowerCase())) out.push({ icon, label });
  }
  return out;
}

// Semua ruangan sekaligus, sesuai urutan tampil:
// { urutan: ["BIRO UMUM", ...], data: { "SETJEN II": { satuan_kerja, kapasitas, link_foto, fasilitas: [...], foto: [...] }, ... } }.
router.get('/', async (req, res) => {
  try {
    const [fotos, profil] = await Promise.all([
      prisma.ruangFoto.findMany({ orderBy: [{ room: 'asc' }, { sort_order: 'asc' }, { id: 'asc' }] }),
      prisma.ruangProfil.findMany({ orderBy: [{ sort_order: 'asc' }, { room: 'asc' }] }),
    ]);
    const data = Object.fromEntries(profil.map((p) => [p.room, { ...profilOut(p), foto: [] }]));
    for (const f of fotos) if (data[f.room]) data[f.room].foto.push(fotoOut(f));
    res.json({ urutan: profil.map((p) => p.room), data });
  } catch (err) {
    logger.error('GET ruang info gagal', { error: err });
    res.status(500).json({ message: 'Gagal memuat foto ruangan.' });
  }
});

// File foto (publik). Path disimpan di DB -- dipastikan tetap di dalam folder uploads.
router.get('/foto/:id/file', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID foto tidak valid.' });
    const foto = await prisma.ruangFoto.findUnique({ where: { id }, select: { file_path: true, file_mime: true } });
    if (!foto) return res.status(404).json({ message: 'Foto tidak ditemukan.' });
    const abs = path.resolve(BACKEND_ROOT, foto.file_path);
    if (!abs.startsWith(path.join(BACKEND_ROOT, 'uploads') + path.sep) || !fs.existsSync(abs)) return res.status(404).json({ message: 'File foto tidak ditemukan.' });
    // Foto ini memang publik (layar ruangan tanpa login) dan dimuat <img> dari frontend yang bisa beda
    // port/domain dengan API (development, atau production bila API di domain lain) -> izinkan lintas origin.
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    // Isi file per ID tidak pernah berubah (ganti foto = hapus + upload baru dengan ID baru) -> cache lama aman.
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.type(foto.file_mime);
    res.sendFile(abs);
  } catch (err) {
    logger.error('GET file foto ruang gagal', { error: err });
    res.status(500).json({ message: 'Gagal memuat foto.' });
  }
});

router.use(requireAuth, requireRole(ADMIN_ROLES));

// Tambah satu foto: { room, caption, file_data: "data:image/jpeg;base64,..." }.
router.post('/foto', async (req, res) => {
  try {
    const { room, caption = '', file_data } = req.body || {};
    if (!(await validRoom(room))) return res.status(400).json({ message: 'Ruangan tidak valid.' });
    if (!validCaption(caption)) return res.status(400).json({ message: 'Keterangan foto maksimal 200 karakter.' });
    const mime = typeof file_data === 'string' ? (file_data.match(/^data:([^;,]+);base64,/) || [])[1] : null;
    if (!IMAGE_MIME.includes(mime) || !isGenuineDocumentDataUrl(file_data, maxDataUrlLength(MAX_FILE))) {
      return res.status(400).json({ message: 'File harus foto JPG/PNG/WEBP asli, maksimal 5MB.' });
    }
    const count = await prisma.ruangFoto.count({ where: { room } });
    if (count >= MAX_FOTO) return res.status(400).json({ message: `Maksimal ${MAX_FOTO} foto per ruangan. Hapus foto lama dulu.` });
    const file_path = await saveDataUrl(file_data, `ruang-${room}`, 'ruang-foto');
    if (!file_path) return res.status(400).json({ message: 'File foto tidak valid.' });
    let foto;
    try {
      foto = await prisma.$transaction(async (tx) => {
        await lockRuang(tx, room);
        // Cek ulang di dalam kunci: cek di atas hanya supaya tidak menulis file bila jelas sudah penuh.
        if (await tx.ruangFoto.count({ where: { room } }) >= MAX_FOTO) throw new PenuhError();
        const last = await tx.ruangFoto.aggregate({ where: { room }, _max: { sort_order: true } });
        return tx.ruangFoto.create({
          data: { room, caption: caption.trim(), file_path, file_mime: mime, sort_order: (last._max.sort_order ?? -1) + 1, created_by: req.user.id },
        });
      });
    } catch (err) {
      // Gagal simpan ke DB -> jangan tinggalkan file yatim di folder uploads.
      fs.promises.unlink(path.resolve(BACKEND_ROOT, file_path)).catch(() => {});
      if (err instanceof PenuhError) return res.status(400).json({ message: `Maksimal ${MAX_FOTO} foto per ruangan. Hapus foto lama dulu.` });
      throw err;
    }
    await catat(req, { modul: 'ruangan', aksi: 'foto-tambah', ref: refRuang(room, await satkerOf(room)), keterangan: `Foto ditambahkan${caption.trim() ? `: "${caption.trim()}"` : ''}.` });
    res.status(201).json({ data: fotoOut(foto), message: 'Foto ditambahkan.' });
  } catch (err) {
    logger.error('POST foto ruang gagal', { error: err });
    res.status(500).json({ message: 'Gagal menyimpan foto.' });
  }
});

// Ubah keterangan foto.
router.put('/foto/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { caption } = req.body || {};
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID foto tidak valid.' });
    if (typeof caption !== 'string' || !validCaption(caption)) return res.status(400).json({ message: 'Keterangan foto maksimal 200 karakter.' });
    const lama = await prisma.ruangFoto.findUnique({ where: { id }, select: { room: true, caption: true } });
    const { count } = await prisma.ruangFoto.updateMany({ where: { id }, data: { caption: caption.trim() } });
    if (!count) return res.status(404).json({ message: 'Foto tidak ditemukan.' });
    if (lama && lama.caption !== caption.trim()) {
      await catat(req, { modul: 'ruangan', aksi: 'foto-ubah', ref: refRuang(lama.room, await satkerOf(lama.room)), perubahan: [{ label: 'Keterangan foto', dari: lama.caption || null, ke: caption.trim() || null }] });
    }
    res.json({ message: 'Keterangan foto disimpan.' });
  } catch (err) {
    logger.error('PUT foto ruang gagal', { error: err });
    res.status(500).json({ message: 'Gagal menyimpan keterangan foto.' });
  }
});

// Atur urutan: { room, ids: [id foto sesuai urutan baru] } -- harus berisi semua foto ruangan itu.
router.put('/urutan', async (req, res) => {
  try {
    const { room, ids } = req.body || {};
    if (!(await validRoom(room)) || !Array.isArray(ids) || ids.length > MAX_FOTO || !ids.every(Number.isInteger)) {
      return res.status(400).json({ message: 'Urutan foto tidak valid.' });
    }
    const sama = await prisma.$transaction(async (tx) => {
      await lockRuang(tx, room);
      const current = await tx.ruangFoto.findMany({ where: { room }, select: { id: true }, orderBy: [{ sort_order: 'asc' }, { id: 'asc' }] });
      const ok = current.length === ids.length && new Set(ids).size === ids.length && current.every((f) => ids.includes(f.id));
      if (ok) for (const [i, id] of ids.entries()) await tx.ruangFoto.update({ where: { id }, data: { sort_order: i } });
      return ok && { berubah: current.some((f, i) => f.id !== ids[i]) };
    });
    if (!sama) return res.status(409).json({ message: 'Daftar foto sudah berubah. Muat ulang halaman lalu coba lagi.' });
    if (sama.berubah) await catat(req, { modul: 'ruangan', aksi: 'foto-urutan', ref: refRuang(room, await satkerOf(room)), keterangan: `Urutan ${ids.length} foto slideshow diubah.` });
    res.json({ message: 'Urutan foto disimpan.' });
  } catch (err) {
    logger.error('PUT urutan foto ruang gagal', { error: err });
    res.status(500).json({ message: 'Gagal menyimpan urutan foto.' });
  }
});

// Hapus foto + file-nya.
router.delete('/foto/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID foto tidak valid.' });
    const foto = await prisma.ruangFoto.findUnique({ where: { id } });
    if (!foto) return res.status(404).json({ message: 'Foto tidak ditemukan.' });
    await prisma.ruangFoto.delete({ where: { id } });
    await catat(req, { modul: 'ruangan', aksi: 'foto-hapus', ref: refRuang(foto.room, await satkerOf(foto.room)), keterangan: `Foto dihapus${foto.caption ? `: "${foto.caption}"` : ''}.` });
    const abs = path.resolve(BACKEND_ROOT, foto.file_path);
    if (abs.startsWith(path.join(BACKEND_ROOT, 'uploads') + path.sep)) fs.promises.unlink(abs).catch(() => {});
    res.json({ message: 'Foto dihapus.' });
  } catch (err) {
    logger.error('DELETE foto ruang gagal', { error: err });
    res.status(500).json({ message: 'Gagal menghapus foto.' });
  }
});

// Simpan daftar fasilitas: { room, fasilitas: [{ icon, label }] }.
router.put('/fasilitas', async (req, res) => {
  try {
    const { room } = req.body || {};
    const fasilitas = validFasilitas(req.body?.fasilitas);
    if (!(await validRoom(room))) return res.status(400).json({ message: 'Ruangan tidak valid.' });
    if (!fasilitas) return res.status(400).json({ message: `Fasilitas tidak valid (maksimal ${MAX_FASILITAS}, nama maksimal 60 karakter).` });
    const lama = await prisma.ruangProfil.findUnique({ where: { room }, select: { fasilitas: true, satuan_kerja: true } });
    await prisma.ruangProfil.update({ where: { room }, data: { fasilitas, updated_by: req.user.id } });
    await catat(req, { modul: 'ruangan', aksi: 'ubah', ref: refRuang(room, lama?.satuan_kerja), bandingkanDengan: { modul: 'ruangan', sebelum: lama, sesudah: { fasilitas } } });
    res.json({ data: fasilitas, message: 'Fasilitas disimpan.' });
  } catch (err) {
    logger.error('PUT fasilitas ruang gagal', { error: err });
    res.status(500).json({ message: 'Gagal menyimpan fasilitas.' });
  }
});

// Maintenance ruangan: { room, aktif: true|false, keterangan?, mulai?, sampai? }. Periode opsional
// ('YYYY-MM-DD'): tanpa tanggal = diblokir sampai dibuka lagi; sampai kosong = hanya tanggal mulai (1 hari).
// Selama periode itu ruangan tidak bisa dibooking (pegawai & tamu); booking yang sudah ada tidak dihapus ->
// jumlah yang kena periode dikembalikan (`terdampak`) supaya admin bisa memindahkan/membatalkannya sendiri.
const TGL_RE = /^\d{4}-\d{2}-\d{2}$/;
const tglValid = (v) => typeof v === 'string' && TGL_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && isoTgl(`${v}T00:00:00Z`) === v;
router.put('/maintenance', async (req, res) => {
  try {
    const { room, aktif } = req.body || {};
    const ket = typeof req.body?.keterangan === 'string' ? req.body.keterangan.trim().replace(/\s+/g, ' ') : '';
    if (!(await validRoom(room))) return res.status(404).json({ message: 'Ruangan tidak ditemukan.' });
    if (typeof aktif !== 'boolean') return res.status(400).json({ message: 'Status maintenance tidak valid.' });
    if (ket.length > 300) return res.status(400).json({ message: 'Keterangan maintenance maksimal 300 karakter.' });
    const hariIni = nowLocal().date;
    let mulai = null, sampai = null;
    if (aktif) {
      mulai = req.body.mulai || null; sampai = req.body.sampai || null;
      if ((mulai && !tglValid(mulai)) || (sampai && !tglValid(sampai))) return res.status(400).json({ message: 'Tanggal maintenance tidak valid.' });
      if (sampai && !mulai) return res.status(400).json({ message: 'Isi tanggal mulai maintenance.' });
      if (mulai && !sampai) sampai = mulai; // 1 hari
      if (mulai && sampai < mulai) return res.status(400).json({ message: 'Tanggal selesai tidak boleh sebelum tanggal mulai.' });
      if (sampai && sampai < hariIni) return res.status(400).json({ message: 'Periode maintenance sudah lewat. Pilih tanggal hari ini atau setelahnya.' });
    }
    const today = new Date(`${hariIni}T00:00:00Z`);
    const { lama, terdampak } = await prisma.$transaction(async (tx) => {
      // Kunci booking ruangan ini: booking yang sedang disimpan bersamaan selesai dulu (dan ikut terhitung).
      await B.lockRoom(tx, room);
      const lama = await tx.ruangProfil.findUnique({ where: { room }, select: { maintenance: true, maintenance_ket: true, maintenance_mulai: true, maintenance_sampai: true, satuan_kerja: true } });
      const masihAktif = blokirKena(lama, hariIni, '9999-12-31');
      await tx.ruangProfil.update({
        where: { room },
        data: {
          maintenance: aktif, maintenance_ket: aktif ? ket || null : null,
          maintenance_mulai: mulai ? new Date(`${mulai}T00:00:00Z`) : null, maintenance_sampai: sampai ? new Date(`${sampai}T00:00:00Z`) : null,
          maintenance_at: aktif ? (masihAktif ? undefined : new Date()) : null, updated_by: req.user.id,
        },
      });
      // Booking aktif yang kena periode blokir (hari ini/ke depan).
      const dari = mulai && mulai > hariIni ? new Date(`${mulai}T00:00:00Z`) : today;
      const terdampak = aktif ? await tx.ruangRapat.count({ where: { room, cancelled_at: null, end_date: { gte: dari }, ...(sampai ? { booking_date: { lte: new Date(`${sampai}T00:00:00Z`) } } : {}) } }) : 0;
      return { lama: { ...lama, masihAktif }, terdampak };
    });
    const periode = teksPeriode(mulai, sampai);
    const status = (on) => (on ? 'Maintenance (tidak bisa dibooking)' : 'Bisa dibooking');
    const teksLama = lama.masihAktif ? teksPeriode(isoTgl(lama.maintenance_mulai), isoTgl(lama.maintenance_sampai)) || 'Sampai dibuka lagi' : null;
    const teksBaru = aktif ? periode || 'Sampai dibuka lagi' : null;
    const ketLama = lama.masihAktif ? lama.maintenance_ket || null : null, ketBaru = aktif ? ket || null : null;
    const perubahan = [];
    if (lama.masihAktif !== aktif) perubahan.push({ label: 'Status ruangan', dari: status(lama.masihAktif), ke: status(aktif) });
    if (teksLama !== teksBaru) perubahan.push({ label: 'Periode maintenance', dari: teksLama, ke: teksBaru });
    if (ketLama !== ketBaru) perubahan.push({ label: 'Keterangan maintenance', dari: ketLama, ke: ketBaru });
    if (perubahan.length) {
      await catat(req, { modul: 'ruangan', aksi: aktif ? 'maintenance' : 'buka-maintenance', ref: refRuang(room, lama.satuan_kerja), perubahan, keterangan: terdampak ? `${terdampak} booking aktif pada periode blokir tetap tersimpan.` : undefined });
    }
    // Jadwal, kiosk, layar ruangan & dashboard ikut diperbarui.
    live.broadcast('ruang-rapat'); B.broadcastChange();
    res.json({
      terdampak,
      message: !aktif ? `Ruangan ${room} kembali bisa dibooking.`
        : periode ? `Ruangan ${room} diblokir (maintenance) tanggal ${periode}; di luar tanggal itu tetap bisa dibooking.`
        : `Ruangan ${room} diblokir (maintenance) dan tidak bisa dibooking sampai maintenance dimatikan.`,
    });
  } catch (err) {
    logger.error('PUT maintenance ruangan gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengubah status maintenance ruangan.' });
  }
});

// Tambah ruangan: { room, satuan_kerja, kapasitas?, link_foto?, tema?, fasilitas? } -> langsung bisa dibooking.
// Tanpa tema -> otomatis tema yang belum dipakai ruangan lain.
router.post('/ruangan', async (req, res) => {
  try {
    const b = req.body || {};
    const nama = await validNamaBaru(b.room);
    if (nama.error) return res.status(400).json({ message: nama.error });
    const detail = validDetail(b, true);
    if (detail.error) return res.status(400).json({ message: detail.error });
    const fasilitas = validFasilitas(b.fasilitas ?? []);
    if (!fasilitas) return res.status(400).json({ message: `Fasilitas tidak valid (maksimal ${MAX_FASILITAS}, nama maksimal 60 karakter).` });
    const profil = await prisma.$transaction(async (tx) => {
      // Urutan: tepat di belakang ruangan lain dengan satuan kerja yang sama, atau paling akhir bila satuan kerja baru.
      const [akhirSatker, akhir] = await Promise.all([
        tx.ruangProfil.aggregate({ where: { satuan_kerja: detail.data.satuan_kerja }, _max: { sort_order: true } }),
        tx.ruangProfil.aggregate({ _max: { sort_order: true } }),
      ]);
      const sesudah = akhirSatker._max.sort_order ?? akhir._max.sort_order ?? -1;
      await tx.ruangProfil.updateMany({ where: { sort_order: { gt: sesudah } }, data: { sort_order: { increment: 1 } } });
      const tema = detail.data.tema ?? await temaBebas(tx);
      return tx.ruangProfil.create({ data: { room: nama.nama, ...detail.data, tema, fasilitas, sort_order: sesudah + 1, updated_by: req.user.id } });
    });
    resetDaftarRuang();
    await catat(req, { modul: 'ruangan', aksi: 'tambah', ref: refRuang(profil.room, profil.satuan_kerja), perubahan: ringkas('ruangan', profil) });
    res.status(201).json({ data: { room: profil.room, ...profilOut(profil) }, message: 'Ruangan ditambahkan.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Ruangan dengan nama itu sudah ada.' });
    logger.error('POST ruangan gagal', { error: err });
    res.status(500).json({ message: 'Gagal menambah ruangan.' });
  }
});

// Ubah detail ruangan: { room, nama_baru?, satuan_kerja?, kapasitas?, link_foto?, tema? }.
// Ganti nama ikut memindahkan semua booking & foto ruangan itu ke nama baru.
router.put('/ruangan', async (req, res) => {
  try {
    const b = req.body || {};
    if (!(await validRoom(b.room))) return res.status(404).json({ message: 'Ruangan tidak ditemukan.' });
    const detail = validDetail(b, false);
    if (detail.error) return res.status(400).json({ message: detail.error });
    let baru = b.room;
    if (typeof b.nama_baru === 'string' && b.nama_baru.trim() !== b.room) {
      const nama = await validNamaBaru(b.nama_baru, b.room);
      if (nama.error) return res.status(400).json({ message: nama.error });
      baru = nama.nama;
    }
    const sebelum = await prisma.ruangProfil.findUnique({ where: { room: b.room }, select: pilihKolom('ruangan') });
    await prisma.$transaction(async (tx) => {
      if (baru !== b.room) {
        // Kunci booking & foto kedua nama (urut abjad, sama seperti edit booking) supaya booking/upload
        // yang berjalan bersamaan tidak tertinggal di nama lama.
        for (const r of [b.room, baru].sort()) { await B.lockRoom(tx, r); await lockRuang(tx, r); }
        await tx.ruangProfil.update({ where: { room: b.room }, data: { room: baru } });
        await tx.ruangRapat.updateMany({ where: { room: b.room }, data: { room: baru } });
        await tx.ruangFoto.updateMany({ where: { room: b.room }, data: { room: baru } });
      }
      await tx.ruangProfil.update({ where: { room: baru }, data: { ...detail.data, updated_by: req.user.id } });
    });
    resetDaftarRuang();
    const sesudah = await prisma.ruangProfil.findUnique({ where: { room: baru }, select: pilihKolom('ruangan') });
    if (sesudah) await catat(req, { modul: 'ruangan', aksi: 'ubah', ref: refRuang(baru, sesudah.satuan_kerja), bandingkanDengan: { modul: 'ruangan', sebelum, sesudah }, keterangan: baru !== b.room ? `Ganti nama: booking & foto "${b.room}" ikut pindah ke "${baru}".` : undefined });
    // Nama ruangan juga tersimpan di data booking -> kalender di semua tab ikut dimuat ulang.
    if (baru !== b.room) { live.broadcast('ruang-rapat'); B.broadcastChange(); }
    res.json({ data: { room: baru }, message: 'Detail ruangan disimpan.' });
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ message: 'Ruangan dengan nama itu sudah ada.' });
    logger.error('PUT ruangan gagal', { error: err });
    res.status(500).json({ message: 'Gagal menyimpan detail ruangan.' });
  }
});

// Hapus ruangan: { room }. Ditolak bila masih ada booking aktif hari ini/ke depan. Booking lama tetap
// tersimpan (nama ruangan tetap tampil di riwayat), foto ruangan ikut dihapus.
router.delete('/ruangan', async (req, res) => {
  try {
    const { room } = req.body || {};
    if (!(await validRoom(room))) return res.status(404).json({ message: 'Ruangan tidak ditemukan.' });
    const today = new Date(`${nowLocal().date}T00:00:00Z`);
    const sebelum = await prisma.ruangProfil.findUnique({ where: { room }, select: pilihKolom('ruangan') });
    const fotos = await prisma.$transaction(async (tx) => {
      await B.lockRoom(tx, room);
      await lockRuang(tx, room);
      const aktif = await tx.ruangRapat.count({ where: { room, cancelled_at: null, end_date: { gte: today } } });
      if (aktif) throw new B.HttpError(409, `Masih ada ${aktif} booking aktif di ruangan ini. Batalkan atau pindahkan dulu bookingnya.`);
      const list = await tx.ruangFoto.findMany({ where: { room }, select: { file_path: true } });
      await tx.ruangFoto.deleteMany({ where: { room } });
      await tx.ruangProfil.delete({ where: { room } });
      return list;
    });
    resetDaftarRuang();
    await catat(req, { modul: 'ruangan', aksi: 'hapus', ref: refRuang(room, sebelum?.satuan_kerja), perubahan: ringkas('ruangan', sebelum, 'dari'), keterangan: fotos.length ? `${fotos.length} foto ruangan ikut dihapus. Booking lama tetap tersimpan.` : 'Booking lama tetap tersimpan.' });
    for (const f of fotos) {
      const abs = path.resolve(BACKEND_ROOT, f.file_path);
      if (abs.startsWith(path.join(BACKEND_ROOT, 'uploads') + path.sep)) fs.promises.unlink(abs).catch(() => {});
    }
    res.json({ message: 'Ruangan dihapus.' });
  } catch (err) {
    if (err instanceof B.HttpError) return res.status(err.status).json({ message: err.message });
    logger.error('DELETE ruangan gagal', { error: err });
    res.status(500).json({ message: 'Gagal menghapus ruangan.' });
  }
});

module.exports = router;
