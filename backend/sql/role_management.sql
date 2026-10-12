-- =========================================================
-- ROLE MANAGEMENT
-- Jalankan di pgAdmin4 pada database biro_umum_db.
-- Pendaftaran mandiri membuat Karyawan. Sehari-hari role diubah dari
-- menu "Akun & Akses" di aplikasi (Admin/Kabag; role Admin hanya oleh Admin).
-- Script ini terutama untuk menjadikan ADMIN PERTAMA atau kondisi darurat.
-- =========================================================

-- Lihat seluruh akun dan role saat ini.
SELECT id, nama_lengkap, email, unit_kerja, role, is_active
FROM users
ORDER BY id;

-- Contoh: jadikan user sebagai PIC. Ganti email.
-- UPDATE users SET role = 'pic', updated_at = NOW()
-- WHERE email = 'nama@contoh.go.id';

-- Contoh: jadikan user sebagai Kabag.
-- UPDATE users SET role = 'kabag', updated_at = NOW()
-- WHERE email = 'nama@contoh.go.id';

-- Contoh: kembalikan ke Karyawan.
-- UPDATE users SET role = 'karyawan', updated_at = NOW()
-- WHERE email = 'nama@contoh.go.id';

-- Bootstrap Admin pertama kali. Hanya lakukan untuk akun admin yang dipercaya.
-- UPDATE users SET role = 'admin', updated_at = NOW()
-- WHERE email = 'admin@contoh.go.id';
