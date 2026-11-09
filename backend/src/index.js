require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { requestHardening, createRateLimiter, createSseLimiter, validateCommonInput, randomRequestId } = require('./middleware/security');

const authRoutes = require('./routes/auth');
const pemeliharaanRoutes = require('./routes/pemeliharaan');
const pengadaanRoutes = require('./routes/pengadaan');
const kendaraanRoutes = require('./routes/kendaraan');
const dashboardRoutes = require('./routes/dashboard');
const ruangRapatRoutes = require('./routes/ruangRapat');
const maintenanceRoutes = require('./routes/maintenance');
const usersRoutes = require('./routes/users');
const guestRoutes = require('./routes/guest');
const ruangInfoRoutes = require('./routes/ruangInfo');
const riwayatRoutes = require('./routes/riwayat');
const live = require('./live');
const logger = require('./logger');
const { ensureUploadRoot } = require('./fileStorage');

const app = express();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  throw new Error('JWT_SECRET wajib diisi dan minimal 32 karakter.');
}

const frontendUrl = process.env.FRONTEND_URL;
if (!frontendUrl) {
  throw new Error('FRONTEND_URL wajib diisi untuk production.');
}

app.disable('x-powered-by');
// Query string diparse "simple" (querystring bawaan Node), bukan "extended" (qs): ?a[b]=1 tidak lagi
// menjadi objek { a: { b: '1' } }, jadi nilai dari URL tidak bisa berubah jadi operator Prisma
// (mis. ?status[not]=x). Semua filter di aplikasi ini memang hanya memakai teks biasa.
app.set('query parser', 'simple');
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(requestHardening);
app.use((req, res, next) => {
  req.requestId = randomRequestId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});
