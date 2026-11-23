-- Role baru "ruang_rapat" (Pengelola Ruang Rapat): setelah login hanya melihat menu Jadwal Ruang Rapat
-- dan Foto & Fasilitas Ruang; boleh menambah & mengubah ruangan serta foto/fasilitasnya.
ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'ruang_rapat';

-- Lokasi ruangan (gedung / lantai / nomor ruang), tampil di detail ruangan, jadwal & layar ruangan.
ALTER TABLE "ruang_profil" ADD COLUMN IF NOT EXISTS "lokasi" VARCHAR(150);
