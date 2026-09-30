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


-- Nomor HP PIC agar ikut tampil pada Jadwal Rapat dan halaman Read Only.
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS pic_phone VARCHAR(30);
-- Data lama tidak dihapus. Isi sementara hanya untuk memenuhi NOT NULL setelah data lama diperiksa.
UPDATE ruang_rapat SET pic_phone='-' WHERE pic_phone IS NULL;
ALTER TABLE ruang_rapat ALTER COLUMN pic_phone SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ruang_rapat_pic_phone ON ruang_rapat (pic_phone);


-- Booking multi-hari (sama dengan Prisma migration 0022_ruang_rapat_multi_hari).
-- Booking berlaku tiap hari dari booking_date s/d end_date pada jam yang sama.
-- Jika database dikelola dengan Prisma, cukup jalankan `npx prisma migrate deploy`
-- (jangan jalankan bagian ini manual, supaya riwayat migration Prisma tetap sinkron).
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS end_date DATE;
UPDATE ruang_rapat SET end_date = booking_date WHERE end_date IS NULL;
ALTER TABLE ruang_rapat ALTER COLUMN end_date SET NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ruang_rapat_end_date_check') THEN
    ALTER TABLE ruang_rapat ADD CONSTRAINT ruang_rapat_end_date_check CHECK (end_date >= booking_date);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ruang_rapat_room_booking_date_end_date_idx ON ruang_rapat (room, booking_date, end_date);


-- Cancel booking tanpa menghapus data (sama dengan Prisma migration 0024_ruang_rapat_cancel).
-- cancelled_at terisi = booking berstatus batal; cancel_reason = alasan (opsional).
-- Jika database dikelola dengan Prisma, cukup jalankan `npx prisma migrate deploy`.
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP(3);
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS cancelled_by INTEGER;
ALTER TABLE ruang_rapat ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(500);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ruang_rapat_cancelled_by_fkey') THEN
    ALTER TABLE ruang_rapat ADD CONSTRAINT ruang_rapat_cancelled_by_fkey FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS ruang_rapat_cancelled_at_idx ON ruang_rapat (cancelled_at);
