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
const pool = require('./db');
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
app.use(cors({ origin: frontendUrl, credentials: false, methods: ['GET','POST','PUT','DELETE','OPTIONS'], allowedHeaders: ['Content-Type','Authorization','X-Request-ID'] }));
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

// Migrasi ringan untuk database PostgreSQL yang sudah ada.
async function ensurePemeliharaanStageColumns() {
  const statements = [
    `CREATE TABLE IF NOT EXISTS ruang_rapat (id SERIAL PRIMARY KEY, agenda VARCHAR(255) NOT NULL, room VARCHAR(150) NOT NULL, pic VARCHAR(150) NOT NULL, booking_date DATE NOT NULL, start_time TIME NOT NULL, end_time TIME NOT NULL, surat_status VARCHAR(20) NOT NULL DEFAULT 'belum' CHECK (surat_status IN ('belum','ditinjau','diterima')), created_by INTEGER REFERENCES users(id), updated_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW(), CHECK (end_time > start_time))`,
    "CREATE INDEX IF NOT EXISTS idx_ruang_rapat_date_room ON ruang_rapat(booking_date, room)",
    "CREATE INDEX IF NOT EXISTS idx_ruang_rapat_pic ON ruang_rapat(pic)",
    "ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_name VARCHAR(255)",
    "ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_file_data TEXT",
    "ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_file_path TEXT",

    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS lokasi VARCHAR(150)",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS kategori VARCHAR(100)",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS deskripsi TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS request_document_name TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS request_document_file_data TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS request_document_file_path TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS tanggal_selesai DATE",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS jenis_pekerjaan VARCHAR(100)",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS request_document_name TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS request_document_file_data TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS request_document_file_path TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS urgensi VARCHAR(20) DEFAULT 'sedang'",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_boq TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_hps NUMERIC(18,2)",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_document_name TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_boq_file_data TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_boq_file_path TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_payment_method VARCHAR(20)",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_vendor VARCHAR(150)",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_invoice_number VARCHAR(100)",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_invoice_date DATE",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_invoice_amount NUMERIC(18,2)",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_name TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_document_file_data TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_document_file_path TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_file_data TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_file_path TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage3_documentation_files TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage3_documentation_file_paths TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage3_documentation_names TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage3_bast_notes TEXT",
    "ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS tanggal_selesai DATE",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_name TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_file_data TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_file_path TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_payment_proof_name TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_payment_proof_file_data TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_payment_proof_file_path TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage3_final_document_name TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage3_final_document_file_data TEXT",
    "ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage3_final_document_file_path TEXT",
    "CREATE TABLE IF NOT EXISTS kendaraan (id SERIAL PRIMARY KEY, name VARCHAR(150) NOT NULL, plate VARCHAR(30) NOT NULL UNIQUE, type VARCHAR(100) NOT NULL, sub VARCHAR(150), status VARCHAR(30) NOT NULL DEFAULT 'Tersedia', tax VARCHAR(50), next_tax VARCHAR(50), photo_name TEXT, photo_file_data TEXT, created_by INTEGER REFERENCES users(id), updated_by INTEGER REFERENCES users(id), created_at TIMESTAMP NOT NULL DEFAULT NOW(), updated_at TIMESTAMP NOT NULL DEFAULT NOW())",
    "CREATE INDEX IF NOT EXISTS idx_kendaraan_plate ON kendaraan(plate)",
    "ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_name TEXT",
    "ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_file_data TEXT",
    "ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_file_path TEXT",
    "ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id)",
    "ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id)",
    "ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW()",
    "ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()",
    "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_kendaraan_updated_at') THEN CREATE TRIGGER trg_kendaraan_updated_at BEFORE UPDATE ON kendaraan FOR EACH ROW EXECUTE FUNCTION set_updated_at(); END IF; END $$",
    "INSERT INTO kendaraan (name, sub, plate, type, status, tax, next_tax) SELECT * FROM (VALUES ('Toyota Camry','VIP / Direksi','B 1234 RFS','Sedan (Roda 4)','Tersedia','12 Jan 2023','12 Jan 2024'), ('Toyota Innova','Operasional Tim','B 5678 CD','MPV (Roda 4)','Digunakan','15 Mar 2023','15 Mar 2024'), ('Mitsubishi Triton','Lapangan','B 9012 EF','Double Cabin (Roda 4)','Servis','20 Jun 2023','20 Jun 2024'), ('Toyota HiAce','Tamu Instansi','B 3456 GH','Minibus (Bus)','Tersedia','05 Aug 2023','05 Aug 2024')) AS v(name, sub, plate, type, status, tax, next_tax) WHERE NOT EXISTS (SELECT 1 FROM kendaraan)" ,
  ];
  for (const sql of statements) await pool.query(sql);
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint tidak ditemukan.' });
});

// Error handler terakhir (jaga-jaga)
app.use((err, req, res, next) => {
  console.error('[UNHANDLED ERROR]', err);
  logger.error('Unhandled application error', { error: err, request_id: req.requestId, method: req.method, path: req.originalUrl });
  res.status(500).json({ message: 'Terjadi kesalahan pada server.', request_id: req.requestId });
});

const PORT = process.env.PORT || 4000;
ensurePemeliharaanStageColumns()
  .then(() => app.listen(PORT, () => console.log(`✅ Backend Biro Umum berjalan di http://localhost:${PORT}`)))
  .catch((err) => {
    logger.error('Gagal menyiapkan database saat startup', err);
    console.error('Gagal menyiapkan kolom Tahap Pemeliharaan:', err);
    process.exit(1);
  });
