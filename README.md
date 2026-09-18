# Aplikasi Layanan Biro Umum & Rumah Tangga

Full-stack aplikasi internal: React + Vite (frontend), Node.js + Express (backend), Prisma ORM, dan PostgreSQL lokal. Versi ini sudah disiapkan agar menu **Pemeliharaan, Pengadaan, Kendaraan, dan Ruang Rapat** menggunakan Prisma.

## Yang sudah diperbaiki
- Prisma menjadi akses database utama backend.
- `DATABASE_URL` wajib menunjuk ke database PostgreSQL yang benar, contoh `biro_umum_db`.
- Pengadaan: form tambah **tidak mengirim Nilai HPS**. HPS hanya diisi melalui Tahap 1.
- Kendaraan: akun terautentikasi dapat menambah kendaraan; edit/hapus tetap untuk Kabag/PIC.
- Ruang Rapat: akun terautentikasi dapat membuat booking; edit/hapus tetap untuk Kabag/PIC.
- Role Admin sekarang dikenali JWT.
- Menu Settings memiliki pengelolaan role untuk Kabag/Admin.
- Register mandiri membuat role **Karyawan**. Role Kabag/PIC dikelola setelah akun dibuat.
- Upload tetap disimpan ke folder `backend/uploads/...` dan path-nya dicatat di database.
- Proteksi SQL injection tetap menggunakan query Prisma terparameterisasi.

## 1. Konfigurasi `.env` backend
Buat/ubah `backend/.env`:

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=biro_umum_db
PGUSER=postgres
PGPASSWORD=123

DATABASE_URL="postgresql://postgres:123@localhost:5432/biro_umum_db"

JWT_SECRET=ganti_dengan_string_rahasia_minimal_32_karakter
JWT_EXPIRES_IN=8h
PORT=4000
FRONTEND_URL=http://localhost:5173

# Opsional Google SSO
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
```

> **Penting:** `PGDATABASE` dan nama database pada `DATABASE_URL` harus sama. Pada komputer yang digunakan untuk project ini nama database adalah `biro_umum_db`. Jangan memakai `/biro_umum` jika database tersebut tidak ada. Jangan commit `.env` karena berisi password dan secret.

## 2. Pastikan database lama tetap dipakai
Jika database `biro_umum_db` sudah berisi data, **jangan menjalankan `prisma migrate dev` sembarangan**. Versi ini ditujukan untuk database PostgreSQL yang sudah dibuat menggunakan schema/migration project. Backup database sebelum perubahan struktur.

Untuk memastikan koneksi:

```bash
cd backend
npm install
npx prisma generate
npm run db:test
npm run db:verify
```

Hasil yang benar:

```text
[INFO] Prisma connected
[ { now: 2026-... } ]
[DB VERIFY] users: OK
[DB VERIFY] pemeliharaan: OK
[DB VERIFY] pengadaan: OK
[DB VERIFY] kendaraan: OK
[DB VERIFY] ruang_rapat: OK
[DB VERIFY] Semua tabel/kolom utama siap digunakan Prisma.
```

## 3. Jalankan aplikasi
Terminal 1:

```bash
cd backend
npm start
```

Backend: `http://localhost:4000`

Terminal 2:

```bash
cd frontend
npm install
npm run dev
```

Frontend biasanya: `http://localhost:5173`

## 4. Alur role / hak akses

| Role | Lihat | Tambah Pengadaan | Tambah Kendaraan | Booking Ruang | Proses/Edit | Kelola Role |
|---|---|---|---|---|---|---|
| Karyawan | Ya | Ya | Ya | Ya | Tidak | Tidak |
| Kabag | Ya | Ya | Ya | Ya | Ya | Ya, non-Admin |
| PIC | Ya | Ya | Ya | Ya | Ya | Tidak |
| Admin | Ya | Ya | Ya | Ya | Ya | Ya |

Karyawan boleh membuat data/permintaan baru, tetapi tidak boleh mengubah atau menghapus data yang sudah ada melalui endpoint edit/hapus.

## 5. Cara update role — cara paling mudah
Login sebagai **Kabag** atau **Admin**, lalu buka:

**Settings → Kelola Role Pengguna**

Pilih role pada user dan sistem akan langsung menyimpan perubahan ke PostgreSQL.

Setelah mengubah role akun yang sedang dipakai, lakukan **logout lalu login kembali** supaya JWT baru membawa role terbaru.

### Alternatif melalui pgAdmin4

