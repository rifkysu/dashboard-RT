const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { saveDataUrl } = require('../fileStorage');
const { requireAuth, requireRole, EDITOR_ROLES } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();
router.use(requireAuth);

const MAX_DOCUMENT_DATA_LENGTH = 12 * 1024 * 1024;
const ALLOWED_DOCUMENT_PREFIXES = ['data:application/pdf;base64,', 'data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,', 'data:application/msword;base64,', 'data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,', 'data:application/vnd.ms-excel;base64,', 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,'];

function validDocumentData(value) {
  return value == null || (typeof value === 'string' && value.length <= MAX_DOCUMENT_DATA_LENGTH && ALLOWED_DOCUMENT_PREFIXES.some((prefix) => value.startsWith(prefix)));
}

function generateKode() {
  const rand = crypto.randomInt(1000, 10000);
  return `PGD-${new Date().getFullYear()}-${rand}`;
}

// GET /api/pengadaan -> semua role boleh melihat
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

    if (kategori) {
      values.push(kategori);
      conditions.push(`kategori = $${values.length}`);
    }
    if (lokasi) {
      values.push(lokasi);
      conditions.push(`lokasi = $${values.length}`);
    }
    if (status) {
      values.push(status);
      conditions.push(`status = $${values.length}`);
    }
    if (search) {
      values.push(`%${search}%`);
      conditions.push(`(nama_barang_jasa ILIKE $${values.length} OR kode ILIKE $${values.length})`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await pool.query(
      `SELECT g.*, g.tanggal::text AS tanggal, g.tanggal_selesai::text AS tanggal_selesai, u.nama_lengkap AS pic
       FROM pengadaan g
       LEFT JOIN users u ON u.id = g.created_by
       ${where}
       ORDER BY g.created_at DESC`,
      values
    );
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('GET pengadaan gagal', { error: err, query: req.query, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal mengambil data pengadaan.', error_code: err.code || 'DB_ERROR' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query('SELECT *, tanggal::text AS tanggal, tanggal_selesai::text AS tanggal_selesai FROM pengadaan WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Route error', { error: err, method: req.method, path: req.originalUrl, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal mengambil data.' });
  }
});

// POST /api/pengadaan -> karyawan boleh mengajukan pengadaan baru
router.post('/', async (req, res) => {
  try {
    const { nama_barang_jasa, kategori, lokasi, metode_pengadaan, nilai_hps, tanggal, deskripsi, request_document_name, request_document_file_data } = req.body;
    if (!nama_barang_jasa) {
      return res.status(400).json({ message: 'nama_barang_jasa wajib diisi.' });
    }
    if (!validDocumentData(request_document_file_data)) {
      return res.status(400).json({ message: 'Dokumen tidak valid. Gunakan PDF, JPG, PNG, atau WebP dengan ukuran maksimal 8MB.' });
    }

    const kode = generateKode();
    const request_document_file_path = request_document_file_data ? await saveDataUrl(request_document_file_data, request_document_name, 'pengadaan') : null;
    const result = await pool.query(
      `INSERT INTO pengadaan (kode, nama_barang_jasa, kategori, lokasi, metode_pengadaan, nilai_hps, tanggal, deskripsi, request_document_name, request_document_file_data, request_document_file_path, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,COALESCE($7, CURRENT_DATE),$8,$9,$10,$11,$12)
       RETURNING *`,
      [kode, nama_barang_jasa, kategori || null, lokasi || null, metode_pengadaan || null, nilai_hps || null, tanggal || null, deskripsi || null, request_document_name || null, request_document_file_data || null, request_document_file_path, req.user.id]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Route error', { error: err, method: req.method, path: req.originalUrl, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal membuat permintaan pengadaan.' });
  }
});

// PUT /api/pengadaan/:id -> HANYA kabag & pic (karyawan ditolak / 403)
router.put('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const { id } = req.params;
    const currentResult = await pool.query('SELECT *, tanggal::text AS tanggal, tanggal_selesai::text AS tanggal_selesai FROM pengadaan WHERE id = $1', [id]);
    if (currentResult.rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan.' });
    const current = currentResult.rows[0];

    // Tahapan pengadaan wajib berurutan, sama seperti Pemeliharaan.
    if (req.body.tahap2_status !== undefined && req.body.tahap2_status !== 'pending' && current.tahap1_status !== 'selesai' && req.body.tahap1_status !== 'selesai') {
      return res.status(400).json({ message: 'Tahap 1 harus diselesaikan terlebih dahulu.' });
    }
    if (req.body.tahap3_status !== undefined && req.body.tahap3_status !== 'pending' && current.tahap2_status !== 'selesai' && req.body.tahap2_status !== 'selesai') {
      return res.status(400).json({ message: 'Tahap 2 harus diselesaikan terlebih dahulu.' });
    }

    const fields = ['nama_barang_jasa','kategori','lokasi','metode_pengadaan','nilai_hps','stage2_vendor','stage2_invoice_number','stage2_invoice_date','stage2_invoice_amount',
                     'tanggal','tanggal_selesai','status','tahap1_status','tahap2_status','tahap3_status','catatan',
                     'stage2_invoice_document_name','stage2_invoice_file_data','stage2_invoice_file_path','stage2_payment_proof_name','stage2_payment_proof_file_data','stage2_payment_proof_file_path','stage3_final_document_name','stage3_final_document_file_data','stage3_final_document_file_path'];

    for (const field of ['request_document_file_data', 'stage2_invoice_file_data', 'stage2_payment_proof_file_data', 'stage3_final_document_file_data']) {
      if (req.body[field] !== undefined && !validDocumentData(req.body[field])) {
        return res.status(400).json({ message: 'Dokumen tidak valid. Gunakan PDF, JPG, PNG, atau WebP dengan ukuran maksimal 8MB.' });
      }
    }

    // Jika status menjadi selesai, catat tanggal selesai otomatis. Jika dibuka kembali, kosongkan tanggalnya.
    if (req.body.status === 'selesai') {
      // Sumber kebenaran tanggal selesai adalah database trigger.
      // Paksa nilai tanggal agar null dari frontend tidak dapat menghapusnya.
      const now = new Date();
      req.body.tanggal_selesai = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    } else if (req.body.status !== undefined) {
      // Pending / On Progress tidak boleh memiliki tanggal selesai.
      req.body.tanggal_selesai = null;
    }

    const pathFields = {
      request_document_file_data: ['request_document_file_path','request_document_name'],
      stage2_invoice_file_data: ['stage2_invoice_file_path','stage2_invoice_document_name'],
      stage2_payment_proof_file_data: ['stage2_payment_proof_file_path','stage2_payment_proof_name'],
      stage3_final_document_file_data: ['stage3_final_document_file_path','stage3_final_document_name'],
    };
    for (const [dataField, [pathField, nameField]] of Object.entries(pathFields)) {
      if (Object.prototype.hasOwnProperty.call(req.body, dataField) && req.body[dataField]) {
        req.body[pathField] = await saveDataUrl(req.body[dataField], req.body[nameField], 'pengadaan');
      }
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
      `UPDATE pengadaan SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Data tidak ditemukan.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('Route error', { error: err, method: req.method, path: req.originalUrl, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal memperbarui data pengadaan.' });
  }
});

router.delete('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    await pool.query('DELETE FROM pengadaan WHERE id = $1', [req.params.id]);
    res.json({ message: 'Data berhasil dihapus.' });
  } catch (err) {
    logger.error('Route error', { error: err, method: req.method, path: req.originalUrl, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal menghapus data.' });
  }
});

module.exports = router;
