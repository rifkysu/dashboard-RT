# Aplikasi Layanan Biro Umum & Rumah Tangga

Full-stack app (React + Node.js/Express + PostgreSQL + **Prisma**) untuk mengelola pemeliharaan fasilitas, pengadaan barang/jasa, kendaraan dinas, dan booking ruang rapat instansi — lengkap dengan landing page publik, real-time update, dan mode maintenance per menu.

## Fitur utama

### 🌐 Landing page & akses publik (tanpa login)
- **Landing page** (`/`) — menampilkan jadwal ketersediaan ruang rapat secara **real-time**, plus ajakan Masuk/Daftar akun. Ini yang muncul pertama kali dibuka, bukan halaman login.
- **Halaman kiosk read-only** (`/jadwal-rapat`) — versi tampilan layar besar (mis. dipasang di layar dekat ruang rapat), read-only, data sama dengan landing page.

### 🔐 Autentikasi & Role
- Login email/password + **Login SSO** (Google OAuth 2.0 — bisa diganti ke SSO instansi lain lewat `backend/src/config/passport.js`).
- **Lupa Password** — tanpa perlu layanan email: backend membuat link reset (berlaku 1 jam) dan menampilkannya langsung ke pengguna untuk disalin/dikirim manual.
- **Proteksi anti-spam login** — maksimal 5 percobaan per menit per IP, lewat itu tombol login terkunci otomatis **tepat 1 menit** (ada hitungan mundur di UI).
- **4 role**: `karyawan`, `kabag`, `pic`, `admin`.
  - **Karyawan** — cuma bisa melihat & mengajukan permintaan baru (Pemeliharaan/Pengadaan). Satu-satunya role yang bisa daftar mandiri lewat form Register.
  - **Auto-promote PIC** — begitu seorang karyawan berhasil menambahkan permintaan Pemeliharaan/Pengadaan pertamanya, role-nya **otomatis naik jadi PIC** (tanpa logout/login ulang).
  - **PIC** — hanya boleh **mengedit data yang dia buat sendiri** (dicek dari `created_by`), tidak bisa mengedit punya orang lain.
  - **Kabag & Admin** — bebas mengedit/menghapus semua data di semua modul.
  - **Admin** — role tertinggi, **hanya bisa diberikan manual lewat pgAdmin4** (tidak ada di form Register). Satu-satunya role yang bisa mengatur Mode Maintenance, dan selalu bisa mengakses semua menu walau sedang di-maintenance.
  - Role & status aktif user **selalu dicek ulang langsung dari database di setiap request** (bukan dipercaya dari isi token JWT) — jadi kalau role diubah manual lewat pgAdmin4, perubahannya langsung berlaku ke request berikutnya, **tanpa perlu logout**.

### 📊 Dashboard
- Ringkasan status Pemeliharaan & Pengadaan (pending / on progress / selesai) + daftar aktivitas terbaru gabungan dari kedua modul, terurut dari yang paling baru diperbarui.

### 🛠️ Pemeliharaan & 🛒 Pengadaan
- Alur **3 tahap** per permintaan: Analisa & HPS → Invoice & Pembayaran → Dokumentasi/BAST.
- Tahap 2 (Invoice & Pembayaran): pilih metode pembayaran **GUP** (nomor 1–20), **TUP** (nomor 1–10), atau **LS** (+ tanggal LS) — dipasangkan dengan **Asal Anggaran** (`RM` / `PNBP`). Ditampilkan gabung di kolom **Transaksi** tabel (mis. `GUP 5 RM`), lengkap dengan kolom filter-nya sendiri.
- Karyawan hanya bisa melihat & mengajukan; **Kabag, PIC (data sendiri), dan Admin** bisa mengedit & memproses tahapan.
- Export ke Excel dengan filter rentang tanggal, dan setiap kolom tabel punya filter sendiri-sendiri.

### 🚗 Kendaraan
- Data kendaraan dinas (nama, plat nomor, jenis, status: Tersedia/Digunakan/Servis) + foto kendaraan.

