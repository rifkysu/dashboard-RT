-- Nomor surat booking ruang rapat -- diisi saat booking (opsional) atau lewat
-- Edit Booking, ditampilkan di detail booking dan ikut di export Excel.
ALTER TABLE "ruang_rapat" ADD COLUMN "nomor_surat" VARCHAR(100);
