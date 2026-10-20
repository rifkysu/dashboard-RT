const express = require('express');
const fs = require('fs');
const path = require('path');
const prisma = require('../prisma');
const logger = require('../logger');
const { saveDataUrl } = require('../fileStorage');
const { isGenuineDocumentDataUrl, maxDataUrlLength } = require('../fileSignature');
const { requireAuth, requireRole, ADMIN_ROLES } = require('../middleware/auth');
const { ROOMS } = require('./ruangRapat');

// Foto & fasilitas tiap ruang rapat untuk slideshow layar ruangan (/ruang/:slug).
// Baca: publik (layar ruangan tanpa login). Ubah: hanya Admin/Kabag (menu "Foto & Fasilitas Ruang").
const router = express.Router();

const BACKEND_ROOT = path.resolve(__dirname, '..', '..');
const MAX_FOTO = 12;                 // per ruangan
const MAX_FILE = 5 * 1024 * 1024;    // frontend sudah mengecilkan foto (maks. 1920px) sebelum upload
const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FASILITAS = 16;
const ICON_RE = /^[a-z0-9_]{1,40}$/;  // nama ikon Material Symbols

const validRoom = (r) => typeof r === 'string' && ROOMS.includes(r);
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

// Semua ruangan sekaligus: { data: { "SETJEN II": { fasilitas: [...], foto: [...] }, ... } }.
router.get('/', async (req, res) => {
  try {
    const [fotos, profil] = await Promise.all([
      prisma.ruangFoto.findMany({ orderBy: [{ room: 'asc' }, { sort_order: 'asc' }, { id: 'asc' }] }),
      prisma.ruangProfil.findMany(),
    ]);
    const data = Object.fromEntries(ROOMS.map((r) => [r, { fasilitas: [], foto: [] }]));
    for (const p of profil) if (data[p.room]) data[p.room].fasilitas = Array.isArray(p.fasilitas) ? p.fasilitas : [];
    for (const f of fotos) if (data[f.room]) data[f.room].foto.push(fotoOut(f));
    res.json({ data });
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
    // Foto dimuat <img> dari frontend (beda port saat development) -> izinkan lintas origin dalam satu situs.
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Cache-Control', 'public, max-age=86400');
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
    if (!validRoom(room)) return res.status(400).json({ message: 'Ruangan tidak valid.' });
    if (!validCaption(caption)) return res.status(400).json({ message: 'Keterangan foto maksimal 200 karakter.' });
    const mime = typeof file_data === 'string' ? (file_data.match(/^data:([^;,]+);base64,/) || [])[1] : null;
    if (!IMAGE_MIME.includes(mime) || !isGenuineDocumentDataUrl(file_data, maxDataUrlLength(MAX_FILE))) {
      return res.status(400).json({ message: 'File harus foto JPG/PNG/WEBP asli, maksimal 5MB.' });
    }
    const count = await prisma.ruangFoto.count({ where: { room } });
    if (count >= MAX_FOTO) return res.status(400).json({ message: `Maksimal ${MAX_FOTO} foto per ruangan. Hapus foto lama dulu.` });
    const file_path = await saveDataUrl(file_data, `ruang-${room}`, 'ruang-foto');
    if (!file_path) return res.status(400).json({ message: 'File foto tidak valid.' });
    const last = await prisma.ruangFoto.aggregate({ where: { room }, _max: { sort_order: true } });
    const foto = await prisma.ruangFoto.create({
      data: { room, caption: caption.trim(), file_path, file_mime: mime, sort_order: (last._max.sort_order ?? -1) + 1, created_by: req.user.id },
    });
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
    const { count } = await prisma.ruangFoto.updateMany({ where: { id }, data: { caption: caption.trim() } });
    if (!count) return res.status(404).json({ message: 'Foto tidak ditemukan.' });
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
    if (!validRoom(room) || !Array.isArray(ids) || ids.length > MAX_FOTO || !ids.every(Number.isInteger)) {
      return res.status(400).json({ message: 'Urutan foto tidak valid.' });
    }
    const current = await prisma.ruangFoto.findMany({ where: { room }, select: { id: true } });
    const sama = current.length === ids.length && new Set(ids).size === ids.length && current.every((f) => ids.includes(f.id));
    if (!sama) return res.status(409).json({ message: 'Daftar foto sudah berubah. Muat ulang halaman lalu coba lagi.' });
    await prisma.$transaction(ids.map((id, i) => prisma.ruangFoto.update({ where: { id }, data: { sort_order: i } })));
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
    if (!validRoom(room)) return res.status(400).json({ message: 'Ruangan tidak valid.' });
    if (!fasilitas) return res.status(400).json({ message: `Fasilitas tidak valid (maksimal ${MAX_FASILITAS}, nama maksimal 60 karakter).` });
    await prisma.ruangProfil.upsert({
      where: { room },
      create: { room, fasilitas, updated_by: req.user.id },
      update: { fasilitas, updated_by: req.user.id },
    });
    res.json({ data: fasilitas, message: 'Fasilitas disimpan.' });
  } catch (err) {
    logger.error('PUT fasilitas ruang gagal', { error: err });
    res.status(500).json({ message: 'Gagal menyimpan fasilitas.' });
  }
});

module.exports = router;
