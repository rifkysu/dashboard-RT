-- Bagian kendaraan yang diservis (teks bebas), diisi saat tambah service.
-- Nullable supaya riwayat lama yang belum punya isian tetap valid.
ALTER TABLE "kendaraan_service" ADD COLUMN "bagian_service" VARCHAR(255);
