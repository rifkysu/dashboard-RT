HEAD
# Aplikasi Layanan Biro Umum & Rumah Tangga

Full-stack app (React + Node.js/Express + PostgreSQL) sesuai mockup Stitch yang diberikan.

## Fitur utama
- Login (email/password) + **Login SSO** (Google OAuth 2.0 — bisa diganti ke SSO instansi lain)
- Daftar Akun Baru (role yang bisa dipilih sendiri: **Karyawan** & **Kabag** saja)
- Role **PIC**: role khusus dengan hak edit sama seperti Kabag, **tidak muncul** di form pendaftaran, hanya bisa diberikan lewat pgAdmin4
- Dashboard ringkasan
- Modul **Pemeliharaan**: Karyawan hanya bisa melihat & mengajukan permintaan baru; **Kabag & PIC** bisa mengedit dan memproses 3 tahap (HPS/Analisa → Invoice/Pembayaran → BAST/Dokumentasi)
- Modul **Pengadaan**: sama polanya — Karyawan lihat + ajukan, Kabag & PIC mengedit/memproses 3 tahap
- Otorisasi role diterapkan **di dua lapis**: disable di UI (frontend) DAN ditolak di API (backend) — jadi tetap aman walau seseorang mencoba akses API langsung.

---

## STRUKTUR PROJECT
```
biro-umum-app/
  backend/     -> Node.js + Express + PostgreSQL (pg)
  frontend/    -> React + Vite + Tailwind (CDN)
```

---

## BAGIAN 1 — SETUP DATABASE DI pgAdmin4

1. Buka **pgAdmin4**, login dengan master password kamu.
2. Di panel kiri, klik kanan **Servers > PostgreSQL** (server lokal kamu) → pastikan statusnya connected (klik dan masukkan password postgres jika diminta).
3. Klik kanan pada **Databases** → **Create** → **Database...**
   - Database: `biro_umum_db`
   - Owner: `postgres` (atau user lain yang kamu pakai)
   - Klik **Save**.
4. Klik database `biro_umum_db` yang baru dibuat di panel kiri agar terpilih (highlight biru).
5. Buka **Query Tool**: klik kanan pada `biro_umum_db` → **Query Tool** (atau ikon petir di toolbar).
6. Buka file `backend/schema.sql` (dari project ini) di teks editor, **copy semua isinya**, lalu **paste** ke Query Tool pgAdmin4.
7. Klik tombol **Execute/Run** (▶ ikon petir, atau tekan `F5`).
8. Jika berhasil, di panel kiri akan muncul tabel: `users`, `pemeliharaan`, `pengadaan` di bawah `biro_umum_db > Schemas > public > Tables`. Klik kanan `Tables` → `Refresh` kalau belum muncul.
9. Cek datanya: klik kanan tabel `pemeliharaan` → **View/Edit Data > All Rows**, harus muncul 3 baris contoh.

Database sudah siap. ✅

### Cara memberikan Role "PIC" ke seorang karyawan (khusus lewat pgAdmin4)
Role `pic` **sengaja tidak ada** di pilihan saat mendaftar akun baru. Untuk menjadikan seorang karyawan sebagai PIC (hak edit khusus), lakukan ini di **Query Tool** pgAdmin4:

```sql
-- Ganti email di bawah dengan email karyawan yang ingin dijadikan PIC
UPDATE users
SET role = 'pic'
WHERE email = 'nama.karyawan@kemnaker.go.id';
```
Klik Execute (F5). Setelah itu, saat karyawan tersebut login ulang (atau login kembali agar token baru terbit), dia otomatis punya hak edit di modul Pemeliharaan & Pengadaan, sama seperti Kabag.

Untuk mengecek semua user & role-nya kapan saja:
```sql
SELECT id, nama_lengkap, email, role FROM users ORDER BY id;
```

Untuk mengembalikan PIC jadi karyawan biasa lagi:
```sql
UPDATE users SET role = 'karyawan' WHERE email = 'nama.karyawan@kemnaker.go.id';
```

---

## BAGIAN 2 — MENJALANKAN BACKEND (API)

**Prasyarat:** Node.js sudah terinstall (cek dengan `node -v`, minimal versi 18).

1. Buka terminal, masuk ke folder backend:
   ```bash
   cd biro-umum-app/backend
   ```
2. Install dependency:
   ```bash
   npm install
   ```
3. Duplikat file `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   (Di Windows CMD: `copy .env.example .env`)
4. Buka file `.env`, sesuaikan dengan koneksi PostgreSQL kamu di pgAdmin4:
   ```env
   PGHOST=localhost
   PGPORT=5432
   PGDATABASE=biro_umum_db
   PGUSER=postgres
   PGPASSWORD=isi_password_postgres_kamu
   JWT_SECRET=isi_string_acak_panjang
   PORT=4000
   FRONTEND_URL=http://localhost:5173
   ```
   > Tips generate JWT_SECRET acak: jalankan `openssl rand -hex 32` di terminal (Mac/Linux/Git Bash), atau isi manual string acak panjang apa saja.
5. Jalankan server:
   ```bash
   npm run dev
   ```
   Kalau berhasil akan muncul:
   ```
   [DB] Terhubung ke PostgreSQL: biro_umum_db
   ✅ Backend Biro Umum berjalan di http://localhost:4000
   ```
6. Tes cepat: buka browser ke `http://localhost:4000/api/health` → harus muncul `{"status":"ok", ...}`.

