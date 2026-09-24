const express = require('express');
const prisma = require('../prisma');
const { saveDataUrl } = require('../fileStorage');
const { isGenuineDocumentDataUrl } = require('../fileSignature');
const { requireAuth, requireRole, EDITOR_ROLES } = require('../middleware/auth');
const { requireNotInMaintenance } = require('../middleware/maintenance');
const logger = require('../logger');

const router = express.Router();
router.use(requireAuth);
router.use(requireNotInMaintenance('kendaraan'));

const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // foto sudah dikompres di client, 4MB base64 cukup longgar
const MAX_PHOTOS = 6;
const MAX_DOCUMENT_BYTES = 12 * 1024 * 1024; // dokumen BPKB/STNK (PDF hasil scan)
const STATUS = ['Tersedia', 'Digunakan', 'Servis'];
// Kategori "Nama Barang" mengikuti nomenklatur BMN untuk alat angkutan darat bermotor.
const NAMA_BARANG = ['Sedan', 'Jeep', 'Station Wagon', 'Micro Bus', 'Mini Bus', 'Pick Up', 'Mobil Ambulance', 'Kendaraan Bermotor Khusus Lainnya', 'Sepeda Motor'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const text = (v, m, req = false) => (v == null || v === '') ? !req : typeof v === 'string' && v.trim().length > 0 && v.length <= m;
const validDate = (v) => v == null || v === '' || DATE_RE.test(v);
const toDate = (v) => (v == null || v === '') ? null : new Date(`${v}T00:00:00Z`);
const dateOnly = (v) => v == null ? null : v.toISOString().slice(0, 10);

function parsePhotos(row) {
  let photos = [];
  try { photos = row.photos ? JSON.parse(row.photos) : []; } catch { photos = []; }
  return photos;
}
// Frontend cuma butuh preview + nama; array asli (dengan base64) tetap dikirim
// supaya galeri foto kendaraan bisa langsung ditampilkan tanpa request tambahan.
const serialize = (row) => row ? ({
  ...row,
  tanggal_perolehan: dateOnly(row.tanggal_perolehan),
  masa_berlaku_stnk: dateOnly(row.masa_berlaku_stnk),
  waktu_pajak: dateOnly(row.waktu_pajak),
  photos: parsePhotos(row),
  photo_file_paths: undefined,
}) : row;

// Validasi array foto: maks 6, tiap item {name, data} dan `data`-nya benar-benar
// gambar asli (magic number dicek lewat isGenuineDocumentDataUrl), bukan cuma
// klaim Content-Type dari client.
function validatePhotos(photos) {
  if (photos === undefined) return { ok: true, items: undefined };
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS) return { ok: false };
  for (const p of photos) {
    if (!p || typeof p.name !== 'string' || p.name.length > 255) return { ok: false };
    if (!isGenuineDocumentDataUrl(p.data, MAX_PHOTO_BYTES)) return { ok: false };
  }
  return { ok: true, items: photos };
}

// Dokumen BPKB/STNK: kalau `data` dikirim, harus PDF asli (magic number
// dicek lewat isGenuineDocumentDataUrl) dan `name`-nya wajib ada.
function validDocument(name, data) {
  if (data === undefined) return true;
  if (data == null || data === '') return true; // sengaja dikosongkan/dihapus (form kirim '' kalau tidak ada file)
  if (typeof name !== 'string' || !name.trim() || name.length > 255) return false;
  return isGenuineDocumentDataUrl(data, MAX_DOCUMENT_BYTES);
}

router.get('/', async (req, res) => {
  try {
    // PDF BPKB/STNK tidak ikut di daftar (bisa belasan MB per kendaraan); diambil lewat GET /:id saat detail dibuka.
    const rows = await prisma.kendaraan.findMany({ omit: { bpkb_document_file_data: true, stnk_document_file_data: true }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });
    res.json({ data: rows.map(serialize) });
  } catch (err) {
    logger.error('GET kendaraan gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil data kendaraan.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID kendaraan tidak valid.' });
    const row = await prisma.kendaraan.findUnique({ where: { id } });
    if (!row) return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    res.json({ data: serialize(row) });
  } catch (err) {
    logger.error('GET kendaraan detail gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil data kendaraan.' });
  }
});

