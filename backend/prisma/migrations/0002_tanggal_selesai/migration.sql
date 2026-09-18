-- Menjamin tanggal selesai selalu tercatat saat pekerjaan selesai.
CREATE OR REPLACE FUNCTION set_tanggal_selesai()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'selesai' THEN
    IF NEW.tanggal_selesai IS NULL THEN NEW.tanggal_selesai = CURRENT_DATE; END IF;
  ELSE
    NEW.tanggal_selesai = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_pemeliharaan_tanggal_selesai ON pemeliharaan;
CREATE TRIGGER trg_pemeliharaan_tanggal_selesai BEFORE INSERT OR UPDATE ON pemeliharaan FOR EACH ROW EXECUTE FUNCTION set_tanggal_selesai();
DROP TRIGGER IF EXISTS trg_pengadaan_tanggal_selesai ON pengadaan;
CREATE TRIGGER trg_pengadaan_tanggal_selesai BEFORE INSERT OR UPDATE ON pengadaan FOR EACH ROW EXECUTE FUNCTION set_tanggal_selesai();
UPDATE pemeliharaan SET tanggal_selesai=CURRENT_DATE WHERE status='selesai' AND tanggal_selesai IS NULL;
UPDATE pengadaan SET tanggal_selesai=CURRENT_DATE WHERE status='selesai' AND tanggal_selesai IS NULL;
