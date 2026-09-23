-- MIGRASI KENDARAAN + FOTO
-- Jalankan di pgAdmin4 Query Tool pada database Biro Umum.
-- Aman dijalankan lebih dari sekali.

CREATE TABLE IF NOT EXISTS kendaraan (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(150) NOT NULL,
    plate           VARCHAR(30) NOT NULL UNIQUE,
    type            VARCHAR(100) NOT NULL,
    sub             VARCHAR(150),
    status          VARCHAR(30) NOT NULL DEFAULT 'Tersedia',
    tax             VARCHAR(50),
    next_tax        VARCHAR(50),
    photo_name      TEXT,
    photo_file_data TEXT,
    created_by      INTEGER REFERENCES users(id),
    updated_by      INTEGER REFERENCES users(id),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kendaraan_plate ON kendaraan(plate);

ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_name TEXT;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_file_data TEXT;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS photo_file_path TEXT;
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id);
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS updated_by INTEGER REFERENCES users(id);
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT NOW();
ALTER TABLE kendaraan ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW();

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_kendaraan_updated_at ON kendaraan;
CREATE TRIGGER trg_kendaraan_updated_at
BEFORE UPDATE ON kendaraan
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Data awal dari tampilan lama, hanya dimasukkan bila tabel masih kosong.
INSERT INTO kendaraan (name, sub, plate, type, status, tax, next_tax)
SELECT * FROM (VALUES
 ('Toyota Camry','VIP / Direksi','B 1234 RFS','Sedan (Roda 4)','Tersedia','12 Jan 2023','12 Jan 2024'),
 ('Toyota Innova','Operasional Tim','B 5678 CD','MPV (Roda 4)','Digunakan','15 Mar 2023','15 Mar 2024'),
 ('Mitsubishi Triton','Lapangan','B 9012 EF','Double Cabin (Roda 4)','Servis','20 Jun 2023','20 Jun 2024'),
 ('Toyota HiAce','Tamu Instansi','B 3456 GH','Minibus (Bus)','Tersedia','05 Aug 2023','05 Aug 2024')
) AS v(name, sub, plate, type, status, tax, next_tax)
WHERE NOT EXISTS (SELECT 1 FROM kendaraan);
