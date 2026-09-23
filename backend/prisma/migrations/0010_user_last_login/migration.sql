-- Catat kapan tiap akun terakhir login (email/password maupun SSO), dipakai
-- di menu "Akun" (khusus admin) untuk memantau siapa saja yang mengakses
-- sistem beserta role-nya.
ALTER TABLE "users" ADD COLUMN "last_login_at" TIMESTAMP;
