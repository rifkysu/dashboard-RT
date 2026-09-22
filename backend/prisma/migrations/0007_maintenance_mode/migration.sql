-- Mode maintenance per menu, dikontrol admin dari halaman Settings.
CREATE TABLE "maintenance_mode" (
  "id" SERIAL NOT NULL,
  "menu_key" VARCHAR(50) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT false,
  "message" VARCHAR(255),
  "updated_by" INTEGER,
  "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "maintenance_mode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "maintenance_mode_menu_key_key" ON "maintenance_mode"("menu_key");
ALTER TABLE "maintenance_mode" ADD CONSTRAINT "maintenance_mode_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- set_updated_at() sudah dibuat di migration 0001_init, tinggal dipakai lagi.
CREATE TRIGGER "maintenance_mode_updated_at" BEFORE UPDATE ON "maintenance_mode" FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Pre-seed baris untuk tiap menu supaya selalu ada 5 baris siap di-toggle.
INSERT INTO "maintenance_mode" ("menu_key","is_active") VALUES
  ('dashboard', false),
  ('pemeliharaan', false),
  ('pengadaan', false),
  ('kendaraan', false),
  ('ruang-rapat', false)
ON CONFLICT ("menu_key") DO NOTHING;
