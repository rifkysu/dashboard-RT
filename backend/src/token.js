const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 jam
const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Buat token reset password: yang disimpan di DB hanya hash-nya, token mentah
// cuma dikembalikan sekali untuk dijadikan link.
function createResetToken() {
  const rawToken = crypto.randomBytes(32).toString('hex');
  return { rawToken, hash: hashResetToken(rawToken), expires: new Date(Date.now() + RESET_TOKEN_TTL_MS) };
}

// remember=true ("Ingat saya" saat login): token berlaku lebih lama (JWT_REMEMBER_EXPIRES_IN,
// default 30 hari) dan ditandai rm supaya token yang diterbitkan ulang (mis. promosi ke PIC)
// tetap memakai masa berlaku yang sama. Logout/ban/ganti sandi tetap langsung mencabutnya (token_version).
// Format sah: angka detik ("3600") atau angka + satuan ("8h", "30d", "45m"). Nilai lain -> default.
const EXPIRES_RE = /^\d+\s*(ms|s|m|h|d|w|y)?$/i;
function expiresFrom(name, fallback) {
  const v = (process.env[name] || '').trim();
  if (!v) return fallback;
  if (EXPIRES_RE.test(v)) return /^\d+$/.test(v) ? Number(v) : v;
  console.warn(`[token] ${name}="${v}" tidak valid (contoh benar: 8h, 30d). Memakai default ${fallback}.`);
  return fallback;
}

function signToken(user, { remember = false } = {}) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      nama_lengkap: user.nama_lengkap,
      // Versi sesi: dicocokkan requireAuth dengan users.token_version (lihat middleware/auth.js).
      tv: user.token_version ?? 0,
      ...(remember ? { rm: true } : {}),
    },
    process.env.JWT_SECRET,
    { expiresIn: remember ? expiresFrom('JWT_REMEMBER_EXPIRES_IN', '30d') : expiresFrom('JWT_EXPIRES_IN', '8h'), algorithm: 'HS256' }
  );
}

module.exports = { signToken, hashResetToken, createResetToken };
