const express=require('express');const prisma=require('../prisma');const {requireAuth}=require('../middleware/auth');const {requireNotInMaintenance}=require('../middleware/maintenance');const router=express.Router();router.use(requireAuth);router.use(requireNotInMaintenance('dashboard'));
router.get('/summary',async(req,res)=>{try{const [pm,pg,kendaraan]=await Promise.all([prisma.pemeliharaan.groupBy({by:['status'],_count:{_all:true}}),prisma.pengadaan.groupBy({by:['status'],_count:{_all:true}}),prisma.kendaraan.findMany({select:{id:true,plate:true,plat_khusus:true,merk:true,tipe:true,waktu_pajak:true}})]);const map=rows=>rows.reduce((a,r)=>{a[r.status]=r._count._all;return a;},{pending:0,on_progress:0,selesai:0});
  // Semua perbandingan pakai string tanggal YYYY-MM-DD: waktu_pajak disimpan sebagai DATE (00:00 UTC),
  // "hari ini" pakai tanggal lokal server (WIB).
  const d=new Date();const iso=(x)=>`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`;
  const today=iso(d);const limitDate=new Date(d);limitDate.setDate(limitDate.getDate()+14);const limit=iso(limitDate);
  const dayMs=86400000;const pajak=k=>k.waktu_pajak?k.waktu_pajak.toISOString().slice(0,10):null;
  // "Belum bayar pajak" = belum pernah diisi tanggal pajaknya, atau tanggalnya sudah lewat hari ini.
  const belumBayarPajak=kendaraan.filter(k=>!pajak(k)||pajak(k)<today).length;
  // "Pajak segera" (H-14) = jatuh tempo hari ini s/d 14 hari ke depan.
  const segera=kendaraan.filter(k=>pajak(k)&&pajak(k)>=today&&pajak(k)<=limit).map(k=>({id:k.id,plate:k.plate,plat_khusus:k.plat_khusus,merk:k.merk,tipe:k.tipe,waktu_pajak:pajak(k),sisa_hari:Math.round((new Date(`${pajak(k)}T00:00:00Z`)-new Date(`${today}T00:00:00Z`))/dayMs)})).sort((a,b)=>a.sisa_hari-b.sisa_hari);
  res.json({pemeliharaan:map(pm),pengadaan:map(pg),kendaraan:{total:kendaraan.length,belum_bayar_pajak:belumBayarPajak,pajak_segera:segera.length,pajak_segera_list:segera}});
}catch(e){res.status(500).json({message:'Gagal mengambil ringkasan dashboard.'});}});
router.get('/activities',async(req,res)=>{try{const [pm,pg]=await Promise.all([prisma.pemeliharaan.findMany({select:{kode:true,judul:true,status:true,updated_at:true},orderBy:{updated_at:'desc'},take:20}),prisma.pengadaan.findMany({select:{kode:true,nama_barang_jasa:true,status:true,updated_at:true},orderBy:{updated_at:'desc'},take:20})]);const data=[...pm.map(r=>({modul:'Pemeliharaan',kode:r.kode,deskripsi:r.judul,status:r.status,waktu:r.updated_at})),...pg.map(r=>({modul:'Pengadaan',kode:r.kode,deskripsi:r.nama_barang_jasa,status:r.status,waktu:r.updated_at}))].sort((a,b)=>b.waktu-a.waktu).slice(0,20);res.json({data});}catch(e){res.status(500).json({message:'Gagal mengambil aktivitas terbaru.'});}});module.exports=router;
