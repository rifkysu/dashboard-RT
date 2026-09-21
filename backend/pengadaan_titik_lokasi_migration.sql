-- ================================================================
-- PENGADAAN: TITIK LOKASI + LOKASI BARU
-- Aman untuk database yang SUDAH berisi data.
-- Tidak menghapus / mengubah data lama.
-- Jalankan di database biro_umum_db melalui pgAdmin4.
-- ================================================================

ALTER TABLE pengadaan
  ADD COLUMN IF NOT EXISTS titik_lokasi VARCHAR(255);

-- Index agar pencarian/filter titik lokasi tetap ringan.
CREATE INDEX IF NOT EXISTS idx_pengadaan_lokasi ON pengadaan(lokasi);

-- Nilai lokasi yang dipakai aplikasi:
-- Graha Kemnaker, Gatsu 51, Wisma Ciloto, Rumah Dinas, RC Walang, RC Kranji
-- Data lama tidak diubah; lokasi lama tetap valid.

-- Verifikasi:
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'pengadaan'
  AND column_name IN ('lokasi','titik_lokasi')
ORDER BY ordinal_position;
