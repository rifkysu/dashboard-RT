const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const passport = require('passport');
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiter, normalizeEmail, isSafeText } = require('../middleware/security');
const { signToken } = require('../token');

const router = express.Router();

// Role yang BOLEH dipilih sendiri saat mendaftar.
// "pic" SENGAJA tidak dimasukkan di sini -> tidak muncul & tidak bisa
// dipilih dari form Daftar Akun Baru. Role "pic" hanya bisa diberikan
// oleh admin/kabag langsung lewat pgAdmin4 (lihat README.md).
const SELF_REGISTER_ROLES = ['karyawan'];

// Proteksi spam-klik login: kena timeout tepat 1 menit, tidak berlapis
// dengan limiter lain supaya lama kuncinya selalu konsisten & bisa ditebak.
const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Terlalu banyak percobaan login. Silakan tunggu 1 menit sebelum mencoba lagi.',
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Terlalu banyak percobaan pendaftaran dari alamat ini.',
});

const forgotPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: 'Terlalu banyak permintaan reset password. Silakan coba lagi nanti.',
});

const resetPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 20,
  message: 'Terlalu banyak percobaan reset password. Silakan coba lagi nanti.',
});

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 jam
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

function sanitizeUser(user) {
  const { password_hash, ...rest } = user;
  return rest;
}

// ---------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { nama_lengkap, email: rawEmail, password, no_hp, unit_kerja, role } = req.body;
    const email = normalizeEmail(rawEmail);

    if (!isSafeText(nama_lengkap, 150) || !isSafeText(email, 254) || (no_hp != null && !isSafeText(no_hp, 30)) || (unit_kerja != null && !isSafeText(unit_kerja, 150))) {
      return res.status(400).json({ message: 'Format atau panjang data tidak valid.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Format email tidak valid.' });
    }

    if (!nama_lengkap || !email || !password || !role) {
      return res.status(400).json({ message: 'Data wajib diisi: nama_lengkap, email, password, role.' });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Kata sandi minimal 8 karakter.' });
    }

    // Pertahanan berlapis di server: walaupun request dipaksa mengirim
    // role "pic" langsung ke API, tetap ditolak di sini.
    if (!SELF_REGISTER_ROLES.includes(role)) {
      return res.status(403).json({
        message:
          'Role tersebut tidak dapat dipilih saat pendaftaran mandiri. Role "PIC" hanya bisa diberikan oleh admin melalui database.',
      });
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      return res.status(409).json({ message: 'Email sudah terdaftar. Silakan login.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({ data: { nama_lengkap, email, password_hash, no_hp: no_hp || null, unit_kerja: unit_kerja || null, role } });
    const token = signToken(user);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat mendaftar.' });
  }
});

// ---------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ message: 'Format login tidak valid.' });
    }
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan kata sandi wajib diisi.' });
    }

    const user = await prisma.user.findFirst({ where: { email, is_active: true } });

    if (!user || !user.password_hash) {
      return res.status(401).json({ message: 'Email atau kata sandi salah.' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ message: 'Email atau kata sandi salah.' });
    }

    const token = signToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat login.' });
  }
});

// ---------------------------------------------------------
// POST /api/auth/forgot-password
// Sistem belum terhubung ke layanan email, jadi endpoint ini
// mengembalikan link reset langsung di response. Admin/HR bisa
// meneruskan link tsb secara manual (WA/Slack/dsb) ke user yang
// lupa password. Link berlaku 1 jam.
// ---------------------------------------------------------
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Format email tidak valid.' });
    }

    const user = await prisma.user.findFirst({ where: { email, is_active: true } });
    if (!user) {
      return res.status(404).json({ message: 'Email tidak ditemukan atau akun tidak aktif.' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    await prisma.user.update({
      where: { id: user.id },
      data: { reset_token: hashResetToken(rawToken), reset_token_expires: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${rawToken}`;
    res.json({
      message: 'Link reset password berhasil dibuat. Sistem belum terhubung ke email, jadi salin/kirim link ini secara manual ke pengguna. Link berlaku 1 jam.',
      resetUrl,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat membuat link reset.' });
  }
});

// ---------------------------------------------------------
// POST /api/auth/reset-password
// ---------------------------------------------------------
router.post('/reset-password', resetPasswordLimiter, async (req, res) => {
  try {
    const { token, password } = req.body;
    if (typeof token !== 'string' || token.length < 32 || token.length > 256) {
      return res.status(400).json({ message: 'Token reset tidak valid.' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return res.status(400).json({ message: 'Kata sandi minimal 8 karakter.' });
    }

    const user = await prisma.user.findFirst({
      where: { reset_token: hashResetToken(token), reset_token_expires: { gt: new Date() } },
    });
    if (!user) {
      return res.status(400).json({ message: 'Token reset tidak valid atau sudah kedaluwarsa. Silakan minta link reset baru.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash, reset_token: null, reset_token_expires: null },
    });

    res.json({ message: 'Kata sandi berhasil diubah. Silakan login dengan kata sandi baru.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat mereset kata sandi.' });
  }
});

// ---------------------------------------------------------
// GET /api/auth/me  -> data user yang sedang login (dari token)
// ---------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: Number(req.user.id) }, select: { id: true, nama_lengkap: true, email: true, no_hp: true, unit_kerja: true, role: true, sso_provider: true, created_at: true } });
    if (!user) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }
    res.json({ user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server.' });
  }
});

// ---------------------------------------------------------
// SSO (Single Sign-On) via Google OAuth 2.0
// Hanya aktif jika GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET diisi di .env
// ---------------------------------------------------------
const ssoEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

if (ssoEnabled) {
  router.get(
    '/google',
    passport.authenticate('google', { scope: ['profile', 'email'], session: false })
  );

  router.get(
    '/google/callback',
    passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?sso=gagal` }),
    async (req, res) => {
      // req.user diisi oleh strategy passport-google-oauth20 (lihat config/passport.js)
      const token = signToken(req.user);
      // Redirect kembali ke frontend membawa token di query string.
      res.redirect(`${process.env.FRONTEND_URL}/sso-callback?token=${token}`);
    }
  );
} else {
  // Kalau SSO belum dikonfigurasi, tetap sediakan route agar frontend
  // tidak error 404 total -> beri pesan yang jelas.
  router.get('/google', (req, res) => {
    res.status(503).json({
      message:
        'Login SSO belum dikonfigurasi. Isi GOOGLE_CLIENT_ID & GOOGLE_CLIENT_SECRET di file .env backend (lihat README.md).',
    });
  });
}

module.exports = router;
