require('dotenv').config();
const prisma = require('./prisma');

const required = {
  users: ['id','nama_lengkap','email','role','is_active'],
  pemeliharaan: ['id','kode','judul','status','tahap1_status','tahap2_status','tahap3_status','tanggal_selesai'],
  pengadaan: ['id','kode','nama_barang_jasa','nilai_hps','status','tahap1_status','tahap2_status','tahap3_status','tanggal_selesai'],
  kendaraan: ['id','name','plate','type','status','photo_file_path'],
  ruang_rapat: ['id','agenda','room','pic','booking_date','start_time','end_time','surat_status','surat_file_path'],
};

(async () => {
  try {
    const rows = await prisma.$queryRawUnsafe(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name IN (${Object.keys(required).map((_, i) => `$${i + 1}`).join(',')})
      ORDER BY table_name, ordinal_position
    `, ...Object.keys(required));
    const found = {};
    for (const r of rows) (found[r.table_name] ||= new Set()).add(r.column_name);
    let ok = true;
    for (const [table, cols] of Object.entries(required)) {
      const missing = cols.filter(c => !found[table]?.has(c));
      if (missing.length) { ok = false; console.error(`[DB VERIFY] ${table}: missing ${missing.join(', ')}`); }
      else console.log(`[DB VERIFY] ${table}: OK`);
    }
    if (!ok) process.exitCode = 1;
    else console.log('[DB VERIFY] Semua tabel/kolom utama siap digunakan Prisma.');
  } catch (err) {
    console.error('[DB VERIFY] gagal:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
