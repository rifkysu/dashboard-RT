-- =====================================================================
--  SKEMA DATABASE PRODUCTION -- Layanan Biro Umum & Rumah Tangga
-- =====================================================================
--  Satu file untuk membuat database production BARU (kosong) yang sudah
--  sama persis dengan aplikasi saat ini, tanpa perlu menjalankan
--  `npx prisma migrate deploy`.
--
--  Isi file = hasil akhir migration Prisma 0001_init s/d 0030_guest_cancel
--  (backend/prisma/migrations/), ditambah tabel riwayat `_prisma_migrations`
--  yang sudah terisi. Jadi setelah file ini dijalankan:
--    * `npx prisma migrate status` -> "Database schema is up to date!"
--    * migration baru berikutnya cukup `npx prisma migrate deploy` seperti biasa.
--
--  CARA PAKAI (pgAdmin4):
--    1. Buat database kosong, mis. biro_umum_db (Encoding UTF8).
--    2. Buka Query Tool pada database tsb, buka file ini, lalu Execute (F5).
--    3. Jalankan backend, daftar akun pertama lewat halaman Register, lalu
--       naikkan jadi admin dengan role_management.sql.
--  Atau lewat terminal:
--    psql "postgresql://USER:PASSWORD@HOST:5432/biro_umum_db" -f production_schema.sql
--
--  PENTING:
--    * Hanya untuk database KOSONG. Kalau tabel `users` sudah ada, script
--      berhenti dengan error dan tidak mengubah apa pun. Database lama yang
--      sudah berisi data cukup diperbarui dengan `npx prisma migrate deploy`.
--    * Semua dijalankan dalam satu transaksi: gagal di tengah = tidak ada
--      yang tersimpan.
--    * Kalau ada migration baru di prisma/migrations/, file ini juga harus
--      diperbarui (struktur + baris _prisma_migrations di bagian akhir).
--      Checksum = sha256 dari file migration.sql:  sha256sum migration.sql
--  Minimal PostgreSQL 12.
-- =====================================================================

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    RAISE EXCEPTION 'Tabel "users" sudah ada. production_schema.sql hanya untuk database kosong -- untuk database lama jalankan: npx prisma migrate deploy';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- Tipe enum
-- ---------------------------------------------------------------------
CREATE TYPE "user_role" AS ENUM ('karyawan','kabag','pic','admin');
CREATE TYPE "status_tahap" AS ENUM ('pending','on_progress','selesai');

-- ---------------------------------------------------------------------
-- users -- akun pengguna (role naik ke kabag/pic/admin lewat role_management.sql)
-- ---------------------------------------------------------------------
CREATE TABLE "users" (
  "id"                  SERIAL NOT NULL,
  "nama_lengkap"        VARCHAR(150) NOT NULL,
  "email"               VARCHAR(150) NOT NULL,
  "password_hash"       VARCHAR(255),
  "no_hp"               VARCHAR(30),
  "unit_kerja"          VARCHAR(50),
  "role"                "user_role" NOT NULL DEFAULT 'karyawan',
  "sso_provider"        VARCHAR(30),
  "sso_subject"         VARCHAR(255),
  "is_active"           BOOLEAN NOT NULL DEFAULT true,
  "reset_token"         VARCHAR(128),
  "reset_token_expires" TIMESTAMP(3),
  "reset_requested_at"  TIMESTAMP(3),          -- notifikasi "Lupa Password" di menu Akun
  "last_login_at"       TIMESTAMP(3),
  "token_version"       INTEGER NOT NULL DEFAULT 0, -- naik saat logout/reset/ban -> JWT lama tidak berlaku
  "created_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");

