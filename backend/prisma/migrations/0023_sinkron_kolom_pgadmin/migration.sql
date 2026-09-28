-- Menyamakan riwayat migration Prisma dengan schema.prisma. Kolom di bawah
-- sebelumnya hanya dibuat lewat script SQL pgAdmin (backend/sql), sehingga
-- database yang dibuat murni dengan `prisma migrate deploy` tidak memilikinya
-- dan menu Ruang Rapat / Pengadaan gagal (error P2022). IF NOT EXISTS membuat
-- migration ini aman untuk database lama yang kolomnya sudah ada.

-- Ruang rapat: nomor HP PIC (data lama tanpa nomor diisi '-').
ALTER TABLE "ruang_rapat" ADD COLUMN IF NOT EXISTS "pic_phone" VARCHAR(30);
UPDATE "ruang_rapat" SET "pic_phone" = '-' WHERE "pic_phone" IS NULL;
ALTER TABLE "ruang_rapat" ALTER COLUMN "pic_phone" SET NOT NULL;

-- Pengadaan: titik lokasi.
ALTER TABLE "pengadaan" ADD COLUMN IF NOT EXISTS "titik_lokasi" VARCHAR(255);

-- Presisi timestamp disamakan dengan tipe DateTime Prisma (milidetik).
ALTER TABLE "users" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "reset_token_expires" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "last_login_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "kendaraan" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3), ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "maintenance_mode" ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "pemeliharaan" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3), ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "pengadaan" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3), ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
ALTER TABLE "ruang_rapat" ALTER COLUMN "created_at" SET DATA TYPE TIMESTAMP(3), ALTER COLUMN "updated_at" SET DATA TYPE TIMESTAMP(3);
