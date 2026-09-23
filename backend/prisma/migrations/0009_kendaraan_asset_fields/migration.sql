-- Restrukturisasi kolom "kendaraan" mengikuti format aset BMN standar
-- (Nama Barang, Merk, Tipe, No BPKB, No Polisi, Tanggal Perolehan, Masa
-- Berlaku STNK, Waktu Pajak) + galeri hingga 6 foto per kendaraan.
ALTER TABLE "kendaraan"
  ADD COLUMN "nama_barang" VARCHAR(150),
  ADD COLUMN "merk" VARCHAR(100),
  ADD COLUMN "tipe" VARCHAR(100),
  ADD COLUMN "no_bpkb" VARCHAR(50),
  ADD COLUMN "jenis" VARCHAR(30),
  ADD COLUMN "tanggal_perolehan" DATE,
  ADD COLUMN "masa_berlaku_stnk" DATE,
  ADD COLUMN "waktu_pajak" DATE,
  ADD COLUMN "photos" TEXT,
  ADD COLUMN "photo_file_paths" TEXT;

-- Migrasikan data lama supaya baris yang sudah ada tidak hilang / gagal
-- kena constraint NOT NULL di bawah. "jenis" baru cuma boleh 'Roda 2'/'Roda
-- 4'/'Roda 6' (dipakai untuk filter tab di frontend), jadi diturunkan dari
-- teks "type" lama lewat pattern match, bukan disalin mentah-mentah.
UPDATE "kendaraan" SET
  "nama_barang" = "name",
  "merk" = split_part("name", ' ', 1),
  "tipe" = COALESCE(NULLIF("type", ''), "name"),
  "jenis" = CASE
    WHEN "type" ILIKE '%Roda 2%' THEN 'Roda 2'
    WHEN "type" ILIKE '%Roda 6%' THEN 'Roda 6'
    ELSE 'Roda 4'
  END;

ALTER TABLE "kendaraan"
  ALTER COLUMN "nama_barang" SET NOT NULL,
  ALTER COLUMN "merk" SET NOT NULL,
  ALTER COLUMN "tipe" SET NOT NULL,
  ALTER COLUMN "jenis" SET NOT NULL;

ALTER TABLE "kendaraan"
  DROP COLUMN "name",
  DROP COLUMN "type",
  DROP COLUMN "tax",
  DROP COLUMN "next_tax",
  DROP COLUMN "photo_name",
  DROP COLUMN "photo_file_data",
  DROP COLUMN "photo_file_path";
