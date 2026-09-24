-- Riwayat service kendaraan: menggantikan kolom invoice service tunggal di
-- tabel "kendaraan" (0015) dengan tabel sendiri, jadi satu kendaraan bisa
-- punya banyak catatan service (tanggal, jenis, bengkel, km, biaya, invoice).
CREATE TABLE "kendaraan_service" (
  "id" SERIAL NOT NULL,
  "kendaraan_id" INTEGER NOT NULL,
  "tanggal_service" DATE NOT NULL,
  "jenis_service" VARCHAR(100) NOT NULL,
  "bengkel" VARCHAR(150),
  "kilometer" INTEGER,
  "biaya" DECIMAL(18,2),
  "keterangan" VARCHAR(1000),
  "invoice_document_name" TEXT,
  "invoice_document_file_data" TEXT,
  "invoice_document_file_path" TEXT,
  "created_by" INTEGER,
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "kendaraan_service_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "kendaraan_service_kilometer_check" CHECK ("kilometer" IS NULL OR "kilometer" >= 0),
  CONSTRAINT "kendaraan_service_biaya_check" CHECK ("biaya" IS NULL OR "biaya" >= 0)
);

CREATE INDEX "kendaraan_service_kendaraan_id_tanggal_service_idx" ON "kendaraan_service"("kendaraan_id", "tanggal_service");

ALTER TABLE "kendaraan_service" ADD CONSTRAINT "kendaraan_service_kendaraan_id_fkey" FOREIGN KEY ("kendaraan_id") REFERENCES "kendaraan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "kendaraan_service" ADD CONSTRAINT "kendaraan_service_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "kendaraan_service" ADD CONSTRAINT "kendaraan_service_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Prisma @updatedAt menangani update dari aplikasi; trigger ini untuk update langsung lewat pgAdmin4.
CREATE TRIGGER "kendaraan_service_updated_at" BEFORE UPDATE ON "kendaraan_service" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Pindahkan invoice service lama (kalau ada) menjadi entri riwayat pertama
-- supaya tidak ada data yang hilang saat kolom lamanya dihapus.
INSERT INTO "kendaraan_service" ("kendaraan_id", "tanggal_service", "jenis_service", "keterangan", "invoice_document_name", "invoice_document_file_data", "invoice_document_file_path", "created_by", "updated_by", "created_at", "updated_at")
SELECT "id", "updated_at"::date, 'Service', 'Dipindahkan dari invoice service sebelumnya', "service_invoice_document_name", "service_invoice_document_file_data", "service_invoice_document_file_path", "updated_by", "updated_by", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "kendaraan"
WHERE "service_invoice_document_file_data" IS NOT NULL OR "service_invoice_document_file_path" IS NOT NULL;

ALTER TABLE "kendaraan"
  DROP COLUMN "service_invoice_document_name",
  DROP COLUMN "service_invoice_document_file_data",
  DROP COLUMN "service_invoice_document_file_path";
