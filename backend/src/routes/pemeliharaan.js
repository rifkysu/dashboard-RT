const express = require('express');
const crypto = require('crypto');
const prisma = require('../prisma');
const { saveDataUrl } = require('../fileStorage');
const { isGenuineDocumentDataUrl } = require('../fileSignature');
const { requireAuth, requireRole, EDITOR_ROLES } = require('../middleware/auth');
const { requireNotInMaintenance } = require('../middleware/maintenance');
const { signToken } = require('../token');
const logger = require('../logger');

const router = express.Router();
router.use(requireAuth);
router.use(requireNotInMaintenance('pemeliharaan'));
const MAX_DOCUMENT_DATA_LENGTH = 12 * 1024 * 1024;
const validDocumentData = (v) => v == null || isGenuineDocumentDataUrl(v, MAX_DOCUMENT_DATA_LENGTH);
const dateOnly = (v) => v == null ? null : (v instanceof Date ? v.toISOString().slice(0,10) : String(v).slice(0,10));
const serialize = (row) => row ? ({ ...row, tanggal: dateOnly(row.tanggal), tanggal_selesai: dateOnly(row.tanggal_selesai), stage2_invoice_date: dateOnly(row.stage2_invoice_date), stage2_ls_date: dateOnly(row.stage2_ls_date), stage1_hps: row.stage1_hps == null ? row.stage1_hps : Number(row.stage1_hps), stage2_invoice_amount: row.stage2_invoice_amount == null ? row.stage2_invoice_amount : Number(row.stage2_invoice_amount), pic: row.createdBy?.nama_lengkap || null, createdBy: undefined, updatedBy: undefined }) : row;
function generateKode(){ return `REQ-${new Date().getFullYear()}-${crypto.randomInt(1000,10000)}`; }

router.get('/', async (req,res)=>{ try {
  const {status,kategori,lokasi,search}=req.query;
  for(const [k,v] of Object.entries(req.query)){ if(!['status','kategori','lokasi','search'].includes(k) || typeof v!=='string' || v.length>150) return res.status(400).json({message:'Parameter filter tidak valid.'}); }
  const where={};
  if(status) where.status=status;
  if(kategori) where.kategori={equals:kategori,mode:'insensitive'};
  if(lokasi) where.lokasi={equals:lokasi,mode:'insensitive'};
  if(search) where.OR=[{judul:{contains:search,mode:'insensitive'}},{kode:{contains:search,mode:'insensitive'}}];
  const rows=await prisma.pemeliharaan.findMany({where,include:{createdBy:{select:{nama_lengkap:true}}},orderBy:{created_at:'desc'}});
  res.json({data:rows.map(serialize)});
} catch(err){ logger.error('GET pemeliharaan gagal',{error:err,query:req.query,user_id:req.user?.id}); res.status(500).json({message:'Gagal mengambil data pemeliharaan.',error_code:err.code||'DB_ERROR'}); }});

router.get('/:id',async(req,res)=>{ try { const row=await prisma.pemeliharaan.findUnique({where:{id:Number(req.params.id)},include:{createdBy:{select:{nama_lengkap:true}}}}); if(!row)return res.status(404).json({message:'Data tidak ditemukan.'}); res.json({data:serialize(row)}); } catch(err){logger.error('GET pemeliharaan detail gagal',{error:err});res.status(500).json({message:'Gagal mengambil data.'});}});

router.post('/',async(req,res)=>{try{
 const {judul,lokasi,titik_lokasi,kategori,deskripsi,tanggal,jenis_pekerjaan,urgensi,metode_pengadaan,request_document_name,request_document_file_data}=req.body;
 if(!judul||!lokasi||!kategori)return res.status(400).json({message:'judul, lokasi, dan kategori wajib diisi.'});
 if(request_document_file_data!==undefined&&!validDocumentData(request_document_file_data))return res.status(400).json({message:'Dokumen permintaan tidak valid.'});
 const path=request_document_file_data?await saveDataUrl(request_document_file_data,request_document_name,'pemeliharaan'):null;
 const row=await prisma.pemeliharaan.create({data:{kode:generateKode(),judul,lokasi,titik_lokasi:titik_lokasi||null,kategori,deskripsi:deskripsi||null,tanggal: tanggal?new Date(`${tanggal}T00:00:00Z`):new Date(),jenis_pekerjaan:jenis_pekerjaan||null,urgensi:urgensi||'sedang',metode_pengadaan:metode_pengadaan||null,request_document_name:request_document_name||null,request_document_file_data:request_document_file_data||null,request_document_file_path:path,created_by:req.user.id},include:{createdBy:{select:{nama_lengkap:true}}}});
 // Karyawan yang membuat permintaan otomatis dipromosikan jadi PIC atas permintaan itu sendiri.
 let promotion=null;
 if(req.user.role==='karyawan'){
   const updatedUser=await prisma.user.update({where:{id:req.user.id},data:{role:'pic'}});
   promotion={token:signToken(updatedUser),user:{id:updatedUser.id,nama_lengkap:updatedUser.nama_lengkap,email:updatedUser.email,no_hp:updatedUser.no_hp,unit_kerja:updatedUser.unit_kerja,role:updatedUser.role}};
 }
 res.status(201).json({data:serialize(row),...(promotion||{})});
}catch(err){logger.error('POST pemeliharaan gagal',{error:err,user_id:req.user?.id});res.status(500).json({message:'Gagal membuat permintaan pemeliharaan.'});}});

