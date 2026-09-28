-- Booking ruang rapat multi-hari: booking berlaku setiap hari dari booking_date
-- s/d end_date pada jam start_time–end_time yang sama. Booking lama (1 hari)
-- otomatis diisi end_date = booking_date sehingga perilakunya tidak berubah.
ALTER TABLE "ruang_rapat" ADD COLUMN "end_date" DATE;
UPDATE "ruang_rapat" SET "end_date" = "booking_date" WHERE "end_date" IS NULL;
ALTER TABLE "ruang_rapat" ALTER COLUMN "end_date" SET NOT NULL;
ALTER TABLE "ruang_rapat" ADD CONSTRAINT "ruang_rapat_end_date_check" CHECK ("end_date" >= "booking_date");
CREATE INDEX "ruang_rapat_room_booking_date_end_date_idx" ON "ruang_rapat"("room", "booking_date", "end_date");
