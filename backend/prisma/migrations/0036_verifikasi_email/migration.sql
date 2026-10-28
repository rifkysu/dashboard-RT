-- Verifikasi email saat Daftar Akun: akun baru baru bisa login setelah pemilik email mengklik link
-- yang dikirim ke alamat @kemnaker.go.id-nya (atau diverifikasi manual oleh Admin/Kabag di menu Akun & Akses).
-- verify_token = hash SHA-256 token (token mentah hanya ada di link email), berlaku 24 jam.
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "verify_token" VARCHAR(128);
ALTER TABLE "users" ADD COLUMN "verify_token_expires" TIMESTAMP(3);
CREATE UNIQUE INDEX "users_verify_token_key" ON "users"("verify_token");

-- Akun yang sudah ada sebelum fitur ini dianggap sudah terverifikasi (tetap bisa login seperti biasa).
UPDATE "users" SET "email_verified_at" = COALESCE("created_at", NOW()) WHERE "email_verified_at" IS NULL;
