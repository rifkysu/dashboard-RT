-- Status surat ruang rapat kini otomatis: ada file surat -> 'diterima', tidak ada -> 'belum'.
-- Samakan data lama (termasuk yang masih 'ditinjau') dengan aturan baru.
UPDATE "ruang_rapat" SET "surat_status" = 'diterima'
  WHERE COALESCE("surat_file_data", '') <> '' OR COALESCE("surat_file_path", '') <> '';
UPDATE "ruang_rapat" SET "surat_status" = 'belum'
  WHERE COALESCE("surat_file_data", '') = '' AND COALESCE("surat_file_path", '') = '';
