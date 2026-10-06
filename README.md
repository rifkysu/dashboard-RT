# Aplikasi Layanan Biro Umum & Rumah Tangga

Full-stack app (React + Node.js/Express + PostgreSQL + **Prisma**) untuk mengelola pemeliharaan fasilitas, pengadaan barang/jasa, kendaraan dinas, dan booking ruang rapat instansi — lengkap dengan landing page publik, real-time update, dan mode maintenance per menu.

## Fitur utama

### 🌐 Landing page & akses publik (tanpa login)
- **Landing page** (`/`) — hero + ringkasan modul + jadwal ketersediaan ruang rapat secara **real-time**, plus ajakan Masuk/Daftar akun. Ini yang muncul pertama kali dibuka, bukan halaman login.
- **Halaman kiosk read-only** (`/jadwal-rapat`) — versi tampilan layar besar (mis. dipasang di layar dekat ruang rapat), read-only, data sama dengan landing page.
- **Pilihan ruangan** di jadwal kiosk & landing page: tombol *Semua Ruangan* atau satu nama ruangan, tetap real-time. Pilihan tersimpan di URL, jadi layar di depan satu ruangan cukup dibuka dengan link seperti `/jadwal-rapat?ruang=SERBAGUNA` (nama ruangan persis seperti di tombol; spasi ditulis `%20`, mis. `?ruang=SETJEN%20II`).
- **Landing page ikut Mode Maintenance** — admin bisa menonaktifkan landing page juga (menu `landing` di panel Mode Maintenance), dicek lewat endpoint publik `GET /api/maintenance/landing-status` (tanpa perlu login) supaya pengunjung yang belum punya akun tetap melihat notifikasi maintenance yang benar.

### 🔐 Autentikasi & Role
- Login email/password (Login Google/SSO sudah dihapus).
- **Hanya email @kemnaker.go.id** yang bisa membuat akun baru lewat Daftar Akun. Akun lama dengan domain lain tetap bisa login dengan email + kata sandi. Domainnya diatur di `ALLOWED_EMAIL_DOMAIN` (`backend/src/middleware/security.js` dan `frontend/src/utils/validation.js` — ubah keduanya).
- **Lupa Password** — link reset (berlaku 1 jam) **tidak pernah** ditampilkan ke peminta publik (kalau ditampilkan, siapa pun bisa mengambil alih akun orang lain hanya dengan mengetik emailnya).
  - **SMTP diisi** (lihat Bagian 2): link langsung dikirim ke email pemilik akun.
  - **SMTP kosong / email gagal terkirim**: permintaan masuk sebagai notifikasi admin (badge merah di menu Akun & Akses + penanda di baris akunnya). Admin klik **Kirim Link** → link dikirim ke email (kalau SMTP aktif) dan bisa juga disalin atau dikirim via WhatsApp.
- **Proteksi anti-spam login** — maksimal 5 percobaan per menit per IP, lewat itu tombol login terkunci otomatis **tepat 1 menit** (ada hitungan mundur di UI).
- **4 role**: `karyawan`, `kabag`, `pic`, `admin`.
  - **Karyawan** — cuma bisa melihat & mengajukan permintaan baru (Pemeliharaan/Pengadaan). Satu-satunya role yang bisa daftar mandiri lewat form Register.
  - **Auto-promote PIC** — begitu seorang karyawan berhasil menambahkan permintaan Pemeliharaan/Pengadaan pertamanya, role-nya **otomatis naik jadi PIC** (tanpa logout/login ulang).
  - **PIC** — hanya boleh **mengedit data yang dia buat sendiri** (dicek dari `created_by`), tidak bisa mengedit punya orang lain.
  - **Kabag & Admin** — bebas mengedit/menghapus semua data di semua modul.
  - **Admin** — role tertinggi, **hanya bisa diberikan manual lewat pgAdmin4** (tidak ada di form Register). Satu-satunya role yang bisa mengatur Mode Maintenance, dan selalu bisa mengakses semua menu walau sedang di-maintenance.
  - Role & status aktif user **selalu dicek ulang langsung dari database di setiap request** (bukan dipercaya dari isi token JWT) — jadi kalau role diubah manual lewat pgAdmin4, perubahannya langsung berlaku ke request berikutnya, **tanpa perlu logout**.

