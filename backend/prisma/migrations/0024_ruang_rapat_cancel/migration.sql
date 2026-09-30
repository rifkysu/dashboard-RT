-- Booking ruang rapat yang dibatalkan tidak lagi dihapus: baris tetap tersimpan
-- dengan status batal (cancelled_at terisi), siapa yang membatalkan, dan alasan
-- pembatalan (opsional). Booking batal diabaikan saat cek bentrok & tidak tampil di jadwal.
ALTER TABLE "ruang_rapat" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "ruang_rapat" ADD COLUMN "cancelled_by" INTEGER;
ALTER TABLE "ruang_rapat" ADD COLUMN "cancel_reason" VARCHAR(500);
ALTER TABLE "ruang_rapat" ADD CONSTRAINT "ruang_rapat_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ruang_rapat_cancelled_at_idx" ON "ruang_rapat"("cancelled_at");
