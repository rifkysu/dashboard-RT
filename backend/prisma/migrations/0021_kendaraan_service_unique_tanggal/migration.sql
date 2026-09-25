-- Satu kendaraan hanya boleh punya satu catatan service per tanggal. Dijaga di
-- level database supaya dua request bersamaan (double-click / dua user) tidak
-- bisa membuat duplikat. Index unik ini sekaligus menggantikan index biasa.
DROP INDEX "kendaraan_service_kendaraan_id_tanggal_service_idx";
CREATE UNIQUE INDEX "kendaraan_service_kendaraan_id_tanggal_service_key" ON "kendaraan_service"("kendaraan_id", "tanggal_service");