### 📅 Ruang Rapat
- **5 ruangan tetap**: SERBAGUNA, SETJEN II, TRI DHARMA, BIRO UMUM, GRAHA KEMNAKER.
- Kalender **matriks** (baris = ruangan, kolom = tanggal Senin–Minggu), navigasi minggu **bebas tanpa batas** (bisa maju/mundur ke tahun berapa pun) + tombol "Hari Ini".
- **Real-time lewat Server-Sent Events (SSE)** — begitu ada booking baru/diedit/dibatalkan oleh siapa pun, semua orang yang sedang membuka halaman (admin maupun landing page publik) langsung melihat perubahannya tanpa refresh.
- **"Terakhir diedit oleh"** beserta waktunya, ditampilkan di detail booking dan otomatis ikut live kalau ada yang mengedit booking yang sama saat modal sedang terbuka.
- **Highlight tanggal merah otomatis**, berlaku untuk tahun berapa pun (tidak perlu update tahunan):
  - Akhir pekan (Sabtu/Minggu) — otomatis, murni dari hari kalender.
  - Hari libur nasional bertanggal tetap (Tahun Baru, Hari Buruh, Harlah Pancasila, HUT RI, Natal).
  - Wafat & Kenaikan Isa Almasih — dihitung otomatis dari rumus Paskah (akurat 100%).
  - Idul Fitri & Idul Adha — dihitung dari konversi kalender Hijriah (ditandai "perkiraan", bisa meleset ±1 hari dari sidang isbat resmi).
  - Tahun Baru Imlek — dihitung dari kalender Tionghoa.
  - **Cuti bersama** & **Nyepi** — didaftar manual per tahun di `frontend/src/utils/holidays.js` (murni kebijakan pemerintah/kalender Saka Bali, tidak bisa dihitung otomatis).

### ⚙️ Mode Maintenance (Settings, khusus Admin)
- Admin bisa menonaktifkan menu tertentu (Dashboard/Pemeliharaan/Pengadaan/Kendaraan/Ruang Rapat) untuk semua role selain admin, lengkap dengan pesan custom per menu.
- Perubahan **real-time lewat SSE** — begitu admin toggle, semua user yang sedang online langsung melihat menu terkunci/terbuka tanpa refresh.
- Diterapkan **dua lapis**: disable tampilan di sidebar/halaman (frontend) **dan** ditolak di API dengan status 503 (backend) — jadi tetap aman walau ada yang mencoba akses API langsung.

### 🎨 Tampilan
- Tema terang biru muda dengan logo Kemnaker, warna aksen berbeda per modul.
- Sidebar bisa **diciutkan** (mode ikon saja) — preferensinya disimpan otomatis di browser.

### 🔒 Keamanan
- Otorisasi role diterapkan **di dua lapis**: disable di UI (frontend) **dan** ditolak di API (backend) — aman walau seseorang mencoba akses API langsung (mis. lewat Postman).
- Rate limiting di endpoint sensitif: login (5x/menit), register, dan lupa password.
- Header keamanan standar (CSP, X-Frame-Options, dll) di setiap response API.

---

## STRUKTUR PROJECT
```
biro-umum-app/
  backend/
    src/
      routes/      -> auth, dashboard, kendaraan, maintenance, pemeliharaan, pengadaan, ruangRapat
      middleware/  -> autentikasi, cek role, cek maintenance mode, rate limiter
    prisma/
      schema.prisma
      migrations/  -> riwayat migration database (SUMBER KEBENARAN skema, urut 0001 s/d terbaru)
    sql/           -> script SQL manual (role_management.sql masih dipakai; sisanya arsip pra-Prisma)
    scripts/       -> script bantu (db-verify.js)
    docs/          -> dokumentasi khusus backend (PRISMA_PRODUCTION.md)
  frontend/
    src/
      pages/       -> Landing, Login, Register, Dashboard, Pemeliharaan, Pengadaan, Kendaraan, RuangRapat, Settings, dll
      components/  -> Sidebar, ProtectedRoute, BrandMark, RuangRapatSchedule, dll
      hooks/       -> useRuangRapatLive (SSE)
      utils/       -> holidays.js (hari libur otomatis)
      context/     -> AuthContext (role, sesi, maintenance mode)
  docs/            -> catatan project lainnya (Update.md, UPLOAD_LOCAL_PLAN.md)
```

