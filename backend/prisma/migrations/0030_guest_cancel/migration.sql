-- Tamu (login Google di landing page) bisa membatalkan booking miliknya sendiri.
-- cancelled_by tetap untuk pegawai (FK users); pembatalan oleh tamu dicatat di kolom ini.
ALTER TABLE "ruang_rapat" ADD COLUMN "cancelled_by_guest_id" INTEGER;
ALTER TABLE "ruang_rapat" ADD CONSTRAINT "ruang_rapat_cancelled_by_guest_id_fkey" FOREIGN KEY ("cancelled_by_guest_id") REFERENCES "guest_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- updated_at otomatis (jam UTC) juga saat akun tamu diubah langsung lewat pgAdmin4 (mis. is_blocked).
CREATE TRIGGER "guest_accounts_updated_at" BEFORE UPDATE ON "guest_accounts" FOR EACH ROW EXECUTE FUNCTION set_updated_at();