-- ---------------------------------------------------------------------
-- maintenance_mode -- mode maintenance per menu (diatur admin)
-- ---------------------------------------------------------------------
CREATE TABLE "maintenance_mode" (
  "id"         SERIAL NOT NULL,
  "menu_key"   VARCHAR(50) NOT NULL,
  "is_active"  BOOLEAN NOT NULL DEFAULT false,
  "message"    VARCHAR(255),
  "updated_by" INTEGER,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "maintenance_mode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "maintenance_mode_menu_key_key" ON "maintenance_mode"("menu_key");

-- ---------------------------------------------------------------------
-- pemeliharaan -- permintaan pemeliharaan sarana/prasarana (3 tahap)
-- ---------------------------------------------------------------------
CREATE TABLE "pemeliharaan" (
  "id"                                SERIAL NOT NULL,
  "kode"                              VARCHAR(30) NOT NULL,
  "judul"                             VARCHAR(255) NOT NULL,
  "lokasi"                            VARCHAR(150) NOT NULL,
  "titik_lokasi"                      VARCHAR(255),
  "kategori"                          VARCHAR(20) NOT NULL,
  "deskripsi"                         TEXT,
  "request_document_name"             TEXT,
  "request_document_file_data"        TEXT,
  "request_document_file_path"        TEXT,
  "tanggal"                           DATE NOT NULL DEFAULT CURRENT_DATE,
  "status"                            "status_tahap" NOT NULL DEFAULT 'pending',
  "tanggal_selesai"                   DATE,
  "tahap1_status"                     "status_tahap" NOT NULL DEFAULT 'pending',
  "tahap2_status"                     "status_tahap" NOT NULL DEFAULT 'pending',
  "tahap3_status"                     "status_tahap" NOT NULL DEFAULT 'pending',
  "jenis_pekerjaan"                   VARCHAR(100),
  "metode_pengadaan"                  VARCHAR(50),
  "urgensi"                           VARCHAR(20) DEFAULT 'sedang',
  "stage1_boq"                        TEXT,
  "stage1_hps"                        DECIMAL(18,2),
  "stage1_document_name"              TEXT,
  "stage1_document_file_data"         TEXT,
  "stage1_document_file_path"         TEXT,
  "stage1_boq_file_data"              TEXT,
  "stage1_boq_file_path"              TEXT,
  "stage2_payment_method"             VARCHAR(20),   -- GUP / TUP / LS
  "stage2_payment_number"             INTEGER,       -- GUP 1-20 / TUP 1-10
  "stage2_ls_date"                    DATE,
  "stage2_budget_source"              VARCHAR(10),   -- RM / PNBP
  "stage2_vendor"                     VARCHAR(150),
  "stage2_invoice_number"             VARCHAR(100),
  "stage2_invoice_date"               DATE,
  "stage2_invoice_amount"             DECIMAL(18,2),
  "stage2_invoice_document_name"      TEXT,
  "stage2_invoice_document_file_data" TEXT,
  "stage2_invoice_document_file_path" TEXT,
  "stage3_documentation_names"        TEXT,
  "stage3_documentation_files"        TEXT,
  "stage3_documentation_file_paths"   TEXT,
  "stage3_bast_notes"                 TEXT,
  "catatan"                           TEXT,
  "created_by"                        INTEGER,
  "updated_by"                        INTEGER,
  "created_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pemeliharaan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pemeliharaan_kode_key" UNIQUE ("kode"),
  CONSTRAINT "pemeliharaan_kategori_check" CHECK ("kategori" IN ('sarana','prasarana'))
);
CREATE INDEX "pemeliharaan_created_at_idx" ON "pemeliharaan"("created_at");
CREATE INDEX "pemeliharaan_status_idx" ON "pemeliharaan"("status");

-- ---------------------------------------------------------------------
-- pengadaan -- permintaan pengadaan barang/jasa (3 tahap)
-- ---------------------------------------------------------------------
CREATE TABLE "pengadaan" (
  "id"                                SERIAL NOT NULL,
  "kode"                              VARCHAR(30) NOT NULL,
  "nama_barang_jasa"                  VARCHAR(255) NOT NULL,
  "kategori"                          VARCHAR(100),
  "lokasi"                            VARCHAR(150),
  "titik_lokasi"                      VARCHAR(255),
  "metode_pengadaan"                  VARCHAR(50),
  "nilai_hps"                         DECIMAL(18,2),
  "deskripsi"                         TEXT,
  "request_document_name"             TEXT,
  "request_document_file_data"        TEXT,
  "request_document_file_path"        TEXT,
  "stage2_payment_method"             VARCHAR(20),
  "stage2_payment_number"             INTEGER,
  "stage2_ls_date"                    DATE,
  "stage2_budget_source"              VARCHAR(10),
  "stage2_vendor"                     VARCHAR(150),
  "stage2_invoice_number"             VARCHAR(100),
  "stage2_invoice_date"               DATE,
  "stage2_invoice_amount"             DECIMAL(18,2),
  "tanggal"                           DATE NOT NULL DEFAULT CURRENT_DATE,
  "status"                            "status_tahap" NOT NULL DEFAULT 'pending',
  "tanggal_selesai"                   DATE,
  "tahap1_status"                     "status_tahap" NOT NULL DEFAULT 'pending',
  "tahap2_status"                     "status_tahap" NOT NULL DEFAULT 'pending',
  "tahap3_status"                     "status_tahap" NOT NULL DEFAULT 'pending',
  "stage2_invoice_document_name"      TEXT,
  "stage2_invoice_document_file_data" TEXT,
  "stage2_invoice_document_file_path" TEXT,
  "stage2_invoice_file_data"          TEXT,
  "stage2_invoice_file_path"          TEXT,
  "stage2_payment_proof_name"         TEXT,
  "stage2_payment_proof_file_data"    TEXT,
  "stage2_payment_proof_file_path"    TEXT,
  "stage3_final_document_name"        TEXT,
  "stage3_final_document_file_data"   TEXT,
  "stage3_final_document_file_path"   TEXT,
  "catatan"                           TEXT,
  "created_by"                        INTEGER,
  "updated_by"                        INTEGER,
  "created_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pengadaan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "pengadaan_kode_key" UNIQUE ("kode")
);
CREATE INDEX "pengadaan_created_at_idx" ON "pengadaan"("created_at");
CREATE INDEX "pengadaan_status_idx" ON "pengadaan"("status");

-- ---------------------------------------------------------------------
-- kendaraan -- aset kendaraan dinas (format BMN) + dokumen BPKB/STNK + galeri foto
-- ---------------------------------------------------------------------
CREATE TABLE "kendaraan" (
  "id"                      SERIAL NOT NULL,
  "nama_barang"             VARCHAR(150) NOT NULL,
  "merk"                    VARCHAR(100) NOT NULL,
  "tipe"                    VARCHAR(100) NOT NULL,
  "no_bpkb"                 VARCHAR(50),
  "plate"                   VARCHAR(30) NOT NULL,  -- Nomor Polisi (wajib)
  "plat_khusus"             VARCHAR(30),           -- opsional, bisa bersamaan dengan nomor polisi
  "jenis"                   VARCHAR(30) NOT NULL,  -- Roda 2 / Roda 4 / Roda 6
  "sub"                     VARCHAR(150),
  "status"                  VARCHAR(30) NOT NULL DEFAULT 'Tersedia',
  "tanggal_perolehan"       DATE,
  "masa_berlaku_stnk"       DATE,
  "waktu_pajak"             DATE,
  "photos"                  TEXT,
  "photo_file_paths"        TEXT,
  "bpkb_document_name"      TEXT,
  "bpkb_document_file_data" TEXT,
  "bpkb_document_file_path" TEXT,
  "stnk_document_name"      TEXT,
  "stnk_document_file_data" TEXT,
  "stnk_document_file_path" TEXT,
  "created_by"              INTEGER,
  "updated_by"              INTEGER,
  "created_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kendaraan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kendaraan_plate_key" UNIQUE ("plate")
);
CREATE INDEX "kendaraan_plate_idx" ON "kendaraan"("plate");

-- ---------------------------------------------------------------------
-- kendaraan_service -- riwayat service per kendaraan (ikut terhapus bersama kendaraannya)
-- ---------------------------------------------------------------------
CREATE TABLE "kendaraan_service" (
  "id"                         SERIAL NOT NULL,
  "kendaraan_id"               INTEGER NOT NULL,
  "tanggal_service"            DATE NOT NULL,
  "created_by"                 INTEGER,
  "updated_by"                 INTEGER,
  "created_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "invoice_document_name"      TEXT,
  "invoice_document_file_data" TEXT,
  "invoice_document_file_path" TEXT,
  "bagian_service"             VARCHAR(255),  -- mis. "Ganti oli, kampas rem"
  CONSTRAINT "kendaraan_service_pkey" PRIMARY KEY ("id")
);
-- Satu kendaraan hanya boleh satu catatan service per tanggal.
CREATE UNIQUE INDEX "kendaraan_service_kendaraan_id_tanggal_service_key" ON "kendaraan_service"("kendaraan_id", "tanggal_service");

-- ---------------------------------------------------------------------
-- ruang_rapat -- booking ruang rapat (multi-hari, cancel tanpa hapus, kode pengajuan)
-- ---------------------------------------------------------------------
-- Akun tamu dari login Google di landing page (hanya untuk booking ruang rapat).
CREATE TABLE "guest_accounts" (
  "id"            SERIAL PRIMARY KEY,
  "google_sub"    VARCHAR(255) NOT NULL,
  "email"         VARCHAR(254) NOT NULL,
  "nama"          VARCHAR(150) NOT NULL,
  "foto"          VARCHAR(500),
  "is_blocked"    BOOLEAN NOT NULL DEFAULT false,
  "token_version" INTEGER NOT NULL DEFAULT 0,
  "last_login_at" TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "guest_accounts_google_sub_key" ON "guest_accounts"("google_sub");

CREATE TABLE "ruang_rapat" (
  "id"              SERIAL NOT NULL,
  "agenda"          VARCHAR(255) NOT NULL,
  "room"            VARCHAR(150) NOT NULL,
  "pic"             VARCHAR(150) NOT NULL,
  "pic_phone"       VARCHAR(30) NOT NULL,
  "booking_date"    DATE NOT NULL,
  "end_date"        DATE NOT NULL,            -- = booking_date untuk booking 1 hari
  "start_time"      TIME(0) NOT NULL,
  "end_time"        TIME(0) NOT NULL,
  "surat_status"    VARCHAR(20) NOT NULL DEFAULT 'belum', -- otomatis: ada file surat -> 'diterima'
  "nomor_surat"     VARCHAR(100),
  "surat_name"      VARCHAR(255),
  "surat_file_data" TEXT,
  "surat_file_path" TEXT,
  "created_by"      INTEGER,
  "updated_by"      INTEGER,
  "cancelled_at"    TIMESTAMP(3),             -- terisi = booking dibatalkan
  "cancelled_by"    INTEGER,
  "cancel_reason"   VARCHAR(500),
  "booking_group"   VARCHAR(36),              -- kode pengajuan (satu kali booking)
  "guest_id"        INTEGER,                  -- terisi = diajukan akun tamu (login Google)
  "cancelled_by_guest_id" INTEGER,            -- terisi = dibatalkan sendiri oleh tamu pengaju
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ruang_rapat_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ruang_rapat_surat_status_check" CHECK ("surat_status" IN ('belum','ditinjau','diterima')),
  CONSTRAINT "ruang_rapat_time_check" CHECK ("end_time" > "start_time"),
  CONSTRAINT "ruang_rapat_end_date_check" CHECK ("end_date" >= "booking_date")
);
CREATE INDEX "ruang_rapat_booking_date_room_idx" ON "ruang_rapat"("booking_date", "room");
CREATE INDEX "ruang_rapat_room_booking_date_end_date_idx" ON "ruang_rapat"("room", "booking_date", "end_date");
CREATE INDEX "ruang_rapat_pic_idx" ON "ruang_rapat"("pic");
CREATE INDEX "ruang_rapat_cancelled_at_idx" ON "ruang_rapat"("cancelled_at");
CREATE INDEX "ruang_rapat_booking_group_idx" ON "ruang_rapat"("booking_group");
CREATE INDEX "ruang_rapat_guest_id_idx" ON "ruang_rapat"("guest_id");

-- ---------------------------------------------------------------------
-- Foreign key
-- ---------------------------------------------------------------------
ALTER TABLE "maintenance_mode"  ADD CONSTRAINT "maintenance_mode_updated_by_fkey"  FOREIGN KEY ("updated_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pemeliharaan"      ADD CONSTRAINT "pemeliharaan_created_by_fkey"      FOREIGN KEY ("created_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pemeliharaan"      ADD CONSTRAINT "pemeliharaan_updated_by_fkey"      FOREIGN KEY ("updated_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pengadaan"         ADD CONSTRAINT "pengadaan_created_by_fkey"         FOREIGN KEY ("created_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pengadaan"         ADD CONSTRAINT "pengadaan_updated_by_fkey"         FOREIGN KEY ("updated_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kendaraan"         ADD CONSTRAINT "kendaraan_created_by_fkey"         FOREIGN KEY ("created_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kendaraan"         ADD CONSTRAINT "kendaraan_updated_by_fkey"         FOREIGN KEY ("updated_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kendaraan_service" ADD CONSTRAINT "kendaraan_service_kendaraan_id_fkey" FOREIGN KEY ("kendaraan_id") REFERENCES "kendaraan"("id") ON DELETE CASCADE  ON UPDATE CASCADE;
ALTER TABLE "kendaraan_service" ADD CONSTRAINT "kendaraan_service_created_by_fkey" FOREIGN KEY ("created_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kendaraan_service" ADD CONSTRAINT "kendaraan_service_updated_by_fkey" FOREIGN KEY ("updated_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ruang_rapat"       ADD CONSTRAINT "ruang_rapat_created_by_fkey"       FOREIGN KEY ("created_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ruang_rapat"       ADD CONSTRAINT "ruang_rapat_updated_by_fkey"       FOREIGN KEY ("updated_by")   REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ruang_rapat"       ADD CONSTRAINT "ruang_rapat_cancelled_by_fkey"     FOREIGN KEY ("cancelled_by") REFERENCES "users"("id")     ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ruang_rapat"       ADD CONSTRAINT "ruang_rapat_guest_id_fkey"         FOREIGN KEY ("guest_id")     REFERENCES "guest_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ruang_rapat"       ADD CONSTRAINT "ruang_rapat_cancelled_by_guest_id_fkey" FOREIGN KEY ("cancelled_by_guest_id") REFERENCES "guest_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ---------------------------------------------------------------------
-- Function & trigger
-- ---------------------------------------------------------------------
-- updated_at otomatis (jam UTC) juga untuk update langsung lewat pgAdmin4.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW."updated_at" = (now() AT TIME ZONE 'UTC'); RETURN NEW; END; $$ LANGUAGE plpgsql;

CREATE TRIGGER "users_updated_at"             BEFORE UPDATE ON "users"             FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "maintenance_mode_updated_at"  BEFORE UPDATE ON "maintenance_mode"  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "pemeliharaan_updated_at"      BEFORE UPDATE ON "pemeliharaan"      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "pengadaan_updated_at"         BEFORE UPDATE ON "pengadaan"         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "kendaraan_updated_at"         BEFORE UPDATE ON "kendaraan"         FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "kendaraan_service_updated_at" BEFORE UPDATE ON "kendaraan_service" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "ruang_rapat_updated_at"       BEFORE UPDATE ON "ruang_rapat"       FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "guest_accounts_updated_at"    BEFORE UPDATE ON "guest_accounts"    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Tanggal selesai terisi otomatis saat status 'selesai', dikosongkan kalau status lain.
CREATE OR REPLACE FUNCTION set_tanggal_selesai()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'selesai' THEN
    IF NEW.tanggal_selesai IS NULL THEN NEW.tanggal_selesai = CURRENT_DATE; END IF;
  ELSE
    NEW.tanggal_selesai = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pemeliharaan_tanggal_selesai BEFORE INSERT OR UPDATE ON pemeliharaan FOR EACH ROW EXECUTE FUNCTION set_tanggal_selesai();
CREATE TRIGGER trg_pengadaan_tanggal_selesai    BEFORE INSERT OR UPDATE ON pengadaan    FOR EACH ROW EXECUTE FUNCTION set_tanggal_selesai();

-- ---------------------------------------------------------------------
-- Data awal: baris mode maintenance untuk tiap menu (semua nonaktif)
-- ---------------------------------------------------------------------
INSERT INTO "maintenance_mode" ("menu_key", "is_active") VALUES
  ('dashboard', false),
  ('pemeliharaan', false),
  ('pengadaan', false),
  ('kendaraan', false),
  ('ruang-rapat', false),
  ('landing', false)
ON CONFLICT ("menu_key") DO NOTHING;

-- ---------------------------------------------------------------------
-- Riwayat migration Prisma -- menandai 0001 s/d 0030 sudah diterapkan,
-- supaya `prisma migrate deploy` berikutnya hanya menjalankan migration baru.
-- ---------------------------------------------------------------------
CREATE TABLE "_prisma_migrations" (
  "id"                  VARCHAR(36) PRIMARY KEY NOT NULL,
  "checksum"            VARCHAR(64) NOT NULL,
  "finished_at"         TIMESTAMPTZ,
  "migration_name"      VARCHAR(255) NOT NULL,
  "logs"                TEXT,
  "rolled_back_at"      TIMESTAMPTZ,
  "started_at"          TIMESTAMPTZ NOT NULL DEFAULT now(),
  "applied_steps_count" INTEGER NOT NULL DEFAULT 0
);

INSERT INTO "_prisma_migrations" ("id", "checksum", "finished_at", "migration_name", "applied_steps_count")
SELECT md5(random()::text || clock_timestamp()::text || m.name)::uuid::text, m.checksum, now(), m.name, 1
FROM (VALUES
  ('0001_init',                             '1e544c124f5da289fb8a59e305e1529131ea20364f84518a761c75b29806a52b'),
  ('0002_tanggal_selesai',                  '6096605071397a4118a131f5e29ae5263548ccff46a9c7356e978f212ad31fb4'),
  ('0003_pic_auto_promote_backfill',        '6ffce21bb172c27a6f4177afa8108f1389046e02c32a0762e8e50cf307d18446'),
  ('0004_password_reset',                   'e22f9eb8f7494e724f9c2c4a8c9f3806a9b9d66242a2751a5603af93e9d5f97e'),
  ('0005_stage2_payment_detail',            'fa2e656e5a72adbbc79725fb2d3ff7f186822a2bdb1364832f1a42615ea83fc6'),
  ('0006_stage2_budget_source',             'a2669518d6a848aab91f96b2ef4fd7c0c58676b3690c959583127b226b243fde'),
  ('0007_maintenance_mode',                 '4bfa0e78998fbe091db97b1814a95a596053bce8b83981283f4aa2fca6076171'),
  ('0008_landing_maintenance',              '909592fc4075810a2b13fa801478ae21bcb4ce9b0072ef21b8952da1205c9914'),
  ('0009_kendaraan_asset_fields',           'ec57ab5c71d773f3e505960e6e3f7be082e0e7a0853f4109e2bf3e14f1c61ca9'),
  ('0010_user_last_login',                  '5f29d32122fc790dd33744f1dff49d87aed744ea3614da7fb315e557c821edb2'),
  ('0011_kendaraan_jenis_plat',             'adc45b5c8cc0e1beabb043751afbe109e8877a440cd043482ee5111426aaacda'),
  ('0012_kendaraan_plat_khusus',            'bdd4c028263f6100b41c10482b641afffd563e8982b8ae0dadf9decd6cdc0ea0'),
  ('0013_kendaraan_dokumen',                'ff9097425191ea590b411fe4b02c7ae6240a6257557d7b494e61c11131780b6b'),
  ('0014_user_reset_request',               'ca9e307d47dc320dd85d6899045b8ac149a5c381fe6d9514093c1144a159c568'),
  ('0015_kendaraan_invoice_service',        '94ecd89e829c60afc6fe190446547d20ee71d5e59346c0f6a4ec92c148145469'),
  ('0016_ruang_rapat_nomor_surat',          '3aca8e1e94a840638bc85194eb989e1bb646969c1f5040a9c322d7e9f81fcaad'),
  ('0017_kendaraan_service_history',        '0116635ba5a9b704ad4f5e99efac777ce47d3ea09cd4cff33586ee51472acf29'),
  ('0018_kendaraan_service_simple',         '9a871ad97c1dbead0efe7a1603840924c8e1dc2c4740c8c52270d58347a75d3a'),
  ('0019_kendaraan_service_invoice',        '92a4a44e83d4a6b1ffb92d6b0a4952ef3f6acd80c50c47d7b181c76cef8a98f6'),
  ('0020_kendaraan_service_bagian',         'a2f2caa43cab9e3e2a599a69a0f55bc03685e929efb0b42cef9af15bf3e9a0eb'),
  ('0021_kendaraan_service_unique_tanggal', 'efbbd4420ed2df882ae4aa7c4855002667995c42c9ad118b14cb1991513404e8'),
  ('0022_ruang_rapat_multi_hari',           '81f5a5560f7a2c394eccdb28a7275797d03c2beeda2b9cabce37139053d472c6'),
  ('0023_sinkron_kolom_pgadmin',            '5c1423ec309f45dc70625dabb614c11f3d4a0dc44f60daef3f779ce24e08ac5c'),
  ('0024_ruang_rapat_cancel',               'ab8dd2a4e3bdf70942777a7125fb856a4de679e3597c05808575400a19bab66d'),
  ('0025_token_version',                    '0e37f0da4942280c5728284739995b6b728e6dbcf11776ca43d547c9a42fa27a'),
  ('0026_surat_status_otomatis',            'f1e49b6a2500c867a606874986f7f945f68016abbf0e09ff152310a96d8d1495'),
  ('0027_ruang_rapat_booking_group',        'dd3e8a98353b95b0c1e26045710133dd84f582b2d530b0c317404a6c9bac7723'),
  ('0028_updated_at_utc',                   'c2f9591c3bcb9f82a2c3bc35b7298c4875871b10e5c8ea9db7c6c813e763e4c4'),
  ('0029_guest_booking_sso',                '6d8f68a3ed9ab6947d70251837bea9f959d96d74fff5bbaf7eb1ba3f7aa7c00d'),
  ('0030_guest_cancel',                     '8e03410cada48534e620951fff51362063fa37d33a81ff6179ba82bd9224489c')
) AS m(name, checksum)
ORDER BY m.name;

COMMIT;
