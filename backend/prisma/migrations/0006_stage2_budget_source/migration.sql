-- Asal anggaran Tahap 2 (RM / PNBP), dipasangkan dengan metode pembayaran GUP/TUP/LS.
ALTER TABLE "pemeliharaan" ADD COLUMN "stage2_budget_source" VARCHAR(10);
ALTER TABLE "pengadaan" ADD COLUMN "stage2_budget_source" VARCHAR(10);
