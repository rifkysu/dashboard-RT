# Security hardening

Versi ini menambahkan hardening dasar untuk deployment produksi:

- Semua query database memakai parameter PostgreSQL (`$1`, `$2`, dst.); field UPDATE berasal dari allowlist.
- JWT hanya menerima algoritma HS256 dan memeriksa ID + role token.
- `JWT_SECRET` wajib ada dan minimal 32 karakter saat backend startup.
- Rate limiting global dan rate limiting khusus login/registrasi untuk mengurangi brute force.
- CORS dikunci ke `FRONTEND_URL`, tidak lagi memakai wildcard `*`.
- Security headers: CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, COOP/CORP.
- `X-Powered-By` dinonaktifkan.
- Body/query dibatasi agar request berukuran/berbentuk tidak wajar lebih sulit disalahgunakan.
- PostgreSQL connection/query timeout dan pool limit ditambahkan.
- Endpoint upload tidak diekspos sebagai folder static publik.
- Role `kabag`/`pic` tidak dapat dibuat melalui self-registration; role sensitif harus diberikan oleh administrator.
- Kode nomor permintaan memakai `crypto.randomInt()`.
- Token JWT bisa dicabut: versi sesi (`users.token_version`) naik saat logout, reset kata sandi, atau ban; token dengan versi lama ditolak.
- Hanya email @kemnaker.go.id yang dapat membuat akun baru; tidak ada login pihak ketiga (Google/SSO).
- Login dengan email tidak terdaftar tetap menjalankan bcrypt, sehingga waktu respons tidak membocorkan email mana yang terdaftar.
- Link reset kata sandi memakai `#token=` agar token tidak tercatat di log server.
- Halaman web diberi HSTS, CSP (`script-src 'self'`, tanpa script inline), `Referrer-Policy: no-referrer`, dll. lewat `docs/deploy/security-headers.conf`; Nginx hanya TLS 1.2/1.3, `server_tokens off`, file tersembunyi ditolak.
- Frontend memakai Vite 8 (celah keamanan dev server Vite 5 sudah tertutup).
- Akun Admin hanya bisa dikelola Admin: Kabag ditolak (403) saat mengubah role, mem-ban, membuat link reset kata sandi, atau memverifikasi akun Admin. Sebelumnya Kabag bisa membuat link reset untuk Admin (link dikembalikan ke pembuatnya) lalu login sebagai Admin.
- Body JSON 25 MB hanya untuk request dengan token sah (pegawai/tamu); tanpa token maks. 256 KB, supaya orang tanpa login tidak bisa membanjiri server dengan body besar.
- Export CSV/Excel menetralkan sel yang diawali `=`, `+`, `-`, `@` (diberi awalan `'`) agar isi dari pengguna/tamu tidak dijalankan Excel sebagai rumus (CSV injection).
- Foto kendaraan hanya menerima JPG/PNG/WEBP asli.
- Dengan `TRUST_PROXY=true`, backend hanya mendengarkan `127.0.0.1` (ubah lewat `HOST` bila Nginx berada di server lain, dan batasi port backend dengan firewall). Tanpa ini, port 4000 yang terbuka ke jaringan memungkinkan pemalsuan header `X-Forwarded-For` untuk lolos dari batas percobaan login.
- ID di URL di luar batas INTEGER ditolak 400 (bukan error 500).

## Penting

Tidak ada aplikasi yang dapat dijamin "100% tidak bisa di-inject". Hardening aplikasi harus dilengkapi HTTPS, firewall/reverse proxy, update dependency, backup database, password PostgreSQL yang kuat, dan pengelolaan secret yang benar.

Jangan pernah memasukkan file `.env` production ke repository/ZIP. Gunakan `backend/.env.example` sebagai template dan buat `.env` langsung di server.

Untuk deployment:

1. `cd backend && npm ci`
2. Buat `backend/.env` dari `.env.example` dan isi secret/database production.
3. `npm start`
4. Build frontend di server/build pipeline dengan `cd frontend && npm ci && npm run build`.
5. Sajikan `frontend/dist` melalui HTTPS/reverse proxy memakai `docs/deploy/nginx.conf.example` + `security-headers.conf`.
6. Ikuti "Checklist keamanan server" di README Bagian 5 (firewall, password DB, backup, `JWT_SECRET`).
