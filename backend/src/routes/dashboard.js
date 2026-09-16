const express = require('express');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/dashboard/summary -> ringkasan angka untuk kartu di Dashboard
router.get('/summary', async (req, res) => {
  try {
    const [pm, pg] = await Promise.all([
      pool.query(`SELECT status, COUNT(*) FROM pemeliharaan GROUP BY status`),
      pool.query(`SELECT status, COUNT(*) FROM pengadaan GROUP BY status`),
    ]);

    const toMap = (rows) =>
      rows.reduce((acc, r) => ({ ...acc, [r.status]: Number(r.count) }), {
        pending: 0,
        on_progress: 0,
        selesai: 0,
      });

    res.json({
      pemeliharaan: toMap(pm.rows),
      pengadaan: toMap(pg.rows),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil ringkasan dashboard.' });
  }
});

router.get('/activities', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 'Pemeliharaan' AS modul, kode, judul AS deskripsi, status, updated_at AS waktu
      FROM pemeliharaan
      UNION ALL
      SELECT 'Pengadaan' AS modul, kode, nama_barang_jasa AS deskripsi, status, updated_at AS waktu
      FROM pengadaan
      ORDER BY waktu DESC
      LIMIT 20
    `);
    res.json({ data: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Gagal mengambil aktivitas terbaru.' });
  }
});

module.exports = router;