---

## BAGIAN 1 — SETUP DATABASE (Prisma, direkomendasikan untuk database baru)

1. Buka **pgAdmin4**, buat database kosong bernama `biro_umum_db` (**Databases** → **Create** → **Database...**). Tidak perlu menjalankan SQL manual apa pun — cukup buat database kosongnya saja.
2. Siapkan `backend/.env` dulu (lihat Bagian 2) supaya `DATABASE_URL` mengarah ke database ini.
3. Dari folder `backend`, jalankan:
   ```bash
   npm install
   npx prisma migrate deploy
   ```
   Perintah ini otomatis membuat semua tabel sesuai riwayat di `backend/prisma/migrations/` (`users`, `pemeliharaan`, `pengadaan`, `kendaraan`, `ruang_rapat`, `maintenance_mode`).
4. Cek di pgAdmin4: refresh `biro_umum_db > Schemas > public > Tables`, tabel-tabel di atas harus sudah muncul.

Database sudah siap. ✅

> **Punya database lama** yang sudah berisi data dari sebelum project ini pakai Prisma? Jangan langsung jalankan `prisma migrate dev`. Ikuti panduan baseline di `backend/docs/PRISMA_PRODUCTION.md` bagian "Database lama yang sudah berisi data".
> Referensi skema versi lama (pra-Prisma) masih disimpan di `backend/sql/` untuk arsip — bukan untuk dijalankan lagi di database baru.

### Cara memberikan Role "Admin" / "PIC" / "Kabag" (khusus lewat pgAdmin4)
Ketiga role ini **sengaja tidak ada** di pilihan saat mendaftar akun baru (form Register cuma bisa bikin akun Karyawan). Untuk menaikkan role seorang user, jalankan di **Query Tool** pgAdmin4 (lihat juga `backend/sql/role_management.sql`):

```sql
-- Lihat semua user & role-nya
SELECT id, nama_lengkap, email, role FROM users ORDER BY id;

-- Jadikan PIC
UPDATE users SET role = 'pic', updated_at = NOW() WHERE email = 'nama.karyawan@kemnaker.go.id';

-- Jadikan Kabag
UPDATE users SET role = 'kabag', updated_at = NOW() WHERE email = 'nama.karyawan@kemnaker.go.id';

-- Jadikan Admin (hanya untuk akun yang benar-benar dipercaya)
UPDATE users SET role = 'admin', updated_at = NOW() WHERE email = 'nama.admin@kemnaker.go.id';

-- Kembalikan jadi Karyawan biasa
UPDATE users SET role = 'karyawan', updated_at = NOW() WHERE email = 'nama.karyawan@kemnaker.go.id';
```

Backend selalu mengambil role terbaru langsung dari database di setiap request, jadi perubahan di atas **langsung berlaku** — user tidak perlu logout/login ulang (walau kalau mau lihat perubahan di tampilan UI langsung tanpa nunggu ~30 detik, cukup refresh browser sekali).

---

## BAGIAN 2 — MENJALANKAN BACKEND (API)

**Prasyarat:** Node.js terinstall (cek `node -v`, minimal versi 18) dan PostgreSQL sudah jalan.

1. Masuk ke folder backend:
   ```bash
   cd biro-umum-app/backend
   ```
2. Duplikat `.env.example` menjadi `.env`:
   ```bash
   cp .env.example .env
   ```
   (Windows CMD: `copy .env.example .env`)