### Kalau muncul error koneksi database
- Pastikan service PostgreSQL sedang berjalan (buka pgAdmin4, server harus dalam status connected).
- Cek ulang `PGUSER` / `PGPASSWORD` / `PGPORT` di `.env` sesuai punya kamu (defaultnya biasanya port `5432`, user `postgres`).
- Kalau pakai password ber-karakter spesial, tetap tulis apa adanya, tidak perlu tanda kutip.

---

## BAGIAN 3 — MENJALANKAN FRONTEND (React)

1. Buka terminal baru (biarkan backend tetap jalan), masuk ke folder frontend:
   ```bash
   cd biro-umum-app/frontend
   ```
2. Install dependency:
   ```bash
   npm install
   ```
3. Duplikat `.env.example` jadi `.env`:
   ```bash
   cp .env.example .env
   ```
   Isinya cukup:
   ```env
   VITE_API_URL=http://localhost:4000/api
   ```
4. Jalankan:
   ```bash
   npm run dev
   ```
5. Buka browser ke alamat yang ditampilkan, biasanya: `http://localhost:5173`

Kamu akan melihat halaman **Login**. Klik **"Daftar Akun Baru"** untuk membuat akun pertama (pilih role **Kabag** supaya langsung bisa mengedit semua data untuk testing).

---

## BAGIAN 4 — MENGAKTIFKAN LOGIN SSO (Google, opsional)

Contoh di project ini pakai **Google OAuth 2.0** sebagai penyedia SSO (paling gampang untuk uji coba). Kalau instansi kamu punya SSO sendiri (Azure AD / Keycloak / SAML Kemnaker), pola kodenya tetap sama — cukup ganti strategy di `backend/src/config/passport.js` (misalnya pakai `passport-saml` atau `passport-openidconnect`), sisanya (routing, JWT) tidak perlu diubah.

Langkah aktifkan Google SSO untuk uji coba:
1. Buka https://console.cloud.google.com/ → buat project baru (atau pakai yang sudah ada).
2. Menu **APIs & Services > OAuth consent screen** → isi info dasar aplikasi → Save.
3. Menu **APIs & Services > Credentials** → **Create Credentials > OAuth client ID**.
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:4000/api/auth/google/callback`
4. Setelah dibuat, copy **Client ID** dan **Client Secret**.
5. Tempel ke file `.env` backend:
   ```env
   GOOGLE_CLIENT_ID=isi_client_id_kamu
   GOOGLE_CLIENT_SECRET=isi_client_secret_kamu
   GOOGLE_CALLBACK_URL=http://localhost:4000/api/auth/google/callback
   ```
6. Restart backend (`npm run dev` ulang).
7. Klik tombol **"Masuk dengan Akun Kemenaker / Intranet (SSO)"** di halaman login → akan diarahkan ke Google → setelah izin, otomatis kembali ke aplikasi dan langsung login.

> Catatan: kalau `.env` belum diisi, tombol SSO akan menampilkan pesan bahwa SSO belum dikonfigurasi (tidak akan error/crash).
> User yang login pertama kali lewat SSO otomatis dibuatkan akun baru dengan role **karyawan** (read-only). Untuk menjadikannya Kabag/PIC, ubah lewat pgAdmin4 seperti di Bagian 1.

---

## BAGIAN 5 — RINGKASAN ATURAN HAK AKSES (RBAC)

| Role      | Bisa buka data? | Bisa tambah permintaan baru? | Bisa edit / proses tahapan? | Bisa dipilih saat daftar akun? |
|-----------|:---:|:---:|:---:|:---:|
| Karyawan  | ✅ | ✅ | ❌ | ✅ |
| Kabag     | ✅ | ✅ | ✅ | ✅ |
| PIC       | ✅ | ✅ | ✅ | ❌ (hanya via pgAdmin4) |

Penerapan teknis:
- **Frontend**: tombol edit/tahapan otomatis disable + terlihat abu-abu untuk role `karyawan` (lihat `useAuth().canEdit` di `frontend/src/context/AuthContext.jsx`).
- **Backend**: endpoint `PUT` dan `DELETE` di `backend/src/routes/pemeliharaan.js` & `pengadaan.js` dibungkus middleware `requireRole(['kabag','pic','admin'])` — kalau karyawan memaksa memanggil API langsung (misal lewat Postman), tetap akan ditolak dengan HTTP 403.

---

## TROUBLESHOOTING UMUM

| Masalah | Solusi |
|---|---|
| `ECONNREFUSED` saat backend start | PostgreSQL belum jalan / port salah. Cek pgAdmin4 & `.env`. |
| `relation "users" does not exist` | Berarti `schema.sql` belum dijalankan di database yang benar. Ulangi Bagian 1. |
| Login gagal padahal sudah daftar | Pastikan backend & frontend `.env` sudah benar (`VITE_API_URL` mengarah ke backend yang aktif). |
| CORS error di console browser | Pastikan `FRONTEND_URL` di `.env` backend sama persis dengan alamat frontend (`http://localhost:5173`). |
| Tombol edit tetap disable padahal sudah jadi Kabag/PIC | Logout lalu login ulang supaya token JWT baru (berisi role terbaru) diterbitkan. |

