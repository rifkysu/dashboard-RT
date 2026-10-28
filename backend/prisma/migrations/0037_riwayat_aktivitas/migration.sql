-- Riwayat aktivitas (audit trail): siapa melakukan apa, kapan, di data mana, dan apa yang berubah
-- (sebelum -> sesudah) di Pemeliharaan, Pengadaan, Kendaraan, Ruang Rapat, dan Akun. Dibaca Admin/Kabag di
-- menu "Riwayat Aktivitas". Nama/role pelaku & label data disimpan sebagai salinan saat kejadian, jadi riwayat
-- tetap utuh walau akun berganti nama atau datanya sudah dihapus. Sengaja tanpa foreign key.
CREATE TABLE "riwayat_aktivitas" (
  "id" SERIAL NOT NULL,
  "waktu" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "modul" VARCHAR(30) NOT NULL,
  "aksi" VARCHAR(30) NOT NULL,
  "ref_id" INTEGER,
  "ref_kode" VARCHAR(150),
  "ref_label" VARCHAR(300),
  "aktor_tipe" VARCHAR(10) NOT NULL,
  "aktor_id" INTEGER,
  "aktor_nama" VARCHAR(150),
  "aktor_role" VARCHAR(30),
  "aktor_email" VARCHAR(254),
  "perubahan" JSONB,
  "keterangan" VARCHAR(1000),
  "ip" VARCHAR(64),
  CONSTRAINT "riwayat_aktivitas_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "riwayat_aktivitas_waktu_idx" ON "riwayat_aktivitas"("waktu");
CREATE INDEX "riwayat_aktivitas_modul_waktu_idx" ON "riwayat_aktivitas"("modul", "waktu");
CREATE INDEX "riwayat_aktivitas_aktor_idx" ON "riwayat_aktivitas"("aktor_tipe", "aktor_id");
CREATE INDEX "riwayat_aktivitas_ref_idx" ON "riwayat_aktivitas"("modul", "ref_id");

-- Riwayat tidak bisa diubah atau dihapus lewat aplikasi maupun query biasa (termasuk oleh admin),
-- supaya isinya bisa dipercaya sebagai bukti.
CREATE OR REPLACE FUNCTION riwayat_aktivitas_tolak_ubah() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'riwayat_aktivitas hanya bisa ditambah, tidak bisa diubah atau dihapus';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "riwayat_aktivitas_tidak_bisa_diubah"
  BEFORE UPDATE OR DELETE ON "riwayat_aktivitas"
  FOR EACH ROW EXECUTE FUNCTION riwayat_aktivitas_tolak_ubah();
