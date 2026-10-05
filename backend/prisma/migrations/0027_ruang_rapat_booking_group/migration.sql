-- Kode pengajuan booking: semua baris dari satu kali booking (pilih beberapa tanggal / pecahan
-- hasil cancel sebagian) punya booking_group yang sama, sehingga saat Cancel semua tanggalnya
-- bisa dipilih dari satu popup. Booking lama dibiarkan NULL (diperlakukan sebagai pengajuan sendiri).
ALTER TABLE "ruang_rapat" ADD COLUMN "booking_group" VARCHAR(36);
CREATE INDEX "ruang_rapat_booking_group_idx" ON "ruang_rapat"("booking_group");
