-- Ruangan baru Biro Umum: Galeri Kemnaker, tepat setelah ruangan Biro Umum lainnya (GRAHA KEMNAKER).
-- Kapasitas, fasilitas, dan foto bisa dilengkapi Admin/Kabag di menu "Foto & Fasilitas Ruang".
-- Tema layar: kombinasi yang belum dipakai ruangan lain, utamakan warna yang belum dipakai ruangan Biro Umum
-- lain supaya layarnya tidak mirip ruangan tetangga.
DO $$
DECLARE
  sesudah INT;
  tema_baru TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM "ruang_profil" WHERE "room" = 'GALERI KEMNAKER') THEN
    RETURN;
  END IF;

  SELECT COALESCE(MAX("sort_order"), -1) INTO sesudah FROM "ruang_profil" WHERE "satuan_kerja" = 'Biro Umum';
  UPDATE "ruang_profil" SET "sort_order" = "sort_order" + 1 WHERE "sort_order" > sesudah;

  SELECT p || '/' || m INTO tema_baru
  FROM unnest(ARRAY['kawung','garis','titik','kotak']) WITH ORDINALITY AS mm(m, mi)
  CROSS JOIN unnest(ARRAY['emas','zamrud','safir','marun','ungu','jingga','limau','toska','mawar','perak','tembaga','nila','kuning','hutan']) WITH ORDINALITY AS pp(p, pi)
  WHERE NOT EXISTS (SELECT 1 FROM "ruang_profil" r WHERE r."tema" = p || '/' || m)
  ORDER BY EXISTS (SELECT 1 FROM "ruang_profil" r WHERE r."satuan_kerja" = 'Biro Umum' AND split_part(r."tema", '/', 1) = p), mi, pi
  LIMIT 1;

  INSERT INTO "ruang_profil" ("room", "satuan_kerja", "kapasitas", "fasilitas", "link_foto", "tema", "sort_order", "updated_at")
  VALUES ('GALERI KEMNAKER', 'Biro Umum', NULL, '[]'::jsonb, NULL, tema_baru, sesudah + 1, NOW());
END $$;
