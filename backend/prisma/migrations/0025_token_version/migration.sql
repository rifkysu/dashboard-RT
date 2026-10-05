-- Versi sesi per akun: naik setiap logout, reset kata sandi, atau ban.
-- Token JWT membawa versi ini (klaim "tv"); requireAuth menolak token yang versinya tidak sama,
-- sehingga sesi lama bisa dicabut sebelum masa berlaku 8 jamnya habis.
ALTER TABLE "users" ADD COLUMN "token_version" INTEGER NOT NULL DEFAULT 0;
