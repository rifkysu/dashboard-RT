const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();
router.use(requireAuth);
router.use(requireRole(['admin']));

// Daftar akun + role, khusus admin -- dipakai di menu "Akun" untuk memantau
// siapa saja yang punya akses ke sistem dan kapan terakhir mereka login.
router.get('/', async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        nama_lengkap: true,
        email: true,
        no_hp: true,
        unit_kerja: true,
        role: true,
        is_active: true,
        sso_provider: true,
        created_at: true,
        last_login_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
    res.json({ data: users });
  } catch (err) {
    logger.error('GET users gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil daftar akun.' });
  }
});

module.exports = router;
