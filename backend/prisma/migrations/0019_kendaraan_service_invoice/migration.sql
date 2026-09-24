-- Invoice PDF (opsional) per riwayat service, diupload saat tambah service.
ALTER TABLE "kendaraan_service"
  ADD COLUMN "invoice_document_name" TEXT,
  ADD COLUMN "invoice_document_file_data" TEXT,
  ADD COLUMN "invoice_document_file_path" TEXT;