### 📊 Dashboard
- **Kartu KPI**: Total Permintaan, Pending, On Progress, Selesai — gabungan Pemeliharaan + Pengadaan.
- **Kartu modul** (Pemeliharaan/Pengadaan/Kendaraan/Ruang Rapat) dengan progress bar persentase selesai, badge dinamis per modul.
- **Kartu Kendaraan** menampilkan jumlah kendaraan yang **belum bayar pajak** (dihitung dari `waktu_pajak` yang kosong atau sudah lewat tanggal hari ini) — langsung dari `GET /api/dashboard/summary`, tidak perlu buka menu Kendaraan dulu untuk tahu.
- **Status ruang rapat saat ini** di kartu Ruang Rapat: tiap ruangan tampil **Kosong** (plus jam booking berikutnya) atau **Dipakai s/d jam X**, badge berisi jumlah ruang kosong. Diperbarui otomatis tiap menit dan langsung saat ada booking berubah (SSE).
- **Peringatan pajak H-14** di kartu Kendaraan: kendaraan yang `waktu_pajak`-nya jatuh hari ini s/d 14 hari ke depan ditampilkan dengan nomor polisi & sisa hari (maks. 3 teratas, merah kalau ≤ 3 hari).
- Daftar **Aktivitas Terbaru** gabungan Pemeliharaan & Pengadaan, terurut dari yang paling baru diperbarui, dengan badge status berwarna.

### 🛠️ Pemeliharaan & 🛒 Pengadaan
- Alur **3 tahap** per permintaan: Analisa & HPS → Invoice & Pembayaran → Dokumentasi/BAST. Dokumen permintaan awal (diupload saat "Tambah Permintaan") bisa dilihat lagi di Tahap 1, tidak hilang begitu masuk alur tahapan.
- Tahap 2 (Invoice & Pembayaran): pilih metode pembayaran **GUP** (nomor 1–20), **TUP** (nomor 1–10), atau **LS** (+ tanggal LS) — dipasangkan dengan **Asal Anggaran** (`RM` / `PNBP`). Ditampilkan gabung di kolom **Transaksi** tabel (mis. `GUP 5 RM`), lengkap dengan kolom filter-nya sendiri.
- Karyawan hanya bisa melihat & mengajukan; **Kabag, PIC (data sendiri), dan Admin** bisa mengedit & memproses tahapan.
- **Kolom Hapus terpisah** dari kolom Aksi (tahapan) — tombol hapus cuma aktif untuk kabag/admin, atau PIC yang memang menambahkan data itu sendiri (dicek `created_by`, sama seperti aturan edit).
- Export ke Excel dengan filter rentang tanggal, dan setiap kolom tabel punya filter sendiri-sendiri.

