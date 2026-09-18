const jwt = require('jsonwebtoken');

// Middleware: memastikan request punya token JWT yang valid.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (token && token.length > 4096) return res.status(401).json({ message: 'Token tidak valid.' });

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan. Silakan login kembali.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (!payload || !Number.isInteger(Number(payload.id)) || !['karyawan', 'kabag', 'pic', 'admin'].includes(payload.role)) {
      return res.status(401).json({ message: 'Token tidak valid.' });
    }
    req.user = { ...payload, id: Number(payload.id) };
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Token tidak valid atau sudah kedaluwarsa.' });
  }
}

// Middleware factory: membatasi akses hanya untuk role tertentu.
// Contoh: requireRole(['kabag', 'pic']) -> hanya kabag & pic yang boleh lewat.
function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Belum login.' });
    }
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Akses ditolak. Role Anda ("${req.user.role}") tidak memiliki izin untuk aksi ini.`,
      });
    }
    next();
  };
}

// Role yang boleh MENGEDIT modul Pemeliharaan & Pengadaan
// (karyawan sengaja TIDAK dimasukkan -> karyawan hanya boleh lihat & buat permintaan baru)
const EDITOR_ROLES = ['kabag', 'pic', 'admin'];

module.exports = { requireAuth, requireRole, EDITOR_ROLES };
