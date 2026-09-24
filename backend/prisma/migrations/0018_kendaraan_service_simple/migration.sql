-- Riwayat service disederhanakan: cukup tanggal service saja, tanpa detail
-- (jenis, bengkel, km, biaya, keterangan) dan tanpa upload invoice PDF.
ALTER TABLE "kendaraan_service"
  DROP COLUMN "jenis_service",
  DROP COLUMN "bengkel",
  DROP COLUMN "kilometer",
  DROP COLUMN "biaya",
  DROP COLUMN "keterangan",
  DROP COLUMN "invoice_document_name",
  DROP COLUMN "invoice_document_file_data",
  DROP COLUMN "invoice_document_file_path";
