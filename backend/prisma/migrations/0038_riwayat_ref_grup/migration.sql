-- Kunci pengelompokan data di riwayat aktivitas, untuk tombol "Riwayat data ini":
--   Ruang Rapat -> booking_group (satu pengajuan; tetap sama walau booking dipecah karena batal sebagian),
--   Ruangan     -> nama ruangan (tabel ruang_profil tidak punya id angka).
-- Menambah kolom tidak melanggar trigger riwayat (trigger hanya menolak UPDATE/DELETE baris).
ALTER TABLE "riwayat_aktivitas" ADD COLUMN "ref_grup" VARCHAR(150);
CREATE INDEX "riwayat_aktivitas_grup_idx" ON "riwayat_aktivitas"("modul", "ref_grup");
