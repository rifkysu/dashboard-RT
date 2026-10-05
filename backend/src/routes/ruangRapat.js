const express=require('express');const crypto=require('crypto');const {EventEmitter}=require('events');const prisma=require('../prisma');const {saveDataUrl,hideFilePaths}=require('../fileStorage');const {isGenuineDocumentDataUrl,maxDataUrlLength}=require('../fileSignature');const {requireAuth}=require('../middleware/auth');const {requireNotInMaintenance}=require('../middleware/maintenance');const logger=require('../logger');const {createSseLimiter}=require('../middleware/security');const fs=require('fs');const nodePath=require('path');const {UPLOAD_ROOT}=require('../fileStorage');const {createZip}=require('../zip');
const router=express.Router();
// Bus internal untuk broadcast SSE (Server-Sent Events) tiap ada booking berubah,
// supaya kalender publik & admin refresh real-time tanpa polling.
const bus=new EventEmitter();bus.setMaxListeners(0);
const broadcastChange=()=>bus.emit('change');
// Status surat OTOMATIS: ada file surat -> 'diterima' (hijau), tidak ada -> 'belum' (merah).
// Status yang dikirim klien diabaikan.
const suratStatus=fileData=>fileData?'diterima':'belum';
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
// Alasan pembatalan opsional, maks. 500 karakter (kolom cancel_reason VARCHAR(500)).
const validReason=v=>v==null||(typeof v==='string'&&v.length<=500);
const cancelData=(req)=>({cancelled_at:new Date(),cancelled_by:req.user.id,cancel_reason:typeof req.body?.reason==='string'&&req.body.reason.trim()?req.body.reason.trim():null,updated_by:req.user.id});
const validPhone=v=>typeof v==='string'&&/^[0-9+()\- .]{6,30}$/.test(v.trim());
const date=v=>new Date(`${v}T00:00:00Z`); const time=v=>new Date(`1970-01-01T${v}:00Z`);
const DAY=86400000;
// Booking multi-hari: berlaku tiap hari dari booking_date s/d end_date pada jam yang sama. Maks. 90 hari per booking.
const MAX_DAYS=90;
const validDate=v=>typeof v==='string'&&DATE_RE.test(v)&&!isNaN(date(v))&&date(v).toISOString().slice(0,10)===v;
const validTime=v=>typeof v==='string'&&TIME_RE.test(v);
// Booking tanggal loncat-loncat (body.dates): maks. 60 tanggal per pengajuan. Tanggal yang berurutan
// digabung jadi satu booking multi-hari, sisanya jadi booking terpisah -- semuanya dalam satu transaksi.
const MAX_PICKED=60;
const dateRuns=list=>{const runs=[];for(const d of [...new Set(list)].sort()){const t=date(d),last=runs[runs.length-1];if(last&&t-last[1]===DAY)last[1]=t;else runs.push([t,t]);}return runs;};
const rangeError=(bd,ed)=>ed<bd?'Tanggal selesai tidak boleh sebelum tanggal mulai.':(ed-bd)/DAY+1>MAX_DAYS?`Booking maksimal ${MAX_DAYS} hari.`:null;
// Bentrok = rentang tanggal beririsan DAN jam beririsan (karena jamnya sama setiap hari).
const conflictWhere=(room,bd,ed,st,et,excludeId)=>({...(excludeId?{id:{not:excludeId}}:{}),cancelled_at:null,room,booking_date:{lte:ed},end_date:{gte:bd},start_time:{lt:et},end_time:{gt:st}});
const fmtDate=d=>d.toISOString().slice(0,10);
const conflictMessage=c=>`Ruangan sudah dibooking pada waktu tersebut: "${c.agenda}" (${fmtDate(c.booking_date)}${+c.end_date!==+c.booking_date?` s/d ${fmtDate(c.end_date)}`:''}, ${c.start_time.toISOString().slice(11,16)}–${c.end_time.toISOString().slice(11,16)}).`;
// Kunci per ruangan selama transaksi, supaya dua booking bersamaan untuk ruangan yang sama tidak lolos cek bentrok berbarengan.
const lockRoom=(tx,room)=>tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'ruang_rapat:'+room}))`;
class HttpError extends Error{constructor(status,message){super(message);this.status=status;}}
const out=r=>hideFilePaths({...r,date:fmtDate(r.booking_date),end_date:fmtDate(r.end_date||r.booking_date),start:r.start_time.toISOString().slice(11,16),end:r.end_time.toISOString().slice(11,16),title:r.agenda,status:r.surat_status,updated_by_name:r.updatedBy?.nama_lengkap||null,updatedBy:undefined,cancelled:!!r.cancelled_at,cancelled_by_name:r.cancelledBy?.nama_lengkap||null,cancelledBy:undefined});
// Rentang tanggal jadwal (?from=YYYY-MM-DD&to=YYYY-MM-DD). Tanpa parameter:
// 1 bulan ke belakang s/d 1 tahun ke depan, supaya respons tidak terus
// membesar seiring bertambahnya riwayat booking. Maksimal 400 hari per request.
function dateRange(q){const today=new Date(new Date().toISOString().slice(0,10)+'T00:00:00Z');const from=q.from===undefined?new Date(today-31*DAY):(typeof q.from==='string'&&DATE_RE.test(q.from)?date(q.from):null);const to=q.to===undefined?new Date(+today+366*DAY):(typeof q.to==='string'&&DATE_RE.test(q.to)?date(q.to):null);if(!from||!to||isNaN(from)||isNaN(to)||to<from||to-from>400*DAY)return null;return {cancelled_at:null,booking_date:{lte:to},end_date:{gte:from}};}
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
// ?include_cancelled=1 -> booking berstatus batal ikut dikirim (toggle "Tampilkan yang dibatalkan").
router.get('/',async(req,res)=>{try{const range=dateRange(req.query);if(!range)return res.status(400).json({message:'Rentang tanggal tidak valid.'});if(req.query.include_cancelled==='1')delete range.cancelled_at;const rows=await prisma.ruangRapat.findMany({where:range,omit:{surat_file_data:true},include:{updatedBy:{select:{nama_lengkap:true}},cancelledBy:{select:{nama_lengkap:true}}},orderBy:[{booking_date:'asc'},{start_time:'asc'},{id:'asc'}]});res.json({data:rows.map(out)});}catch(err){logger.error('GET ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal mengambil jadwal ruang rapat.'});}});
// Export file surat booking (ZIP) untuk rentang tanggal ?from=&to=. Booking batal diabaikan.
// Nomor surat yang sama cukup diambil satu file saja; booking tanpa nomor surat dibedakan per file
// (salinan dari cancel sebagian memakai file yang sama sehingga juga cukup satu).
const MAX_ZIP_BYTES=300*1024*1024;
const zipSafe=v=>String(v||'').replace(/[\\/:*?"<>|\u0000-\u001f]+/g,'-').replace(/\s+/g,' ').trim().slice(0,80)||'-';
const MIME_EXT={'application/pdf':'.pdf','image/jpeg':'.jpg','image/png':'.png'};
async function readSurat(row){
  if(row.surat_file_path){
    const abs=nodePath.resolve(__dirname,'..','..',row.surat_file_path);
    // Hanya file di dalam folder uploads yang boleh dibaca.
    if(abs.startsWith(UPLOAD_ROOT+nodePath.sep)){try{return {data:await fs.promises.readFile(abs),ext:nodePath.extname(abs).toLowerCase()};}catch{}}
  }
  // Data lama yang belum punya file di disk -> pakai salinan base64 di database.
  const full=await prisma.ruangRapat.findUnique({where:{id:row.id},select:{surat_file_data:true}});
  const m=full?.surat_file_data?.match(/^data:([^;,]+);base64,(.+)$/s);
  return m?{data:Buffer.from(m[2],'base64'),ext:MIME_EXT[m[1].toLowerCase()]||nodePath.extname(row.surat_name||'').toLowerCase()||'.bin'}:null;
}
router.get('/surat-export',async(req,res)=>{try{
  const range=dateRange(req.query);if(!range||req.query.from===undefined||req.query.to===undefined)return res.status(400).json({message:'Rentang tanggal export tidak valid (maks. 400 hari).'});
  const rows=await prisma.ruangRapat.findMany({where:{...range,OR:[{surat_file_path:{not:null}},{surat_file_data:{not:null}}]},select:{id:true,agenda:true,room:true,pic:true,nomor_surat:true,booking_date:true,end_date:true,start_time:true,surat_name:true,surat_file_path:true},orderBy:[{booking_date:'asc'},{start_time:'asc'},{id:'asc'}]});
  const seen=new Set(), names=new Set(), files=[], missing=new Map(), fileOf=new Map();let total=0;
  const keyOf=r=>{const nomor=(r.nomor_surat||'').trim();return nomor?`no:${nomor.toLowerCase()}`:r.surat_file_path?`file:${r.surat_file_path}`:`id:${r.id}`;};
  for(const r of rows){
    const nomor=(r.nomor_surat||'').trim();
    const key=keyOf(r);
    if(seen.has(key))continue;
    // File hilang dari disk -> coba booking lain dengan nomor surat yang sama; kalau semua hilang, dicatat di daftar.
    const file=await readSurat(r);if(!file){if(!missing.has(key))missing.set(key,r);continue;}
    seen.add(key);missing.delete(key);
    total+=file.data.length;if(total>MAX_ZIP_BYTES)return res.status(413).json({message:'Total ukuran surat terlalu besar untuk satu ZIP. Perkecil rentang tanggal.'});
    const tgl=fmtDate(r.booking_date);
    let base=`${nomor?zipSafe(nomor):'Tanpa Nomor'}_${tgl}_${zipSafe(r.agenda)}`, name=`${base}${file.ext}`;
    for(let i=2;names.has(name.toLowerCase());i++)name=`${base} (${i})${file.ext}`;
    names.add(name.toLowerCase());files.push({name,data:file.data});fileOf.set(key,name);
  }
  if(!files.length)return res.status(404).json({message:missing.size?'File surat pada rentang tanggal tersebut tidak ditemukan di server.':'Tidak ada surat booking pada rentang tanggal tersebut.'});
  // Daftar isi ZIP (bisa dibuka di Excel), satu baris PER HARI seperti Export Excel: booking seminggu
  // ditulis 7 baris, lengkap dari tanggal mulai s/d selesai. Kolom File menunjuk file surat di ZIP.
  const perDay=[];
  for(const r of rows)for(let t=+r.booking_date;t<=+r.end_date;t+=DAY)perDay.push({day:fmtDate(new Date(t)),r});
  perDay.sort((a,b)=>a.day.localeCompare(b.day)||(+a.r.start_time)-(+b.r.start_time)||a.r.room.localeCompare(b.r.room));
  const tglID=v=>`${v.slice(8,10)}/${v.slice(5,7)}/${v.slice(0,4)}`;
  const csv=v=>`"${String(v).replace(/"/g,'""')}"`;
  const list=[['No','Tanggal','Ruang Rapat','Nama Rapat','PIC','Nomor Surat','File'],...perDay.map(({day,r},i)=>[i+1,tglID(day),r.room,r.agenda,r.pic,(r.nomor_surat||'').trim()||'-',fileOf.get(keyOf(r))||'(file tidak ditemukan di server)'])].map(r=>r.map(csv).join(',')).join('\r\n');
  files.push({name:'daftar_surat.csv',data:Buffer.from('\ufeff'+list,'utf8')});
  const zip=createZip(files);
  res.setHeader('Content-Type','application/zip');
  res.setHeader('Content-Disposition',`attachment; filename="surat_ruang_rapat_${req.query.from}_sd_${req.query.to}.zip"`);
  res.setHeader('X-Surat-Count',String(files.length-1));
  res.send(zip);
}catch(err){logger.error('Export surat ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal export surat ruang rapat.'});}});
router.get('/:id',async(req,res)=>{try{const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({message:'ID booking tidak valid.'});const row=await prisma.ruangRapat.findFirst({where:{id,cancelled_at:null},include:{updatedBy:{select:{nama_lengkap:true}}}});if(!row)return res.status(404).json({message:'Booking tidak ditemukan.'});res.json({data:out(row)});}catch(err){logger.error('GET ruang rapat detail gagal',{error:err});res.status(500).json({message:'Gagal mengambil detail booking.'});}});
// Semua user login (termasuk karyawan) boleh menambah, mengedit, mengelola surat/status, dan membatalkan booking.
router.post('/',async(req,res)=>{try{
  const {title,room,pic,pic_phone,date:startDate,end_date,start,end,surat_name,surat_file_data,nomor_surat,dates}=req.body;
  const picked=dates!==undefined;
  if(picked&&(!Array.isArray(dates)||!dates.length||dates.length>MAX_PICKED||!dates.every(validDate)))return res.status(400).json({message:`Pilih 1-${MAX_PICKED} tanggal yang valid.`});
  if(!validNomorSurat(nomor_surat))return res.status(400).json({message:'Nomor surat maksimal 100 karakter.'});
  if(!validText(title,255)||!validText(room,150)||!validText(pic,150)||!validPhone(pic_phone)||(!picked&&(!validDate(startDate)||(end_date!=null&&end_date!==''&&!validDate(end_date))))||!validTime(start)||!validTime(end))return res.status(400).json({message:'Data booking atau nomor HP PIC tidak valid.'});
  if(!ROOMS.includes(room)||!validFile(surat_file_data)||!validSuratName(surat_name))return res.status(400).json({message:'Ruangan, status, atau surat tidak valid.'});
  if(start>=end)return res.status(400).json({message:'Jam selesai harus lebih besar dari jam mulai.'});
  let ranges;
  if(picked)ranges=dateRuns(dates);
  else{const bookingDate=date(startDate),endDate=end_date?date(end_date):bookingDate;const rangeErr=rangeError(bookingDate,endDate);if(rangeErr)return res.status(400).json({message:rangeErr});ranges=[[bookingDate,endDate]];}
  const group=crypto.randomUUID(); // semua tanggal pengajuan ini = satu booking (lihat booking_group)
  const rows=await prisma.$transaction(async tx=>{
    await lockRoom(tx,room);
    // Semua tanggal dicek dulu; kalau ada satu saja yang bentrok, tidak ada yang disimpan.
    const conflicts=[];
    for(const [bd,ed] of ranges){const c=await tx.ruangRapat.findFirst({where:conflictWhere(room,bd,ed,time(start),time(end)),orderBy:[{booking_date:'asc'},{start_time:'asc'}]});if(c)conflicts.push(c);}
    if(conflicts.length)throw new HttpError(409,conflictMessage(conflicts[0])+(conflicts.length>1?` (dan ${conflicts.length-1} tanggal lain juga bentrok)`:''));
    const path=surat_file_data?await saveDataUrl(surat_file_data,surat_name,'ruang-rapat'):null;
    const created=[];
    for(const [bd,ed] of ranges)created.push(await tx.ruangRapat.create({data:{agenda:title.trim(),nomor_surat:nomor_surat?.trim()||null,room,pic:pic.trim(),pic_phone:pic_phone.trim(),booking_date:bd,end_date:ed,start_time:time(start),end_time:time(end),surat_status:suratStatus(surat_file_data),surat_name:surat_name||null,surat_file_data:surat_file_data||null,surat_file_path:path,booking_group:group,created_by:req.user.id,updated_by:req.user.id},include:{updatedBy:{select:{nama_lengkap:true}}}}));
    return created;
  },{timeout:20000});
  // Booking biasa tetap membalas satu objek (kompatibel); tanggal pilihan membalas array.
  broadcastChange();res.status(201).json({data:picked?rows.map(out):out(rows[0])});
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
  if(b.surat_name!==undefined){if(!validSuratName(b.surat_name))return res.status(400).json({message:'Nama file surat maksimal 255 karakter.'});data.surat_name=b.surat_name||null;}
  if(b.surat_file_data!==undefined&&!validFile(b.surat_file_data))return res.status(400).json({message:'Dokumen surat tidak valid.'});
  const row=await prisma.$transaction(async tx=>{
    const pre=await tx.ruangRapat.findFirst({where:{id,cancelled_at:null},select:{room:true}});
    if(!pre)throw new HttpError(404,'Booking tidak ditemukan atau sudah dibatalkan.');
    // Selalu kunci ruangan lama (+ ruangan baru bila pindah) dengan urutan tetap supaya tidak deadlock,
    // lalu baca ulang: booking bisa saja baru dibatalkan / dipindah pengguna lain sebelum kunci didapat.
    for(const r of [...new Set([pre.room,data.room??pre.room])].sort())await lockRoom(tx,r);
    const current=await tx.ruangRapat.findFirst({where:{id,cancelled_at:null},select:{room:true,booking_date:true,end_date:true,start_time:true,end_time:true}});
    if(!current)throw new HttpError(404,'Booking tidak ditemukan atau sudah dibatalkan.');
    if(current.room!==pre.room)throw new HttpError(409,'Booking baru saja diubah pengguna lain. Muat ulang lalu coba lagi.');
    const scheduleChanged=b.room!==undefined||b.date!==undefined||b.end_date!==undefined||b.start!==undefined||b.end!==undefined;
    if(scheduleChanged){
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
    if(b.surat_file_data!==undefined){data.surat_status=suratStatus(b.surat_file_data);data.surat_file_data=b.surat_file_data||null;data.surat_file_path=b.surat_file_data?await saveDataUrl(b.surat_file_data,b.surat_name,'ruang-rapat'):null;}
    data.updated_by=req.user.id;
    return tx.ruangRapat.update({where:{id},data,include:{updatedBy:{select:{nama_lengkap:true}}}});
  },{timeout:20000});
  broadcastChange();res.json({data:out(row)});
}catch(err){if(err instanceof HttpError)return res.status(err.status).json({message:err.message});if(err.code==='P2025')return res.status(404).json({message:'Booking tidak ditemukan.'});logger.error('PUT ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal memperbarui booking.'});}});
// Semua tanggal aktif dalam satu pengajuan (booking_group) -> daftar centang di popup Cancel.
router.get('/:id/group-dates',async(req,res)=>{try{
  const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({message:'ID booking tidak valid.'});
  const b=await prisma.ruangRapat.findFirst({where:{id,cancelled_at:null},select:{booking_group:true,booking_date:true,end_date:true}});
  if(!b)return res.status(404).json({message:'Booking tidak ditemukan atau sudah dibatalkan.'});
  const members=b.booking_group?await prisma.ruangRapat.findMany({where:{booking_group:b.booking_group,cancelled_at:null},select:{booking_date:true,end_date:true},orderBy:{booking_date:'asc'}}):[b];
  const dates=[];for(const m of members)for(let t=+m.booking_date;t<=+m.end_date;t+=DAY)dates.push(fmtDate(new Date(t)));
  res.json({data:{dates:[...new Set(dates)].sort(),bookings:members.length}});
}catch(err){logger.error('GET tanggal grup ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal mengambil tanggal booking.'});}});
// Batalkan sebagian/semua tanggal dari SATU PENGAJUAN booking TANPA menghapus data. Satu pengajuan =
// semua booking aktif dengan booking_group sama (tanggal loncat-loncat atau pecahan cancel sebelumnya),
// jadi tanggal mana pun di pengajuan itu bisa dicentang dari satu popup. Tanggal batal disimpan sebagai
// booking berstatus batal (cancelled_at + alasan opsional); sisa tanggal aktif dipecah jadi rentang
// berurutan dengan data yang sama (agenda, PIC, surat, status) dan booking_group yang sama.
router.post('/:id/cancel-dates',async(req,res)=>{try{
  const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({message:'ID booking tidak valid.'});
  const dates=req.body?.dates;
  if(!Array.isArray(dates)||dates.length===0||dates.length>400||!dates.every(validDate))return res.status(400).json({message:'Pilih minimal satu tanggal yang valid untuk dibatalkan.'});
  if(!validReason(req.body?.reason))return res.status(400).json({message:'Alasan pembatalan maksimal 500 karakter.'});
  const cancel=new Set(dates);
  const include={updatedBy:{select:{nama_lengkap:true}}};
  const result=await prisma.$transaction(async tx=>{
    const pre=await tx.ruangRapat.findFirst({where:{id,cancelled_at:null},select:{room:true,booking_group:true}});
    if(!pre)throw new HttpError(404,'Booking tidak ditemukan atau sudah dibatalkan.');
    const preRooms=pre.booking_group?(await tx.ruangRapat.findMany({where:{booking_group:pre.booking_group,cancelled_at:null},select:{room:true}})).map(x=>x.room):[pre.room];
    for(const r of [...new Set(preRooms)].sort())await lockRoom(tx,r); // urutan tetap -> tidak deadlock
    const b=await tx.ruangRapat.findFirst({where:{id,cancelled_at:null},include});
    if(!b)throw new HttpError(404,'Booking tidak ditemukan atau sudah dibatalkan.');
    if(b.room!==pre.room||b.booking_group!==pre.booking_group)throw new HttpError(409,'Booking baru saja diubah pengguna lain. Muat ulang lalu coba lagi.');
    const members=b.booking_group?await tx.ruangRapat.findMany({where:{booking_group:b.booking_group,cancelled_at:null},include,orderBy:{booking_date:'asc'}}):[b];
    const group=b.booking_group||crypto.randomUUID(); // booking lama tanpa kode: pecahannya tetap satu grup
    const daysOf=m=>{const out=[];for(let t=+m.booking_date;t<=+m.end_date;t+=DAY)out.push(fmtDate(new Date(t)));return out;};
    const all=new Set(members.flatMap(daysOf));
    if([...cancel].some(d=>!all.has(d)))throw new HttpError(400,'Ada tanggal yang tidak termasuk dalam booking ini.');
    const batal=cancelData(req);const rows=[];
    for(const m of members){
      const days=daysOf(m);
      if(!days.some(d=>cancel.has(d))){rows.push(m);continue;}
      const segmentsOf=pick=>{const out=[];for(const d of days){if(!pick(d))continue;const last=out[out.length-1];if(last&&+date(d)-+date(last.to)===DAY)last.to=d;else out.push({from:d,to:d});}return out;};
      const keep=segmentsOf(d=>!cancel.has(d)),gone=segmentsOf(d=>cancel.has(d));
      // Semua tanggal booking ini dibatalkan -> baris ini sendiri yang berstatus batal.
      if(!keep.length){await tx.ruangRapat.update({where:{id:m.id},data:{...batal,booking_group:group}});continue;}
      rows.push(await tx.ruangRapat.update({where:{id:m.id},data:{booking_date:date(keep[0].from),end_date:date(keep[0].to),booking_group:group,updated_by:req.user.id},include}));
      const copy={agenda:m.agenda,nomor_surat:m.nomor_surat,room:m.room,pic:m.pic,pic_phone:m.pic_phone,start_time:m.start_time,end_time:m.end_time,surat_status:m.surat_status,surat_name:m.surat_name,surat_file_data:m.surat_file_data,surat_file_path:m.surat_file_path,booking_group:group,created_by:m.created_by,updated_by:req.user.id};
      for(const sg of keep.slice(1))rows.push(await tx.ruangRapat.create({data:{...copy,booking_date:date(sg.from),end_date:date(sg.to)},include}));
      for(const sg of gone)await tx.ruangRapat.create({data:{...copy,...batal,booking_date:date(sg.from),end_date:date(sg.to)}});
    }
    return {cancelled:!rows.length,bookings:rows,ids:members.map(m=>m.id)};
  },{timeout:20000});
  // ids = semua booking lama di pengajuan ini; bookings = booking aktif yang tersisa (pengganti ids).
  broadcastChange();res.json({data:{cancelled:result.cancelled,bookings:result.bookings.map(out),ids:result.ids},message:result.cancelled?'Booking dibatalkan.':`${cancel.size} tanggal berhasil dibatalkan.`});
}catch(err){if(err instanceof HttpError)return res.status(err.status).json({message:err.message});logger.error('Cancel tanggal ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal membatalkan tanggal booking.'});}});
// Batalkan seluruh booking. Data tidak dihapus, hanya diberi status batal (+ alasan opsional di body.reason).
router.delete('/:id',async(req,res)=>{try{const id=Number(req.params.id);if(!Number.isInteger(id))return res.status(400).json({message:'ID booking tidak valid.'});if(!validReason(req.body?.reason))return res.status(400).json({message:'Alasan pembatalan maksimal 500 karakter.'});const {count}=await prisma.ruangRapat.updateMany({where:{id,cancelled_at:null},data:cancelData(req)});if(!count)return res.status(404).json({message:'Booking tidak ditemukan atau sudah dibatalkan.'});broadcastChange();res.json({message:'Booking dibatalkan.'});}catch(err){logger.error('DELETE ruang rapat gagal',{error:err});res.status(500).json({message:'Gagal membatalkan booking.'});}});
module.exports=router;module.exports.ROOMS=ROOMS;
