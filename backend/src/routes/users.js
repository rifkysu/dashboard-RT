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

// Ban / unban akun -- toggle is_active. Akun yang di-ban langsung tertolak
// di request berikutnya (requireAuth cek is_active segar dari DB tiap
// request) dan tidak bisa login lagi (POST /auth/login cuma cari user yang
// is_active: true), jadi efeknya langsung berlaku tanpa perlu logic tambahan.
router.put('/:id/status', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID akun tidak valid.' });
    const { is_active } = req.body;
    if (typeof is_active !== 'boolean') return res.status(400).json({ message: 'is_active harus boolean.' });
    if (id === req.user.id) return res.status(400).json({ message: 'Tidak bisa mem-ban/menonaktifkan akun sendiri.' });

    const user = await prisma.user.update({ where: { id }, data: { is_active } });
    res.json({ data: { id: user.id, is_active: user.is_active } });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Akun tidak ditemukan.' });
    logger.error('PUT user status gagal', { error: err });
    res.status(500).json({ message: 'Gagal memperbarui status akun.' });
  }
});

module.exports = router;
