-- Pengelola Ruang Rapat per biro: role "ruang_rapat" + biro (satuan kerja) yang dikelola akun itu.
-- Akun hanya bisa menambah/mengubah/menghapus ruangan (beserta foto, fasilitas, maintenance) milik biro ini.
-- Biro Umum tidak dipakai di sini karena ruangannya dikelola Admin.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ruang_satker" VARCHAR(150);
