const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { requireAuth, requireRole, EDITOR_ROLES } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();

const MAX_DOCUMENT_DATA_LENGTH = 12 * 1024 * 1024;
const ALLOWED_DOCUMENT_PREFIXES = ['data:application/pdf;base64,', 'data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'];
function validDocumentData(value) { return value == null || (typeof value === 'string' && value.length <= MAX_DOCUMENT_DATA_LENGTH && ALLOWED_DOCUMENT_PREFIXES.some((prefix) => value.startsWith(prefix))); }
router.use(requireAuth); // semua endpoint di bawah ini wajib login

function generateKode() {
  const rand = crypto.randomInt(1000, 10000);
  return `REQ-${new Date().getFullYear()}-${rand}`;
}

// ---------------------------------------------------------
// GET /api/pemeliharaan
// Semua role (karyawan, kabag, pic) boleh MELIHAT daftar.
// ---------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { status, kategori, lokasi, search } = req.query;
    const conditions = [];
    const values = [];

    for (const [key, value] of Object.entries(req.query)) {
      if (!['status','kategori','lokasi','search'].includes(key)) {
        return res.status(400).json({ message: `Parameter filter tidak dikenal: ${key}` });
      }
      if (typeof value !== 'string' || value.length > 150) {
        return res.status(400).json({ message: 'Parameter filter terlalu panjang atau tidak valid.' });
      }
    }

    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (kategori) {
      values.push(kategori);
      conditions.push(`LOWER(TRIM(kategori)) = LOWER(TRIM($${values.length}))`);
    }
    if (lokasi) {
      values.push(lokasi);
      conditions.push(`LOWER(TRIM(lokasi)) = LOWER(TRIM($${values.length}))`);
    }
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(judul ILIKE $${values.length} OR kode ILIKE $${values.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT p.*, p.tanggal::text AS tanggal, p.tanggal_selesai::text AS tanggal_selesai, u.nama_lengkap AS pic
       FROM pemeliharaan p
       LEFT JOIN users u ON u.id = p.created_by
       ${where}
       ORDER BY p.created_at DESC`,
      values
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('GET pemeliharaan gagal', { error: err, query: req.query, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal mengambil data pemeliharaan.', error_code: err.code || 'DB_ERROR' });
  }
});

// GET /api/pemeliharaan/:id
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT *, tanggal::text AS tanggal, tanggal_selesai::text AS tanggal_selesai FROM pemeliharaan WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Route error', { error: err, method: req.method, path: req.originalUrl, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal mengambil data.' });
  }
});

// ---------------------------------------------------------
// POST /api/pemeliharaan
// Karyawan BOLEH membuat permintaan baru (ini bukan "edit" data
// yang sudah ada, tapi mengajukan permintaan baru).
// ---------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { judul, lokasi, titik_lokasi, kategori, deskripsi, tanggal, jenis_pekerjaan, urgensi, metode_pengadaan, request_document_name, request_document_file_data } = req.body;
    if (!judul || !lokasi || !kategori) {
      return res.status(400).json({ message: 'judul, lokasi, dan kategori wajib diisi.' });
    }

    if (request_document_file_data !== undefined && !validDocumentData(request_document_file_data)) {
      return res.status(400).json({ message: 'Dokumen permintaan tidak valid. Gunakan PDF, JPG, PNG/WebP dengan ukuran maksimal 8MB.' });
    }

    const kode = generateKode();
    const result = await pool.query(
      `INSERT INTO pemeliharaan (kode, judul, lokasi, titik_lokasi, kategori, deskripsi, tanggal, jenis_pekerjaan, urgensi, metode_pengadaan, request_document_name, request_document_file_data, created_by)
       VALUES ($1,$2,$3,$4,$5,$6, COALESCE($7, CURRENT_DATE), $8, COALESCE($9, 'sedang'), $10, $11, $12, $13)
       RETURNING *`,
      [kode, judul, lokasi, titik_lokasi || null, kategori, deskripsi || null, tanggal || null, jenis_pekerjaan || null, urgensi || 'sedang', metode_pengadaan || null, request_document_name || null, request_document_file_data || null, req.user.id]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Route error', { error: err, method: req.method, path: req.originalUrl, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal membuat permintaan pemeliharaan.' });
  }
});

// ---------------------------------------------------------
// PUT /api/pemeliharaan/:id
// HANYA kabag & pic (EDITOR_ROLES) yang boleh mengedit data
// dan memproses tahapan alur (Analisa/HPS, Invoice, BAST).
// Karyawan yang mencoba endpoint ini akan mendapat 403.
// ---------------------------------------------------------
router.put('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const fields = ['judul','lokasi','titik_lokasi','kategori','deskripsi','tanggal','status',
                     'tahap1_status','tahap2_status','tahap3_status','tanggal_selesai','catatan',
                     'jenis_pekerjaan','urgensi','metode_pengadaan','request_document_name','request_document_file_data','stage1_boq','stage1_boq_file_data','stage1_hps','stage1_document_name','stage1_document_file_data',
                     'stage2_payment_method','stage2_vendor','stage2_invoice_number','stage2_invoice_date','stage2_invoice_amount','stage2_invoice_document_name','stage2_invoice_document_file_data',
                     'stage3_documentation_names','stage3_documentation_files','stage3_bast_notes'];

    // Tanggal selesai otomatis tercatat saat status pekerjaan menjadi selesai.
    if (req.body.status === 'selesai' && req.body.tanggal_selesai === undefined) {
      req.body.tanggal_selesai = new Date().toISOString().slice(0, 10);
    }
    if (req.body.status && req.body.status !== 'selesai' && req.body.tanggal_selesai === undefined) {
      req.body.tanggal_selesai = null;
    }

    for (const field of ['request_document_file_data','stage1_boq_file_data','stage1_document_file_data','stage2_invoice_document_file_data']) {
      if (req.body[field] !== undefined && !validDocumentData(req.body[field])) return res.status(400).json({ message: 'Dokumen tidak valid. Gunakan PDF, JPG, PNG/WebP dengan ukuran maksimal 8MB.' });
    }
    if (req.body.stage3_documentation_files !== undefined) {
      try {
        const files = typeof req.body.stage3_documentation_files === 'string' ? JSON.parse(req.body.stage3_documentation_files) : req.body.stage3_documentation_files;
        if (!Array.isArray(files) || files.length > 20 || files.some((f) => !f || typeof f.name !== 'string' || !validDocumentData(f.data))) return res.status(400).json({ message: 'Dokumentasi final tidak valid.' });
      } catch { return res.status(400).json({ message: 'Format dokumentasi final tidak valid.' }); }
    }

    const sets = [];
    const values = [];
    fields.forEach((f) => {
      if (req.body[f] !== undefined) {
        values.push(req.body[f]);
        sets.push(`${f} = $${values.length}`);
      }
    });

    if (sets.length === 0) {
      return res.status(400).json({ message: 'Tidak ada field yang diubah.' });
    }

    values.push(req.user.id);
    sets.push(`updated_by = $${values.length}`);

    values.push(id);
    const result = await pool.query(
      `UPDATE pemeliharaan SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Route error', { error: err, method: req.method, path: req.originalUrl, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal memperbarui data pemeliharaan.' });
  }
});

// DELETE /api/pemeliharaan/:id -> hanya kabag & pic
router.delete('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    await pool.query('DELETE FROM pemeliharaan WHERE id = $1', [req.params.id]);
    res.json({ message: 'Data berhasil dihapus.' });
  } catch (err) {
    logger.error('Route error', { error: err, method: req.method, path: req.originalUrl, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal menghapus data.' });
  }
});

module.exports = router;
