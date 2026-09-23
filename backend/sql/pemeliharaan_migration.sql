ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS tanggal DATE;
-- Migration Pemeliharaan

ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_document_file_data TEXT;
ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage1_document_file_path TEXT;
ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_file_data TEXT;
ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage2_invoice_document_file_path TEXT;
ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage3_documentation_files TEXT;
ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS stage3_documentation_file_paths TEXT;

ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;

ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS request_document_name TEXT;
ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS request_document_file_data TEXT;
ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS request_document_file_path TEXT;

-- Repair data lama: permintaan yang sudah selesai harus memiliki tanggal selesai.
UPDATE pemeliharaan
SET tanggal_selesai = CURRENT_DATE
WHERE status = 'selesai' AND tanggal_selesai IS NULL;

-- Pastikan tanggal permintaan disimpan sebagai tanggal kalender tanpa konversi timezone.
ALTER TABLE pemeliharaan ALTER COLUMN tanggal TYPE DATE USING tanggal::date;
