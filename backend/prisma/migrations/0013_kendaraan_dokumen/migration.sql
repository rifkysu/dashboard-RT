-- Dokumen PDF BPKB & STNK per kendaraan -- bisa diupload saat tambah
-- kendaraan, dan diganti/update lagi dari modal Detail Kendaraan.
ALTER TABLE "kendaraan"
  ADD COLUMN "bpkb_document_name" TEXT,
  ADD COLUMN "bpkb_document_file_data" TEXT,
  ADD COLUMN "bpkb_document_file_path" TEXT,
  ADD COLUMN "stnk_document_name" TEXT,
  ADD COLUMN "stnk_document_file_data" TEXT,
  ADD COLUMN "stnk_document_file_path" TEXT;