### 🚗 Kendaraan
- Data mengikuti nomenklatur aset **BMN**: Nama Barang (dropdown kategori tetap: Sedan/Jeep/Station Wagon/Micro Bus/Mini Bus/Pick Up/Mobil Ambulance/Kendaraan Bermotor Khusus Lainnya/Sepeda Motor), Merk, Tipe, No BPKB, No Polisi, Tanggal Perolehan, Masa Berlaku STNK, Waktu Pajak.
- **No Polisi & Plat Khusus independen** — satu kendaraan boleh punya **keduanya sekaligus** (bukan pilih salah satu); ditampilkan gabung di kolom "No Polisi / Khusus" dengan badge "KHUSUS" kalau plat khusus terisi.
- **Galeri foto** — upload hingga **6 foto** sekaligus per kendaraan, otomatis **dikompres di browser** (resize maks. 1600px + re-encode JPEG, pakai Canvas API bawaan, tanpa dependency tambahan) sebelum diupload.
- **Dokumen PDF BPKB & STNK** — bisa diupload saat Tambah Kendaraan, dan **diganti/update lagi kapan pun** dari modal Detail Kendaraan (tombol Lihat/Ganti Dokumen per dokumen), tersimpan di `backend/uploads/kendaraan_bpkb/` & `kendaraan_stnk/`.
- **Status Servis & Invoice Service** — service kendaraan diatur **hanya dari modal Detail** (form Tambah Kendaraan tidak punya pilihan Servis). Di Detail, status bisa diubah (Tersedia/Digunakan/Servis — tombol **Tandai Waktunya Service**); selama status Servis, PDF **invoice service** bisa diupload, dilihat, dan diganti. Tersimpan di kolom `service_invoice_document_*` tabel `kendaraan`, file-nya di `backend/uploads/kendaraan_service/`. Tabel punya kolom **Service** (Waktunya Service / Tidak Service; klik nama invoice untuk membuka PDF-nya). Invoice hanya ditampilkan selama status Servis — datanya tetap tersimpan di database.
- **Edit Data di modal Detail** — kabag/PIC/admin bisa mengubah semua data yang diisi saat Tambah Kendaraan (Nama Barang, Merk, Tipe, No BPKB, No Polisi, Plat Khusus, Jenis, Keterangan, Tanggal Perolehan) lewat tombol **Edit Data**; status, tanggal STNK/pajak, foto, dokumen, dan riwayat service diubah di bagiannya masing-masing di modal yang sama.
- **Update cepat Masa Berlaku STNK & Waktu Pajak** langsung dari modal Detail — praktis dipakai begitu upload STNK baru (nilainya diisi manual, bukan dibaca otomatis dari isi PDF — pembacaan otomatis/OCR sengaja tidak dipakai karena tidak reliable untuk dokumen hasil scan).
- **Search + filter pill** ala marketplace mobil (Merek, Status, Tahun Perolehan) — tiap pill buka dropdown berisi daftar pilihan lengkap dengan jumlah datanya, di atas tab kategori Roda 2/Roda 4/Roda 6.
- Kartu di Dashboard menampilkan jumlah kendaraan yang **belum bayar pajak** dan peringatan **pajak jatuh tempo ≤ 2 minggu (H-14)** (lihat bagian Dashboard).

### 📅 Ruang Rapat
- **5 ruangan tetap**: SERBAGUNA, SETJEN II, TRI DHARMA, BIRO UMUM, GRAHA KEMNAKER.
- Kalender **matriks** (baris = ruangan, kolom = tanggal Senin–Minggu), navigasi minggu **bebas tanpa batas** (bisa maju/mundur ke tahun berapa pun) + tombol "Hari Ini".
- **Real-time lewat Server-Sent Events (SSE)** — begitu ada booking baru/diedit/dibatalkan oleh siapa pun, semua orang yang sedang membuka halaman (admin maupun landing page publik) langsung melihat perubahannya tanpa refresh.
- **Pilih beberapa tanggal (loncat-loncat)** — di form Book Ruangan, pilih *Pilih beberapa tanggal* lalu klik tanggal mana saja di kalender (maks. 60 tanggal, jam sama). Tanggal yang berurutan otomatis digabung jadi satu booking multi-hari, sisanya jadi booking terpisah. Semua tanggal dicek bentrok sekaligus: kalau ada satu yang bentrok, tidak ada yang disimpan. API: `POST /api/ruang-rapat` dengan `dates: ["YYYY-MM-DD", ...]` sebagai pengganti `date`/`end_date`.
- **Satu pengajuan = satu booking saat Cancel** — semua tanggal dari satu kali booking (termasuk tanggal loncat-loncat dan pecahan hasil cancel sebagian) punya kode pengajuan yang sama (`booking_group`). Saat Cancel, popup menampilkan **semua tanggal pengajuan itu** untuk dicentang, dari booking mana pun popup dibuka — tidak perlu cancel satu per satu. Booking lama (sebelum fitur ini) tetap diperlakukan sebagai pengajuan sendiri. API: `GET /api/ruang-rapat/:id/group-dates`, `POST /api/ruang-rapat/:id/cancel-dates`.
- **Booking multi-hari** — isi "Sampai Tanggal" untuk booking beberapa hari (maks. 90 hari, jam sama setiap hari). Saat Cancel, tanggal bisa dipilih satu per satu; sisa tanggal tetap terbooking (otomatis dipecah jadi beberapa booking kalau yang dibatalkan tanggal di tengah).
- **Cancel tidak menghapus data** — booking yang dibatalkan tetap tersimpan di database dengan status batal (`cancelled_at`) dan alasan pembatalan opsional (`cancel_reason`) yang diisi di popup Cancel.
- **Semua role** (termasuk karyawan) bisa menambah, mengedit, mengelola surat/status, dan membatalkan booking.
- **Status surat otomatis** — begitu file surat diupload (tab Surat di detail booking), status langsung **Surat Diterima** (hijau); tanpa surat tetap **Belum Ada Surat** (merah). Tidak ada lagi pilihan status manual, dan status yang dikirim lewat API diabaikan. Surat bisa dihapus lagi (status kembali merah). Migration `0026_surat_status_otomatis` menyamakan data lama.
- **Nomor Surat** — bisa diisi saat booking (opsional) atau lewat Edit Booking, tampil di detail saat booking diklik (kolom `nomor_surat` tabel `ruang_rapat`). Tidak ikut ditampilkan di jadwal publik/landing page.
- **Export Excel** — kolom Tanggal, Nomor Surat, Nama Rapat, PIC; rentang tanggal default = minggu yang sedang dilihat (maks. 400 hari), data diambil langsung dari server.
- **"Terakhir diedit oleh"** beserta waktunya, ditampilkan di detail booking dan otomatis ikut live kalau ada yang mengedit booking yang sama saat modal sedang terbuka.
- **Highlight tanggal merah otomatis**, berlaku untuk tahun berapa pun (tidak perlu update tahunan):
  - Akhir pekan (Sabtu/Minggu) — otomatis, murni dari hari kalender.
  - Hari libur nasional bertanggal tetap (Tahun Baru, Hari Buruh, Harlah Pancasila, HUT RI, Natal).
  - Wafat & Kenaikan Isa Almasih — dihitung otomatis dari rumus Paskah (akurat 100%).
  - Idul Fitri & Idul Adha — dihitung dari konversi kalender Hijriah (ditandai "perkiraan", bisa meleset ±1 hari dari sidang isbat resmi).
  - Tahun Baru Imlek — dihitung dari kalender Tionghoa.
  - **Cuti bersama** & **Nyepi** — didaftar manual per tahun di `frontend/src/utils/holidays.js` (murni kebijakan pemerintah/kalender Saka Bali, tidak bisa dihitung otomatis).

