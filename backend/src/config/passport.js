const crypto = require('crypto');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const prisma = require('../prisma');
const { isAllowedEmailDomain } = require('../middleware/security');

// Strategy SSO Google. Alur:
// 1. User klik "Masuk dengan Akun Kemenaker / Intranet" di frontend
// 2. Frontend redirect ke GET /api/auth/google
// 3. Google menampilkan halaman login/consent
// 4. Google redirect balik ke GET /api/auth/google/callback
// 5. Strategy di bawah ini mencari/membuat user berdasarkan email Google,
//    lalu meneruskan ke route callback di routes/auth.js untuk dibuatkan JWT.
//
// CATATAN: Untuk SSO institusi (mis. Azure AD / Keycloak / SSO Kemnaker),
// ganti strategy ini dengan passport-saml atau passport-openidconnect,
// polanya (cari/buat user, lalu signToken) tetap sama persis.

// Parameter OAuth `state` (anti login-CSRF) tanpa session server: nilai acak disimpan di
// cookie HttpOnly saat redirect ke Google, lalu wajib sama dengan `state` yang dibawa Google
// kembali ke callback. Tanpa ini, penyerang bisa membuat korban diam-diam login ke akun penyerang.
const STATE_COOKIE = 'oauth_state';
const cookieAttrs = () => `Path=/api/auth/google; HttpOnly; SameSite=Lax${
  String(process.env.FRONTEND_URL || '').startsWith('https://') ? '; Secure' : ''}`;
const readCookie = (req, name) => {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
};
const cookieStateStore = {
  store(req, meta, cb) {
    const state = crypto.randomBytes(24).toString('hex');
    req.res.append('Set-Cookie', `${STATE_COOKIE}=${state}; Max-Age=600; ${cookieAttrs()}`);
    cb(null, state);
  },
  verify(req, provided, cb) {
    const expected = readCookie(req, STATE_COOKIE);
    req.res.append('Set-Cookie', `${STATE_COOKIE}=; Max-Age=0; ${cookieAttrs()}`); // sekali pakai
    const ok = typeof provided === 'string' && typeof expected === 'string' && provided.length === expected.length
      && crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
    cb(null, ok, ok ? undefined : { message: 'State OAuth tidak cocok.' });
  },
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
        store: cookieStateStore,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const rawEmail = profile.emails && profile.emails[0] && profile.emails[0].value;
          // Samakan dengan register/login (lowercase) supaya tidak terbentuk akun ganda beda huruf besar/kecil.
          const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : null;
          const nama_lengkap = profile.displayName || 'Pengguna SSO';

          if (!email) {
            return done(new Error('Akun Google tidak memiliki email publik.'));
          }
          // Hanya email kedinasan yang sudah diverifikasi Google. Tanpa cek verifikasi, akun Google
          // bisa dibuat dengan alamat @kemnaker.go.id milik orang lain tanpa akses ke kotak suratnya.
          const verified = profile._json?.email_verified === true || profile.emails[0].verified === true;
          if (!verified || !isAllowedEmailDomain(email)) {
            return done(null, false, { domain: true });
          }

          // Cari user berdasarkan email
          let user = await prisma.user.findUnique({ where: { email } });

          if (!user) {
            // Belum ada -> buat akun baru otomatis dengan role default "karyawan".
            // password_hash NULL karena user ini hanya login lewat SSO.
            user = await prisma.user.create({ data: { nama_lengkap, email, password_hash: null, role: 'karyawan', sso_provider: 'google', sso_subject: profile.id } });
          } else if (!user.sso_provider) {
            // User sudah ada (daftar manual sebelumnya) -> tandai juga bisa SSO
            user = await prisma.user.update({ where: { id: user.id }, data: { sso_provider: 'google', sso_subject: profile.id } });
          }

          // Akun yang di-ban admin tidak boleh masuk lewat SSO juga.
          if (!user.is_active) return done(null, false, { banned: true });

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = passport;
module.exports.cookieStateStore = cookieStateStore; // diekspor untuk pengujian
