-- Waktu pengguna meminta reset kata sandi dari halaman Lupa Password.
-- Dipakai untuk notifikasi admin di menu Akun & Akses; dikosongkan lagi
-- setelah admin membuat link reset atau kata sandi berhasil direset.
ALTER TABLE "users" ADD COLUMN "reset_requested_at" TIMESTAMP(3);