### 🌗 Tampilan Terang / Gelap
- Pilihan **Terang** / **Gelap** ada di sidebar (bagian "Tampilan"), berlaku di semua menu dashboard termasuk popup & dialog. Saat sidebar diciutkan, tersedia sebagai satu tombol ikon.
- Pilihan disimpan per browser (`localStorage`, kunci `tema`). Landing page, login, daftar akun, dan kiosk jadwal rapat selalu terang.
- Teknis: atribut `data-theme="dark"` di `<html>` (dipasang layout dashboard, lihat `src/theme.js` & `ProtectedRoute.jsx`); semua warna gelap ada di satu file `src/dark-theme.css`, jadi mode terang tidak tersentuh.

### ⚙️ Mode Maintenance (Settings, khusus Admin & Kabag)
- Admin bisa menonaktifkan menu tertentu (Landing Page/Dashboard/Pemeliharaan/Pengadaan/Kendaraan/Ruang Rapat) untuk semua role selain admin, lengkap dengan pesan custom per menu.
- Perubahan **real-time lewat SSE** — begitu admin toggle, semua user yang sedang online langsung melihat menu terkunci/terbuka tanpa refresh.
- Diterapkan **dua lapis**: disable tampilan di sidebar/halaman (frontend) **dan** ditolak di API dengan status 503 (backend) — jadi tetap aman walau ada yang mencoba akses API langsung.
- Halaman **Settings khusus admin & kabag** — link-nya otomatis hilang dari sidebar untuk role lain, dan redirect ke Dashboard kalau karyawan/PIC coba akses `/settings` langsung lewat URL. Info profil pengguna (nama, email, role) dipindah ke halaman terpisah **`/profile`** yang bisa diakses semua role lewat blok profil di sidebar (di atas Settings).

### 👤 Akun & Akses (`/akun`, khusus Admin & Kabag)
- Tabel semua akun terdaftar: nama, email, role, no HP, unit kerja, status, metode login (password; akun lama yang dulu dibuat lewat SSO ditandai "SSO (google)"), tanggal daftar, dan **terakhir login** (`last_login_at`, dicatat otomatis tiap kali ada login sukses lewat email/password).
- **Ban / Aktifkan akun** — admin bisa menonaktifkan (`is_active = false`) akun siapa pun kecuali akun sendiri. Efeknya **langsung berlaku**: akun yang di-ban langsung ditolak di request berikutnya (`requireAuth` selalu cek `is_active` segar dari database) dan tidak bisa login lagi sampai diaktifkan ulang — tanpa logic tambahan, murni memanfaatkan mekanisme cek role/status yang sudah ada.
- Link menu ini **cuma muncul di sidebar untuk role admin**, dan endpoint `GET/PUT /api/users*` dijaga `requireRole(['admin'])` di backend.