router.post('/', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const { nama_barang, merk, tipe, no_bpkb, plate, plat_khusus, jenis, sub, status, tanggal_perolehan, masa_berlaku_stnk, waktu_pajak, photos, bpkb_document_name, bpkb_document_file_data, stnk_document_name, stnk_document_file_data } = req.body;

    if (!text(nama_barang, 150, true) || !text(merk, 100, true) || !text(tipe, 100, true) || !text(plate, 30, true) || !text(jenis, 30, true)) {
      return res.status(400).json({ message: 'Nama barang, merk, tipe, nomor polisi, dan jenis wajib diisi.' });
    }
    if (!NAMA_BARANG.includes(nama_barang)) return res.status(400).json({ message: 'Nama barang tidak valid.' });
    if (!STATUS.includes(status || 'Tersedia')) return res.status(400).json({ message: 'Status kendaraan tidak valid.' });
    if (no_bpkb != null && !text(no_bpkb, 50)) return res.status(400).json({ message: 'Nomor BPKB tidak valid.' });
    if (plat_khusus != null && !text(plat_khusus, 30)) return res.status(400).json({ message: 'Plat khusus tidak valid.' });
    if (!validDate(tanggal_perolehan) || !validDate(masa_berlaku_stnk) || !validDate(waktu_pajak)) {
      return res.status(400).json({ message: 'Format tanggal tidak valid.' });
    }
    const photoCheck = validatePhotos(photos);
    if (!photoCheck.ok) return res.status(400).json({ message: 'Foto kendaraan tidak valid (maksimal 6 foto, harus gambar asli).' });
    const photoItems = photoCheck.items || [];
    if (!validDocument(bpkb_document_name, bpkb_document_file_data)) return res.status(400).json({ message: 'Dokumen BPKB tidak valid (harus PDF asli).' });
    if (!validDocument(stnk_document_name, stnk_document_file_data)) return res.status(400).json({ message: 'Dokumen STNK tidak valid (harus PDF asli).' });

    const savedPaths = [];
    for (const p of photoItems) savedPaths.push({ name: p.name, path: await saveDataUrl(p.data, p.name, 'kendaraan') });
    const bpkbPath = bpkb_document_file_data ? await saveDataUrl(bpkb_document_file_data, bpkb_document_name, 'kendaraan/bpkb') : null;
    const stnkPath = stnk_document_file_data ? await saveDataUrl(stnk_document_file_data, stnk_document_name, 'kendaraan/stnk') : null;

    const row = await prisma.kendaraan.create({
      data: {
        nama_barang: nama_barang.trim(),
        merk: merk.trim(),
        tipe: tipe.trim(),
        no_bpkb: no_bpkb ? no_bpkb.trim() : null,
        plate: plate.trim(),
        plat_khusus: plat_khusus ? plat_khusus.trim() : null,
        jenis: jenis.trim(),
        sub: sub || null,
        status: status || 'Tersedia',
        tanggal_perolehan: toDate(tanggal_perolehan),
        masa_berlaku_stnk: toDate(masa_berlaku_stnk),
        waktu_pajak: toDate(waktu_pajak),
        photos: photoItems.length ? JSON.stringify(photoItems) : null,
        photo_file_paths: savedPaths.length ? JSON.stringify(savedPaths) : null,
        bpkb_document_name: bpkb_document_file_data ? bpkb_document_name : null,
        bpkb_document_file_data: bpkb_document_file_data || null,
        bpkb_document_file_path: bpkbPath,
        stnk_document_name: stnk_document_file_data ? stnk_document_name : null,
        stnk_document_file_data: stnk_document_file_data || null,
        stnk_document_file_path: stnkPath,
        created_by: req.user.id,
        updated_by: req.user.id,
      },
    });
    res.status(201).json({ data: serialize(row) });
  } catch (err) {
    logger.error('POST kendaraan gagal', { error: err });
    if (err.code === 'P2002') return res.status(409).json({ message: 'Nomor polisi sudah terdaftar.' });
    res.status(500).json({ message: 'Gagal menambahkan kendaraan.' });
  }
});

