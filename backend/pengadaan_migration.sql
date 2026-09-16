-- Migration Pengadaan terbaru
-- Vendor dan Nilai Invoice hanya diinput pada Tahap 2 (Invoice & Pembayaran).

ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_vendor VARCHAR(150);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_number VARCHAR(100);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_date DATE;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS stage2_invoice_amount NUMERIC(18,2);
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS deskripsi TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS request_document_name TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS request_document_file_data TEXT;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;

-- Migrasi data lama agar informasi vendor/invoice tidak hilang.
UPDATE pengadaan
SET stage2_vendor = COALESCE(stage2_vendor, vendor),
    stage2_invoice_number = COALESCE(stage2_invoice_number, nomor_invoice),
    stage2_invoice_amount = COALESCE(stage2_invoice_amount, nilai_invoice)
WHERE vendor IS NOT NULL OR nomor_invoice IS NOT NULL OR nilai_invoice IS NOT NULL;

-- Data selesai lama harus memiliki tanggal selesai.
UPDATE pengadaan
SET tanggal_selesai = CURRENT_DATE
WHERE status = 'selesai' AND tanggal_selesai IS NULL;

-- Struktur lama tidak lagi dipakai: Vendor/Invoice hanya berasal dari Tahap 2.
ALTER TABLE pengadaan DROP COLUMN IF EXISTS vendor;
ALTER TABLE pengadaan DROP COLUMN IF EXISTS nomor_invoice;
ALTER TABLE pengadaan DROP COLUMN IF EXISTS nilai_invoice;
