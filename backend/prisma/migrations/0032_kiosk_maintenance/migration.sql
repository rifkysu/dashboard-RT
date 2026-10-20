-- Tambah baris maintenance untuk halaman kiosk jadwal ruang rapat ('/jadwal-rapat', termasuk panel
-- booking tamu Google di dalamnya) supaya admin bisa menonaktifkannya lewat panel Mode Maintenance.
INSERT INTO "maintenance_mode" ("menu_key","is_active") VALUES
  ('kiosk', false)
ON CONFLICT ("menu_key") DO NOTHING;
