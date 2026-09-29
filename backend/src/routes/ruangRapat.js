const express=require('express');const {EventEmitter}=require('events');const prisma=require('../prisma');const {saveDataUrl,hideFilePaths}=require('../fileStorage');const {isGenuineDocumentDataUrl,maxDataUrlLength}=require('../fileSignature');const {requireAuth}=require('../middleware/auth');const {requireNotInMaintenance}=require('../middleware/maintenance');const logger=require('../logger');const {createSseLimiter}=require('../middleware/security');
const router=express.Router();
// Bus internal untuk broadcast SSE (Server-Sent Events) tiap ada booking berubah,
// supaya kalender publik & admin refresh real-time tanpa polling.
const bus=new EventEmitter();bus.setMaxListeners(0);
const broadcastChange=()=>bus.emit('change');
const STATUS=['belum','ditinjau','diterima'];
const ROOMS=['SERBAGUNA','SETJEN II','TRI DHARMA','BIRO UMUM','GRAHA KEMNAKER'];
const PREFIX=['data:application/pdf;base64,','data:image/jpeg;base64,','data:image/png;base64,'];
// Selain prefix MIME, cek juga magic number isi file (sama seperti modul lain) supaya file palsu yang cuma diganti nama/tipe ditolak.
const validFile=v=>v==null||v===''||(typeof v==='string'&&PREFIX.some(p=>v.startsWith(p))&&isGenuineDocumentDataUrl(v,maxDataUrlLength(8*1024*1024)));
const DATE_RE=/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;const TIME_RE=/^([01]\d|2[0-3]):[0-5]\d$/;
const validText=(v,m)=>typeof v==='string'&&v.trim().length>0&&v.length<=m;
// Nomor surat opsional (boleh kosong), maks. 100 karakter.
const validNomorSurat=v=>v==null||(typeof v==='string'&&v.trim().length<=100);
// Nama file surat opsional, maks. 255 karakter (kolom surat_name VARCHAR(255)).
const validSuratName=v=>v==null||(typeof v==='string'&&v.length<=255);
const validPhone=v=>typeof v==='string'&&/^[0-9+()\- .]{6,30}$/.test(v.trim());
const date=v=>new Date(`${v}T00:00:00Z`); const time=v=>new Date(`1970-01-01T${v}:00Z`);
const DAY=86400000;
// Booking multi-hari: berlaku tiap hari dari booking_date s/d end_date pada jam yang sama. Maks. 90 hari per booking.
const MAX_DAYS=90;
const validDate=v=>typeof v==='string'&&DATE_RE.test(v)&&!isNaN(date(v))&&date(v).toISOString().slice(0,10)===v;
const validTime=v=>typeof v==='string'&&TIME_RE.test(v);
const rangeError=(bd,ed)=>ed<bd?'Tanggal selesai tidak boleh sebelum tanggal mulai.':(ed-bd)/DAY+1>MAX_DAYS?`Booking maksimal ${MAX_DAYS} hari.`:null;
// Bentrok = rentang tanggal beririsan DAN jam beririsan (karena jamnya sama setiap hari).
const conflictWhere=(room,bd,ed,st,et,excludeId)=>({...(excludeId?{id:{not:excludeId}}:{}),room,booking_date:{lte:ed},end_date:{gte:bd},start_time:{lt:et},end_time:{gt:st}});
const fmtDate=d=>d.toISOString().slice(0,10);
const conflictMessage=c=>`Ruangan sudah dibooking pada waktu tersebut: "${c.agenda}" (${fmtDate(c.booking_date)}${+c.end_date!==+c.booking_date?` s/d ${fmtDate(c.end_date)}`:''}, ${c.start_time.toISOString().slice(11,16)}–${c.end_time.toISOString().slice(11,16)}).`;
// Kunci per ruangan selama transaksi, supaya dua booking bersamaan untuk ruangan yang sama tidak lolos cek bentrok berbarengan.
const lockRoom=(tx,room)=>tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ruang_rapat:'+room}))`;
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const out=r=>hideFilePaths({...r,date:fmtDate(r.booking_date),end_date:fmtDate(r.end_date||r.booking_date),start:r.start_time.toISOString().slice(11,16),end:r.end_time.toISOString().slice(11,16),title:r.agenda,status:r.surat_status,updated_by_name:r.updatedBy?.nama_lengkap||null,updatedBy:undefined});
// Rentang tanggal jadwal (?from=YYYY-MM-DD&to=YYYY-MM-DD). Tanpa parameter:
// 1 bulan ke belakang s/d 1 tahun ke depan, supaya respons tidak terus
// membesar seiring bertambahnya riwayat booking. Maksimal 400 hari per request.
function dateRange(q){const today=new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z');const from=q.from===undefined?new Date(today-31*DAY):(typeof q.from==='string'&&DATE_RE.test(q.from)?date(q.from):null);const to=q.to===undefined?new Date(+today+366*DAY):(typeof q.to==='string'&&DATE_RE.test(q.to)?date(q.to):null);if(!from||!to||isNaN(from)||isNaN(to)||to<from||to-from>400*DAY)return null;return {booking_date:{lte:to},end_date:{gte:from}};}
const publicSelect={id:true,agenda:true,room:true,pic:true,booking_date:true,end_date:true,start_time:true,end_time:true,surat_status:true};

// Public read-only schedule. No token required and only schedule information is returned.
router.get('/public-schedule',async(req,res)=>{try{const range=dateRange(req.query);if(!range)return res.status(400).json({message:'Rentang tanggal tidak valid.'});const rows=await prisma.ruangRapat.findMany({where:range,select:publicSelect,orderBy:[{booking_date:'asc'},{start_time:'asc'},{id:'asc'}]});res.json({data:rows.map(out)});}catch(err){logger.error('GET public ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal mengambil jadwal ruang rapat.'});}});

