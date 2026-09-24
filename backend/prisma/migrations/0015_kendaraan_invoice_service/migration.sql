-- Invoice service (PDF) per kendaraan -- bisa diupload saat tambah kendaraan
-- berstatus "Servis", dan diganti/update lagi dari modal Detail Kendaraan.
ALTER TABLE "kendaraan"
  ADD COLUMN "service_invoice_document_name" TEXT,
  ADD COLUMN "service_invoice_document_file_data" TEXT,
  ADD COLUMN "service_invoice_document_file_path" TEXT;
