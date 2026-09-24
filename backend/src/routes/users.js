const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../logger');
const { createResetToken } = require('../token');
const { isMailConfigured, sendResetPasswordEmail } = require('../mailer');

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
        reset_requested_at: true,
      },
      orderBy: { created_at: 'asc' },
    });
    res.json({ data: users });
  } catch (err) {
    logger.error('GET users gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil daftar akun.' });
  }
});

// Jumlah akun aktif yang sedang menunggu link reset kata sandi -- dipakai
// badge notifikasi menu "Akun & Akses" di sidebar admin.
router.get('/reset-requests/count', async (req, res) => {
  try {
    const count = await prisma.user.count({ where: { reset_requested_at: { not: null }, is_active: true } });
    res.json({ count });
  } catch (err) {
    logger.error('GET reset request count gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil jumlah permintaan reset.' });
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

// Buat link reset password untuk akun tertentu (khusus admin). Sistem belum
// punya layanan email, jadi admin menyalin link ini dan mengirimkannya manual
// (WA/Slack/dsb) ke pemilik akun setelah memverifikasi identitasnya.
router.post('/:id/reset-link', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID akun tidak valid.' });
    const target = await prisma.user.findUnique({ where: { id }, select: { id: true, is_active: true, nama_lengkap: true, no_hp: true, email: true } });
    if (!target) return res.status(404).json({ message: 'Akun tidak ditemukan.' });
    if (!target.is_active) return res.status(400).json({ message: 'Akun sedang di-ban. Aktifkan dulu sebelum membuat link reset.' });

    const { rawToken, hash, expires } = createResetToken();
    // Permintaan dianggap sudah ditangani begitu admin membuat link-nya.
    await prisma.user.update({ where: { id }, data: { reset_token: hash, reset_token_expires: expires, reset_requested_at: null } });
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;

    // Kalau SMTP sudah diisi, link sekalian dikirim ke email pemilik akun.
    // Link tetap dikembalikan ke admin sebagai cadangan (Salin / WhatsApp).
    let emailed = false;
    let email_error = null;
    if (isMailConfigured()) {
      try {
        await sendResetPasswordEmail({ to: target.email, nama: target.nama_lengkap, resetUrl });
        emailed = true;
      } catch (err) {
        logger.error('Kirim email reset password (admin) gagal', { error: err, user_id: id });
        email_error = 'Email gagal dikirim. Kirim link secara manual (Salin / WhatsApp).';
      }
    }
    res.json({ resetUrl, expires_at: expires, nama_lengkap: target.nama_lengkap, no_hp: target.no_hp, email: target.email, emailed, email_error });
  } catch (err) {
    logger.error('POST user reset-link gagal', { error: err });
    res.status(500).json({ message: 'Gagal membuat link reset password.' });
  }
});

module.exports = router;