// SSE stream: cuma sinyal "ada perubahan" (bukan data booking itu sendiri),
// jadi aman dibuat publik -- browser EventSource native tidak bisa kirim
// header Authorization, dan data asli tetap lewat endpoint ber-otentikasi
// (GET '/') atau publik terbatas (GET '/public-schedule') seperti biasa.
router.get('/stream',createSseLimiter(),(req,res)=>{
  res.writeHead(200,{'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-cache, no-transform','Connection':'keep-alive'});
  res.write('retry: 3000\n\n');
  const send=()=>{try{res.write(`data: ${Date.now()}\n\n`);}catch{}};
  bus.on('change',send);
  const heartbeat=setInterval(()=>{try{res.write(': heartbeat\n\n');}catch{}},25000);
  req.on('close',()=>{clearInterval(heartbeat);bus.off('change',send);});
});

router.use(requireAuth);
router.use(requireNotInMaintenance('ruang-rapat'));
router.get('/',async(req,res)=>{try{const range=dateRange(req.query);if(!range)return res.status(400).json({message:'Rentang tanggal tidak valid.'});const rows=await prisma.ruangRapat.findMany({where:range,omit:{surat_file_data:true},include:{updatedBy:{select:{nama_lengkap:true}}},orderBy:[{booking_date:'asc'},{start_time:'asc'},{id:'asc'}]});res.json({data:rows.map(out)});}catch(err){logger.error('GET ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal mengambil jadwal ruang rapat.'});}});
router.get('/:id',async(req,res)=>{try{const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({message:'ID booking tidak valid.'});const row=await prisma.ruangRapat.findUnique({where:{id},include:{updatedBy:{select:{nama_lengkap:true}}}});if(!row)return res.status(404).json({message:'Booking tidak ditemukan.'});res.json({data:out(row)});}catch(err){logger.error('GET ruang rapat detail gagal',{error:err});res.status(500).json({message:'Gagal mengambil detail booking.'});}});
// Semua user login (termasuk karyawan) boleh menambah, mengedit, mengelola surat/status, dan membatalkan booking.
router.post('/',async(req,res)=>{try{
  const {title,room,pic,pic_phone,date:startDate,end_date,start,end,status,surat_name,surat_file_data,nomor_surat}=req.body;
  if(!validNomorSurat(nomor_surat))return res.status(400).json({message:'Nomor surat maksimal 100 karakter.'});
  if(!validText(title,255)||!validText(room,150)||!validText(pic,150)||!validPhone(pic_phone)||!validDate(startDate)||(end_date!=null&&end_date!==''&&!validDate(end_date))||!validTime(start)||!validTime(end))return res.status(400).json({message:'Data booking atau nomor HP PIC tidak valid.'});
  if(!ROOMS.includes(room)||!STATUS.includes(status||'belum')||!validFile(surat_file_data)||!validSuratName(surat_name))return res.status(400).json({message:'Ruangan, status, atau surat tidak valid.'});
  if(start>=end)return res.status(400).json({message:'Jam selesai harus lebih besar dari jam mulai.'});
  const bookingDate=date(startDate), endDate=end_date?date(end_date):bookingDate;
  const rangeErr=rangeError(bookingDate,endDate);if(rangeErr)return res.status(400).json({message:rangeErr});
  const row=await prisma.$transaction(async tx=>{
    await lockRoom(tx,room);
    const conflict=await tx.ruangRapat.findFirst({where:conflictWhere(room,bookingDate,endDate,time(start),time(end)),orderBy:[{booking_date:'asc'},{start_time:'asc'}]});
    if(conflict)throw new HttpError(409,conflictMessage(conflict));
    const path=surat_file_data?await saveDataUrl(surat_file_data,surat_name,'ruang-rapat'):null;
    return tx.ruangRapat.create({data:{agenda:title.trim(),nomor_surat:nomor_surat?.trim()||null,room,pic:pic.trim(),pic_phone:pic_phone.trim(),booking_date:bookingDate,end_date:endDate,start_time:time(start),end_time:time(end),surat_status:status||'belum',surat_name:surat_name||null,surat_file_data:surat_file_data||null,surat_file_path:path,created_by:req.user.id,updated_by:req.user.id},include:{updatedBy:{select:{nama_lengkap:true}}}});
  },{timeout:20000});
  broadcastChange();res.status(201).json({data:out(row)});
}catch(err){if(err instanceof HttpError)return res.status(err.status).json({message:err.message});logger.error('POST ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal menyimpan booking ruang rapat.'});}});
router.put('/:id',async(req,res)=>{try{
  const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({message:'ID booking tidak valid.'});
  const b=req.body;
  if((b.date!==undefined&&!validDate(b.date))||(b.end_date!==undefined&&b.end_date!==null&&b.end_date!==''&&!validDate(b.end_date))||(b.start!==undefined&&!validTime(b.start))||(b.end!==undefined&&!validTime(b.end)))return res.status(400).json({message:'Format tanggal atau jam tidak valid.'});
  const data={};
  if(b.title!==undefined){if(!validText(b.title,255))return res.status(400).json({message:'Agenda tidak valid.'});data.agenda=b.title.trim();}
  if(b.nomor_surat!==undefined){if(!validNomorSurat(b.nomor_surat))return res.status(400).json({message:'Nomor surat maksimal 100 karakter.'});data.nomor_surat=b.nomor_surat?.trim()||null;}
  if(b.room!==undefined){if(!ROOMS.includes(b.room))return res.status(400).json({message:'Ruangan tidak valid.'});data.room=b.room;}
  if(b.pic!==undefined){if(!validText(b.pic,150))return res.status(400).json({message:'Nama PIC tidak valid.'});data.pic=b.pic.trim();}
  if(b.pic_phone!==undefined){if(!validPhone(b.pic_phone))return res.status(400).json({message:'Nomor HP PIC tidak valid.'});data.pic_phone=b.pic_phone.trim();}
  if(b.status!==undefined){if(!STATUS.includes(b.status))return res.status(400).json({message:'Status surat tidak valid.'});data.surat_status=b.status;}
  if(b.surat_name!==undefined){if(!validSuratName(b.surat_name))return res.status(400).json({message:'Nama file surat maksimal 255 karakter.'});data.surat_name=b.surat_name||null;}
  if(b.surat_file_data!==undefined&&!validFile(b.surat_file_data))return res.status(400).json({message:'Dokumen surat tidak valid.'});
  const row=await prisma.$transaction(async tx=>{
    const pre=await tx.ruangRapat.findUnique({where:{id},select:{room:true}});
    if(!pre)throw new HttpError(404,'Booking tidak ditemukan.');
    const scheduleChanged=b.room!==undefined||b.date!==undefined||b.end_date!==undefined||b.start!==undefined||b.end!==undefined;
    if(scheduleChanged){
      await lockRoom(tx,data.room??pre.room);
      const current=await tx.ruangRapat.findUnique({where:{id}});
      if(!current)throw new HttpError(404,'Booking tidak ditemukan.');
      const bd=b.date!==undefined?date(b.date):current.booking_date;
      // Kalau hanya tanggal mulai yang diubah, durasi booking dipertahankan.
      const ed=b.end_date?date(b.end_date):b.end_date!==undefined?bd:new Date(+bd+(current.end_date-current.booking_date));
      const st=b.start!==undefined?time(b.start):current.start_time, et=b.end!==undefined?time(b.end):current.end_time;
      if(et<=st)throw new HttpError(400,'Jam selesai harus lebih besar dari jam mulai.');
      const rangeErr=rangeError(bd,ed);if(rangeErr)throw new HttpError(400,rangeErr);
      const conflict=await tx.ruangRapat.findFirst({where:conflictWhere(data.room??pre.room,bd,ed,st,et,id),orderBy:[{booking_date:'asc'},{start_time:'asc'}]});
      if(conflict)throw new HttpError(409,conflictMessage(conflict));
      Object.assign(data,{booking_date:bd,end_date:ed,start_time:st,end_time:et});
    }
    // File surat disimpan paling akhir, setelah semua validasi & cek bentrok lolos.
    if(b.surat_file_data!==undefined){data.surat_file_data=b.surat_file_data||null;data.surat_file_path=b.surat_file_data?await saveDataUrl(b.surat_file_data,b.surat_name,'ruang-rapat'):null;}
    data.updated_by=req.user.id;
    return tx.ruangRapat.update({where:{id},data,include:{updatedBy:{select:{nama_lengkap:true}}}});
  },{timeout:20000});
  broadcastChange();res.json({data:out(row)});
}catch(err){if(err instanceof HttpError)return res.status(err.status).json({message:err.message});if(err.code==='P2025')return res.status(404).json({message:'Booking tidak ditemukan.'});logger.error('PUT ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal memperbarui booking.'});}});
// Batalkan sebagian tanggal dari booking multi-hari. Sisa tanggal dipecah jadi rentang-rentang berurutan:
// rentang pertama tetap memakai booking ini, rentang berikutnya jadi booking baru dengan data yang sama
// (agenda, PIC, surat, status). Kalau semua tanggal dibatalkan, booking dihapus.
router.post('/:id/cancel-dates',async(req,res)=>{try{
  const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({message:'ID booking tidak valid.'});
  const dates=req.body?.dates;
  if(!Array.isArray(dates)||dates.length===0||dates.length>MAX_DAYS||!dates.every(validDate))return res.status(400).json({message:'Pilih minimal satu tanggal yang valid untuk dibatalkan.'});
  const cancel=new Set(dates);
  const result=await prisma.$transaction(async tx=>{
    const pre=await tx.ruangRapat.findUnique({where:{id},select:{room:true}});
    if(!pre)throw new HttpError(404,'Booking tidak ditemukan.');
    await lockRoom(tx,pre.room);
    const b=await tx.ruangRapat.findUnique({where:{id}});
    if(!b)throw new HttpError(404,'Booking tidak ditemukan.');
    const days=[];for(let t=+b.booking_date;t<=+b.end_date;t+=DAY)days.push(fmtDate(new Date(t)));
    if([...cancel].some(d=>!days.includes(d)))throw new HttpError(400,'Ada tanggal yang tidak termasuk dalam booking ini.');
    const segments=[];for(const d of days){if(cancel.has(d))continue;const last=segments[segments.length-1];if(last&&+date(d)-+date(last.to)===DAY)last.to=d;else segments.push({from:d,to:d});}
    if(!segments.length){await tx.ruangRapat.delete({where:{id}});return {deleted:true,bookings:[]};}
    const include={updatedBy:{select:{nama_lengkap:true}}};
    const rows=[await tx.ruangRapat.update({where:{id},data:{booking_date:date(segments[0].from),end_date:date(segments[0].to),updated_by:req.user.id},include})];
    const copy={agenda:b.agenda,nomor_surat:b.nomor_surat,room:b.room,pic:b.pic,pic_phone:b.pic_phone,start_time:b.start_time,end_time:b.end_time,surat_status:b.surat_status,surat_name:b.surat_name,surat_file_data:b.surat_file_data,surat_file_path:b.surat_file_path,created_by:b.created_by,updated_by:req.user.id};
    for(const s of segments.slice(1))rows.push(await tx.ruangRapat.create({data:{...copy,booking_date:date(s.from),end_date:date(s.to)},include}));
    return {deleted:false,bookings:rows};
  },{timeout:20000});
  broadcastChange();res.json({data:{deleted:result.deleted,bookings:result.bookings.map(out)},message:result.deleted?'Booking dibatalkan.':`${cancel.size} tanggal berhasil dibatalkan.`});
}catch(err){if(err instanceof HttpError)return res.status(err.status).json({message:err.message});logger.error('Cancel tanggal ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal membatalkan tanggal booking.'});}});
router.delete('/:id',async(req,res)=>{try{const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({message:'ID booking tidak valid.'});await prisma.ruangRapat.delete({where:{id}});broadcastChange();res.json({message:'Booking dibatalkan.'});}catch(err){if(err.code==='P2025')return res.status(404).json({message:'Booking tidak ditemukan.'});logger.error('DELETE ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal membatalkan booking.'});}});
module.exports=router;module.exports.ROOMS=ROOMS;
