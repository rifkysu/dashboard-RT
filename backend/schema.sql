-- =========================================================
-- SCHEMA DATABASE: Layanan Biro Umum & Rumah Tangga
-- Jalankan file ini di pgAdmin4 (Query Tool) setelah membuat
-- database baru, misalnya bernama: biro_umum_db
-- =========================================================

-- Hapus dulu kalau mau reset total (opsional, hati-hati di production)
-- DROP TABLE IF EXISTS pengadaan CASCADE;
-- DROP TABLE IF EXISTS pemeliharaan CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TYPE IF EXISTS user_role;
-- DROP TYPE IF EXISTS status_tahap;

-- ---------------------------------------------------------
-- ENUM Role Pengguna
-- karyawan : hanya boleh melihat (read-only) & membuat permintaan baru
-- kabag    : boleh melihat & mengedit / memproses semua tahapan
-- pic      : role khusus, punya hak edit sama seperti kabag,
--            TAPI role ini TIDAK tersedia di form "Daftar Akun Baru".
--            Role ini hanya bisa diberikan lewat pgAdmin4 (lihat README).
-- admin    : opsional, super user (jika dibutuhkan)
-- ---------------------------------------------------------
CREATE TYPE user_role AS ENUM ('karyawan', 'kabag', 'pic', 'admin');

CREATE TYPE status_tahap AS ENUM ('pending', 'on_progress', 'selesai');

-- ---------------------------------------------------------
-- TABEL USERS
-- ---------------------------------------------------------
CREATE TABLE users (
    id              SERIAL PRIMARY KEY,
    nama_lengkap    VARCHAR(150) NOT NULL,
    email           VARCHAR(150) NOT NULL UNIQUE,
    password_hash   VARCHAR(255),              -- NULL jika user hanya login via SSO
    no_hp           VARCHAR(30),
    unit_kerja      VARCHAR(50),
    role            user_role NOT NULL DEFAULT 'karyawan',
    sso_provider    VARCHAR(30),                -- contoh: 'google'
    sso_subject     VARCHAR(255),               -- id unik dari provider SSO
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);

