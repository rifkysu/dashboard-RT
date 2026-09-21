-- ================================================================
-- BIRO UMUM - DATABASE REPAIR / COMPATIBILITY
-- Aman dijalankan pada database yang SUDAH BERISI DATA.
-- Tidak DROP TABLE, tidak DELETE DATA.
-- Target: menyamakan database lama dengan Prisma versi production.
-- Jalankan di pgAdmin4 > Query Tool pada database biro_umum_db.
-- ================================================================

-- ---------- ENUM ----------
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('karyawan','kabag','pic','admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status_tahap AS ENUM ('pending','on_progress','selesai');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------- USERS ----------
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  nama_lengkap VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255),
  no_hp VARCHAR(30),
  unit_kerja VARCHAR(50),
  role user_role NOT NULL DEFAULT 'karyawan',
  sso_provider VARCHAR(30),
  sso_subject VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------- PENGADAAN ----------
CREATE TABLE IF NOT EXISTS pengadaan (
  id SERIAL PRIMARY KEY,
  kode VARCHAR(30) NOT NULL UNIQUE,
  nama_barang_jasa VARCHAR(255) NOT NULL,
  kategori VARCHAR(100),
  lokasi VARCHAR(150),
  titik_lokasi VARCHAR(255),
  metode_pengadaan VARCHAR(50),
  nilai_hps NUMERIC(18,2),
  deskripsi TEXT,
  request_document_name TEXT,
  request_document_file_data TEXT,
  request_document_file_path TEXT,
  stage2_vendor VARCHAR(150),
  stage2_invoice_number VARCHAR(100),
  stage2_invoice_date DATE,
  stage2_invoice_amount NUMERIC(18,2),
  tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
  status status_tahap NOT NULL DEFAULT 'pending',
  tanggal_selesai DATE,
  tahap1_status status_tahap NOT NULL DEFAULT 'pending',
  tahap2_status status_tahap NOT NULL DEFAULT 'pending',
  tahap3_status status_tahap NOT NULL DEFAULT 'pending',
  stage2_invoice_document_name TEXT,
  stage2_invoice_document_file_data TEXT,
  stage2_invoice_document_file_path TEXT,
  stage2_invoice_file_data TEXT,
  stage2_invoice_file_path TEXT,
  stage2_payment_proof_name TEXT,
  stage2_payment_proof_file_data TEXT,
  stage2_payment_proof_file_path TEXT,
  stage3_final_document_name TEXT,
  stage3_final_document_file_data TEXT,
  stage3_final_document_file_path TEXT,
  catatan TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS titik_lokasi VARCHAR(255);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS nilai_hps NUMERIC(18,2);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS deskripsi TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS request_document_name TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS request_document_file_data TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS request_document_file_path TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_vendor VARCHAR(150);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_number VARCHAR(100);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_date DATE;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_amount NUMERIC(18,2);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS tanggal DATE DEFAULT CURRENT_DATE;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS status status_tahap DEFAULT 'pending';
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS tahap1_status status_tahap DEFAULT 'pending';
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS tahap2_status status_tahap DEFAULT 'pending';
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS tahap3_status status_tahap DEFAULT 'pending';
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_name TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_file_data TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_file_path TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_file_data TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_file_path TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_payment_proof_name TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_payment_proof_file_data TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_payment_proof_file_path TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage3_final_document_name TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage3_final_document_file_data TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage3_final_document_file_path TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS catatan TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS updated_by INTEGER;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ---------- KENDARAAN ----------
CREATE TABLE IF NOT EXISTS kendaraan (
  id SERIAL PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  plate VARCHAR(30) NOT NULL UNIQUE,
  type VARCHAR(100) NOT NULL,
  sub VARCHAR(150),
  status VARCHAR(30) NOT NULL DEFAULT 'Tersedia',
  tax VARCHAR(50),
  next_tax VARCHAR(50),
  photo_name TEXT,
  photo_file_data TEXT,
  photo_file_path TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_name TEXT;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_file_data TEXT;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_file_path TEXT;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS updated_by INTEGER;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- ---------- RUANG RAPAT ----------
CREATE TABLE IF NOT EXISTS ruang_rapat (
  id SERIAL PRIMARY KEY,
  agenda VARCHAR(255) NOT NULL,
  room VARCHAR(150) NOT NULL,
  pic VARCHAR(150) NOT NULL,
  booking_date DATE NOT NULL,
  start_time TIME(0) NOT NULL,
  end_time TIME(0) NOT NULL,
  surat_status VARCHAR(20) NOT NULL DEFAULT 'belum',
  surat_name VARCHAR(255),
  surat_file_data TEXT,
  surat_file_path TEXT,
  created_by INTEGER,
  updated_by INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_name VARCHAR(255);
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_file_data TEXT;
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_file_path TEXT;
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS created_by INTEGER;
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS updated_by INTEGER;
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();

-- Bersihkan foreign-key orphan dari database lama sebelum menambahkan FK.
UPDATE pengadaan p SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.created_by);
UPDATE pengadaan p SET updated_by = NULL WHERE updated_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.updated_by);
UPDATE kendaraan k SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = k.created_by);
UPDATE kendaraan k SET updated_by = NULL WHERE updated_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = k.updated_by);
UPDATE ruang_rapat r SET created_by = NULL WHERE created_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.created_by);
UPDATE ruang_rapat r SET updated_by = NULL WHERE updated_by IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = r.updated_by);

-- ---------- RELATIONS (only add when missing) ----------
DO $$ BEGIN
  ALTER TABLE pengadaan ADD CONSTRAINT pengadaan_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE pengadaan ADD CONSTRAINT pengadaan_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE kendaraan ADD CONSTRAINT kendaraan_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE kendaraan ADD CONSTRAINT kendaraan_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ruang_rapat ADD CONSTRAINT ruang_rapat_created_by_fkey FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ruang_rapat ADD CONSTRAINT ruang_rapat_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill defaults for rows created by the old schema.
UPDATE pengadaan SET tanggal = CURRENT_DATE WHERE tanggal IS NULL;
UPDATE pengadaan SET status = 'pending' WHERE status IS NULL;
UPDATE pengadaan SET tahap1_status = 'pending' WHERE tahap1_status IS NULL;
UPDATE pengadaan SET tahap2_status = 'pending' WHERE tahap2_status IS NULL;
UPDATE pengadaan SET tahap3_status = 'pending' WHERE tahap3_status IS NULL;
UPDATE kendaraan SET status = 'Tersedia' WHERE status IS NULL OR status = '';
UPDATE ruang_rapat SET surat_status = 'belum' WHERE surat_status IS NULL OR surat_status = '';

CREATE INDEX IF NOT EXISTS pengadaan_created_at_idx ON pengadaan(created_at);
CREATE INDEX IF NOT EXISTS pengadaan_status_idx ON pengadaan(status);
CREATE INDEX IF NOT EXISTS kendaraan_plate_idx ON kendaraan(plate);
CREATE INDEX IF NOT EXISTS ruang_rapat_booking_date_room_idx ON ruang_rapat(booking_date, room);
CREATE INDEX IF NOT EXISTS ruang_rapat_pic_idx ON ruang_rapat(pic);

-- Jangan hapus nilai_hps. HPS hanya diisi dari Tahap 1 oleh aplikasi.
SELECT 'DATABASE REPAIR SELESAI - data lama tidak dihapus.' AS hasil;
