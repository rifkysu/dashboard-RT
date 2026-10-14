-- Akun tamu (login Google/SSO dari landing page) untuk booking ruang rapat tanpa akun pegawai.
-- Sengaja tabel terpisah dari "users": akun tamu tidak bisa masuk ke aplikasi internal sama sekali.
CREATE TABLE "guest_accounts" (
  "id"            SERIAL PRIMARY KEY,
  "google_sub"    VARCHAR(255) NOT NULL,
  "email"         VARCHAR(254) NOT NULL,
  "nama"          VARCHAR(150) NOT NULL,
  "foto"          VARCHAR(500),
  "is_blocked"    BOOLEAN NOT NULL DEFAULT false,
  "token_version" INTEGER NOT NULL DEFAULT 0,
  "last_login_at" TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "guest_accounts_google_sub_key" ON "guest_accounts"("google_sub");

-- Booking yang diajukan akun tamu: guest_id terisi (created_by/updated_by tetap NULL).
ALTER TABLE "ruang_rapat" ADD COLUMN "guest_id" INTEGER;
ALTER TABLE "ruang_rapat" ADD CONSTRAINT "ruang_rapat_guest_id_fkey" FOREIGN KEY ("guest_id") REFERENCES "guest_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ruang_rapat_guest_id_idx" ON "ruang_rapat"("guest_id");
