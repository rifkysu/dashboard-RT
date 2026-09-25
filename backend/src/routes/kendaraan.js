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
// Dokumen PDF per kendaraan: <prefix>_document_name / _file_data / _file_path.
// Riwayat service + invoice-nya disimpan di tabel kendaraan_service (lihat bagian bawah file).
const DOCUMENTS = [
  { prefix: 'bpkb', label: 'BPKB', folder: 'kendaraan/bpkb' },
  { prefix: 'stnk', label: 'STNK', folder: 'kendaraan/stnk' },
];

const text = (v, m, req = false) => (v == null || v === '') ? !req : typeof v === 'string' && v.trim().length > 0 && v.length <= m;
const validDate = (v) => v == null || v === '' || realDate(v); // realDate: tolak tanggal yang tidak ada (2026-02-31, 2026-13-01)
const toDate = (v) => (v == null || v === '') ? null : new Date(`${v}T00:00:00Z`);
const dateOnly = (v) => v == null ? null : v.toISOString().slice(0, 10);
const todayJakarta = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
// Tanggal YYYY-MM-DD yang benar-benar ada di kalender (tolak 2026-02-31 dsb).
const realDate = (v) => typeof v === 'string' && DATE_RE.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const parseId = (v) => { const n = Number(v); return Number.isInteger(n) && n > 0 && n <= 2147483647 ? n : null; };

function parsePhotos(row) {
  let photos = [];
  try { photos = row.photos ? JSON.parse(row.photos) : []; } catch { photos = []; }
  return photos;
}
// Path file di disk tidak pernah dikirim ke client.
const serializeService = (row) => row ? ({ ...row, tanggal_service: dateOnly(row.tanggal_service), invoice_document_file_path: undefined }) : row;
// Service terakhir + jumlah riwayat, ditampilkan di tabel daftar kendaraan.
const WITH_SERVICE_SUMMARY = {
  services: { select: { id: true, tanggal_service: true }, orderBy: [{ tanggal_service: 'desc' }, { id: 'desc' }], take: 1 },
  _count: { select: { services: true } },
};

// Frontend cuma butuh preview + nama; array asli (dengan base64) tetap dikirim
// supaya galeri foto kendaraan bisa langsung ditampilkan tanpa request tambahan.
const serialize = (row) => {
  if (!row) return row;
  const { services, _count, ...rest } = row;
  const last = services?.[0];
  return {
    ...rest,
    tanggal_perolehan: dateOnly(row.tanggal_perolehan),
    masa_berlaku_stnk: dateOnly(row.masa_berlaku_stnk),
    waktu_pajak: dateOnly(row.waktu_pajak),
    photos: parsePhotos(row),
    photo_file_paths: undefined,
    service_count: _count?.services ?? 0,
    last_service: last ? { id: last.id, tanggal_service: dateOnly(last.tanggal_service) } : null,
  };
};

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
    const rows = await prisma.kendaraan.findMany({
      omit: { bpkb_document_file_data: true, stnk_document_file_data: true },
      include: WITH_SERVICE_SUMMARY,
      orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
    });
    res.json({ data: rows.map(serialize) });
  } catch (err) {
    logger.error('GET kendaraan gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil data kendaraan.' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID kendaraan tidak valid.' });
    const row = await prisma.kendaraan.findUnique({ where: { id }, include: WITH_SERVICE_SUMMARY });
    if (!row) return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    res.json({ data: serialize(row) });
  } catch (err) {
    logger.error('GET kendaraan detail gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil data kendaraan.' });
  }
});

