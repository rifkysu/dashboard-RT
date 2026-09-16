const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const pool = require('../db');
const { requireAuth } = require('../middleware/auth');
const { createRateLimiter, normalizeEmail, isSafeText } = require('../middleware/security');

const router = express.Router();

// Role yang BOLEH dipilih sendiri saat mendaftar.
// "pic" SENGAJA tidak dimasukkan di sini -> tidak muncul & tidak bisa
// dipilih dari form Daftar Akun Baru. Role "pic" hanya bisa diberikan
// oleh admin/kabag langsung lewat pgAdmin4 (lihat README.md).
const SELF_REGISTER_ROLES = ['karyawan'];

const loginLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Terlalu banyak percobaan login. Silakan coba lagi nanti.',
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Terlalu banyak percobaan pendaftaran dari alamat ini.',
});

function signToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      nama_lengkap: user.nama_lengkap,
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h', algorithm: 'HS256' }
  );
}

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

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ message: 'Email sudah terdaftar. Silakan login.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (nama_lengkap, email, password_hash, no_hp, unit_kerja, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, nama_lengkap, email, no_hp, unit_kerja, role, created_at`,
      [nama_lengkap, email, password_hash, no_hp || null, unit_kerja || null, role]
    );

    const user = result.rows[0];
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

    const result = await pool.query('SELECT * FROM users WHERE email = $1 AND is_active = TRUE', [email]);
    const user = result.rows[0];

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
// GET /api/auth/me  -> data user yang sedang login (dari token)
// ---------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, nama_lengkap, email, no_hp, unit_kerja, role, sso_provider, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User tidak ditemukan.' });
    }
    res.json({ user: result.rows[0] });
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
