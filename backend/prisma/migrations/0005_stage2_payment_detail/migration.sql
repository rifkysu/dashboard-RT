-- Detail metode pembayaran Tahap 2 (GUP 1-20 / TUP 1-10 / tanggal LS).
ALTER TABLE "pemeliharaan" ADD COLUMN "stage2_payment_number" INTEGER;
ALTER TABLE "pemeliharaan" ADD COLUMN "stage2_ls_date" DATE;

-- Pengadaan belum punya metode pembayaran sama sekali -> tambahkan sekalian.
ALTER TABLE "pengadaan" ADD COLUMN "stage2_payment_method" VARCHAR(20);
ALTER TABLE "pengadaan" ADD COLUMN "stage2_payment_number" INTEGER;
ALTER TABLE "pengadaan" ADD COLUMN "stage2_ls_date" DATE;