router.post('/', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const { nama_barang, merk, tipe, no_bpkb, plate, plat_khusus, jenis, sub, status, tanggal_perolehan, masa_berlaku_stnk, waktu_pajak, photos } = req.body;

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
    for (const doc of DOCUMENTS) {
      if (!validDocument(req.body[`${doc.prefix}_document_name`], req.body[`${doc.prefix}_document_file_data`])) {
        return res.status(400).json({ message: `Dokumen ${doc.label} tidak valid (harus PDF asli).` });
      }
    }

    const savedPaths = [];
    for (const p of photoItems) savedPaths.push({ name: p.name, path: await saveDataUrl(p.data, p.name, 'kendaraan') });
    const docData = {};
    for (const doc of DOCUMENTS) {
      const name = req.body[`${doc.prefix}_document_name`];
      const fileData = req.body[`${doc.prefix}_document_file_data`];
      docData[`${doc.prefix}_document_name`] = fileData ? name : null;
      docData[`${doc.prefix}_document_file_data`] = fileData || null;
      docData[`${doc.prefix}_document_file_path`] = fileData ? await saveDataUrl(fileData, name, doc.folder) : null;
    }

    const row = await prisma.kendaraan.create({
      include: WITH_SERVICE_SUMMARY,
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
        ...docData,
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
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID kendaraan tidak valid.' });
    const body = { ...req.body };

    if (body.status !== undefined && !STATUS.includes(body.status)) return res.status(400).json({ message: 'Status kendaraan tidak valid.' });
    if (body.no_bpkb !== undefined && body.no_bpkb != null && !text(body.no_bpkb, 50)) return res.status(400).json({ message: 'Nomor BPKB tidak valid.' });
    if (body.plat_khusus !== undefined && body.plat_khusus != null && !text(body.plat_khusus, 30)) return res.status(400).json({ message: 'Plat khusus tidak valid.' });
    for (const f of ['tanggal_perolehan', 'masa_berlaku_stnk', 'waktu_pajak']) {
      if (body[f] !== undefined && !validDate(body[f])) return res.status(400).json({ message: 'Format tanggal tidak valid.' });
    }
    const photoCheck = validatePhotos(body.photos);
    if (!photoCheck.ok) return res.status(400).json({ message: 'Foto kendaraan tidak valid (maksimal 6 foto, harus gambar asli).' });
    for (const doc of DOCUMENTS) {
      if (!validDocument(body[`${doc.prefix}_document_name`], body[`${doc.prefix}_document_file_data`])) {
        return res.status(400).json({ message: `Dokumen ${doc.label} tidak valid (harus PDF asli).` });
      }
    }

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
    for (const doc of DOCUMENTS) {
      const fileData = body[`${doc.prefix}_document_file_data`];
      if (fileData === undefined) continue;
      const name = body[`${doc.prefix}_document_name`];
      data[`${doc.prefix}_document_name`] = fileData ? name : null;
      data[`${doc.prefix}_document_file_data`] = fileData || null;
      data[`${doc.prefix}_document_file_path`] = fileData ? await saveDataUrl(fileData, name, doc.folder) : null;
    }

    if (!Object.keys(data).length) return res.status(400).json({ message: 'Tidak ada field yang diubah.' });
    data.updated_by = req.user.id;
    const row = await prisma.kendaraan.update({ where: { id }, data, include: WITH_SERVICE_SUMMARY });
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
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID kendaraan tidak valid.' });
    await prisma.kendaraan.delete({ where: { id } });
    res.json({ message: 'Kendaraan berhasil dihapus.' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    logger.error('DELETE kendaraan gagal', { error: err });
    res.status(500).json({ message: 'Gagal menghapus kendaraan.' });
  }
});

// ---------- Riwayat service ----------
// Catat tanggal kapan kendaraan diservis, bagian apa yang diservis + invoice PDF (opsional).
// PDF tidak ikut di daftar; hanya bisa diambil user yang login lewat
// GET /:id/services/:serviceId (folder uploads tidak di-expose publik).

const SERVICE_FOLDER = 'kendaraan/service';
const SERVICE_RESPONSE = {
  omit: { invoice_document_file_data: true, invoice_document_file_path: true },
  include: { createdBy: { select: { nama_lengkap: true } } },
};

// Invoice wajib PDF asli + nama file. Mengembalikan pesan error atau null.
function invoiceError(name, data) {
  if (typeof data !== 'string' || !data) return 'File invoice PDF wajib dipilih.';
  if (!validDocument(name, data)) return 'Invoice service tidak valid (harus PDF asli, maks. 12MB).';
  return null;
}

router.get('/:id/services', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID kendaraan tidak valid.' });
    const vehicle = await prisma.kendaraan.findUnique({ where: { id }, select: { id: true } });
    if (!vehicle) return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    const rows = await prisma.kendaraanService.findMany({
      where: { kendaraan_id: id },
      ...SERVICE_RESPONSE,
      orderBy: [{ tanggal_service: 'desc' }, { id: 'desc' }],
    });
    res.json({ data: rows.map(serializeService) });
  } catch (err) {
    logger.error('GET riwayat service kendaraan gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil riwayat service.' });
  }
});

