-- =========================================================
-- FIX TANGGAL SELESAI PEMELIHARAAN & PENGADAAN
-- Jalankan di pgAdmin4 pada database biro_umum_db.
-- Aman dijalankan berulang kali.
-- =========================================================

-- Pastikan kolom tersedia.
ALTER TABLE pemeliharaan ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;
ALTER TABLE pengadaan ADD COLUMN IF NOT EXISTS tanggal_selesai DATE;

-- Trigger Pemeliharaan: bila Tahap 3/status selesai, DB otomatis mengisi CURRENT_DATE.
CREATE OR REPLACE FUNCTION set_tanggal_selesai_pemeliharaan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'selesai' OR NEW.tahap3_status = 'selesai' THEN
    NEW.status := 'selesai';
    NEW.tahap3_status := 'selesai';
    NEW.tanggal_selesai := COALESCE(NEW.tanggal_selesai, CURRENT_DATE);
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'selesai' THEN
    NEW.tanggal_selesai := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tanggal_selesai_pemeliharaan ON pemeliharaan;
CREATE TRIGGER trg_tanggal_selesai_pemeliharaan
BEFORE INSERT OR UPDATE OF status, tahap3_status, tanggal_selesai
ON pemeliharaan
FOR EACH ROW
EXECUTE FUNCTION set_tanggal_selesai_pemeliharaan();

-- Trigger Pengadaan: bila Tahap 3/status selesai, DB otomatis mengisi CURRENT_DATE.
CREATE OR REPLACE FUNCTION set_tanggal_selesai_pengadaan()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'selesai' OR NEW.tahap3_status = 'selesai' THEN
    NEW.status := 'selesai';
    NEW.tahap3_status := 'selesai';
    NEW.tanggal_selesai := COALESCE(NEW.tanggal_selesai, CURRENT_DATE);
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'selesai' THEN
    NEW.tanggal_selesai := NULL;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tanggal_selesai_pengadaan ON pengadaan;
CREATE TRIGGER trg_tanggal_selesai_pengadaan
BEFORE INSERT OR UPDATE OF status, tahap3_status, tanggal_selesai
ON pengadaan
FOR EACH ROW
EXECUTE FUNCTION set_tanggal_selesai_pengadaan();

-- Perbaiki data lama yang statusnya sudah selesai tetapi tanggalnya masih NULL.
UPDATE pemeliharaan
SET tanggal_selesai = COALESCE(tanggal_selesai, CURRENT_DATE)
WHERE (status = 'selesai' OR tahap3_status = 'selesai')
  AND tanggal_selesai IS NULL;

UPDATE pengadaan
SET tanggal_selesai = COALESCE(tanggal_selesai, CURRENT_DATE)
WHERE (status = 'selesai' OR tahap3_status = 'selesai')
  AND tanggal_selesai IS NULL;