### 🎨 Tampilan
- Tema terang biru muda dengan logo Kemnaker, warna aksen berbeda per modul.
- Sidebar bisa **diciutkan** (mode ikon saja) di layar desktop — preferensinya disimpan otomatis di browser.
- **Responsive mobile/tablet** — di layar sempit (< md), sidebar berubah jadi **drawer overlay** yang dibuka lewat tombol hamburger di top bar, bukan lagi selalu tampil menutupi konten. Tabel-tabel lebar (Pemeliharaan, Pengadaan, Kendaraan, kalender Ruang Rapat) scroll horizontal di dalam kartunya sendiri, tidak mendorong lebar seluruh halaman.
- Landing page & beberapa menu (Dashboard, Pemeliharaan, Pengadaan, Kendaraan, Ruang Rapat) pakai font Arial/sans-serif, beda dari font default (Inter) di halaman lain.

- **Popup & notifikasi seragam** (`frontend/src/components/Feedback.jsx`) — semua konfirmasi (hapus, batalkan booking, ban akun, selesaikan tahap, aktifkan maintenance), peringatan validasi, dan pesan error tampil sebagai popup; aksi yang berhasil memunculkan notifikasi kecil di pojok kanan atas. Tidak ada lagi `alert()`/`confirm()` bawaan browser.
- **Validasi form sebelum dikirim** (`frontend/src/utils/validation.js`) — kolom wajib yang kosong/salah ditampilkan sekaligus dalam satu popup. Kolom bertanda * di tiap tahap Pemeliharaan/Pengadaan dicek saat **Lanjut ke Tahap** / **Selesaikan** (tidak saat Simpan Draf).

### 🔒 Keamanan
- Otorisasi role diterapkan **di dua lapis**: disable di UI (frontend) **dan** ditolak di API (backend) — aman walau seseorang mencoba akses API langsung (mis. lewat Postman).
- Rate limiting di endpoint sensitif: login (5x/menit), register, dan lupa password.
- **Sesi bisa dicabut** — setiap token JWT membawa versi sesi (`users.token_version`, klaim `tv`). Versi ini naik saat **logout** (`POST /api/auth/logout`), **reset kata sandi**, atau **akun di-ban**, dan `requireAuth` menolak token yang versinya beda. Jadi token yang sempat dicuri langsung mati begitu pemiliknya logout atau mereset sandi, tanpa menunggu 8 jam. Konsekuensinya: logout di satu perangkat ikut mengeluarkan sesi akun yang sama di perangkat lain.
- **Waktu respons login selalu sama** — untuk email yang tidak terdaftar, bcrypt tetap dijalankan terhadap hash pembanding, jadi daftar email pegawai tidak bisa ditebak dari lamanya respons.
- **Link reset kata sandi memakai `#token=`** (bukan `?token=`) — bagian `#` tidak pernah dikirim ke server, jadi token tidak tercatat di log Nginx/proxy; halaman reset langsung menghapusnya dari address bar.
- **Header keamanan halaman web** (HSTS, CSP tanpa script inline, `Referrer-Policy: no-referrer`, dll.) dipasang Nginx lewat `docs/deploy/security-headers.conf`. Karena itu `index.html` tidak boleh berisi `<script>` inline — script awal ada di `frontend/public/boot.js`.
- Header keamanan standar (CSP, X-Frame-Options, dll) di setiap response API.
- **Validasi isi file, bukan cuma klaim tipe file** — semua upload dokumen (Pemeliharaan, Pengadaan, Kendaraan) dicek **magic number**-nya di server (`backend/src/fileSignature.js`) supaya file yang diklaim PDF/JPG/PNG/DOC/XLS beneran punya isi sesuai tipe itu, bukan script/file lain yang cuma diganti nama/ekstensi/Content-Type. Frontend juga punya pengecekan yang sama (`frontend/src/utils/fileSignature.js`) untuk kasih peringatan instan sebelum upload — tapi validasi di server yang jadi penentu akhir, karena cek di client bisa dilewati kalau API dipanggil langsung.
- **Preview dokumen pakai Blob URL, bukan `data:` URI mentah** (`frontend/src/components/DocumentViewer.jsx`, dipakai di semua menu yang punya tombol "Lihat" dokumen). Blob URL cuma valid di memori tab/browser yang membuatnya — kalau di-copy dan dibuka di device/browser lain (termasuk oleh orang yang tidak login), otomatis gagal dimuat, beda dengan `data:` URI yang sifatnya *self-contained* dan bisa dibuka di mana saja tanpa hit ke server.

