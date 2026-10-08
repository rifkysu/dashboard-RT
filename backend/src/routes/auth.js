const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { requireAuth, ACCOUNT_BANNED, ACCOUNT_BANNED_MESSAGE } = require('../middleware/auth');
const { createRateLimiter, normalizeEmail, isSafeText, ALLOWED_EMAIL_DOMAIN, isAllowedEmailDomain } = require('../middleware/security');
const { signToken, hashResetToken, createResetToken } = require('../token');
const { isMailConfigured, sendResetPasswordEmail } = require('../mailer');
const logger = require('../logger');

const router = express.Router();

// Role yang BOLEH dipilih sendiri saat mendaftar.
// "pic" SENGAJA tidak dimasukkan di sini -> tidak muncul & tidak bisa
// dipilih dari form Daftar Akun Baru. Role "pic" hanya bisa diberikan
// oleh admin/kabag langsung lewat pgAdmin4 (lihat README.md).
const SELF_REGISTER_ROLES = ['karyawan'];

// Aturan validasi Daftar Akun -- sama dengan frontend/src/utils/validation.js.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_RE = /^[\p{L}][\p{L} .,'-]*$/u;
const HP_RE = /^(\+?62|0)8\d{7,12}$/;
const UNIT_KERJA = ['rt', 'perlengkapan', 'kendaraan', 'protokol', 'lainnya'];
// Kolom users.email VARCHAR(150) -- lebih panjang dari ini ditolak di validasi, bukan crash 500 di database.
const EMAIL_MAX = 150;
// Cari akun tanpa membedakan huruf besar/kecil: akun yang dibuat/diubah lewat pgAdmin bisa saja tersimpan dengan huruf besar.
const emailWhere = (email) => ({ email: { equals: email, mode: 'insensitive' } });
function passwordIssue(pw) {
  if (typeof pw !== 'string' || !pw) return 'Kata sandi wajib diisi.';
  if (pw.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (pw.length > 128) return 'Kata sandi maksimal 128 karakter.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Kata sandi harus berisi huruf dan angka.';
  return null;
}

// Proteksi spam-klik login: kena timeout tepat 1 menit, tidak berlapis
// dengan limiter lain supaya lama kuncinya selalu konsisten & bisa ditebak.
// Dihitung per IP + email: banyak pegawai satu kantor (IP sama) tetap bisa login bersamaan,
// sedangkan tebak-tebak kata sandi untuk satu akun tetap dikunci setelah 5x per menit.
const loginLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 5,
  message: 'Terlalu banyak percobaan login. Silakan tunggu 1 menit sebelum mencoba lagi.',
  keyFn: (req) => String(normalizeEmail(req.body?.email) || '').slice(0, 254),
});
// Batas longgar per IP untuk menahan percobaan banyak email sekaligus dari satu sumber.
const loginIpLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 30,
  message: 'Terlalu banyak percobaan login dari jaringan ini. Silakan tunggu 1 menit.',
});

// Longgar karena satu kantor biasanya berbagi satu IP (banyak pegawai mendaftar di hari yang sama).
const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 50,
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


// Hash pembanding untuk email yang tidak terdaftar: bcrypt tetap dijalankan supaya lama
// respons login sama, sehingga orang tidak bisa menebak email mana yang terdaftar dari waktunya.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), 12);

function sanitizeUser(user) {
  const { password_hash, reset_token, reset_token_expires, reset_requested_at, ...rest } = user;
  return rest;
}

