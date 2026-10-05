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
- Login Google memakai parameter OAuth `state` (cookie HttpOnly) untuk mencegah login CSRF; hanya email @kemnaker.go.id yang terverifikasi.
- Login dengan email tidak terdaftar tetap menjalankan bcrypt, sehingga waktu respons tidak membocorkan email mana yang terdaftar.
- Link reset kata sandi memakai `#token=` agar token tidak tercatat di log server.
- Halaman web diberi HSTS, CSP (`script-src 'self'`, tanpa script inline), `Referrer-Policy: no-referrer`, dll. lewat `docs/deploy/security-headers.conf`; Nginx hanya TLS 1.2/1.3, `server_tokens off`, file tersembunyi ditolak.
- Frontend memakai Vite 8 (celah keamanan dev server Vite 5 sudah tertutup).

## Penting

Tidak ada aplikasi yang dapat dijamin "100% tidak bisa di-inject". Hardening aplikasi harus dilengkapi HTTPS, firewall/reverse proxy, update dependency, backup database, password PostgreSQL yang kuat, dan pengelolaan secret yang benar.

Jangan pernah memasukkan file `.env` production ke repository/ZIP. Gunakan `backend/.env.example` sebagai template dan buat `.env` langsung di server.

Untuk deployment:

1. `cd backend && npm ci`
2. Buat `backend/.env` dari `.env.example` dan isi secret/database production.
3. `npm start`
4. Build frontend di server/build pipeline dengan `cd frontend && npm ci && npm run build`.
5. Sajikan `frontend/dist` melalui HTTPS/reverse proxy memakai `docs/deploy/nginx.conf.example` + `security-headers.conf`.
6. Ikuti "Checklist keamanan server" di README Bagian 6 (firewall, password DB, backup, `JWT_SECRET`).