---

## STRUKTUR PROJECT
```
biro-umum-app/
  backend/
    src/
      routes/      -> auth, dashboard, kendaraan, maintenance, pemeliharaan, pengadaan, ruangRapat, users
      middleware/  -> autentikasi, cek role, cek maintenance mode, rate limiter
      fileSignature.js -> validasi magic number file upload (dipakai pemeliharaan/pengadaan/kendaraan)
    prisma/
      schema.prisma
      migrations/  -> riwayat migration database (SUMBER KEBENARAN skema, urut 0001 s/d terbaru)
    sql/           -> script SQL manual (role_management.sql masih dipakai; sisanya arsip pra-Prisma)
    scripts/       -> script bantu (db-verify.js)
    docs/          -> dokumentasi khusus backend (PRISMA_PRODUCTION.md)
  frontend/
    src/
      pages/       -> Landing, Login, Register, Dashboard, Pemeliharaan, Pengadaan, Kendaraan, RuangRapat, Settings, Profile, Akun, dll
      components/  -> Sidebar, ProtectedRoute, BrandMark, RuangRapatSchedule, DocumentViewer, dll
      hooks/       -> useLive + useRuangRapatLive (realtime lewat satu koneksi SSE bersama, lihat src/live.js)
      utils/       -> holidays.js (hari libur otomatis), fileSignature.js (validasi magic number di client), imageCompress.js (kompresi foto kendaraan)
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

   # Opsional: kirim link Lupa Password ke email. Contoh pakai Gmail:
   SMTP_HOST="smtp.gmail.com"
   SMTP_PORT="465"
   SMTP_USER="alamat@gmail.com"
   SMTP_PASS="app password 16 karakter"
   ```
   > App Password Gmail dibuat di https://myaccount.google.com/apppasswords (Verifikasi 2 Langkah harus aktif). Nama pengirim otomatis "Biro Umum". Kalau baris SMTP dikosongkan, permintaan reset kata sandi otomatis masuk ke notifikasi admin.
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

### Membersihkan file upload yang tidak terpakai
File di `backend/uploads/` yang tidak lagi direferensikan database (mis. dokumen dari data yang sudah dihapus atau yang sudah diganti) bisa dicek dengan `npm run uploads:cleanup` (laporan saja). Tambahkan `-- --apply` untuk memindahkannya ke `backend/uploads/_orphaned/<tanggal>/` — file tidak dihapus, jadi masih bisa dikembalikan. Hapus folder `_orphaned` secara manual kalau sudah yakin.

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

## BAGIAN 4 — RINGKASAN ATURAN HAK AKSES (RBAC)

### Alur mendapatkan role (penting dipahami sebelum maintenance)
Semua akun **selalu mulai dari role `karyawan`** — tidak ada jalur pendaftaran/login yang langsung memberi role lebih tinggi:

1. **Daftar mandiri** (form Register) → role `karyawan`.
2. **Auto-promote ke PIC** — begitu seorang `karyawan` berhasil menambahkan permintaan baru **di Pemeliharaan ATAU Pengadaan** (endpoint `POST /pemeliharaan` atau `POST /pengadaan`), backend otomatis update role user itu jadi `pic` **saat itu juga**, lalu kirim token JWT baru di response supaya sesi langsung ter-update tanpa logout/login ulang (`refreshAuth` di frontend). Promosi ini **berlaku global** (bukan per-modul) — cukup sekali nambah di modul mana pun, role langsung `pic` di semua tempat. **Catatan**: Kendaraan dan Ruang Rapat sengaja **tidak** memakai alur auto-promote ini — di Ruang Rapat semua role bisa booking & mengelola; di Kendaraan semua role (termasuk karyawan) bisa **menambah** kendaraan, tetapi ubah/hapus/foto/dokumen/service hanya kabag/PIC/admin (tanpa pembatasan kepemilikan antar sesama PIC/kabag/admin).
3. **PIC (lewat pgAdmin4), Kabag, dan Admin** — role-role ini **tidak bisa** didapat otomatis lewat aksi apa pun di aplikasi (selain auto-promote PIC di poin 2); satu-satunya cara adalah admin/DBA mengubahnya manual lewat pgAdmin4 (lihat query di Bagian 1).

