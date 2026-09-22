-- Backfill: karyawan yang sudah pernah membuat permintaan pemeliharaan/pengadaan
-- sebelum fitur auto-promote PIC aktif, ikut dinaikkan rolenya jadi 'pic'.
-- Aman dijalankan berkali-kali (idempotent) -- hanya menyentuh role 'karyawan'.
UPDATE users
SET role = 'pic', updated_at = NOW()
WHERE role = 'karyawan'
  AND (
    EXISTS (SELECT 1 FROM pemeliharaan p WHERE p.created_by = users.id)
    OR EXISTS (SELECT 1 FROM pengadaan g WHERE g.created_by = users.id)
  );