-- ---------------------------------------------------------
-- TABEL PEMELIHARAAN
-- ---------------------------------------------------------
CREATE TABLE pemeliharaan (
    id              SERIAL PRIMARY KEY,
    kode            VARCHAR(30) NOT NULL UNIQUE,
    judul           VARCHAR(255) NOT NULL,
    lokasi          VARCHAR(150) NOT NULL,
    titik_lokasi    VARCHAR(255),
    kategori        VARCHAR(20) NOT NULL CHECK (kategori IN ('sarana','prasarana')),
    deskripsi       TEXT,
    request_document_name TEXT,
    request_document_file_data TEXT,
    tanggal         DATE NOT NULL DEFAULT CURRENT_DATE,
    status          status_tahap NOT NULL DEFAULT 'pending',
    tanggal_selesai  DATE,
    tahap1_status   status_tahap NOT NULL DEFAULT 'pending', -- Analisa/HPS
    tahap2_status   status_tahap NOT NULL DEFAULT 'pending', -- Invoice/Pembayaran
    tahap3_status   status_tahap NOT NULL DEFAULT 'pending', -- BAST/Dokumentasi
    jenis_pekerjaan VARCHAR(100),
    metode_pengadaan VARCHAR(50),
    urgensi         VARCHAR(20) DEFAULT 'sedang',
    stage1_boq      TEXT,
    stage1_hps      NUMERIC(18,2),
    stage1_document_name TEXT,
    stage1_document_file_data TEXT,
    stage1_boq_file_data TEXT,
    stage2_payment_method VARCHAR(20),
    stage2_vendor   VARCHAR(150),
    stage2_invoice_number VARCHAR(100),
    stage2_invoice_date DATE,
    stage2_invoice_amount NUMERIC(18,2),
    stage2_invoice_document_name TEXT,
    stage2_invoice_document_file_data TEXT,
    stage3_documentation_names TEXT,
    stage3_documentation_files TEXT,
    stage3_bast_notes TEXT,
    catatan         TEXT,
    created_by      INTEGER REFERENCES users(id),
    updated_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- TABEL PENGADAAN
-- ---------------------------------------------------------
CREATE TABLE pengadaan (
    id                  SERIAL PRIMARY KEY,
    kode                VARCHAR(30) NOT NULL UNIQUE,
    nama_barang_jasa    VARCHAR(255) NOT NULL,
    kategori            VARCHAR(100),
    lokasi              VARCHAR(150),
    metode_pengadaan   VARCHAR(50),
    nilai_hps           NUMERIC(18,2),
    deskripsi           TEXT,
    request_document_name TEXT,
    request_document_file_data TEXT,
    stage2_vendor       VARCHAR(150),
    stage2_invoice_number VARCHAR(100),
    stage2_invoice_date DATE,
    stage2_invoice_amount NUMERIC(18,2),
    tanggal             DATE NOT NULL DEFAULT CURRENT_DATE,
    status              status_tahap NOT NULL DEFAULT 'pending',
    tanggal_selesai     DATE,
    tahap1_status       status_tahap NOT NULL DEFAULT 'pending', -- Analisa Harga / HPS
    tahap2_status       status_tahap NOT NULL DEFAULT 'pending', -- Invoice & Pembayaran
    tahap3_status       status_tahap NOT NULL DEFAULT 'pending', -- Dokumentasi & Finalisasi
    stage2_invoice_document_name TEXT,
    stage2_invoice_document_file_data TEXT,
    stage2_invoice_file_data TEXT,
    stage2_payment_proof_name TEXT,
    stage2_payment_proof_file_data TEXT,
    stage3_final_document_name TEXT,
    stage3_final_document_file_data TEXT,
    catatan             TEXT,
    created_by          INTEGER REFERENCES users(id),
    updated_by          INTEGER REFERENCES users(id),
    created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

-- ---------------------------------------------------------
-- TABEL KENDARAAN + FOTO
-- ---------------------------------------------------------
-- MIGRASI KENDARAAN + FOTO
-- Jalankan di pgAdmin4 Query Tool pada database Biro Umum.
-- Aman dijalankan lebih dari sekali.

CREATE TABLE IF NOT EXISTS kendaraan (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    plate           VARCHAR(30) NOT NULL UNIQUE,
    type            VARCHAR(100) NOT NULL,
    sub             VARCHAR(150),
    status          VARCHAR(30) NOT NULL DEFAULT 'Tersedia',
    tax             VARCHAR(50),
    next_tax        VARCHAR(50),
    photo_name      TEXT,
    photo_file_data TEXT,
    created_by      INTEGER REFERENCES users(id),
    updated_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kendaraan_plate ON kendaraan(plate);

ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_name TEXT;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_file_data TEXT;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kendaraan_updated_at ON kendaraan;
CREATE TRIGGER trg_kendaraan_updated_at
BEFORE UPDATE ON kendaraan
FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ---------------------------------------------------------
-- Trigger sederhana untuk auto-update kolom updated_at
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pemeliharaan_updated_at BEFORE UPDATE ON pemeliharaan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_pengadaan_updated_at BEFORE UPDATE ON pengadaan
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------
-- (OPSIONAL) Data contoh supaya dashboard tidak kosong
-- ---------------------------------------------------------
INSERT INTO pemeliharaan (kode, judul, lokasi, titik_lokasi, kategori, tanggal, status, tahap1_status, tahap2_status, tahap3_status)
VALUES
('REQ-2024-001', 'Perbaikan & Service Berkala AC Split', 'Graha Kemnaker', 'Ruang Rapat Utama Lantai 3', 'sarana', '2024-10-12', 'pending', 'pending', 'pending', 'pending'),
('REQ-2024-002', 'Perbaikan Instalasi Lampu & Saklar Koridor', 'Gatsu 51', 'Koridor Sayap Kanan 2A', 'prasarana', '2024-10-11', 'on_progress', 'on_progress', 'pending', 'pending'),
('REQ-2024-003', 'Perbaikan Plafon Bocor & Pengecatan Dinding', 'Wisma Ciloto', 'Toilet & Selasar Lantai 2', 'prasarana', '2024-10-09', 'selesai', 'selesai', 'selesai', 'selesai');

INSERT INTO pengadaan (kode, nama_barang_jasa, kategori, nilai_hps, tanggal, status, tahap1_status, tahap2_status, tahap3_status)
VALUES
('PGD-2024-001', 'Pengadaan Kertas & ATK Kantor Triwulan IV', 'Barang Habis Pakai', 25000000, '2024-10-05', 'pending', 'pending', 'pending', 'pending'),
('PGD-2024-002', 'Jasa Perawatan Genset Gedung Utama', 'Jasa', 'PT Karya Listrik Mandiri', 18500000, '2024-10-02', 'on_progress', 'selesai', 'on_progress', 'pending');

-- ---------------------------------------------------------
-- CATATAN AKUN AWAL
-- ---------------------------------------------------------
-- Jangan insert user lewat SQL dengan password mentah/hash palsu,
-- karena hash password HARUS dibuat oleh bcrypt di backend supaya
-- valid saat proses login (kalau hash asal ketik, login pasti gagal).
--
-- Cara membuat akun KABAG pertama kali:
--   1. Jalankan backend & frontend (lihat README.md).
--   2. Buka halaman "Daftar Akun Baru", isi data, pilih Peran = "Kabag".
--   3. Setelah submit, akun kabag akan otomatis tersimpan (password
--      sudah ter-hash otomatis oleh backend).
--
-- Cara memberi role "PIC" (role khusus, tidak ada di form pendaftaran):
--   Lihat bagian "Memberikan Role PIC" di README.md — dilakukan lewat
--   Query Tool pgAdmin4 dengan perintah UPDATE, contoh ada di sana.

-- ---------------------------------------------------------
-- TABEL RUANG RAPAT
-- ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS ruang_rapat (
    id              SERIAL PRIMARY KEY,
    agenda          VARCHAR(255) NOT NULL,
    room            VARCHAR(150) NOT NULL,
    pic             VARCHAR(150) NOT NULL,
    booking_date    DATE NOT NULL,
    start_time      TIME NOT NULL,
    end_time        TIME NOT NULL,
    surat_status    VARCHAR(20) NOT NULL DEFAULT 'belum'
                    CHECK (surat_status IN ('belum','ditinjau','diterima')),
    surat_name      VARCHAR(255),
    surat_file_data TEXT,
    created_by      INTEGER REFERENCES users(id),
    updated_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_ruang_rapat_date_room ON ruang_rapat (booking_date, room);
CREATE INDEX IF NOT EXISTS idx_ruang_rapat_pic ON ruang_rapat (pic);