router.put('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID kendaraan tidak valid.' });
    const body = { ...req.body };

    if (body.status !== undefined && !STATUS.includes(body.status)) return res.status(400).json({ message: 'Status kendaraan tidak valid.' });
    if (body.no_bpkb !== undefined && body.no_bpkb != null && !text(body.no_bpkb, 50)) return res.status(400).json({ message: 'Nomor BPKB tidak valid.' });
    if (body.plat_khusus !== undefined && body.plat_khusus != null && !text(body.plat_khusus, 30)) return res.status(400).json({ message: 'Plat khusus tidak valid.' });
    for (const f of ['tanggal_perolehan', 'masa_berlaku_stnk', 'waktu_pajak']) {
      if (body[f] !== undefined && !validDate(body[f])) return res.status(400).json({ message: 'Format tanggal tidak valid.' });
    }
    const photoCheck = validatePhotos(body.photos);
    if (!photoCheck.ok) return res.status(400).json({ message: 'Foto kendaraan tidak valid (maksimal 6 foto, harus gambar asli).' });
    if (!validDocument(body.bpkb_document_name, body.bpkb_document_file_data)) return res.status(400).json({ message: 'Dokumen BPKB tidak valid (harus PDF asli).' });
    if (!validDocument(body.stnk_document_name, body.stnk_document_file_data)) return res.status(400).json({ message: 'Dokumen STNK tidak valid (harus PDF asli).' });

    const data = {};
    for (const f of ['nama_barang', 'merk', 'tipe', 'no_bpkb', 'plate', 'plat_khusus', 'jenis', 'sub', 'status']) {
      if (body[f] !== undefined) data[f] = typeof body[f] === 'string' ? body[f].trim() || null : body[f];
    }
    for (const f of ['tanggal_perolehan', 'masa_berlaku_stnk', 'waktu_pajak']) {
      if (body[f] !== undefined) data[f] = toDate(body[f]);
    }
    if (data.nama_barang !== undefined && (!text(data.nama_barang, 150, true) || !NAMA_BARANG.includes(data.nama_barang))) return res.status(400).json({ message: 'Nama barang tidak valid.' });
    if (data.merk !== undefined && !text(data.merk, 100, true)) return res.status(400).json({ message: 'Merk tidak valid.' });
    if (data.tipe !== undefined && !text(data.tipe, 100, true)) return res.status(400).json({ message: 'Tipe tidak valid.' });
    if (data.plate !== undefined && !text(data.plate, 30, true)) return res.status(400).json({ message: 'Nomor polisi tidak valid.' });
    if (data.jenis !== undefined && !text(data.jenis, 30, true)) return res.status(400).json({ message: 'Jenis kendaraan tidak valid.' });

    if (photoCheck.items !== undefined) {
      const savedPaths = [];
      for (const p of photoCheck.items) savedPaths.push({ name: p.name, path: await saveDataUrl(p.data, p.name, 'kendaraan') });
      data.photos = photoCheck.items.length ? JSON.stringify(photoCheck.items) : null;
      data.photo_file_paths = savedPaths.length ? JSON.stringify(savedPaths) : null;
    }
    if (body.bpkb_document_file_data !== undefined) {
      data.bpkb_document_name = body.bpkb_document_file_data ? body.bpkb_document_name : null;
      data.bpkb_document_file_data = body.bpkb_document_file_data || null;
      data.bpkb_document_file_path = body.bpkb_document_file_data ? await saveDataUrl(body.bpkb_document_file_data, body.bpkb_document_name, 'kendaraan/bpkb') : null;
    }
    if (body.stnk_document_file_data !== undefined) {
      data.stnk_document_name = body.stnk_document_file_data ? body.stnk_document_name : null;
      data.stnk_document_file_data = body.stnk_document_file_data || null;
      data.stnk_document_file_path = body.stnk_document_file_data ? await saveDataUrl(body.stnk_document_file_data, body.stnk_document_name, 'kendaraan/stnk') : null;
    }

    if (!Object.keys(data).length) return res.status(400).json({ message: 'Tidak ada field yang diubah.' });
    data.updated_by = req.user.id;
    const row = await prisma.kendaraan.update({ where: { id }, data });
    res.json({ data: serialize(row) });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    if (err.code === 'P2002') return res.status(409).json({ message: 'Nomor polisi sudah terdaftar.' });
    logger.error('PUT kendaraan gagal', { error: err });
    res.status(500).json({ message: 'Gagal memperbarui kendaraan.' });
  }
});

router.delete('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID kendaraan tidak valid.' });
    await prisma.kendaraan.delete({ where: { id } });
    res.json({ message: 'Kendaraan berhasil dihapus.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    logger.error('DELETE kendaraan gagal', { error: err });
    res.status(500).json({ message: 'Gagal menghapus kendaraan.' });
  }
});

module.exports = router;