---

## TEKNOLOGI YANG DIPAKAI
- **Frontend**: React 18, React Router, Axios, Tailwind CSS (CDN), Vite
- **Backend**: Node.js, Express, JSON Web Token (jsonwebtoken), bcryptjs, Passport.js (Google OAuth strategy)
- **Database**: PostgreSQL (dikelola lewat pgAdmin4)

### Pemberian Role PIC / Kabag via PostgreSQL
Pendaftaran mandiri hanya menyediakan role **Karyawan**. Untuk memberikan akses **PIC** atau **Kabag**, ubah role user langsung melalui pgAdmin4 Query Tool:

```sql
-- Cek user
SELECT id, nama_lengkap, email, role FROM users ORDER BY id;

-- Jadikan PIC
UPDATE users SET role = 'pic', updated_at = NOW() WHERE email = 'email@contoh.go.id';

-- Jadikan Kabag
UPDATE users SET role = 'kabag', updated_at = NOW() WHERE email = 'email@contoh.go.id';
```

Setelah perubahan role, user perlu login ulang agar token/JWT mendapatkan role terbaru.
=======
# dashboard-RT


## Perbaikan Database Lama + Prisma

Jika database PostgreSQL `biro_umum_db` sudah berisi data lama, **jangan menjalankan `prisma migrate dev` secara sembarangan**. Gunakan `backend/database_repair.sql` sekali melalui pgAdmin4 Query Tool pada database `biro_umum_db`. Script ini bersifat kompatibilitas: memakai `IF NOT EXISTS`, tidak DROP tabel, dan tidak menghapus data.

Setelah SQL selesai:

```bash
cd backend
npm install
npx prisma generate
npm run db:test
npm run db:verify
npm start
```

`npm run db:verify` akan menampilkan jumlah data dan kolom yang masih kurang pada `pengadaan`, `kendaraan`, dan `ruang_rapat`. Jika tertulis `missing=none`, struktur kolom yang dibutuhkan API Prisma sudah tersedia.

### Pengadaan
Nilai HPS **tidak dimasukkan pada form Tambah Pengadaan**. Kolom `pengadaan.nilai_hps` tetap dipertahankan dan hanya diisi melalui Aksi Tahap 1.

### Jika muncul “Gagal memuat...”
1. Pastikan backend menggunakan `.env` yang menunjuk ke `biro_umum_db`.
2. Jalankan `npm run db:test`.
3. Jalankan `npm run db:verify`.
4. Jika ada `missing=...`, jalankan `backend/database_repair.sql` di pgAdmin4 lalu ulangi `npm run db:verify`.
5. Restart backend dengan `npm start`.

### `.env` backend yang dipakai
Simpan sebagai `backend/.env` (jangan commit file ini):

```env
PGHOST=localhost
PGPORT=5432
PGDATABASE=biro_umum_db
PGUSER=postgres
PGPASSWORD=<password PostgreSQL kamu>
DATABASE_URL="postgresql://postgres:<password PostgreSQL kamu>@localhost:5432/biro_umum_db"
JWT_SECRET=<minimal 32 karakter>
JWT_EXPIRES_IN=8h
PORT=4000
FRONTEND_URL=http://localhost:5173
```

Jika password PostgreSQL kamu adalah `123`, maka `DATABASE_URL` menjadi:
`postgresql://postgres:123@localhost:5432/biro_umum_db`

### Urutan aman setelah mengambil ZIP

```bash
cd backend
npm install
npx prisma generate
npm run db:test
npm run db:verify
```

Lalu jalankan `npm start`. Di terminal harus muncul `Prisma connected` dan server pada port 4000.


## Update lokasi Pengadaan & Pemeliharaan

Versi ini menambahkan pilihan lokasi standar pada Pengadaan dan Pemeliharaan: `Graha Kemnaker`, `Gatsu 51`, `Wisma Ciloto`, `Rumah Dinas`, `RC Walang`, dan `RC Kranji`. Filter lokasi sekarang menggunakan dropdown dengan pilihan yang sama.

Pengadaan juga memiliki field `titik_lokasi` seperti Pemeliharaan. Field ini adalah keterangan titik/detail lokasi (misalnya `Gedung A lantai 2 / Ruang 201`) dan tampil di tabel Pengadaan. Jalankan `backend/pengadaan_titik_lokasi_migration.sql` sekali pada database `biro_umum_db` sebelum memakai fitur ini. Migration aman untuk data lama karena hanya `ADD COLUMN IF NOT EXISTS` dan membuat index.