// ---------------------------------------------------------
// POST /api/auth/register
// ---------------------------------------------------------
router.post('/register', registerLimiter, async (req, res) => {
  try {
    const { nama_lengkap: rawNama, email: rawEmail, password, no_hp: rawHp, unit_kerja, role } = req.body;
    const email = normalizeEmail(rawEmail);
    const nama_lengkap = typeof rawNama === 'string' ? rawNama.trim() : rawNama;
    const no_hp = typeof rawHp === 'string' ? rawHp.replace(/[\s-]/g, '') : rawHp;

    if (!isSafeText(nama_lengkap, 150) || nama_lengkap.length < 3 || !NAME_RE.test(nama_lengkap)) {
      return res.status(400).json({ message: 'Nama lengkap minimal 3 karakter dan hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.' });
    }
    if (!isSafeText(email, 254) || !EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Format email tidak valid.' });
    }
    if (email.length > EMAIL_MAX) {
      return res.status(400).json({ message: `Email maksimal ${EMAIL_MAX} karakter.` });
    }
    if (!isAllowedEmailDomain(email)) {
      return res.status(400).json({ message: `Pendaftaran hanya untuk email kedinasan @${ALLOWED_EMAIL_DOMAIN}.` });
    }
    if (typeof no_hp !== 'string' || !HP_RE.test(no_hp)) {
      return res.status(400).json({ message: 'Nomor HP tidak valid (contoh: 081234567890 atau +6281234567890).' });
    }
    if (!UNIT_KERJA.includes(unit_kerja)) {
      return res.status(400).json({ message: 'Unit kerja / bagian wajib dipilih.' });
    }
    const pwIssue = passwordIssue(password);
    if (pwIssue) return res.status(400).json({ message: pwIssue });

    // Pertahanan berlapis di server: walaupun request dipaksa mengirim
    // role "pic" langsung ke API, tetap ditolak di sini.
    if (!SELF_REGISTER_ROLES.includes(role)) {
      return res.status(403).json({
        message:
          'Role tersebut tidak dapat dipilih saat pendaftaran mandiri. Role "PIC" hanya bisa diberikan oleh admin melalui database.',
      });
    }

    const existing = await prisma.user.findFirst({ where: emailWhere(email), select: { id: true } });
    if (existing) {
      return res.status(409).json({ message: 'Email sudah terdaftar. Silakan login.' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({ data: { nama_lengkap, email, password_hash, no_hp, unit_kerja, role } });

    // Sengaja TIDAK mengembalikan token: setelah daftar, pengguna masuk lewat halaman Login.
    res.status(201).json({ message: 'Akun berhasil dibuat. Silakan login.', user: sanitizeUser(user) });
  } catch (err) {
    // Dua pendaftaran bersamaan dengan email sama (mis. klik Daftar dua kali) -> ditahan UNIQUE.
    if (err.code === 'P2002') return res.status(409).json({ message: 'Email sudah terdaftar. Silakan login.' });
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat mendaftar.' });
  }
});

// ---------------------------------------------------------
// POST /api/auth/login
// ---------------------------------------------------------
router.post('/login', loginIpLimiter, loginLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 128) {
      return res.status(400).json({ message: 'Format login tidak valid.' });
    }
    if (!email || !password) {
      return res.status(400).json({ message: 'Email dan kata sandi wajib diisi.' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ message: 'Format email tidak valid.' });
    }

    const user = await prisma.user.findFirst({ where: emailWhere(email) });

    const match = await bcrypt.compare(password, user?.password_hash || DUMMY_PASSWORD_HASH);
    if (!user || !user.password_hash || !match) {
      return res.status(401).json({ message: 'Email atau kata sandi salah.' });
    }

    // Status ban baru diberitahukan SETELAH kata sandi terbukti benar, supaya
    // orang lain tidak bisa mengecek akun siapa yang di-ban cukup dengan emailnya.
    if (!user.is_active) {
      return res.status(403).json({ code: ACCOUNT_BANNED, message: ACCOUNT_BANNED_MESSAGE });
    }

    const updated = await prisma.user.update({ where: { id: user.id }, data: { last_login_at: new Date() } });
    const token = signToken(updated);
    res.json({ token, user: sanitizeUser(updated) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat login.' });
  }
});

// ---------------------------------------------------------
// POST /api/auth/forgot-password
// Link reset TIDAK PERNAH dikembalikan di response -- kalau dikembalikan,
// siapa pun bisa mengambil alih akun orang lain cukup dengan mengetik emailnya.
// - SMTP terkonfigurasi (lihat src/mailer.js): link langsung dikirim ke email
//   pemilik akun.
// - SMTP belum diisi / pengiriman gagal: permintaan dicatat (reset_requested_at)
//   jadi notifikasi di menu Akun & Akses, lalu admin mengirim link manual
//   (POST /api/users/:id/reset-link).
// Respons sengaja sama untuk email terdaftar maupun tidak, dan email dikirim
// di latar belakang supaya lama respons juga tidak membocorkan hal itu.
// ---------------------------------------------------------
router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Format email tidak valid.' });
    }

    const user = await prisma.user.findFirst({ where: { email, is_active: true }, select: { id: true, email: true, nama_lengkap: true } });

    if (!isMailConfigured()) {
      if (user) await prisma.user.update({ where: { id: user.id }, data: { reset_requested_at: new Date() } });
      return res.json({
        message: 'Permintaan reset kata sandi diterima. Silakan hubungi Admin Biro Umum untuk mendapatkan link reset kata sandi akun Anda (link berlaku 1 jam).',
      });
    }

    res.json({
      message: 'Jika email tersebut terdaftar, link reset kata sandi sudah dikirim ke email itu (berlaku 1 jam). Cek juga folder Spam. Kalau tidak menerima email dalam beberapa menit, hubungi Admin Biro Umum.',
    });

    if (user) {
      const { rawToken, hash, expires } = createResetToken();
      prisma.user.update({ where: { id: user.id }, data: { reset_token: hash, reset_token_expires: expires } })
        .then(() => sendResetPasswordEmail({ to: user.email, nama: user.nama_lengkap, resetUrl: `${process.env.FRONTEND_URL}/reset-password#token=${rawToken}` }))
        .catch(async (err) => {
          // Email gagal terkirim -> jangan sampai pengguna terlantar: masuk ke notifikasi admin.
          logger.error('Kirim email reset password gagal', { error: err, user_id: user.id });
          await prisma.user.update({ where: { id: user.id }, data: { reset_requested_at: new Date() } }).catch(() => {});
        });
    }
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
    // Aturan kata sandi sama dengan saat daftar akun (8-128 karakter, huruf & angka).
    const pwIssue = passwordIssue(password);
    if (pwIssue) return res.status(400).json({ message: pwIssue });

    const user = await prisma.user.findFirst({
      where: { reset_token: hashResetToken(token), reset_token_expires: { gt: new Date() } },
    });
    if (!user) {
      return res.status(400).json({ message: 'Token reset tidak valid atau sudah kedaluwarsa. Silakan minta link reset baru.' });
    }

    const password_hash = await bcrypt.hash(password, 12);
    await prisma.user.update({
      where: { id: user.id },
      // token_version naik -> semua sesi lama (mis. milik orang yang mencuri sandi) langsung diputus.
      data: { password_hash, reset_token: null, reset_token_expires: null, reset_requested_at: null, token_version: { increment: 1 } },
    });

    res.json({ message: 'Kata sandi berhasil diubah. Silakan login dengan kata sandi baru.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Terjadi kesalahan server saat mereset kata sandi.' });
  }
});

// ---------------------------------------------------------
// POST /api/auth/logout -> cabut token yang sedang dipakai.
// token_version naik, jadi token ini (dan sesi akun yang sama di perangkat lain)
// tidak bisa dipakai lagi walaupun masa berlaku 8 jamnya belum habis.
// ---------------------------------------------------------
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await prisma.user.update({ where: { id: req.user.id }, data: { token_version: { increment: 1 } } });
    res.json({ message: 'Berhasil logout.' });
  } catch (err) {
    logger.error('POST logout gagal', { error: err, user_id: req.user.id });
    res.status(500).json({ message: 'Gagal logout di server.' });
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

module.exports = router;