Ringkasnya: **Register → Karyawan → (nambah permintaan) → PIC → (manual pgAdmin4) → Kabag/Admin**.

| Role | Bisa buka data? | Bisa tambah permintaan baru? | Bisa edit / proses tahapan? | Bisa dipilih saat daftar akun? |
|---|:---:|:---:|:---:|:---:|
| Karyawan | ✅ | ✅ (otomatis jadi PIC setelahnya) | ❌ | ✅ (satu-satunya) |
| PIC | ✅ | ✅ | ✅ **hanya data buatan sendiri** | ❌ (hanya via pgAdmin4, atau otomatis dari Karyawan) |
| Kabag | ✅ | ✅ | ✅ **setara Admin**: semua data + Akun & Akses + atur Mode Maintenance + selalu bisa akses semua menu | ❌ (hanya via pgAdmin4) |
| Admin | ✅ | ✅ | ✅ semua data + atur Mode Maintenance + selalu bisa akses semua menu | ❌ (hanya via pgAdmin4) |

Penerapan teknis:
- **Frontend**: tombol edit/tahapan/hapus otomatis disable untuk role `karyawan`, dan untuk `pic` khusus di baris data milik orang lain (lihat `useAuth().canEditRow()` di `frontend/src/context/AuthContext.jsx`).
- **Backend**: endpoint `PUT`/`DELETE` di `backend/src/routes/pemeliharaan.js` & `pengadaan.js` dibungkus middleware `requireRole([...])` + pengecekan kepemilikan (`created_by`) untuk role `pic` — kalau dipaksa lewat API langsung (mis. Postman), tetap ditolak HTTP 403. (`kendaraan.js`/`ruangRapat.js` memakai `requireRole([...])` saja tanpa pengecekan kepemilikan — lihat catatan di atas.)
- Role user diverifikasi ulang dari database di **setiap** request lewat `requireAuth` — token JWT cuma dipakai untuk identitas (id), bukan sumber kebenaran hak akses.
- **Kabag = Admin**: daftar role setara admin ada di satu tempat, `ADMIN_ROLES` (`backend/src/middleware/auth.js` dan `frontend/src/context/AuthContext.jsx`) -- dipakai untuk menu Akun & Akses, Settings/Mode Maintenance, dan akses saat maintenance. Ubah di kedua file itu bila aturannya berubah.
- **Admin & Kabag bisa mem-ban akun** (`PUT /api/users/:id/status`, lihat bagian Fitur "Akun & Akses") — memanfaatkan mekanisme cek `is_active` yang sama di `requireAuth`, jadi akun yang di-ban langsung kehilangan akses tanpa perlu logic tambahan. Tidak ada yang bisa mem-ban akun sendiri (dicegah di backend).

---

## BAGIAN 5 — DEPLOY KE PRODUCTION

Contoh siap pakai (tinggal ganti nilai bertanda `<<GANTI>>`):
- `backend/.env.production.example` → salin jadi `backend/.env`
- `frontend/.env.production.example` → salin jadi `frontend/.env.production`
- `docs/deploy/nginx.conf.example` → konfigurasi Nginx (frontend + API satu domain, termasuk realtime)
- `docs/deploy/security-headers.conf` → header keamanan halaman web, salin ke `/etc/nginx/snippets/biro-umum-security-headers.conf`

Urutan di server:

1. **Backup** database dan folder `backend/uploads/` (kalau server sudah pernah dipakai).
2. Backend:
   ```bash
   cd backend
   cp .env.production.example .env      # lalu edit: DATABASE_URL, FRONTEND_URL, JWT_SECRET, dll.
   npm ci --omit=dev
   npx prisma migrate deploy
   npx prisma generate
   pm2 start src/index.js --name biro-umum-api   # SATU proses saja, jangan mode cluster (-i)
   ```
