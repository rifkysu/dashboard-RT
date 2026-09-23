require('dotenv').config();
const prisma = require('../src/prisma');

const checks = {
  users: ['id','nama_lengkap','email','password_hash','role','is_active'],
  pengadaan: ['id','kode','nama_barang_jasa','nilai_hps','request_document_file_path','stage2_invoice_document_file_path','stage2_invoice_file_path','stage2_payment_proof_file_path','stage3_final_document_file_path','created_by','updated_by'],
  kendaraan: ['id','name','plate','type','photo_name','photo_file_data','photo_file_path','created_by','updated_by'],
  ruang_rapat: ['id','agenda','room','pic','booking_date','start_time','end_time','surat_status','surat_file_data','surat_file_path','created_by','updated_by']
};
(async()=>{
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    for (const [table, cols] of Object.entries(checks)) {
      const rows = await prisma.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${table}'`);
      const present = new Set(rows.map(r=>r.column_name));
      const missing = cols.filter(c=>!present.has(c));
      const count = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS count FROM \"${table}\"`);
      console.log(`${table}: rows=${count[0].count} missing=${missing.length ? missing.join(', ') : 'none'}`);
      if (missing.length) process.exitCode=2;
    }
  } catch (e) {
    console.error('DB VERIFY GAGAL:', e.message);
    process.exitCode=1;
  } finally { await prisma.$disconnect(); }
})();