app.use(cors({ origin: frontendUrl, credentials: false, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Request-ID'], exposedHeaders: ['Retry-After','X-RateLimit-Limit','X-RateLimit-Remaining','X-Total-Rows'] }));
// Request dengan token valid dihitung per akun (bukan per IP saja): satu kantor biasanya keluar
// lewat satu IP (NAT/proxy), dan tiap tab yang terbuka polling beberapa kali per menit -- tanpa
// ini puluhan pegawai sekaligus bisa kena 429. Tanpa token / token tidak valid tetap per IP.
// Hasilnya disimpan di req: dipanggil beberapa kali per request (rate limiter, pemilih batas body,
// error handler) -- verifikasi JWT cukup sekali.
const rateKeyByUser = (req) => {
  if (req.rateKeyCache !== undefined) return req.rateKeyCache;
  const header = req.headers.authorization || '';
  let key = '';
  if (header.startsWith('Bearer ') && header.length <= 4200) {
    try {
      const p = jwt.verify(header.slice(7).trim(), process.env.JWT_SECRET, { algorithms: ['HS256'] });
      // Token tamu (login Google di landing page) dihitung per akun tamu, terpisah dari akun pegawai.
      key = p.gid ? `g:${p.gid}` : `u:${p.id}`;
    } catch { key = ''; }
  }
  req.rateKeyCache = key;
  return key;
};
app.use(createRateLimiter({ windowMs: 60 * 1000, max: 180, message: 'Terlalu banyak permintaan. Coba lagi sebentar.', keyFn: rateKeyByUser }));
// File upload disimpan sebagai Base64 di payload JSON; naikkan limit agar dokumen tidak ditolak 413.
// Batas besar hanya untuk request yang membawa token sah (pegawai/tamu): tanpa ini siapa pun tanpa login
// bisa mengirim body 25MB berulang-ulang (mis. ke /api/auth/login) dan menghabiskan memori/CPU server,
// karena body diparse sebelum pengecekan login di route. Login, daftar, dan reset sandi cukup ~256KB.
const jsonBesar = express.json({ limit: '25mb', strict: true });
const jsonKecil = express.json({ limit: '256kb', strict: true });
app.use((req, res, next) => (rateKeyByUser(req) ? jsonBesar : jsonKecil)(req, res, next));
app.use(express.urlencoded({ extended: false, limit: '2mb', parameterLimit: 100 }));
ensureUploadRoot();
app.use(validateCommonInput);
// ID di URL di luar batas INTEGER PostgreSQL (> 2147483647) -> 400, bukan error 500 dari database.
app.use((req, res, next) => (req.path.split('/').some((s) => /^\d+$/.test(s) && Number(s) > 2147483647) ? res.status(400).json({ message: 'ID tidak valid.' }) : next()));
// Jangan expose folder upload sebagai static publik. File sensitif sebaiknya disajikan lewat endpoint yang terautentikasi.
// app.use('/uploads', express.static(...));

// Request logger: catat endpoint, status, durasi, user, dan error agar mudah
// mengetahui apakah masalah berasal dari frontend, API, atau database.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logger.http({ request_id: req.requestId, method: req.method, path: req.path, status: res.statusCode, duration_ms: Date.now() - started, user_id: req.user?.id || null, role: req.user?.role || null });
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend Biro Umum berjalan dengan baik.' });
});

// Satu stream live untuk semua modul (lihat src/live.js).
app.get('/api/live/stream', createSseLimiter(), live.streamHandler);

// Login Google untuk tamu (booking ruang rapat dari landing page) -- lihat routes/guest.js.
app.use('/api/auth', guestRoutes.googleRouter);
// Login/logout hanya mengubah sesi si pengguna sendiri -> tidak perlu sinyal ke semua tab.
app.use('/api/auth', live.notifyOnWrite('users', { except: ['/login', '/logout'] }), authRoutes);
app.use('/api/pemeliharaan', live.notifyOnWrite('pemeliharaan'), pemeliharaanRoutes);
app.use('/api/pengadaan', live.notifyOnWrite('pengadaan'), pengadaanRoutes);
app.use('/api/kendaraan', live.notifyOnWrite('kendaraan'), kendaraanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ruang-rapat', live.notifyOnWrite('ruang-rapat'), ruangRapatRoutes);
app.use('/api/maintenance', live.notifyOnWrite('maintenance'), maintenanceRoutes);
app.use('/api/users', live.notifyOnWrite('users'), usersRoutes);
app.use('/api/guest', live.notifyOnWrite('ruang-rapat'), guestRoutes);
// Foto & fasilitas ruang rapat (layar /ruang/:slug); diubah Admin/Kabag -> layar ruangan ikut update live.
app.use('/api/ruang-info', live.notifyOnWrite('ruang-info'), ruangInfoRoutes);
app.use('/api/riwayat', riwayatRoutes);

// Endpoint API yang tidak dikenal -> JSON berpesan jelas (bukan halaman HTML default Express),
// supaya frontend tidak cuma menampilkan "Gagal ..." -- biasanya karena backend belum di-restart
// setelah update kode.
app.use('/api', (req, res) => {
  res.status(404).json({ message: 'Fitur ini belum tersedia di server. Pastikan backend sudah di-restart setelah update aplikasi.' });
});

// Error dari body parser (mis. upload melebihi batas 25MB) dikembalikan sebagai
// JSON berpesan jelas, bukan halaman HTML default Express yang tidak terbaca frontend.
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    // Token kedaluwarsa/dicabut -> body dibatasi 256KB (lihat jsonKecil), jadi upload besar ditolak di sini
    // sebelum sempat sampai ke pengecekan login. Balas 401 supaya frontend mengarahkan ke halaman login.
    if (req.headers.authorization && !rateKeyByUser(req)) {
      return res.status(401).json({ message: 'Sesi Anda sudah berakhir. Silakan login kembali.' });
    }
    return res.status(413).json({ message: 'Ukuran data/dokumen terlalu besar (maks. total 25MB per simpan). Upload sebagian dokumen lewat menu Detail.' });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Format data tidak valid.' });
  }
  logger.error('Unhandled error', { error: err, path: req.path, request_id: req.requestId });
  return res.status(500).json({ message: 'Terjadi kesalahan server.' });
});


const PORT = Number(process.env.PORT) || 4000;
// Di belakang Nginx (TRUST_PROXY=true) backend hanya mendengarkan 127.0.0.1: header X-Forwarded-For
// dipercaya, jadi kalau port 4000 bisa dihubungi langsung dari jaringan, penyerang bisa memalsukan IP-nya
// dan lolos dari batas percobaan login. Tanpa proxy (dev/LAN) tetap semua interface seperti sebelumnya.
// HOST di .env bisa menimpa (mis. Nginx di server lain -> HOST=0.0.0.0 + firewall yang hanya mengizinkan Nginx).
const HOST = process.env.HOST || (process.env.TRUST_PROXY === 'true' ? '127.0.0.1' : '0.0.0.0');
app.listen(PORT, HOST, () => {
  console.log(`✅ Backend Biro Umum berjalan di http://${HOST === '0.0.0.0' ? 'localhost' : HOST}:${PORT}`);
  require('./reminders').mulaiPengingat(); // email pengingat booking tamu (butuh SMTP di .env)
});
