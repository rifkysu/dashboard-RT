require('dotenv').config();
const express = require('express');
const cors = require('cors');
const passport = require('passport');
const { requestHardening, createRateLimiter, validateCommonInput, randomRequestId } = require('./middleware/security');

require('./config/passport'); // daftarkan strategy Google SSO (jika dikonfigurasi)

const authRoutes = require('./routes/auth');
const pemeliharaanRoutes = require('./routes/pemeliharaan');
const pengadaanRoutes = require('./routes/pengadaan');
const kendaraanRoutes = require('./routes/kendaraan');
const dashboardRoutes = require('./routes/dashboard');
const ruangRapatRoutes = require('./routes/ruangRapat');
const maintenanceRoutes = require('./routes/maintenance');
const usersRoutes = require('./routes/users');
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
app.set('trust proxy', process.env.TRUST_PROXY === 'true' ? 1 : false);
app.use(requestHardening);
app.use((req, res, next) => {
  req.requestId = randomRequestId();
  res.setHeader('X-Request-ID', req.requestId);
  next();
});
app.use(cors({ origin: frontendUrl, credentials: false, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Request-ID'], exposedHeaders: ['Retry-After','X-RateLimit-Limit','X-RateLimit-Remaining'] }));
app.use(createRateLimiter({ windowMs: 60 * 1000, max: 180, message: 'Terlalu banyak permintaan. Coba lagi sebentar.' }));
// File upload disimpan sebagai Base64 di payload JSON; naikkan limit agar dokumen tidak ditolak 413.
app.use(express.json({ limit: '25mb', strict: true }));
app.use(express.urlencoded({ extended: false, limit: '2mb', parameterLimit: 100 }));
ensureUploadRoot();
app.use(validateCommonInput);
// Jangan expose folder upload sebagai static publik. File sensitif sebaiknya disajikan lewat endpoint yang terautentikasi.
// app.use('/uploads', express.static(...));
app.use(passport.initialize());

// Request logger: catat endpoint, status, durasi, user, dan error agar mudah
// mengetahui apakah masalah berasal dari frontend, API, atau database.
app.use((req, res, next) => {
  const started = Date.now();
  res.on('finish', () => {
    logger.info('HTTP request', { request_id: req.requestId, method: req.method, path: req.path, status: res.statusCode, duration_ms: Date.now() - started, user_id: req.user?.id || null, role: req.user?.role || null });
  });
  next();
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend Biro Umum berjalan dengan baik.' });
});

app.use('/api/auth', authRoutes);
app.use('/api/pemeliharaan', pemeliharaanRoutes);
app.use('/api/pengadaan', pengadaanRoutes);
app.use('/api/kendaraan', kendaraanRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ruang-rapat', ruangRapatRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/users', usersRoutes);


const PORT = Number(process.env.PORT) || 4000;
app.listen(PORT, () => console.log(`✅ Backend Biro Umum berjalan di http://localhost:${PORT}`));