router.put('/:id',requireRole(EDITOR_ROLES),async(req,res)=>{try{
 const id=Number(req.params.id); if(!Number.isInteger(id))return res.status(400).json({message:'ID tidak valid.'});
 // PIC hanya boleh mengedit data yang dia buat sendiri (kabag & admin tetap bebas mengedit semua data).
 if(req.user.role==='pic'){
   const existing=await prisma.pemeliharaan.findUnique({where:{id},select:{created_by:true}});
   if(!existing)return res.status(404).json({message:'Data tidak ditemukan.'});
   if(existing.created_by!==req.user.id)return res.status(403).json({message:'Anda hanya dapat mengedit data pemeliharaan yang Anda tambahkan sendiri.'});
 }
 const body={...req.body};
 if(body.status==='selesai' && !body.tanggal_selesai) body.tanggal_selesai=new Date().toISOString().slice(0,10);
 if(body.status && body.status!=='selesai' && body.tanggal_selesai===undefined) body.tanggal_selesai=null;
 for(const f of ['request_document_file_data','stage1_boq_file_data','stage1_document_file_data','stage2_invoice_document_file_data']) if(body[f]!==undefined&&!validDocumentData(body[f])) return res.status(400).json({message:'Dokumen tidak valid.'});
 if(body.stage3_documentation_files!==undefined){let files;try{files=typeof body.stage3_documentation_files==='string'?JSON.parse(body.stage3_documentation_files):body.stage3_documentation_files;}catch{return res.status(400).json({message:'Format dokumentasi final tidak valid.'});} if(!Array.isArray(files)||files.length>20||files.some(f=>!f||typeof f.name!=='string'||!validDocumentData(f.data)))return res.status(400).json({message:'Dokumentasi final tidak valid.'}); const paths=[];for(const f of files)paths.push({name:f.name,path:await saveDataUrl(f.data,f.name,'pemeliharaan/stage3')});body.stage3_documentation_file_paths=JSON.stringify(paths);}
 const pathFields={request_document_file_data:['request_document_file_path','request_document_name'],stage1_boq_file_data:['stage1_boq_file_path','stage1_boq'],stage1_document_file_data:['stage1_document_file_path','stage1_document_name'],stage2_invoice_document_file_data:['stage2_invoice_document_file_path','stage2_invoice_document_name']};
 for(const [df,[pf,nf]] of Object.entries(pathFields)) if(body[df]) body[pf]=await saveDataUrl(body[df],body[nf],'pemeliharaan');
 if(body.stage2_payment_number!==undefined&&body.stage2_payment_number!==null&&body.stage2_payment_number!==''){const n=Number(body.stage2_payment_number);if(!Number.isInteger(n)||n<1||n>20)return res.status(400).json({message:'Nomor GUP/TUP tidak valid (1-20).'});}
 if(body.stage2_budget_source!==undefined&&body.stage2_budget_source!==null&&body.stage2_budget_source!==''&&!['RM','PNBP'].includes(body.stage2_budget_source))return res.status(400).json({message:'Asal anggaran tidak valid (RM atau PNBP).'});
 const allowed=['judul','lokasi','titik_lokasi','kategori','deskripsi','tanggal','status','tahap1_status','tahap2_status','tahap3_status','tanggal_selesai','catatan','jenis_pekerjaan','urgensi','metode_pengadaan','request_document_name','request_document_file_data','request_document_file_path','stage1_boq','stage1_boq_file_data','stage1_boq_file_path','stage1_hps','stage1_document_name','stage1_document_file_data','stage1_document_file_path','stage2_payment_method','stage2_payment_number','stage2_ls_date','stage2_budget_source','stage2_vendor','stage2_invoice_number','stage2_invoice_date','stage2_invoice_amount','stage2_invoice_document_name','stage2_invoice_document_file_data','stage2_invoice_document_file_path','stage3_documentation_names','stage3_documentation_files','stage3_documentation_file_paths','stage3_bast_notes'];
 const DATE_FIELDS=['tanggal','tanggal_selesai','stage2_invoice_date','stage2_ls_date'];
 const data={};for(const f of allowed){if(body[f]===undefined)continue;if(DATE_FIELDS.includes(f))data[f]=body[f]?new Date(`${String(body[f]).slice(0,10)}T00:00:00Z`):null;else if(f==='stage2_payment_number')data[f]=body[f]===''||body[f]==null?null:Number(body[f]);else data[f]=body[f];}
 data.updated_by=req.user.id;
 const row=await prisma.pemeliharaan.update({where:{id},data,include:{createdBy:{select:{nama_lengkap:true}}}});res.json({data:serialize(row)});
}catch(err){logger.error('PUT pemeliharaan gagal',{error:err,user_id:req.user?.id});if(err.code==='P2025')return res.status(404).json({message:'Data tidak ditemukan.'});res.status(500).json({message:'Gagal memperbarui data pemeliharaan.'});}});

router.delete('/:id',requireRole(EDITOR_ROLES),async(req,res)=>{try{
 const id=Number(req.params.id);
 if(req.user.role==='pic'){
   const existing=await prisma.pemeliharaan.findUnique({where:{id},select:{created_by:true}});
   if(!existing)return res.status(404).json({message:'Data tidak ditemukan.'});
   if(existing.created_by!==req.user.id)return res.status(403).json({message:'Anda hanya dapat menghapus data pemeliharaan yang Anda tambahkan sendiri.'});
 }
 await prisma.pemeliharaan.delete({where:{id}});res.json({message:'Data berhasil dihapus.'});
}catch(err){if(err.code==='P2025')return res.status(404).json({message:'Data tidak ditemukan.'});logger.error('DELETE pemeliharaan gagal',{error:err});res.status(500).json({message:'Gagal menghapus data.'});}});
module.exports=router;
