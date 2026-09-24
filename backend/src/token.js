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

module.exports = { signToken, hashResetToken, createResetToken };
