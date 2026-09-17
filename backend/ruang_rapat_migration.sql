-- MIGRASI TABEL JADWAL & BOOKING RUANG RAPAT
-- Jalankan di pgAdmin4 -> Query Tool -> Execute.
-- Aman dijalankan ulang karena menggunakan IF NOT EXISTS.

CREATE TABLE IF NOT EXISTS ruang_rapat (
    id SERIAL PRIMARY KEY,
    agenda VARCHAR(255) NOT NULL,
    room VARCHAR(150) NOT NULL,
    pic VARCHAR(150) NOT NULL,
    booking_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    surat_status VARCHAR(20) NOT NULL DEFAULT 'belum'
        ,surat_name VARCHAR(255)
        ,surat_file_data TEXT
        CHECK (surat_status IN ('belum', 'ditinjau', 'diterima')),
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_ruang_rapat_date_room
    ON ruang_rapat (booking_date, room);

CREATE INDEX IF NOT EXISTS idx_ruang_rapat_pic
    ON ruang_rapat (pic);

-- Opsional: contoh data awal untuk memastikan kalender langsung terlihat.
-- Hapus/blok bagian INSERT ini jika database production tidak ingin data contoh.
-- INSERT INTO ruang_rapat (agenda, room, pic, booking_date, start_time, end_time, surat_status)
-- VALUES
-- ('Rapat Koordinasi', 'Ruang Rapat Utama (Kapasitas 50)', 'Budi Santoso', CURRENT_DATE, '09:00', '11:30', 'ditinjau');

ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_name VARCHAR(255);
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_file_data TEXT;
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS surat_file_path TEXT;