```sql
SELECT id, nama_lengkap, email, role, is_active
FROM users
ORDER BY id;

-- Jadikan PIC
UPDATE users
SET role = 'pic', updated_at = NOW()
WHERE email = 'email@contoh.go.id';

-- Jadikan Kabag
UPDATE users
SET role = 'kabag', updated_at = NOW()
WHERE email = 'email@contoh.go.id';

-- Jadikan Karyawan kembali
UPDATE users
SET role = 'karyawan', updated_at = NOW()
WHERE email = 'email@contoh.go.id';
```

Untuk bootstrap Admin pertama kali, jalankan satu kali di pgAdmin4:

```sql
UPDATE users
SET role = 'admin', updated_at = NOW()
WHERE email = 'email.admin@contoh.go.id';
```

Lalu logout/login kembali.

## 6. Register akun
Form Register hanya membuat akun **Karyawan**. Ini disengaja agar pengguna tidak dapat menaikkan hak aksesnya sendiri melalui form publik. Setelah akun dibuat, Kabag/Admin dapat mengubah role melalui Settings.

Jika register gagal, lihat terminal backend tepat saat tombol Daftar ditekan. Endpoint register menggunakan Prisma `prisma.user.create()`, sehingga error database akan terlihat di log backend.

## 7. Pengadaan dan Nilai HPS
Saat **Tambah Pengadaan**, field Nilai HPS tidak disimpan dari form awal. Data awal hanya menyimpan informasi permintaan.

Nilai HPS diisi melalui **Tahap 1 / Analisa & HPS**. Ini menjaga HPS tetap menjadi bagian proses Tahap 1.

Tahap 2 menangani vendor/invoice/pembayaran dan Tahap 3 menangani dokumen final.

## 8. Kendaraan
- Tambah kendaraan tersedia untuk user yang sudah login.
- Foto JPG/PNG/WebP disimpan lokal di `backend/uploads/kendaraan`.
- Edit dan hapus membutuhkan Kabag/PIC.
- Nomor polisi harus unik.
- Tombol Detail menampilkan data kendaraan dan foto.

## 9. Ruang Rapat
- User yang sudah login dapat membuat booking.
- Sistem mengecek benturan ruangan berdasarkan tanggal, ruangan, jam mulai, dan jam selesai.
- Surat dapat diunggah sebagai PDF/gambar sesuai validasi endpoint.
- Edit/hapus booking membutuhkan Kabag/PIC.
- Status surat: `belum`, `ditinjau`, `diterima`.

## 10. Troubleshooting

### `Database biro_umum does not exist`
Periksa `DATABASE_URL`. Untuk database project ini gunakan:

```env
DATABASE_URL="postgresql://postgres:123@localhost:5432/biro_umum_db"
```

### `Terjadi kesalahan server saat login/register`
Jalankan backend dengan `npm start`, ulangi aksi, lalu lihat error setelah request POST `/api/auth/login` atau `/api/auth/register`. Pastikan tabel `users` ada dan struktur kolom cocok dengan `prisma/schema.prisma`.

### Kendaraan/Ruang Rapat mendapat HTTP 403
Pastikan menggunakan versi project ini. POST kendaraan dan booking ruang sudah diizinkan untuk user login; PUT/DELETE tetap dibatasi role editor.

### Setelah role diubah tetapi tombol belum berubah
Logout → login kembali. Token JWT lama masih membawa role sebelumnya sampai token diperbarui.

## 11. Struktur penting
```text
biro-umum-app/
├─ backend/
│  ├─ prisma/schema.prisma
│  ├─ src/prisma.js
│  ├─ src/routes/auth.js
│  ├─ src/routes/pemeliharaan.js
│  ├─ src/routes/pengadaan.js
│  ├─ src/routes/kendaraan.js
│  ├─ src/routes/ruangRapat.js
│  └─ uploads/
└─ frontend/
   └─ src/pages/
      ├─ Pengadaan.jsx
      ├─ Kendaraan.jsx
      ├─ RuangRapat.jsx
      └─ Settings.jsx
```

## 12. Catatan produksi
- Gunakan password PostgreSQL yang kuat.
- Ganti `JWT_SECRET` dengan secret acak yang panjang.
- Jangan commit `.env`.
- Backup PostgreSQL sebelum migrasi struktur.
- Untuk deployment cloud, gunakan PostgreSQL yang dapat diakses server dan set `DATABASE_URL` sebagai environment variable di platform deployment.
