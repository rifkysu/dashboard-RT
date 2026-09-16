const express = require('express');
const pool = require('../db');
const { requireAuth, requireRole, EDITOR_ROLES } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();
router.use(requireAuth);

const ALLOWED_STATUS = ['belum', 'ditinjau', 'diterima'];
const MAX_TEXT = 255;
const MAX_FILE_DATA_LENGTH = 8 * 1024 * 1024;
const ALLOWED_FILE_PREFIXES = ['data:application/pdf;base64,', 'data:image/jpeg;base64,', 'data:image/png;base64,'];
const VALID_ROOMS = [
  'Ruang Rapat Utama (Kapasitas 50)',
  'Ruang Rapat Nusantara (Kapasitas 20)',
  'Ruang VIP Eksekutif (Kapasitas 10)',
  'Ruang Diskusi Mini (Kapasitas 5)',
];

function validText(v, max = MAX_TEXT) { return typeof v === 'string' && v.trim().length > 0 && v.length <= max; }
function validDate(v) { return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v); }
function validTime(v) { return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v); }
function validFileData(v) { return v == null || (typeof v === 'string' && v.length <= MAX_FILE_DATA_LENGTH && ALLOWED_FILE_PREFIXES.some((prefix) => v.startsWith(prefix))); }

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`SELECT id, agenda AS title, room, pic, booking_date AS date,
      TO_CHAR(start_time, 'HH24:MI') AS start, TO_CHAR(end_time, 'HH24:MI') AS end,
      surat_status AS status, surat_name, surat_file_data, created_at, updated_at FROM ruang_rapat ORDER BY booking_date, start_time, id`);
    res.json({ data: result.rows });
  } catch (err) {
    logger.error('GET ruang rapat gagal', { error: err, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal mengambil jadwal ruang rapat.' });
  }
});

router.post('/', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const { title, room, pic, date, start, end, status, surat_name, surat_file_data } = req.body;
    if (!validText(title) || !validText(room) || !validText(pic, 150) || !validDate(date) || !validTime(start) || !validTime(end)) {
      return res.status(400).json({ message: 'Agenda, ruangan, PIC, tanggal, jam mulai, dan jam selesai wajib valid.' });
    }
    if (!VALID_ROOMS.includes(room)) return res.status(400).json({ message: 'Ruangan tidak valid.' });
    if (!ALLOWED_STATUS.includes(status || 'belum')) return res.status(400).json({ message: 'Status surat tidak valid.' });
    if (!validFileData(surat_file_data)) return res.status(400).json({ message: 'Dokumen surat tidak valid. Gunakan PDF, JPG, atau PNG maksimal 8MB.' });
    if (surat_name != null && !validText(surat_name, 255)) return res.status(400).json({ message: 'Nama file surat tidak valid.' });
    if (start >= end) return res.status(400).json({ message: 'Jam selesai harus lebih besar dari jam mulai.' });

    const conflict = await pool.query(`SELECT id FROM ruang_rapat WHERE room=$1 AND booking_date=$2 AND start_time < $4::time AND end_time > $3::time LIMIT 1`, [room, date, start, end]);
    if (conflict.rows.length) return res.status(409).json({ message: 'Ruangan sudah dibooking pada waktu tersebut.' });

    const result = await pool.query(`INSERT INTO ruang_rapat (agenda, room, pic, booking_date, start_time, end_time, surat_status, surat_name, surat_file_data, created_by, updated_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$10) RETURNING id, agenda AS title, room, pic, booking_date AS date,
      TO_CHAR(start_time, 'HH24:MI') AS start, TO_CHAR(end_time, 'HH24:MI') AS end, surat_status AS status, surat_name, surat_file_data`,
      [title.trim(), room, pic.trim(), date, start, end, status || 'belum', surat_name || null, surat_file_data || null, req.user.id]);
    res.status(201).json({ data: result.rows[0] });
  } catch (err) {
    logger.error('POST ruang rapat gagal', { error: err, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal menyimpan booking ruang rapat.' });
  }
});

router.put('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const fields = { title: 'agenda', room: 'room', pic: 'pic', date: 'booking_date', start: 'start_time', end: 'end_time', status: 'surat_status', surat_name: 'surat_name', surat_file_data: 'surat_file_data' };
    const sets = [], values = [];
    for (const [input, column] of Object.entries(fields)) {
      if (req.body[input] !== undefined) {
        const value = req.body[input];
        if (input === 'surat_file_data' && !validFileData(value)) return res.status(400).json({ message: 'Dokumen surat tidak valid. Gunakan PDF, JPG, atau PNG maksimal 8MB.' });
        if (input === 'surat_name' && !validText(value, 255)) return res.status(400).json({ message: 'Nama file surat tidak valid.' });
        if (input === 'status' && !ALLOWED_STATUS.includes(value)) return res.status(400).json({ message: 'Status surat tidak valid.' });
        if (input === 'room' && !VALID_ROOMS.includes(value)) return res.status(400).json({ message: 'Ruangan tidak valid.' });
        if (['title','pic'].includes(input) && !validText(value, input === 'pic' ? 150 : 255)) return res.status(400).json({ message: `${input} tidak valid.` });
        if (input === 'date' && !validDate(value)) return res.status(400).json({ message: 'Tanggal tidak valid.' });
        if (['start','end'].includes(input) && !validTime(value)) return res.status(400).json({ message: 'Jam tidak valid.' });
        values.push(value); sets.push(`${column}=$${values.length}`);
      }
    }
    if (!sets.length) return res.status(400).json({ message: 'Tidak ada field yang diubah.' });
    values.push(req.user.id); sets.push(`updated_by=$${values.length}`); values.push(req.params.id);
    const result = await pool.query(`UPDATE ruang_rapat SET ${sets.join(', ')} WHERE id=$${values.length} RETURNING id`, values);
    if (!result.rows.length) return res.status(404).json({ message: 'Booking tidak ditemukan.' });
    res.json({ message: 'Booking diperbarui.' });
  } catch (err) {
    logger.error('PUT ruang rapat gagal', { error: err, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal memperbarui booking.' });
  }
});

router.delete('/:id', requireRole(EDITOR_ROLES), async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM ruang_rapat WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ message: 'Booking tidak ditemukan.' });
    res.json({ message: 'Booking dihapus.' });
  } catch (err) {
    logger.error('DELETE ruang rapat gagal', { error: err, user_id: req.user?.id });
    res.status(500).json({ message: 'Gagal menghapus booking.' });
  }
});

module.exports = router;
