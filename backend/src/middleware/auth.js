const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// Middleware: memastikan request punya token JWT yang valid.
// Role & status aktif SELALU diambil segar dari database (bukan dari klaim
// token yang bisa basi) -> perubahan role/nonaktifkan akun lewat pgAdmin4
// langsung berlaku di request berikutnya, tanpa perlu logout/login ulang.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : null;
  if (token && token.length > 4096) return res.status(401).json({ message: 'Token tidak valid.' });

  if (!token) {
    return res.status(401).json({ message: 'Token tidak ditemukan. Silakan login kembali.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    const id = Number(payload?.id);
    if (!payload || !Number.isInteger(id)) {
      return res.status(401).json({ message: 'Token tidak valid.' });
    }

    const current = await prisma.user.findUnique({
      where: { id },
      select: { role: true, is_active: true, nama_lengkap: true, email: true },
    });
    if (!current || !current.is_active || !['karyawan', 'kabag', 'pic', 'admin'].includes(current.role)) {
      return res.status(401).json({ message: 'Akun tidak ditemukan atau tidak aktif. Silakan login kembali.' });
    }

    req.user = { id, email: current.email, role: current.role, nama_lengkap: current.nama_lengkap };
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
