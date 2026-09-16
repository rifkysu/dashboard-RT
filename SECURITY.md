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

## Penting

Tidak ada aplikasi yang dapat dijamin "100% tidak bisa di-inject". Hardening aplikasi harus dilengkapi HTTPS, firewall/reverse proxy, update dependency, backup database, password PostgreSQL yang kuat, dan pengelolaan secret yang benar.

Jangan pernah memasukkan file `.env` production ke repository/ZIP. Gunakan `backend/.env.example` sebagai template dan buat `.env` langsung di server.

Untuk deployment:

1. `cd backend && npm ci`
2. Buat `backend/.env` dari `.env.example` dan isi secret/database production.
3. `npm start`
4. Build frontend di server/build pipeline dengan `cd frontend && npm ci && npm run build`.
5. Sajikan `frontend/dist` melalui HTTPS/reverse proxy.
