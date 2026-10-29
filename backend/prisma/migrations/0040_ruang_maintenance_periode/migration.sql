-- Periode maintenance ruangan (opsional): blokir hanya berlaku untuk tanggal maintenance_mulai s/d
-- maintenance_sampai (boleh 1 hari: mulai = sampai). Keduanya NULL = diblokir sampai dibuka lagi (perilaku 0039).
-- Setelah tanggal sampai lewat, ruangan otomatis bisa dibooking lagi.
ALTER TABLE "ruang_profil"
  ADD COLUMN "maintenance_mulai" DATE,
  ADD COLUMN "maintenance_sampai" DATE;
