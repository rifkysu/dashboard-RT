-- Maintenance per ruangan: Admin/Kabag bisa memblokir satu ruangan (mis. sedang direnovasi / AC rusak)
-- di menu "Foto & Fasilitas Ruang". Selama aktif, ruangan tidak bisa dibooking pegawai maupun tamu;
-- booking yang sudah ada tidak dihapus. Keterangan opsional tampil di form booking, jadwal, dan layar ruangan.
ALTER TABLE "ruang_profil"
  ADD COLUMN "maintenance" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "maintenance_ket" VARCHAR(300),
  ADD COLUMN "maintenance_at" TIMESTAMP(3);
