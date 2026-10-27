-- Tema layar per ruangan (/ruang/:slug): "<palet>/<motif>", mis. "zamrud/garis". Daftar palet & motif
-- sama dengan TEMA_PALET/TEMA_MOTIF di backend/src/routes/ruangInfo.js dan frontend/src/utils/temaRuang.js.
-- NULL = tema otomatis dari nama ruangan.
ALTER TABLE "ruang_profil" ADD COLUMN "tema" VARCHAR(40);

-- Isi awal: tiap ruangan dapat kombinasi berbeda (14 palet x 4 motif) sesuai urutan tampil.
WITH urut AS (
  SELECT "room", (row_number() OVER (ORDER BY "sort_order", "room") - 1)::int AS i FROM "ruang_profil"
)
UPDATE "ruang_profil" p
SET "tema" = (ARRAY['emas','zamrud','safir','marun','ungu','jingga','limau','toska','mawar','perak','tembaga','nila','kuning','hutan'])[(u.i % 14) + 1]
          || '/' || (ARRAY['kawung','garis','titik','kotak'])[((u.i / 14) + u.i) % 4 + 1]
FROM urut u
WHERE p."room" = u."room" AND p."tema" IS NULL;
