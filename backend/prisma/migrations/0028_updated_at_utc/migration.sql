-- Kolom created_at/updated_at bertipe TIMESTAMP tanpa zona waktu dan dibaca Prisma sebagai UTC.
-- Trigger set_updated_at() mengisi updated_at dengan CURRENT_TIMESTAMP, yang dikonversi ke jam
-- LOKAL database (mis. Asia/Jakarta, UTC+7) -> setiap data yang diedit tampil 7 jam lebih maju
-- ("Terakhir diedit" kendaraan/ruang rapat, aktivitas dashboard, dsb.). Isi dengan jam UTC.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$ BEGIN NEW."updated_at" = (now() AT TIME ZONE 'UTC'); RETURN NEW; END; $$ LANGUAGE plpgsql;

-- Perbaiki data lama yang terlanjur tersimpan dengan jam lokal (geser sebesar selisih zona waktu
-- database; kalau database sudah UTC selisihnya 0 dan tidak ada yang berubah):
--   * updated_at > created_at  -> diisi trigger lama saat data diedit.
--   * waktu di masa depan       -> diisi NOW() lewat SQL manual (mis. impor data).
DO $$
DECLARE
  tz_offset interval := now()::timestamp - (now() AT TIME ZONE 'UTC');
  now_utc   timestamp := now() AT TIME ZONE 'UTC';
  t text;
BEGIN
  IF tz_offset = interval '0' THEN RETURN; END IF;
  FOREACH t IN ARRAY ARRAY['users', 'pemeliharaan', 'pengadaan', 'kendaraan', 'kendaraan_service', 'ruang_rapat'] LOOP
    -- Trigger updated_at dimatikan sebentar, kalau tidak nilai koreksi langsung ditimpa jam sekarang.
    EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I', t, t || '_updated_at');
    EXECUTE format(
      'UPDATE %I SET
         created_at = CASE WHEN created_at > $2 + interval ''1 minute'' THEN created_at - $1 ELSE created_at END,
         updated_at = CASE WHEN updated_at > created_at + interval ''1 second'' OR updated_at > $2 + interval ''1 minute''
                           THEN GREATEST(updated_at - $1, CASE WHEN created_at > $2 + interval ''1 minute'' THEN created_at - $1 ELSE created_at END)
                           ELSE updated_at END
       WHERE created_at > $2 + interval ''1 minute'' OR updated_at > created_at + interval ''1 second'' OR updated_at > $2 + interval ''1 minute''', t)
    USING tz_offset, now_utc;
    EXECUTE format('ALTER TABLE %I ENABLE TRIGGER %I', t, t || '_updated_at');
  END LOOP;
  ALTER TABLE maintenance_mode DISABLE TRIGGER maintenance_mode_updated_at;
  UPDATE maintenance_mode SET updated_at = updated_at - tz_offset WHERE updated_at > now_utc + interval '1 minute';
  ALTER TABLE maintenance_mode ENABLE TRIGGER maintenance_mode_updated_at;
END $$;
