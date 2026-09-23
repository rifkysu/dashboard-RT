-- Tambah baris maintenance untuk landing page ('/') supaya admin bisa
-- menonaktifkan landing page juga lewat panel Mode Maintenance.
INSERT INTO "maintenance_mode" ("menu_key","is_active") VALUES
  ('landing', false)
ON CONFLICT ("menu_key") DO NOTHING;
