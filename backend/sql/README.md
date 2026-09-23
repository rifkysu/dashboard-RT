# SQL manual (legacy & referensi admin)

File-file di folder ini adalah **script SQL yang dijalankan manual lewat pgAdmin4**, dari sebelum project ini memakai Prisma Migrate. **Sumber kebenaran skema database sekarang ada di `backend/prisma/migrations/`** — jangan tambahkan `CREATE TABLE`/`ALTER TABLE` baru di sini, buat migration Prisma baru sebagai gantinya.

## Masih relevan (dipakai kapan pun perlu)
- **`role_management.sql`** — lihat & ubah role user (Karyawan/Kabag/PIC/Admin) langsung lewat pgAdmin4. Role tidak bisa diubah dari UI, jadi file ini masih dipakai aktif.

## Legacy / arsip (sudah digantikan `prisma/migrations/`)
- `schema.sql` — skema awal database sebelum Prisma.
- `database_repair.sql` — kompatibilitas untuk database lama yang sudah berisi data.
- `kendaraan_migration.sql`, `pemeliharaan_migration.sql`, `pengadaan_migration.sql`, `pengadaan_titik_lokasi_migration.sql`, `ruang_rapat_migration.sql`, `tanggal_selesai_fix.sql` — migration manual per-fitur dari era pra-Prisma.

Disimpan sebagai arsip/referensi historis, bukan untuk dijalankan lagi pada database yang sudah mengikuti `prisma/migrations/`.