3. Isi `.env`:
   ```env
   DATABASE_URL="postgresql://postgres:isi_password_kamu@localhost:5432/biro_umum_db?schema=public"
   JWT_SECRET="isi_string_acak_minimal_32_karakter"
   JWT_EXPIRES_IN="8h"
   FRONTEND_URL="http://localhost:5173"
   PORT=4000
   ```
   > Tips generate `JWT_SECRET` acak: `openssl rand -hex 32` di terminal (Mac/Linux/Git Bash), atau isi manual string acak panjang.
4. Install dependency (otomatis menjalankan `prisma generate`):
   ```bash
   npm install
   ```
5. Terapkan skema database (lihat Bagian 1):
   ```bash
   npx prisma migrate deploy
   ```
6. Jalankan server:
   ```bash
   npm run dev
   ```
   Kalau berhasil akan muncul:
   ```
   [INFO] Prisma connected
   ✅ Backend Biro Umum berjalan di http://localhost:4000
   ```
7. Tes cepat: buka browser ke `http://localhost:4000/api/health` → harus muncul `{"status":"ok", ...}`.

### Kalau muncul error koneksi database
- Pastikan service PostgreSQL sedang berjalan (buka pgAdmin4, server harus status connected).
- Cek ulang `DATABASE_URL` di `.env` (user, password, port, nama database).
- Jalankan `npm run db:test` untuk tes koneksi cepat, atau `npm run db:verify` untuk cek kolom yang mungkin masih kurang.

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
5. Buka browser ke alamat yang ditampilkan, biasanya `http://localhost:5173`.

Kamu akan melihat **Landing page** (jadwal ruang rapat publik). Klik **"Masuk ke Dashboard"** → **"Daftar Akun Baru"** untuk membuat akun pertama (otomatis role Karyawan). Untuk testing dengan hak edit penuh, naikkan role akun tsb jadi Kabag/Admin lewat pgAdmin4 (lihat Bagian 1), lalu logout–login lagi.

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
7. Klik tombol **"Masuk dengan Akun Kemenaker / Intranet (SSO)"** di halaman login → diarahkan ke Google → setelah izin, otomatis kembali ke aplikasi dan langsung login.

> Catatan: kalau `.env` belum diisi, tombol SSO akan menampilkan pesan bahwa SSO belum dikonfigurasi (tidak error/crash).
> User yang login pertama kali lewat SSO otomatis dibuatkan akun baru dengan role **karyawan**. Untuk menaikkan role, ubah lewat pgAdmin4 seperti di Bagian 1.

---

## BAGIAN 5 — RINGKASAN ATURAN HAK AKSES (RBAC)

### Alur mendapatkan role (penting dipahami sebelum maintenance)
Semua akun **selalu mulai dari role `karyawan`** — tidak ada jalur pendaftaran/login yang langsung memberi role lebih tinggi:

1. **Daftar mandiri** (form Register) → role `karyawan`.
2. **Login SSO pertama kali** (email belum terdaftar) → backend otomatis buat akun baru role `karyawan` juga (`backend/src/config/passport.js`). Kalau email itu ternyata **sudah ada** duluan (misalnya sudah di-upgrade manual lewat pgAdmin4), SSO **tidak** menimpa/reset role yang sudah ada.
3. **Auto-promote ke PIC** — begitu seorang `karyawan` berhasil menambahkan permintaan baru **di Pemeliharaan ATAU Pengadaan** (endpoint `POST /pemeliharaan` atau `POST /pengadaan`), backend otomatis update role user itu jadi `pic` **saat itu juga**, lalu kirim token JWT baru di response supaya sesi langsung ter-update tanpa logout/login ulang (`refreshAuth` di frontend). Promosi ini **berlaku global** (bukan per-modul) — cukup sekali nambah di modul mana pun, role langsung `pic` di semua tempat.
4. **PIC (lewat pgAdmin4), Kabag, dan Admin** — role-role ini **tidak bisa** didapat otomatis lewat aksi apa pun di aplikasi (selain auto-promote PIC di poin 3); satu-satunya cara adalah admin/DBA mengubahnya manual lewat pgAdmin4 (lihat query di Bagian 1).

