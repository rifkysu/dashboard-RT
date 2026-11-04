const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const live = require('../live');

// Cache singkat data akun untuk requireAuth: tiap halaman memicu beberapa request sekaligus (plus
// polling), dan tanpa cache semuanya membaca tabel users. Supaya role/ban/logout tetap langsung
// berlaku: request yang mengubah data (POST/PUT/DELETE) selalu membaca database, cache dikosongkan
// setiap ada perubahan lewat aplikasi (live.onChange), dan perubahan langsung lewat pgAdmin4
// paling lambat terbaca setelah USER_CACHE_MS.
const USER_CACHE_MS = 5000;
const userCache = new Map();
// Request akun yang sama yang datang bersamaan (mis. tepat setelah cache dikosongkan) menunggu satu
// query yang sama, bukan masing-masing membaca database. `generation` naik setiap cache dikosongkan:
// hasil query yang dimulai sebelumnya tidak disimpan (bisa sudah basi, mis. role baru diubah).
const userInflight = new Map();
let generation = 0;
function clearUsers() {
  generation += 1;
  userCache.clear();
  userInflight.clear();
}
live.onChange(clearUsers);
// Untuk perubahan akun yang sengaja tidak di-broadcast ke semua tab (logout): buang cache akun itu saja.
const forgetUser = (id) => {
  generation += 1;
  userCache.delete(id);
  userInflight.delete(id);
};

function loadUser(id, fresh) {
  const hit = userCache.get(id);
  if (!fresh && hit && Date.now() - hit.at < USER_CACHE_MS) return Promise.resolve(hit.user);
  if (!fresh && userInflight.has(id)) return userInflight.get(id);
  const startGeneration = generation;
  const query = prisma.user
    .findUnique({
      where: { id },
      select: { role: true, is_active: true, nama_lengkap: true, email: true, token_version: true },
    })
    .then((user) => {
      if (generation === startGeneration) {
        if (userCache.size > 5000) userCache.clear();
        userCache.set(id, { user, at: Date.now() });
      }
      return user;
    })
    .finally(() => {
      if (userInflight.get(id) === query) userInflight.delete(id);
    });
  if (!fresh) userInflight.set(id, query);
  return query;
}

// Kode & pesan untuk akun yang di-ban admin (is_active = false). Frontend
// mengenali kode ini dan menampilkan popup pemberitahuan ban di halaman Login.
const ACCOUNT_BANNED = 'ACCOUNT_BANNED';
const ACCOUNT_BANNED_MESSAGE =
  'Akun Anda telah diblokir oleh admin karena terdeteksi melanggar ketentuan penggunaan atau melakukan spam berlebihan. Hubungi admin Biro Umum jika menurut Anda ini sebuah kesalahan.';

// Middleware: memastikan request punya token JWT yang valid.
// Role & status aktif diambil dari database (bukan dari klaim token yang bisa
// basi) -> perubahan role/nonaktifkan akun lewat pgAdmin4 berlaku dalam
// beberapa detik, tanpa perlu logout/login ulang (lihat cache loadUser di atas).
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

    const current = await loadUser(id, req.method !== 'GET' && req.method !== 'HEAD');
    // Akun di-ban admin saat masih login -> sesi langsung diputus dan frontend
    // menampilkan pemberitahuan ban (lihat kode ACCOUNT_BANNED di api.js).
    if (current && !current.is_active) {
      return res.status(401).json({ code: ACCOUNT_BANNED, message: ACCOUNT_BANNED_MESSAGE });
    }
    if (
      !current ||
      !current.is_active ||
      !['karyawan', 'kabag', 'pic', 'admin'].includes(current.role)
    ) {
      return res
        .status(401)
        .json({ message: 'Akun tidak ditemukan atau tidak aktif. Silakan login kembali.' });
    }
    // Token dari sebelum logout / reset kata sandi / ban -> sudah dicabut walau belum kedaluwarsa.
    if (payload.tv !== current.token_version) {
      return res.status(401).json({ message: 'Sesi Anda sudah berakhir. Silakan login kembali.' });
    }

    req.user = {
      id,
      email: current.email,
      role: current.role,
      nama_lengkap: current.nama_lengkap,
      remember: payload.rm === true,
    };
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

// Role dengan hak penuh setara admin: kelola akun (menu Akun & Akses), mode maintenance (Settings),
// dan tetap bisa masuk menu yang sedang maintenance. Kabag sengaja disamakan dengan admin.
const ADMIN_ROLES = ['admin', 'kabag'];
const isAdminRole = (role) => ADMIN_ROLES.includes(role);

module.exports = {
  requireAuth,
  requireRole,
  forgetUser,
  EDITOR_ROLES,
  ADMIN_ROLES,
  isAdminRole,
  ACCOUNT_BANNED,
  ACCOUNT_BANNED_MESSAGE,
};
