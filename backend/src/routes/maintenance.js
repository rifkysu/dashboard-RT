const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();
const MENU_KEYS = ['dashboard', 'pemeliharaan', 'pengadaan', 'kendaraan', 'ruang-rapat'];

router.use(requireAuth);

// Semua role login boleh baca status maintenance (dipakai untuk gating UI sendiri-sendiri).
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.maintenanceMode.findMany({ orderBy: { menu_key: 'asc' } });
    res.json({ data: rows });
  } catch (err) {
    logger.error('GET maintenance gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil status maintenance.' });
  }
});

// Hanya admin yang boleh mengubah status maintenance.
router.put('/:menu_key', requireRole(['admin']), async (req, res) => {
  try {
    const { menu_key } = req.params;
    if (!MENU_KEYS.includes(menu_key)) return res.status(400).json({ message: 'Menu tidak dikenal.' });

    const { is_active, message } = req.body;
    if (is_active !== undefined && typeof is_active !== 'boolean') return res.status(400).json({ message: 'is_active harus boolean.' });
    if (message !== undefined && message !== null && (typeof message !== 'string' || message.length > 255)) return res.status(400).json({ message: 'Pesan maksimal 255 karakter.' });

    const data = { updated_by: req.user.id };
    if (is_active !== undefined) data.is_active = is_active;
    if (message !== undefined) data.message = message || null;

    const row = await prisma.maintenanceMode.upsert({
      where: { menu_key },
      update: data,
      create: { menu_key, is_active: is_active ?? false, message: message || null, updated_by: req.user.id },
    });
    res.json({ data: row });
  } catch (err) {
    logger.error('PUT maintenance gagal', { error: err });
    res.status(500).json({ message: 'Gagal memperbarui status maintenance.' });
  }
});

module.exports = router;
