-- Pengingat email ke tamu pengaju booking ruang rapat (H-1 dan beberapa jam sebelum mulai).
-- Kolom terisi = pengingat itu sudah dikirim, supaya tidak terkirim dua kali. Direset saat jadwal diedit.
ALTER TABLE "ruang_rapat"
  ADD COLUMN "reminder_h1_at"  TIMESTAMP(3),
  ADD COLUMN "reminder_jam_at" TIMESTAMP(3);
