const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('../db');

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

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          const email = profile.emails && profile.emails[0] && profile.emails[0].value;
          const nama_lengkap = profile.displayName || 'Pengguna SSO';

          if (!email) {
            return done(new Error('Akun Google tidak memiliki email publik.'));
          }

          // Cari user berdasarkan email
          let result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
          let user = result.rows[0];

          if (!user) {
            // Belum ada -> buat akun baru otomatis dengan role default "karyawan".
            // password_hash NULL karena user ini hanya login lewat SSO.
            const insert = await pool.query(
              `INSERT INTO users (nama_lengkap, email, password_hash, role, sso_provider, sso_subject)
               VALUES ($1, $2, NULL, 'karyawan', 'google', $3)
               RETURNING *`,
              [nama_lengkap, email, profile.id]
            );
            user = insert.rows[0];
          } else if (!user.sso_provider) {
            // User sudah ada (daftar manual sebelumnya) -> tandai juga bisa SSO
            await pool.query(
              `UPDATE users SET sso_provider = 'google', sso_subject = $1 WHERE id = $2`,
              [profile.id, user.id]
            );
          }

          return done(null, user);
        } catch (err) {
          return done(err);
        }
      }
    )
  );
}

module.exports = passport;
