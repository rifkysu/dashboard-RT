-- Tambah pilihan jenis plat kendaraan: "polisi" (nomor polisi standar) atau
-- "khusus" (plat khusus), dipilih lewat dropdown di form Tambah Kendaraan.
-- Kolom "plate" tetap satu-satunya kolom nilai plat -- "jenis_plat" cuma
-- menandai kategorinya, supaya ditampilkan beda di kolom "No Polisi / Khusus".
ALTER TABLE "kendaraan" ADD COLUMN "jenis_plat" VARCHAR(20) NOT NULL DEFAULT 'polisi';
