# SQL manual (pgAdmin4)

File-file di folder ini adalah **script SQL yang dijalankan manual lewat pgAdmin4**. **Sumber kebenaran skema database tetap `backend/prisma/migrations/`** — jangan tambahkan `CREATE TABLE`/`ALTER TABLE` baru di sini, buat migration Prisma baru sebagai gantinya.

## Masih relevan (dipakai kapan pun perlu)
- **`production_schema.sql`** — buat database **production baru (kosong)** sekali jalan, sudah sama persis dengan aplikasi saat ini (setara migration `0001_init` s/d `0028_updated_at_utc`). Tabel `_prisma_migrations` ikut terisi, jadi `npx prisma migrate status` langsung "up to date" dan migration berikutnya cukup `npx prisma migrate deploy`.
  1. Buat database kosong (mis. `biro_umum_db`, encoding UTF8).
  2. Query Tool pgAdmin4 → buka file ini → Execute (F5). Atau: `psql "<DATABASE_URL>" -f production_schema.sql`.
  3. Jalankan backend, daftar akun pertama lewat Register, lalu jadikan admin dengan `role_management.sql`.

  Script menolak jalan kalau tabel `users` sudah ada (database lama → pakai `npx prisma migrate deploy`). **Setiap ada migration Prisma baru, file ini juga harus diperbarui** (struktur + baris `_prisma_migrations`, checksum = `sha256sum migration.sql`).
- **`role_management.sql`** — lihat & ubah role user (Karyawan/Kabag/PIC/Admin) langsung lewat pgAdmin4. Role tidak bisa diubah dari UI, jadi file ini masih dipakai aktif.
- **`import_ruang_rapat_2026.sql`** — impor jadwal ruang rapat 2026 dari rekap PDF (opsional, aman dijalankan ulang). Jalankan setelah skema dibuat.

## Legacy / arsip (sudah digantikan `prisma/migrations/` dan `production_schema.sql`)
- `schema.sql` — skema awal database sebelum Prisma.
- `database_repair.sql` — kompatibilitas untuk database lama yang sudah berisi data (belum mencakup kolom/tabel terbaru; untuk database lama pakai `npx prisma migrate deploy`).
- `kendaraan_migration.sql`, `pemeliharaan_migration.sql`, `pengadaan_migration.sql`, `pengadaan_titik_lokasi_migration.sql`, `ruang_rapat_migration.sql`, `tanggal_selesai_fix.sql` — migration manual per-fitur dari era pra-Prisma.

Disimpan sebagai arsip/referensi historis, bukan untuk dijalankan lagi.
