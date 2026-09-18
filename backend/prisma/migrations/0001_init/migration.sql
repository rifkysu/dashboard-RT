-- Prisma baseline migration for a fresh Biro Umum PostgreSQL database.
CREATE TYPE "user_role" AS ENUM ('karyawan','kabag','pic','admin');
CREATE TYPE "status_tahap" AS ENUM ('pending','on_progress','selesai');

CREATE TABLE "users" (
  "id" SERIAL NOT NULL,
  "nama_lengkap" VARCHAR(150) NOT NULL,
  "email" VARCHAR(150) NOT NULL,
  "password_hash" VARCHAR(255),
  "no_hp" VARCHAR(30),
  "unit_kerja" VARCHAR(50),
  "role" "user_role" NOT NULL DEFAULT 'karyawan',
  "sso_provider" VARCHAR(30),
  "sso_subject" VARCHAR(255),
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "pemeliharaan" (
  "id" SERIAL NOT NULL,"kode" VARCHAR(30) NOT NULL,"judul" VARCHAR(255) NOT NULL,"lokasi" VARCHAR(150) NOT NULL,"titik_lokasi" VARCHAR(255),"kategori" VARCHAR(20) NOT NULL,"deskripsi" TEXT,"request_document_name" TEXT,"request_document_file_data" TEXT,"request_document_file_path" TEXT,"tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,"status" "status_tahap" NOT NULL DEFAULT 'pending',"tanggal_selesai" DATE,"tahap1_status" "status_tahap" NOT NULL DEFAULT 'pending',"tahap2_status" "status_tahap" NOT NULL DEFAULT 'pending',"tahap3_status" "status_tahap" NOT NULL DEFAULT 'pending',"jenis_pekerjaan" VARCHAR(100),"metode_pengadaan" VARCHAR(50),"urgensi" VARCHAR(20) DEFAULT 'sedang',"stage1_boq" TEXT,"stage1_hps" DECIMAL(18,2),"stage1_document_name" TEXT,"stage1_document_file_data" TEXT,"stage1_document_file_path" TEXT,"stage1_boq_file_data" TEXT,"stage1_boq_file_path" TEXT,"stage2_payment_method" VARCHAR(20),"stage2_vendor" VARCHAR(150),"stage2_invoice_number" VARCHAR(100),"stage2_invoice_date" DATE,"stage2_invoice_amount" DECIMAL(18,2),"stage2_invoice_document_name" TEXT,"stage2_invoice_document_file_data" TEXT,"stage2_invoice_document_file_path" TEXT,"stage3_documentation_names" TEXT,"stage3_documentation_files" TEXT,"stage3_documentation_file_paths" TEXT,"stage3_bast_notes" TEXT,"catatan" TEXT,"created_by" INTEGER,"updated_by" INTEGER,"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pemeliharaan_pkey" PRIMARY KEY ("id"), CONSTRAINT "pemeliharaan_kode_key" UNIQUE ("kode"), CONSTRAINT "pemeliharaan_kategori_check" CHECK ("kategori" IN ('sarana','prasarana'))
);
CREATE INDEX "pemeliharaan_created_at_idx" ON "pemeliharaan"("created_at"); CREATE INDEX "pemeliharaan_status_idx" ON "pemeliharaan"("status");

CREATE TABLE "pengadaan" (
  "id" SERIAL NOT NULL,"kode" VARCHAR(30) NOT NULL,"nama_barang_jasa" VARCHAR(255) NOT NULL,"kategori" VARCHAR(100),"lokasi" VARCHAR(150),"metode_pengadaan" VARCHAR(50),"nilai_hps" DECIMAL(18,2),"deskripsi" TEXT,"request_document_name" TEXT,"request_document_file_data" TEXT,"request_document_file_path" TEXT,"stage2_vendor" VARCHAR(150),"stage2_invoice_number" VARCHAR(100),"stage2_invoice_date" DATE,"stage2_invoice_amount" DECIMAL(18,2),"tanggal" DATE NOT NULL DEFAULT CURRENT_DATE,"status" "status_tahap" NOT NULL DEFAULT 'pending',"tanggal_selesai" DATE,"tahap1_status" "status_tahap" NOT NULL DEFAULT 'pending',"tahap2_status" "status_tahap" NOT NULL DEFAULT 'pending',"tahap3_status" "status_tahap" NOT NULL DEFAULT 'pending',"stage2_invoice_document_name" TEXT,"stage2_invoice_document_file_data" TEXT,"stage2_invoice_document_file_path" TEXT,"stage2_invoice_file_data" TEXT,"stage2_invoice_file_path" TEXT,"stage2_payment_proof_name" TEXT,"stage2_payment_proof_file_data" TEXT,"stage2_payment_proof_file_path" TEXT,"stage3_final_document_name" TEXT,"stage3_final_document_file_data" TEXT,"stage3_final_document_file_path" TEXT,"catatan" TEXT,"created_by" INTEGER,"updated_by" INTEGER,"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "pengadaan_pkey" PRIMARY KEY ("id"), CONSTRAINT "pengadaan_kode_key" UNIQUE ("kode")
);
CREATE INDEX "pengadaan_created_at_idx" ON "pengadaan"("created_at"); CREATE INDEX "pengadaan_status_idx" ON "pengadaan"("status");

CREATE TABLE "kendaraan" (
  "id" SERIAL NOT NULL,"name" VARCHAR(150) NOT NULL,"plate" VARCHAR(30) NOT NULL,"type" VARCHAR(100) NOT NULL,"sub" VARCHAR(150),"status" VARCHAR(30) NOT NULL DEFAULT 'Tersedia',"tax" VARCHAR(50),"next_tax" VARCHAR(50),"photo_name" TEXT,"photo_file_data" TEXT,"photo_file_path" TEXT,"created_by" INTEGER,"updated_by" INTEGER,"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kendaraan_pkey" PRIMARY KEY ("id"), CONSTRAINT "kendaraan_plate_key" UNIQUE ("plate")
);
CREATE INDEX "kendaraan_plate_idx" ON "kendaraan"("plate");

CREATE TABLE "ruang_rapat" (
  "id" SERIAL NOT NULL,"agenda" VARCHAR(255) NOT NULL,"room" VARCHAR(150) NOT NULL,"pic" VARCHAR(150) NOT NULL,"booking_date" DATE NOT NULL,"start_time" TIME(0) NOT NULL,"end_time" TIME(0) NOT NULL,"surat_status" VARCHAR(20) NOT NULL DEFAULT 'belum',"surat_name" VARCHAR(255),"surat_file_data" TEXT,"surat_file_path" TEXT,"created_by" INTEGER,"updated_by" INTEGER,"created_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,"updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ruang_rapat_pkey" PRIMARY KEY ("id"), CONSTRAINT "ruang_rapat_surat_status_check" CHECK ("surat_status" IN ('belum','ditinjau','diterima')), CONSTRAINT "ruang_rapat_time_check" CHECK ("end_time" > "start_time")
);
CREATE INDEX "ruang_rapat_booking_date_room_idx" ON "ruang_rapat"("booking_date","room"); CREATE INDEX "ruang_rapat_pic_idx" ON "ruang_rapat"("pic");

ALTER TABLE "pemeliharaan" ADD CONSTRAINT "pemeliharaan_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pemeliharaan" ADD CONSTRAINT "pemeliharaan_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pengadaan" ADD CONSTRAINT "pengadaan_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "pengadaan" ADD CONSTRAINT "pengadaan_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kendaraan" ADD CONSTRAINT "kendaraan_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kendaraan" ADD CONSTRAINT "kendaraan_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ruang_rapat" ADD CONSTRAINT "ruang_rapat_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ruang_rapat" ADD CONSTRAINT "ruang_rapat_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma @updatedAt handles application writes; this trigger also protects direct SQL/admin updates.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW."updated_at" = CURRENT_TIMESTAMP; RETURN NEW; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "users_updated_at" BEFORE UPDATE ON "users" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "pemeliharaan_updated_at" BEFORE UPDATE ON "pemeliharaan" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "pengadaan_updated_at" BEFORE UPDATE ON "pengadaan" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "kendaraan_updated_at" BEFORE UPDATE ON "kendaraan" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "ruang_rapat_updated_at" BEFORE UPDATE ON "ruang_rapat" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
