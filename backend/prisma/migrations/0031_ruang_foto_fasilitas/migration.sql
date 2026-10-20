-- Foto & fasilitas per ruang rapat, dikelola Admin/Kabag di menu "Foto & Fasilitas Ruang" dan
-- ditampilkan sebagai slideshow di layar ruangan (/ruang/:slug). File foto di uploads/ruang-foto/.
CREATE TABLE "ruang_foto" (
  "id"         SERIAL PRIMARY KEY,
  "room"       VARCHAR(150) NOT NULL,
  "caption"    VARCHAR(200) NOT NULL DEFAULT '',
  "file_path"  VARCHAR(500) NOT NULL,
  "file_mime"  VARCHAR(50) NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "ruang_foto" ADD CONSTRAINT "ruang_foto_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ruang_foto_room_sort_order_idx" ON "ruang_foto"("room", "sort_order");

-- Satu baris per ruangan; fasilitas = JSON array [{ "icon": "<material symbol>", "label": "..." }].
CREATE TABLE "ruang_profil" (
  "room"       VARCHAR(150) PRIMARY KEY,
  "fasilitas"  JSONB NOT NULL DEFAULT '[]',
  "updated_by" INTEGER,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
ALTER TABLE "ruang_profil" ADD CONSTRAINT "ruang_profil_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- updated_at otomatis (jam UTC) juga saat diubah langsung lewat pgAdmin4.
CREATE TRIGGER "ruang_foto_updated_at" BEFORE UPDATE ON "ruang_foto" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER "ruang_profil_updated_at" BEFORE UPDATE ON "ruang_profil" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