Ringkasnya: **Register/SSO → Karyawan → (nambah permintaan) → PIC → (manual pgAdmin4) → Kabag/Admin**.

| Role | Bisa buka data? | Bisa tambah permintaan baru? | Bisa edit / proses tahapan? | Bisa dipilih saat daftar akun? |
|---|:---:|:---:|:---:|:---:|
| Karyawan | ✅ | ✅ (otomatis jadi PIC setelahnya) | ❌ | ✅ (satu-satunya) |
| PIC | ✅ | ✅ | ✅ **hanya data buatan sendiri** | ❌ (hanya via pgAdmin4, atau otomatis dari Karyawan) |
| Kabag | ✅ | ✅ | ✅ semua data | ❌ (hanya via pgAdmin4) |
| Admin | ✅ | ✅ | ✅ semua data + atur Mode Maintenance + selalu bisa akses semua menu | ❌ (hanya via pgAdmin4) |

Penerapan teknis:
- **Frontend**: tombol edit/tahapan otomatis disable untuk role `karyawan`, dan untuk `pic` khusus di baris data milik orang lain (lihat `useAuth().canEditRow()` di `frontend/src/context/AuthContext.jsx`).
- **Backend**: endpoint `PUT`/`DELETE` di `backend/src/routes/pemeliharaan.js`, `pengadaan.js`, `kendaraan.js`, `ruangRapat.js` dibungkus middleware `requireRole([...])` + pengecekan kepemilikan (`created_by`) untuk role `pic` — kalau dipaksa lewat API langsung (mis. Postman), tetap ditolak HTTP 403.
- Role user diverifikasi ulang dari database di **setiap** request lewat `requireAuth` — token JWT cuma dipakai untuk identitas (id), bukan sumber kebenaran hak akses.

---

## TROUBLESHOOTING UMUM

| Masalah | Solusi |
|---|---|
| `ECONNREFUSED` saat backend start | PostgreSQL belum jalan / port salah. Cek pgAdmin4 & `DATABASE_URL` di `.env`. |
| `relation "users" does not exist` | Migration belum diterapkan. Jalankan `npx prisma migrate deploy` di folder `backend` (lihat Bagian 1). |
| Database lama sudah berisi data, mau update struktur tanpa kehilangan data | Ikuti panduan baseline di `backend/docs/PRISMA_PRODUCTION.md`, atau jalankan `backend/sql/database_repair.sql` sekali via pgAdmin4 (aman: `IF NOT EXISTS`, tidak DROP data), lalu `npm run db:verify`. |
| Login gagal padahal sudah daftar | Pastikan `VITE_API_URL` (frontend) mengarah ke backend yang aktif. |
| CORS error di console browser | Pastikan `FRONTEND_URL` di `.env` backend sama persis dengan alamat frontend (`http://localhost:5173`). |
| Tombol edit tetap disable padahal sudah jadi Kabag/Admin | Role sudah aktif otomatis maksimal ~30 detik; untuk instan, refresh browser (tidak perlu logout). |
| Login terkunci "Coba lagi dalam X detik" | Proteksi anti-spam (maks. 5x percobaan/menit). Tunggu hitungan mundurnya habis. |
| Menu tampil "Sedang Dalam Mode Maintenance" | Menu tsb sedang dinonaktifkan admin lewat Settings. Hanya role Admin yang tetap bisa akses. |

---

## TEKNOLOGI YANG DIPAKAI
- **Frontend**: React 18, React Router, Axios, Tailwind CSS (CDN), Vite, Server-Sent Events (native `EventSource`)
- **Backend**: Node.js, Express, Prisma ORM, JSON Web Token (jsonwebtoken), bcryptjs, Passport.js (Google OAuth strategy)
- **Database**: PostgreSQL, dikelola lewat Prisma Migrate (`backend/prisma/migrations/`) — pgAdmin4 dipakai untuk operasional (lihat isi data, kelola role user).
