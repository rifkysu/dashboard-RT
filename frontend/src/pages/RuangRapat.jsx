import React, { useEffect, useMemo, useRef, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../components/Feedback';
import { requireFields, PHONE_RE } from '../utils/validation';
import { verifyFileIsGenuine } from '../utils/fileSignature';
import DocumentViewer from '../components/DocumentViewer';
import { holidayLabel } from '../utils/holidays';
import useMonthSchedule, { monthDays } from '../hooks/useMonthSchedule';
import RoomDateGrid, { MonthFilter, monthLabel } from '../components/RoomDateGrid';
import MultiDatePicker from '../components/MultiDatePicker';

const STATUS_META = {
  belum: { label: 'Belum Ada Surat', card: 'bg-red-50 border-red-300 text-red-900', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  ditinjau: { label: 'Surat Ditinjau', card: 'bg-blue-50 border-blue-300 text-blue-900', badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  diterima: { label: 'Surat Diterima', card: 'bg-green-50 border-green-300 text-green-900', badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
};
const ROOMS = ['SERBAGUNA','SETJEN II','TRI DHARMA','BIRO UMUM','GRAHA KEMNAKER'];
const dayNames = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
// dateMode 'range' = Tanggal Mulai s/d Sampai Tanggal; 'pick' = pilih beberapa tanggal bebas (loncat-loncat) di kalender.
const emptyForm = { title:'', nomor_surat:'', room:ROOMS[0], pic:'', pic_phone:'', date:'', end_date:'', start:'', end:'', status:'belum', dateMode:'range', dates:[] };
const MAX_PICKED = 60;
// Booking multi-hari berlaku tiap hari dari `date` s/d `end_date` pada jam yang sama (sama dengan batas di backend).
const MAX_DAYS = 90;
const MAX_FILE = 8 * 1024 * 1024;
const ALLOWED = ['application/pdf','image/jpeg','image/png'];

function localDateISO(d = new Date()) { const x = new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; }
function formatDateLabel(dateString) { if (!dateString) return 'Pilih hari'; const d = new Date(`${dateString}T00:00:00`); return `${dayNames[(d.getDay()+6)%7]}, ${d.getDate()} ${d.toLocaleString('id-ID',{month:'short'})}`; }
function dayCount(from, to) { return Math.round((new Date(`${to}T00:00:00`) - new Date(`${from}T00:00:00`)) / 86400000) + 1; }
function endOf(b) { return b.end_date || b.date; }
function dateRangeLabel(b) { const end = endOf(b); return end === b.date ? formatDateLabel(b.date) : `${formatDateLabel(b.date)} – ${formatDateLabel(end)} (${dayCount(b.date, end)} hari)`; }
// Kalau tanggal mulai digeser melewati tanggal selesai, tanggal selesai ikut disamakan.
// Semua tanggal dari `from` s/d `to` (dipakai saat pindah dari mode rentang ke mode pilih tanggal).
function listDates(from, to) { const out = []; for (let d = new Date(`${from}T00:00:00`); localDateISO(d) <= to && out.length < MAX_PICKED; d.setDate(d.getDate() + 1)) out.push(localDateISO(d)); return out; }
function withStartDate(f, date) { return { ...f, date, end_date: f.end_date && date && f.end_date < date ? date : f.end_date }; }
function fileToDataUrl(file) { return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }
// Validasi data booking sebelum dikirim -> daftar pesan untuk popup.
function validateBooking(f) {
  const errors = requireFields([['Topik / agenda', f.title], ['Nama PIC', f.pic], ['No. HP PIC', f.pic_phone], ['Tanggal', f.dateMode === 'pick' ? (f.dates.length ? 'ok' : '') : f.date], ['Jam mulai', f.start], ['Jam selesai', f.end]]);
  if (f.pic_phone && !PHONE_RE.test(String(f.pic_phone).trim())) errors.push('No. HP PIC tidak valid (6–30 digit, boleh +, -, spasi).');
  if (f.start && f.end && f.end <= f.start) errors.push('Jam selesai harus lebih besar dari jam mulai.');
  if (f.date && f.end_date && f.end_date < f.date) errors.push('Sampai tanggal tidak boleh sebelum tanggal mulai.');
  else if (f.date && f.end_date && dayCount(f.date, f.end_date) > MAX_DAYS) errors.push(`Booking maksimal ${MAX_DAYS} hari.`);
  if ((f.nomor_surat || '').length > 100) errors.push('Nomor surat maksimal 100 karakter.');
  return errors;
}
const cutiBersamaLabel = holidayLabel;

export default function RuangRapat() {
  const { user } = useAuth();
  const { confirm, alert, toast } = useFeedback();
  // Semua user login (termasuk karyawan) boleh menambah, mengedit, mengelola surat/status, dan membatalkan booking.
  const canBook = !!user;
  const canManage = canBook;
  // Jadwal per bulan + infinite scroll (lihat hooks/useMonthSchedule.js).
  // Toggle "Tampilkan yang dibatalkan": booking berstatus batal ikut tampil (abu-abu, dicoret) + alasan.
  const [showCancelled,setShowCancelled]=useState(false), [cancelledView,setCancelledView]=useState(null);
  const sched=useMonthSchedule('/ruang-rapat',showCancelled?{include_cancelled:'1'}:undefined);
  const firstToggle=useRef(true);
  useEffect(()=>{if(firstToggle.current){firstToggle.current=false;return;}sched.reload();},[showCancelled]); // eslint-disable-line react-hooks/exhaustive-deps
  const {items,setItems,loading,error,setError,months}=sched;
  const loadBookings=sched.reload;
  const [showBook,setShowBook]=useState(false), [selected,setSelected]=useState(null), [mode,setMode]=useState('detail');
  // Tanggal kartu yang diklik di kalender -> otomatis tercentang saat cancel sebagian booking multi-hari.
  const [clickedDate,setClickedDate]=useState(null), [cancelDatesOpen,setCancelDatesOpen]=useState(false);
  const [viewer,setViewer]=useState({open:false,name:'',data:''});
  const [form,setForm]=useState(emptyForm), [saving,setSaving]=useState(false);
  // Daftar tidak membawa isi file surat; ambil detail lengkap saat booking dibuka.
  const openBooking=async(x,date=null)=>{setError('');setClickedDate(date);try{const r=await api.get(`/ruang-rapat/${x.id}`);setSelected(r.data.data);setMode('detail');}catch(e){alert({title:'Gagal memuat detail',message:e.response?.data?.message||'Gagal memuat detail booking.',tone:'error'});}};
  // Modal detail yang lagi kebuka ikut disegarkan tiap `items` ter-update (SSE/polling),
  // supaya kalau orang lain edit booking yang sama, "Terakhir diedit oleh" & data lain
  // di modal langsung berubah tanpa perlu tutup-buka modal.
  const selectedIdRef=useRef(null); selectedIdRef.current=selected?.id??null;
  useEffect(()=>{
    if(!selected) return;
    const fresh=items.find(x=>x.id===selected.id);
    if(fresh && fresh.updated_at===selected.updated_at) return;
    // Tidak ada di minggu ini (mungkin dipindah ke minggu lain atau dibatalkan orang lain) atau
    // sudah berubah -> ambil ulang. Kalau ternyata sudah dihapus, tutup modal supaya tidak diedit.
    const id=selected.id;
    api.get(`/ruang-rapat/${id}`).then(r=>setSelected(cur=>cur&&cur.id===id?r.data.data:cur)).catch(e=>{if(e.response?.status!==404||selectedIdRef.current!==id)return;setSelected(null);setCancelDatesOpen(false);toast('Booking ini sudah dibatalkan oleh pengguna lain.','info');});
  },[items]);

  const saveBooking=async(e)=>{e.preventDefault();if(saving)return;const errors=validateBooking(form);if(errors.length){await alert({title:'Data booking belum lengkap',intro:'Periksa data berikut:',message:errors,tone:'warning'});return;}setSaving(true);try{const {dateMode,dates,...rest}=form;const payload=dateMode==='pick'?{...rest,date:undefined,end_date:undefined,dates}:{...rest,end_date:form.end_date||form.date};const r=await api.post('/ruang-rapat',payload);const added=[].concat(r.data.data);setItems(p=>[...p,...added].sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)));setShowBook(false);setForm({...emptyForm,date:''});setError('');toast(dateMode==='pick'?`Ruangan ${form.room} berhasil dibooking untuk ${dates.length} tanggal.`:`Ruangan ${added[0].room} berhasil dibooking.`);}catch(e){alert({title:e.response?.status===409?'Jadwal bentrok':'Gagal menyimpan booking',message:e.response?.data?.message||'Gagal menyimpan booking.',tone:e.response?.status===409?'warning':'error'});}finally{setSaving(false);}};
  const updateSelected=async(payload,successMessage='Booking berhasil diperbarui.')=>{if(saving)return;setSaving(true);try{const r=await api.put(`/ruang-rapat/${selected.id}`,payload);setItems(p=>p.map(x=>x.id===selected.id?r.data.data:x));setSelected(r.data.data);setMode('detail');setError('');toast(successMessage);}catch(e){alert({title:e.response?.status===409?'Jadwal bentrok':'Gagal memperbarui booking',message:e.response?.data?.message||'Gagal memperbarui booking.',tone:e.response?.status===409?'warning':'error'});}finally{setSaving(false);}};
  // Cancel selalu lewat popup (alasan opsional). Data booking tidak dihapus, hanya berstatus batal.
  const cancelBooking=()=>{if(!selected||saving)return;setCancelDatesOpen(true);};
  // Cancel seluruh / sebagian tanggal booking. Semua tanggal dicentang = seluruh booking berstatus batal.
  const cancelDates=async(dates,reason)=>{if(!selected||saving||!dates.length)return;setSaving(true);try{const r=await api.post(`/ruang-rapat/${selected.id}/cancel-dates`,{dates,reason:reason.trim()||null});const {cancelled,bookings}=r.data.data;setItems(p=>[...p.filter(x=>x.id!==selected.id),...bookings].sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)));setCancelDatesOpen(false);setSelected(null);setError('');toast(cancelled?'Booking berhasil dibatalkan.':`${dates.length} tanggal berhasil dibatalkan.`);loadBookings();}catch(e){alert({title:'Gagal membatalkan tanggal',message:e.response?.data?.message||'Gagal membatalkan tanggal booking.',tone:'error'});}finally{setSaving(false);}};
  // Export Excel per hari: Tanggal, Ruang Rapat, Nama Rapat, PIC, Nomor Surat. Data diambil langsung dari
  // server sesuai rentang (bukan cuma bulan yang tampil). Default = bulan yang dipilih di filter.
  const [exportRange,setExportRange]=useState(null);
  const [exporting,setExporting]=useState(false);
  const range=exportRange||{mulai:`${months[0]}-01`,sampai:monthDays(months[0]).slice(-1)[0]};
  const exportExcel=async()=>{
    const {mulai,sampai}=range;
    if(!mulai||!sampai){alert({title:'Tanggal belum diisi',message:'Isi tanggal mulai dan sampai untuk export.',tone:'warning'});return;}
    if(sampai<mulai){alert({title:'Rentang tanggal salah',message:'Tanggal sampai harus sama atau setelah tanggal mulai.',tone:'warning'});return;}
    if((new Date(`${sampai}T00:00:00`)-new Date(`${mulai}T00:00:00`))/86400000>400){alert({title:'Rentang terlalu panjang',message:'Rentang export maksimal 400 hari.',tone:'warning'});return;}
    setExporting(true);
    try{
      const r=await api.get('/ruang-rapat',{params:{from:mulai,to:sampai}});
      // Booking multi-hari dipecah jadi satu baris per hari, LENGKAP dari tanggal mulai s/d selesai
      // (tidak dipotong rentang export: booking 30 Sep–2 Okt tetap tertulis 3 hari walau export September).
      const rows=[];
      for(const x of r.data.data||[]){
        const d=new Date(`${x.date}T00:00:00`);const last=endOf(x);
        for(let day=localDateISO(d);day<=last;d.setDate(d.getDate()+1),day=localDateISO(d))rows.push({...x,day});
      }
      rows.sort((a,b)=>`${a.day} ${a.start} ${a.room}`.localeCompare(`${b.day} ${b.start} ${b.room}`));
      if(!rows.length){alert({title:'Tidak ada data',message:'Tidak ada booking pada rentang tanggal tersebut.',tone:'info'});return;}
      const esc=v=>String(v??'').replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
      const tgl=v=>new Date(`${v}T00:00:00`).toLocaleDateString('id-ID',{day:'2-digit',month:'2-digit',year:'numeric'});
      const headers=['Tanggal','Ruang Rapat','Nama Rapat','PIC','Nomor Surat'];
      // mso-number-format:@ -> Excel memperlakukan sebagai teks (nomor surat & tanggal tidak diubah otomatis)
      const html=`<table><thead><tr>${headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(x=>`<tr>${[tgl(x.day),x.room,x.title,x.pic,x.nomor_surat||'-'].map(v=>`<td style="mso-number-format:'\@'">${esc(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
      const blob=new Blob([`﻿${html}`],{type:'application/vnd.ms-excel'});
      const url=URL.createObjectURL(blob);const a=document.createElement('a');
      a.href=url;a.download=`jadwal_ruang_rapat_${mulai}_sd_${sampai}.xls`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      setError('');toast(`${rows.length} baris jadwal berhasil diexport ke Excel.`);
    }catch(e){alert({title:'Gagal export',message:e.response?.data?.message||'Gagal export jadwal ruang rapat.',tone:'error'});}
    finally{setExporting(false);}
  };
  // Export file surat booking (ZIP) dengan rentang tanggal yang sama. Nomor surat yang sama cukup 1 file (diatur backend).
  const [exportingSurat,setExportingSurat]=useState(false);
  const exportSurat=async()=>{
    const {mulai,sampai}=range;
    if(!mulai||!sampai){alert({title:'Tanggal belum diisi',message:'Isi tanggal mulai dan sampai untuk export.',tone:'warning'});return;}
    if(sampai<mulai){alert({title:'Rentang tanggal salah',message:'Tanggal sampai harus sama atau setelah tanggal mulai.',tone:'warning'});return;}
    if((new Date(`${sampai}T00:00:00`)-new Date(`${mulai}T00:00:00`))/86400000>400){alert({title:'Rentang terlalu panjang',message:'Rentang export maksimal 400 hari.',tone:'warning'});return;}
    setExportingSurat(true);
    try{
      const r=await api.get('/ruang-rapat/surat-export',{params:{from:mulai,to:sampai},responseType:'blob'});
      const url=URL.createObjectURL(r.data);const a=document.createElement('a');
      a.href=url;a.download=`surat_ruang_rapat_${mulai}_sd_${sampai}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
      toast('Surat booking berhasil diexport ke ZIP.');
    }catch(e){
      // Respons error ikut berbentuk Blob karena responseType 'blob' -> baca pesan JSON-nya.
      let message='Gagal export surat booking.';try{message=JSON.parse(await e.response.data.text()).message||message;}catch{}
      alert({title:e.response?.status===404?'Tidak ada surat':'Gagal export surat',message,tone:e.response?.status===404?'info':'error'});
    }finally{setExportingSurat(false);}
  };
  const roomRows=useMemo(()=>{const extra=[...new Set(items.map(x=>x.room).filter(r=>r&&!ROOMS.includes(r)))].sort();return [...ROOMS,...extra];},[items]);

  return <div className="menu-page menu-ruang-rapat relative">
    <div className="menu-hero mb-6"><div><span className="menu-kicker">Biro Umum / Ruang Rapat</span><h1 className="text-3xl font-bold">Jadwal Ruang Rapat</h1><p className="text-sm mt-1">Klik booking di kalender untuk mengubah, mengelola surat, atau membatalkannya. Jadwal diperbarui otomatis.</p></div>{canBook&&<button onClick={()=>{setError('');setForm({...emptyForm,date:localDateISO()});setShowBook(true)}} className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800"><span className="material-symbols-outlined text-[18px]">add</span>Booking Ruang Rapat</button>}</div>
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm"><div className="flex flex-wrap items-center gap-3 text-xs font-medium"><span className="font-bold text-slate-700 mr-2">Petunjuk warna surat:</span>{Object.entries(STATUS_META).map(([k,m])=><span key={k} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${m.badge}`}><span className={`w-2.5 h-2.5 rounded-full ${m.dot}`}/>{m.label}</span>)}<span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border bg-amber-100 text-amber-800 border-amber-200"><span className="w-2.5 h-2.5 rounded-full bg-amber-500"/>Cuti Bersama</span></div></div>
    <div className="flex flex-col sm:flex-row sm:items-end justify-end gap-3 mb-4">
      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal mulai export</label><input type="date" value={range.mulai} onChange={e=>setExportRange({...range,mulai:e.target.value})} className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700"/></div>
      <div><label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal sampai export</label><input type="date" value={range.sampai} onChange={e=>setExportRange({...range,sampai:e.target.value})} className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700"/></div>
      <button type="button" onClick={exportExcel} disabled={exporting} className="h-11 px-4 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-60"><span className="material-symbols-outlined text-[18px] align-middle mr-1">download</span>{exporting?'Menyiapkan...':'Export Excel'}</button>
      <button type="button" onClick={exportSurat} disabled={exportingSurat} title="Unduh semua file surat booking pada rentang tanggal ini (nomor surat yang sama cukup 1 file)" className="h-11 px-4 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-60"><span className="material-symbols-outlined text-[18px] align-middle mr-1">folder_zip</span>{exportingSurat?'Menyiapkan ZIP...':'Export Surat (ZIP)'}</button>
    </div>
    {error&&<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"><div className="p-4 border-b flex flex-col xl:flex-row justify-between gap-3 xl:items-center"><div><div className="font-bold text-sm">Kalender Booking Ruang Rapat</div><div className="text-xs text-slate-500 mt-1">{monthLabel(months[0])}{months.length>1&&` – ${monthLabel(months[months.length-1])}`} · ruangan ke samping, tanggal ke bawah · gulir untuk bulan berikutnya.</div></div><div className="flex flex-col gap-2 xl:items-end"><MonthFilter months={months} onSelect={sched.selectMonth}/><label className={`self-start xl:self-end inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold cursor-pointer select-none ${showCancelled?'bg-slate-700 text-white border-slate-700':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}><input type="checkbox" checked={showCancelled} onChange={e=>setShowCancelled(e.target.checked)} className="w-3.5 h-3.5"/><span className="material-symbols-outlined text-[16px]">event_busy</span>Tampilkan yang dibatalkan{showCancelled&&` (${items.filter(x=>x.cancelled).length})`}</label></div></div>
      <RoomDateGrid months={months} rooms={roomRows} items={items} loading={loading} loadingMore={sched.loadingMore} hasMore={sched.hasMore} onLoadMore={sched.loadMore} renderItem={(x,date)=>{if(x.cancelled)return (
        <button key={x.id} type="button" onClick={()=>setCancelledView(x)} className="w-full text-left border border-dashed border-slate-300 bg-slate-100 text-slate-500 rounded-lg p-2 transition hover:bg-slate-200/70">
          <div className="flex items-start justify-between gap-1"><span className="text-[9px] font-bold line-through">{x.start}–{x.end}</span><span className="text-[8px] px-1.5 py-0.5 rounded-full border border-slate-300 bg-white font-bold text-slate-600">DIBATALKAN</span></div>
          <div className="font-bold text-[11px] mt-1 leading-snug line-through">{x.title}</div>
          <div className="text-[9px] mt-1 font-semibold">♙ {x.pic}</div>
          <div className="text-[9px] mt-1 italic truncate">{x.cancel_reason?`Alasan: ${x.cancel_reason}`:'Tanpa alasan'}</div>
        </button>
      );const m=STATUS_META[x.status]||STATUS_META.belum; return (
        <button key={x.id} type="button" onClick={()=>openBooking(x,date)} className={`w-full text-left border rounded-lg p-2 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${m.card}`}>
          <div className="flex items-start justify-between gap-1"><span className="text-[9px] font-bold">{x.start}–{x.end}{endOf(x)!==x.date&&<span className="block font-semibold opacity-75">Hari {dayCount(x.date,date)}/{dayCount(x.date,endOf(x))}</span>}</span><span className={`text-[8px] px-1.5 py-0.5 rounded-full border ${m.badge}`}>{m.label}</span></div>
          <div className="font-bold text-[11px] mt-1 leading-snug">{x.title}</div>
          <div className="text-[9px] mt-1 font-semibold">♙ {x.pic}</div>
          {x.surat_name&&<div className="text-[8px] mt-1 truncate opacity-75">📄 {x.surat_name}</div>}
        </button>
      );}}/>
    </div>
    {showBook&&<BookModal form={form} setForm={setForm} saving={saving} error={error} onClose={()=>setShowBook(false)} onSubmit={saveBooking}/>} 
    <DocumentViewer open={viewer.open} name={viewer.name} data={viewer.data} onClose={()=>setViewer({open:false,name:'',data:''})} />
    {selected&&<BookingModal booking={selected} canManage={canManage} canEdit={canBook} mode={mode==='letter'&&!canManage||mode==='edit'&&!canBook?'detail':mode} setMode={(m)=>{setError('');setMode(m)}} saving={saving} error={error} onClose={()=>setSelected(null)} onUpdate={updateSelected} onCancel={cancelBooking} onView={(name,data)=>setViewer({open:true,name,data})}/>}
    {cancelledView&&<CancelledModal booking={cancelledView} onClose={()=>setCancelledView(null)}/>}
    {selected&&cancelDatesOpen&&<CancelDatesModal booking={selected} initialDate={clickedDate} saving={saving} onClose={()=>setCancelDatesOpen(false)} onSubmit={cancelDates}/>}
  </div>;
}

function ModalShell({children,onClose,wide=false}){return <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={`w-full ${wide?'max-w-3xl':'max-w-xl'} bg-[#f7f9fb] rounded-2xl shadow-2xl overflow-hidden`}>{children}</div></div>}
function Header({title,subtitle,onClose,icon='event'}){return <div className="bg-white border-b px-6 py-5 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><span className="material-symbols-outlined">{icon}</span></div><div><div className="font-bold text-slate-900">{title}</div><div className="text-[11px] text-slate-500">{subtitle}</div></div></div><button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500"><span className="material-symbols-outlined">close</span></button></div>}
function BookModal({form,setForm,saving,onClose,onSubmit}){return <ModalShell onClose={onClose} wide><Header title="Book Ruangan Rapat" subtitle="Isi agenda, PIC, nomor HP PIC, ruangan, dan waktu" onClose={onClose}/><form noValidate onSubmit={onSubmit} className="p-6 space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Topik / Agenda"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Contoh: Rapat Koordinasi"/></Field><Field label="Nomor Surat"><input value={form.nomor_surat} onChange={e=>setForm({...form,nomor_surat:e.target.value})} maxLength="100" className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Opsional — contoh: B-123/BU/IX/2026"/></Field><Field label="Nama PIC"><input required value={form.pic} onChange={e=>setForm({...form,pic:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Nama penanggung jawab"/></Field><Field label="No. HP PIC"><input required value={form.pic_phone} onChange={e=>setForm({...form,pic_phone:e.target.value.replace(/[^0-9+ -]/g,'')})} maxLength="30" className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Contoh: 081234567890"/></Field><Field label="Ruangan"><select value={form.room} onChange={e=>setForm({...form,room:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900">{ROOMS.map(x=><option key={x}>{x}</option>)}</select></Field><div className="md:col-span-2"><div className="flex items-center gap-1.5 mb-2" role="group" aria-label="Cara memilih tanggal"><button type="button" onClick={()=>setForm(f=>f.dateMode==='range'?f:{...f,dateMode:'range',date:f.dates[0]||f.date,end_date:''})} aria-pressed={form.dateMode!=='pick'} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${form.dateMode!=='pick'?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Rentang tanggal</button><button type="button" onClick={()=>setForm(f=>f.dateMode==='pick'?f:{...f,dateMode:'pick',dates:f.date?listDates(f.date,f.end_date&&f.end_date>f.date?f.end_date:f.date):[]})} aria-pressed={form.dateMode==='pick'} className={`px-3 py-1.5 rounded-full text-xs font-semibold border ${form.dateMode==='pick'?'bg-slate-900 text-white border-slate-900':'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>Pilih beberapa tanggal</button></div>{form.dateMode==='pick'?<><MultiDatePicker value={form.dates} onChange={dates=>setForm(f=>({...f,dates}))} max={MAX_PICKED}/><p className="text-[11px] text-slate-500 mt-1">Jam sama untuk semua tanggal. Tanggal yang berurutan otomatis digabung jadi satu booking.</p></>:<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Hari / Tanggal Mulai"><input required type="date" value={form.date} onChange={e=>setForm(withStartDate(form,e.target.value))} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900"/>{form.date&&<p className="text-[11px] text-slate-500 mt-1">{formatDateLabel(form.date)}</p>}{form.date&&cutiBersamaLabel(form.date)&&<p className="text-[11px] text-amber-700 font-semibold mt-1">⚠ {cutiBersamaLabel(form.date)} (Cuti Bersama)</p>}</Field><Field label="Sampai Tanggal"><input type="date" value={form.end_date} min={form.date||undefined} onChange={e=>setForm({...form,end_date:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900"/><p className="text-[11px] text-slate-500 mt-1">{form.date&&form.end_date&&form.end_date>form.date?`${dayCount(form.date,form.end_date)} hari · jam yang sama setiap hari`:'Kosongkan jika hanya 1 hari'}</p></Field></div>}</div><Field label="Jam Mulai"><input required type="time" value={form.start} onChange={e=>setForm({...form,start:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900"/></Field><Field label="Jam Selesai"><input required type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900"/></Field></div><div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600"><b>Status surat otomatis:</b> Merah — Belum Ada Surat. Begitu surat diupload lewat kartu booking (tab Surat), status langsung menjadi Hijau — Surat Diterima.</div><div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border bg-white text-sm font-semibold">Batal</button><button disabled={saving} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold">{saving?'Menyimpan...':'Pesan Ruangan'}</button></div></form></ModalShell>}
function BookingModal({booking,canManage,canEdit,mode,setMode,saving,error,onClose,onUpdate,onCancel,onView}){const {alert}=useFeedback();const [form,setForm]=useState({title:booking.title||'',nomor_surat:booking.nomor_surat||'',room:booking.room||ROOMS[0],pic:booking.pic||'',pic_phone:booking.pic_phone||'',date:booking.date||'',end_date:endOf(booking)||'',start:booking.start||'',end:booking.end||'',status:booking.status||'belum',surat_name:booking.surat_name||'',surat_file_data:booking.surat_file_data||''});const [msg,setMsg]=useState('');const [name,setName]=useState(booking.surat_name||'');const [data,setData]=useState(booking.surat_file_data||'');const pick=async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;if(!ALLOWED.includes(f.type)){alert({title:'Format tidak didukung',message:'Surat harus PDF, JPG, atau PNG.',tone:'warning'});return;}if(f.size>MAX_FILE){alert({title:'File terlalu besar',message:'Ukuran surat maksimal 8 MB.',tone:'warning'});return;}if(!(await verifyFileIsGenuine(f))){alert({title:'File ditolak',message:'File tidak terdeteksi sebagai PDF/JPG/PNG asli (kemungkinan file diubah namanya).',tone:'error'});return;}const encoded=await fileToDataUrl(f);setName(f.name);setData(encoded);setForm(x=>({...x,surat_name:f.name,surat_file_data:encoded}));setMsg('Surat berhasil dipilih. Klik "Simpan Surat" -- status otomatis menjadi Surat Diterima.');};const saveEdit=async()=>{const errors=validateBooking(form);if(errors.length){await alert({title:'Data booking belum lengkap',intro:'Periksa data berikut:',message:errors,tone:'warning'});return;}onUpdate({title:form.title,nomor_surat:form.nomor_surat,room:form.room,pic:form.pic,pic_phone:form.pic_phone,date:form.date,end_date:form.end_date||form.date,start:form.start,end:form.end},'Perubahan booking berhasil disimpan.');};/* Status surat otomatis (diatur backend): ada file surat -> Surat Diterima (hijau), tidak ada -> Belum Ada Surat (merah). */const saveLetter=async()=>{const changed=data!==(booking.surat_file_data||'');if(!changed){await alert({title:'Belum ada perubahan',message:data?'Surat ini sudah tersimpan.':'Pilih file surat terlebih dahulu.',tone:'warning'});return;}onUpdate({surat_name:name||null,surat_file_data:data||null},data?'Surat tersimpan. Status: Surat Diterima.':'Surat dihapus. Status: Belum Ada Surat.');};const meta=STATUS_META[data?'diterima':'belum'];const liveMeta=STATUS_META[booking.status]||STATUS_META.belum;return <ModalShell onClose={onClose} wide><Header title="Detail Booking Ruang Rapat" subtitle="Edit booking, kelola surat, atau batalkan booking" onClose={onClose} icon="calendar_month"/><div className="p-6 space-y-5">{canEdit&&<div className="flex gap-2 border-b pb-3"><button onClick={()=>setMode('detail')} className={`px-3 py-2 rounded-lg text-xs font-semibold ${mode==='detail'?'bg-slate-900 text-white':'bg-white border'}`}>Detail</button><button onClick={()=>setMode('edit')} className={`px-3 py-2 rounded-lg text-xs font-semibold ${mode==='edit'?'bg-blue-600 text-white':'bg-white border'}`}>Edit Booking</button>{canManage&&<button onClick={()=>setMode('letter')} className={`px-3 py-2 rounded-lg text-xs font-semibold ${mode==='letter'?'bg-slate-900 text-white':'bg-white border'}`}>Surat</button>}<button onClick={onCancel} disabled={saving} className="ml-auto px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white">Cancel Booking</button></div>}{error&&<div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}{mode==='edit'?<div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Topik / Agenda"><input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="w-full h-11 px-3 rounded-lg border bg-white text-sm"/></Field><Field label="Nomor Surat"><input value={form.nomor_surat} onChange={e=>setForm({...form,nomor_surat:e.target.value})} maxLength="100" placeholder="Opsional" className="w-full h-11 px-3 rounded-lg border bg-white text-sm"/></Field><Field label="Nama PIC"><input value={form.pic} onChange={e=>setForm({...form,pic:e.target.value})} className="w-full h-11 px-3 rounded-lg border bg-white text-sm"/></Field><Field label="No. HP PIC"><input value={form.pic_phone} onChange={e=>setForm({...form,pic_phone:e.target.value.replace(/[^0-9+ -]/g,'')})} maxLength="30" className="w-full h-11 px-3 rounded-lg border bg-white text-sm"/></Field><Field label="Ruangan"><select value={form.room} onChange={e=>setForm({...form,room:e.target.value})} className="w-full h-11 px-3 rounded-lg border bg-white text-sm">{ROOMS.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Tanggal Mulai"><input type="date" value={form.date} onChange={e=>setForm(withStartDate(form,e.target.value))} className="w-full h-11 px-3 rounded-lg border bg-white text-sm"/></Field><Field label="Sampai Tanggal"><input type="date" value={form.end_date} min={form.date||undefined} onChange={e=>setForm({...form,end_date:e.target.value})} className="w-full h-11 px-3 rounded-lg border bg-white text-sm"/><p className="text-[11px] text-slate-500 mt-1">{form.date&&form.end_date&&form.end_date>form.date?`${dayCount(form.date,form.end_date)} hari`:'Kosongkan jika hanya 1 hari'}</p></Field><Field label="Jam Mulai"><input type="time" value={form.start} onChange={e=>setForm({...form,start:e.target.value})} className="w-full h-11 px-3 rounded-lg border bg-white text-sm"/></Field><Field label="Jam Selesai"><input type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})} className="w-full h-11 px-3 rounded-lg border bg-white text-sm"/></Field><div className="md:col-span-2 flex justify-end"><button disabled={saving} onClick={saveEdit} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold">{saving?'Menyimpan...':'Simpan Perubahan'}</button></div></div>:mode==='letter'?<div className="space-y-4"><div className={`rounded-xl border p-4 ${meta.card}`}><div className="font-bold text-sm">{form.title}</div><div className="text-xs mt-1">{form.room} · {dateRangeLabel(booking)} · {form.start}–{form.end}</div><div className="text-xs font-semibold mt-1">PIC: {form.pic} · ☎ {form.pic_phone||'-'}</div></div><label className="relative flex items-center gap-4 p-5 rounded-xl border border-dashed border-slate-300 bg-white cursor-pointer"><span className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><span className="material-symbols-outlined text-slate-600">upload_file</span></span><div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{name||'Pilih surat booking'}</div><div className="text-xs text-slate-500 mt-1">PDF, JPG, PNG · Maks. 8 MB</div></div><input type="file" className="absolute inset-0 opacity-0" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={pick}/></label><Field label="Status Surat"><div className={`flex items-center gap-2 h-11 px-3 rounded-lg border text-sm font-semibold ${meta.badge}`}><span className={`w-2.5 h-2.5 rounded-full ${meta.dot}`}></span>{meta.label}<span className="ml-auto text-[11px] font-normal opacity-75">otomatis dari ada/tidaknya surat</span></div></Field>{msg&&<p className="text-xs text-slate-500">{msg}</p>}{data&&<div className="flex gap-4"><button type="button" onClick={()=>onView(name,data)} className="text-xs font-semibold text-blue-700 hover:underline">Lihat surat</button><button type="button" onClick={()=>{setName('');setData('');setForm(x=>({...x,surat_name:'',surat_file_data:''}));setMsg('Surat akan dihapus. Klik "Simpan Surat" -- status kembali menjadi Belum Ada Surat.');}} className="text-xs font-semibold text-red-600 hover:underline">Hapus surat</button></div>}<div className="flex justify-end"><button disabled={saving} onClick={saveLetter} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold">{saving?'Menyimpan...':'Simpan Surat'}</button></div></div>:<div className={`rounded-xl border p-5 ${liveMeta.card}`}><div className="flex items-start justify-between gap-4"><div><div className="font-bold text-lg">{booking.title}</div><div className="text-sm mt-1">✉ No. Surat: <b>{booking.nomor_surat||'-'}</b></div><div className="text-sm mt-2">{dateRangeLabel(booking)} · {booking.start}–{booking.end}</div><div className="text-sm mt-1">▣ {booking.room}</div><div className="text-sm mt-1 font-semibold">♙ PIC: {booking.pic}</div><div className="text-sm mt-1 font-semibold">☎ No. HP PIC: {booking.pic_phone||'-'}</div></div><span className={`px-3 py-1.5 rounded-full border text-xs font-bold ${liveMeta.badge}`}>{liveMeta.label}</span></div><div className="mt-4 pt-4 border-t border-black/10 text-xs opacity-75">🕓 Terakhir diedit oleh <b>{booking.updated_by_name||'—'}</b>{booking.updated_at&&<> · {new Date(booking.updated_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</>}</div>{canEdit&&<div className="mt-5 flex gap-2"><button onClick={()=>setMode('edit')} className="px-4 py-2.5 rounded-lg bg-blue-600 text-white text-xs font-semibold">Edit Booking</button>{canManage&&<button onClick={()=>setMode('letter')} className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold">Kelola Surat</button>}</div>}</div>}</div></ModalShell>}
function CancelDatesModal({booking,initialDate,saving,onClose,onSubmit}){
  const days=useMemo(()=>{const out=[];const d=new Date(`${booking.date}T00:00:00`);const end=endOf(booking);while(localDateISO(d)<=end){out.push(localDateISO(d));d.setDate(d.getDate()+1);}return out;},[booking]);
  const single=days.length===1;
  const [picked,setPicked]=useState(()=>new Set(single?days:initialDate&&days.includes(initialDate)?[initialDate]:[]));
  const [reason,setReason]=useState('');
  const toggle=d=>setPicked(p=>{const n=new Set(p);n.has(d)?n.delete(d):n.add(d);return n;});
  const all=picked.size===days.length;
  return <div className="fixed inset-0 z-[60] bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="w-full max-w-md bg-[#f7f9fb] rounded-2xl shadow-2xl overflow-hidden">
    <Header title={single?'Batalkan Booking':'Batalkan Tanggal Booking'} subtitle={`${booking.title} · ${booking.room} · ${booking.start}–${booking.end}`} onClose={onClose} icon="event_busy"/>
    <div className="p-6 space-y-4">
      {single
        ?<p className="text-sm text-slate-700">Booking pada <b>{formatDateLabel(days[0])} {new Date(`${days[0]}T00:00:00`).getFullYear()}</b> akan dibatalkan. Data booking tetap tersimpan dengan status <b>Dibatalkan</b>.</p>
        :<>
          <p className="text-xs text-slate-600">Centang tanggal yang ingin dibatalkan. Tanggal lain tetap terbooking dengan data & surat yang sama.</p>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer"><input type="checkbox" checked={all} onChange={()=>setPicked(all?new Set():new Set(days))} className="w-4 h-4"/>Pilih semua ({days.length} hari)</label>
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">{days.map(d=>{const on=picked.has(d);const cuti=cutiBersamaLabel(d);return <label key={d} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg border cursor-pointer text-sm ${on?'bg-red-50 border-red-300 text-red-800':'bg-white border-slate-200'}`}><input type="checkbox" checked={on} onChange={()=>toggle(d)} className="w-4 h-4"/><span className="font-semibold">{formatDateLabel(d)} {new Date(`${d}T00:00:00`).getFullYear()}</span>{cuti&&<span className="text-[10px] text-amber-700 font-semibold">{cuti}</span>}{on&&<span className="ml-auto text-[10px] font-bold">DIBATALKAN</span>}</label>;})}</div>
          {all&&<p className="text-xs font-semibold text-red-700">Semua tanggal dipilih — seluruh booking akan berstatus Dibatalkan.</p>}
        </>}
      <div>
        <label className="block text-xs font-bold text-slate-700 mb-1.5">Alasan pembatalan <span className="font-normal text-slate-400">(opsional)</span></label>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} maxLength={500} rows={3} placeholder="Contoh: Rapat diundur ke minggu depan" className="w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900 resize-none"/>
        <div className="text-[10px] text-slate-400 text-right mt-0.5">{reason.length}/500</div>
      </div>
      <div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border bg-white text-sm font-semibold">Tidak</button><button type="button" disabled={saving||!picked.size} onClick={()=>onSubmit(days.filter(d=>picked.has(d)),reason)} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold disabled:opacity-50">{saving?'Memproses...':single?'Ya, Batalkan Booking':all?'Batalkan Semua':`Batalkan ${picked.size} Tanggal`}</button></div>
    </div>
  </div></div>;
}
// Detail booking berstatus batal (baca saja): siapa & kapan membatalkan, serta alasannya.
function CancelledModal({booking,onClose}){return <ModalShell onClose={onClose}><Header title="Booking Dibatalkan" subtitle="Data tetap tersimpan di database dengan status batal" onClose={onClose} icon="event_busy"/><div className="p-6 space-y-4">
  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-100 p-5 text-slate-700">
    <div className="flex items-start justify-between gap-3"><div className="font-bold text-lg line-through">{booking.title}</div><span className="px-3 py-1.5 rounded-full border border-slate-300 bg-white text-xs font-bold text-slate-600 shrink-0">DIBATALKAN</span></div>
    <div className="text-sm mt-2">✉ No. Surat: <b>{booking.nomor_surat||'-'}</b></div>
    <div className="text-sm mt-1">{dateRangeLabel(booking)} · {booking.start}–{booking.end}</div>
    <div className="text-sm mt-1">▣ {booking.room}</div>
    <div className="text-sm mt-1 font-semibold">♙ PIC: {booking.pic} · ☎ {booking.pic_phone||'-'}</div>
  </div>
  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
    <div className="text-xs font-bold text-red-800 uppercase tracking-wide">Alasan pembatalan</div>
    <p className={`text-sm mt-1.5 whitespace-pre-wrap break-words ${booking.cancel_reason?'text-red-900':'text-red-700/70 italic'}`}>{booking.cancel_reason||'Tidak ada alasan yang diisi.'}</p>
    <div className="text-xs text-red-800/80 mt-3">🕓 Dibatalkan oleh <b>{booking.cancelled_by_name||'—'}</b>{booking.cancelled_at&&<> · {new Date(booking.cancelled_at).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'})}</>}</div>
  </div>
  <div className="flex justify-end"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border bg-white text-sm font-semibold">Tutup</button></div>
</div></ModalShell>}
function Field({label,children}){return <div><label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>{children}</div>}
