# Prisma + PostgreSQL Production

Backend Biro Umum sekarang menggunakan Prisma Client untuk seluruh operasi database pada menu:
- Pemeliharaan
- Pengadaan
- Kendaraan
- Ruang Rapat
- Dashboard
- Auth/SSO

Tidak ada lagi `pool.query()` pada route menu. `pg` dan `src/db.js` sudah tidak dipakai.

## 1. Environment

Buat `backend/.env`:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DBNAME?schema=public"
JWT_SECRET="minimal-32-karakter"
FRONTEND_URL="https://domain-frontend-kamu"
```

Untuk production, `HOST` **tidak boleh `localhost`** jika backend berjalan di Vercel/server/cloud yang berbeda dari komputer database. PostgreSQL harus berada pada server yang dapat dijangkau backend production (managed PostgreSQL/VPS/server kantor dengan akses jaringan yang aman).

## 2. Database baru

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate deploy
```

Migration `0001_init` membuat struktur tabel. Migration `0002_tanggal_selesai` membuat pengaman tanggal selesai.

## 3. Database lama yang sudah berisi data

Jangan menjalankan `0001_init` langsung ke database lama yang sudah mempunyai tabel.

1. Backup database terlebih dahulu.
2. Pastikan `DATABASE_URL` menunjuk ke database lama.
3. Tandai baseline sebagai sudah diterapkan:

```bash
npx prisma migrate resolve --applied 0001_init
```

4. Jalankan migration baru:

```bash
npx prisma migrate deploy
```

Migration `0002_tanggal_selesai` aman untuk data lama: record yang statusnya `selesai` tetapi tanggal selesai kosong akan diisi tanggal saat migration dijalankan.

## 4. Pengembangan lokal

```bash
npx prisma migrate dev --name perubahan_kamu
npx prisma generate
npm start
```

Untuk perubahan struktur database, ubah `prisma/schema.prisma`, lalu gunakan migration Prisma. Jangan lagi menambahkan `ALTER TABLE`/`CREATE TABLE` ke route API.

## 5. File upload

Prisma hanya menyimpan metadata/path database. File fisik tetap dikelola oleh `src/fileStorage.js` di:

```text
backend/uploads/
  pemeliharaan/
  pengadaan/
  kendaraan/
  ruang-rapat/
```

Untuk production serverless seperti Vercel, penyimpanan lokal filesystem tidak persisten. Untuk deployment tersebut, file upload sebaiknya nanti dipindahkan ke object storage (misalnya S3-compatible/Supabase Storage/R2). PostgreSQL + Prisma tetap dapat dipakai tanpa mengubah API bisnis.
