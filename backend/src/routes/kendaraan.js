const express = require('express');
const pool = require('../db');
const { saveDataUrl } = require('../fileStorage');
const { requireAuth, requireRole, EDITOR_ROLES } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();
router.use(requireAuth);

const MAX_PHOTO_DATA_LENGTH = 8 * 1024 * 1024;
const ALLOWED_PHOTO_PREFIXES = ['data:image/jpeg;base64,', 'data:image/png;base64,', 'data:image/webp;base64,'];
const ALLOWED_STATUS = ['Tersedia', 'Digunakan', 'Servis'];

function validPhotoData(value) {
  return value == null || (typeof value === 'string' && value.length <= MAX_PHOTO_DATA_LENGTH && ALLOWED_PHOTO_PREFIXES.some((prefix) => value.startsWith(prefix)));
}

function validateText(value, max, required = false) {
  if (value == null || value === '') return !required;
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max;
}

router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM kendaraan ORDER BY created_at DESC, id DESC');
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('GET kendaraan gagal', { error: err, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal mengambil data kendaraan.' });
  }
});

router.post('/', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const { name, plate, type, sub, status, tax, next_tax, photo_name, photo_file_data } = req.body;
    if (!validateText(name, 150, true) || !validateText(plate, 30, true) || !validateText(type, 100, true)) {
      return res.status(400).json({ message: 'Nama kendaraan, nomor polisi, dan jenis wajib diisi.' });
    }
    if (!ALLOWED_STATUS.includes(status || 'Tersedia')) return res.status(400).json({ message: 'Status kendaraan tidak valid.' });
    if (!validPhotoData(photo_file_data)) return res.status(400).json({ message: 'Foto tidak valid. Gunakan JPG, PNG, atau WebP dengan ukuran maksimal 6MB.' });
    if (photo_name != null && !validateText(photo_name, 255)) return res.status(400).json({ message: 'Nama file foto tidak valid.' });

    const result = await pool.query(
      `INSERT INTO kendaraan (name, plate, type, sub, status, tax, next_tax, photo_name, photo_file_data, photo_file_path, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [name.trim(), plate.trim(), type.trim(), sub || null, status || 'Tersedia', tax || '-', next_tax || '-', photo_name || null, photo_file_data || null, photo_file_data ? await saveDataUrl(photo_file_data, photo_name, 'kendaraan') : null, req.user.id, req.user.id]
    );
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('POST kendaraan gagal', { error: err, user_id: req.user?.id });
    if (err.code === '23505') return res.status(409).json({ message: 'Nomor polisi sudah terdaftar.' });
    res.status(500).json({ message: 'Gagal menambahkan kendaraan.' });
  }
});

router.put('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const fields = ['name','plate','type','sub','status','tax','next_tax','photo_name','photo_file_data','photo_file_path'];
    if (req.body.status !== undefined && !ALLOWED_STATUS.includes(req.body.status)) return res.status(400).json({ message: 'Status kendaraan tidak valid.' });
    if (req.body.photo_file_data !== undefined && !validPhotoData(req.body.photo_file_data)) return res.status(400).json({ message: 'Foto tidak valid. Gunakan JPG, PNG, atau WebP dengan ukuran maksimal 6MB.' });
    if (req.body.photo_name !== undefined && !validateText(req.body.photo_name, 255)) return res.status(400).json({ message: 'Nama file foto tidak valid.' });

    const sets = [];
    const values = [];
    if (Object.prototype.hasOwnProperty.call(req.body, 'photo_file_data') && req.body.photo_file_data) {
      req.body.photo_file_path = await saveDataUrl(req.body.photo_file_data, req.body.photo_name, 'kendaraan');
    }
    for (const field of fields) {
      if (req.body[field] !== undefined) {
        if (['name','plate','type'].includes(field) && !validateText(req.body[field], field === 'type' ? 100 : field === 'plate' ? 30 : 150, true)) return res.status(400).json({ message: `Field ${field} tidak valid.` });
        values.push(req.body[field]);
        sets.push(`${field} = $${values.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ message: 'Tidak ada field yang diubah.' });
    values.push(req.user.id); sets.push(`updated_by = $${values.length}`);
    values.push(req.params.id);
    const result = await pool.query(`UPDATE kendaraan SET ${sets.join(', ')} WHERE id = $${values.length} RETURNING *`, values);
    if (!result.rows.length) return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    res.json({ data: result.rows[0] });
  } catch (err) {
    logger.error('PUT kendaraan gagal', { error: err, user_id: req.user?.id });
    if (err.code === '23505') return res.status(409).json({ message: 'Nomor polisi sudah terdaftar.' });
    res.status(500).json({ message: 'Gagal memperbarui kendaraan.' });
  }
});

router.delete('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM kendaraan WHERE id = $1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Kendaraan tidak ditemukan.' });
    res.json({ message: 'Kendaraan berhasil dihapus.' });
  } catch (err) {
    logger.error('DELETE kendaraan gagal', { error: err, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal menghapus kendaraan.' });
  }
});

module.exports = router;