router.post('/:id/services', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ message: 'ID kendaraan tidak valid.' });
    const body = req.body || {};
    const tanggal = body.tanggal_service;
    if (!realDate(tanggal)) return res.status(400).json({ message: 'Tanggal service wajib diisi dengan tanggal yang valid.' });
    if (tanggal > todayJakarta()) return res.status(400).json({ message: 'Tanggal service tidak boleh melebihi hari ini.' });
    if (!text(body.bagian_service, 255, true)) return res.status(400).json({ message: 'Bagian yang diservis wajib diisi (maksimal 255 karakter).' });
    // Invoice opsional saat tambah service; kalau dikirim harus PDF asli.
    const withInvoice = body.invoice_document_file_data != null && body.invoice_document_file_data !== '';
    if (withInvoice) {
      const bad = invoiceError(body.invoice_document_name, body.invoice_document_file_data);
      if (bad) return res.status(400).json({ message: bad });
    }
    const vehicle = await prisma.kendaraan.findUnique({ where: { id }, select: { id: true } });
    if (!vehicle) return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    const duplicate = await prisma.kendaraanService.findFirst({ where: { kendaraan_id: id, tanggal_service: toDate(tanggal) }, select: { id: true } });
    if (duplicate) return res.status(409).json({ message: 'Service pada tanggal tersebut sudah tercatat.' });

    const invoice = withInvoice ? {
      invoice_document_name: body.invoice_document_name.trim(),
      invoice_document_file_data: body.invoice_document_file_data,
      invoice_document_file_path: await saveDataUrl(body.invoice_document_file_data, body.invoice_document_name, SERVICE_FOLDER),
    } : {};
    const row = await prisma.kendaraanService.create({
      data: { kendaraan_id: id, tanggal_service: toDate(tanggal), bagian_service: body.bagian_service.trim(), ...invoice, created_by: req.user.id, updated_by: req.user.id },
      ...SERVICE_RESPONSE,
    });
    res.status(201).json({ data: serializeService(row) });
  } catch (err) {
    // Kendaraan dihapus di antara pengecekan & insert -> FK gagal.
    if (err.code === 'P2003') return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    // Dua request bersamaan untuk tanggal yang sama -> ditahan unique constraint DB.
    if (err.code === 'P2002') return res.status(409).json({ message: 'Service pada tanggal tersebut sudah tercatat.' });
    logger.error('POST riwayat service gagal', { error: err });
    res.status(500).json({ message: 'Gagal menambahkan riwayat service.' });
  }
});

// Isi PDF invoice satu riwayat service -- dipanggil saat tombol "Lihat PDF" diklik.
router.get('/:id/services/:serviceId/invoice', async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const serviceId = parseId(req.params.serviceId);
    if (!id || !serviceId) return res.status(400).json({ message: 'ID tidak valid.' });
    const row = await prisma.kendaraanService.findFirst({
      where: { id: serviceId, kendaraan_id: id },
      select: { invoice_document_name: true, invoice_document_file_data: true },
    });
    if (!row) return res.status(404).json({ message: 'Riwayat service tidak ditemukan.' });
    if (!row.invoice_document_file_data) return res.status(404).json({ message: 'Riwayat service ini belum punya invoice PDF.' });
    res.set('Cache-Control', 'no-store');
    res.json({ data: row });
  } catch (err) {
    logger.error('GET invoice riwayat service gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil invoice service.' });
  }
});

// Upload / ganti invoice PDF untuk riwayat service yang sudah ada.
router.put('/:id/services/:serviceId/invoice', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const serviceId = parseId(req.params.serviceId);
    if (!id || !serviceId) return res.status(400).json({ message: 'ID tidak valid.' });
    const { invoice_document_name: name, invoice_document_file_data: data } = req.body || {};
    const bad = invoiceError(name, data);
    if (bad) return res.status(400).json({ message: bad });
    const existing = await prisma.kendaraanService.findFirst({ where: { id: serviceId, kendaraan_id: id }, select: { id: true } });
    if (!existing) return res.status(404).json({ message: 'Riwayat service tidak ditemukan.' });

    const row = await prisma.kendaraanService.update({
      where: { id: serviceId },
      data: {
        invoice_document_name: name.trim(),
        invoice_document_file_data: data,
        invoice_document_file_path: await saveDataUrl(data, name, SERVICE_FOLDER),
        updated_by: req.user.id,
      },
      ...SERVICE_RESPONSE,
    });
    res.json({ data: serializeService(row) });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Riwayat service tidak ditemukan.' });
    logger.error('PUT invoice riwayat service gagal', { error: err });
    res.status(500).json({ message: 'Gagal menyimpan invoice service.' });
  }
});

router.delete('/:id/services/:serviceId', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const id = parseId(req.params.id);
    const serviceId = parseId(req.params.serviceId);
    if (!id || !serviceId) return res.status(400).json({ message: 'ID tidak valid.' });
    const { count } = await prisma.kendaraanService.deleteMany({ where: { id: serviceId, kendaraan_id: id } });
    if (!count) return res.status(404).json({ message: 'Riwayat service tidak ditemukan.' });
    res.json({ message: 'Riwayat service berhasil dihapus.' });
  } catch (err) {
    logger.error('DELETE riwayat service gagal', { error: err });
    res.status(500).json({ message: 'Gagal menghapus riwayat service.' });
  }
});

module.exports = router;
