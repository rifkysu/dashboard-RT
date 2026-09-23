-- Perbaikan desain plat kendaraan: sebelumnya "jenis_plat" cuma bisa pilih
-- SALAH SATU (polisi ATAU khusus), padahal satu kendaraan bisa punya nomor
-- polisi biasa SEKALIGUS plat khusus. Ganti jadi dua kolom independen:
-- "plate" (No Polisi, tetap wajib) + "plat_khusus" (opsional, bisa diisi
-- bareng "plate").
ALTER TABLE "kendaraan" ADD COLUMN "plat_khusus" VARCHAR(30);
ALTER TABLE "kendaraan" DROP COLUMN "jenis_plat";