3. Frontend:
   ```bash
   cd frontend
   cp .env.production.example .env.production   # lalu edit VITE_API_URL
   npm ci
   npm run build                                 # hasil di frontend/dist
   ```
4. Nginx: pakai `docs/deploy/nginx.conf.example`, sesuaikan domain & path `frontend/dist`, salin `docs/deploy/security-headers.conf` ke `/etc/nginx/snippets/biro-umum-security-headers.conf`, lalu `sudo nginx -t && sudo systemctl reload nginx`.
5. Cek header: `curl -sI https://<<GANTI_DOMAIN>>/ | grep -i -E "strict-transport|content-security"` harus menampilkan keduanya.

Checklist keamanan server (wajib, di luar kode):
- Firewall: hanya buka port **80/443** ke publik. Port **4000** (backend) & **5432** (PostgreSQL) hanya boleh diakses dari server itu sendiri / komputer admin.
- PostgreSQL: password kuat (bukan `postgres`/`admin`), user database khusus aplikasi bila memungkinkan.
- `JWT_SECRET` acak panjang (mis. `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`), tidak sama dengan lingkungan development. Mengganti `JWT_SECRET` = semua orang ter-logout.
- Backup otomatis harian database + `backend/uploads/`, simpan salinan di lokasi lain, dan uji restore berkala.
- Jangan jalankan `npm run dev` (Vite dev server) di server production — sajikan hanya `frontend/dist`.
- Rutin `npm audit` di backend & frontend dan update OS/Node/Nginx/PostgreSQL. Catatan: `npm audit` frontend masih melaporkan `braces` (dipakai Tailwind 3 saat build) — hanya berjalan saat build dengan pola file milik sendiri, tidak terkirim ke browser; hilang bila nanti migrasi ke Tailwind 4.

Hal yang paling sering terlewat:
- `FRONTEND_URL` (backend) harus sama persis dengan alamat yang dibuka pengguna, termasuk `https://` -- kalau beda, semua request ditolak CORS.
- `VITE_API_URL` ditanam saat build -- kalau diganti, `npm run build` ulang.
- Deploy pertama setelah update keamanan ini: semua pengguna perlu **login ulang sekali** (token lama tidak membawa versi sesi).
- `TRUST_PROXY=true` bila di belakang Nginx; tanpa ini semua pengguna dianggap satu IP (batas koneksi realtime & login cepat penuh).
- Realtime butuh backend **satu proses** dan `proxy_buffering off` untuk `/api/live/stream` (sudah ada di contoh Nginx).
- Pakai HTTPS (HTTP/2) seperti contoh Nginx. Server tidak perlu akses internet untuk melayani aplikasi: Tailwind & semua font sudah dibundel saat `npm run build`.
- Setelah `git pull` yang mengubah `package.json`, jalankan lagi `npm ci` di folder yang berubah (backend/frontend) sebelum build/restart.

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
| `npx prisma generate` gagal dengan `EPERM: operation not permitted, rename ... query_engine-windows.dll.node` (Windows) | Query engine binary lagi dikunci proses lain yang masih jalan (mis. `npm run dev` via nodemon). Ini **aman diabaikan** — file JS hasil generate tetap ter-update, cuma binary engine-nya (yang schema-agnostic) gagal di-rename ulang. Restart backend sekali untuk memastikan Prisma Client yang baru benar-benar dipakai. |

---

## TEKNOLOGI YANG DIPAKAI
- **Frontend**: React 18, React Router 7, Axios, Tailwind CSS 3 (dibundel saat build, bukan CDN), Vite, Server-Sent Events (native `EventSource`). Font (Public Sans, Plus Jakarta Sans, JetBrains Mono, Material Symbols) ikut dibundel -- aplikasi tidak memanggil server luar sama sekali saat dibuka.
- **Backend**: Node.js, Express, Prisma ORM, JSON Web Token (jsonwebtoken), bcryptjs
- **Database**: PostgreSQL, dikelola lewat Prisma Migrate (`backend/prisma/migrations/`) — pgAdmin4 dipakai untuk operasional (lihat isi data, kelola role user).


https://claude.ai/artifact/QUVzQ7RemdfnGh5ccT5dTU