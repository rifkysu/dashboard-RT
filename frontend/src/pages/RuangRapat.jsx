import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import DocumentViewer from '../components/DocumentViewer';

const STATUS_META = {
  belum: { label: 'Belum Ada Surat', card: 'bg-red-50 border-red-300 text-red-900', badge: 'bg-red-100 text-red-700 border-red-200', dot: 'bg-red-500' },
  ditinjau: { label: 'Surat Ditinjau', card: 'bg-blue-50 border-blue-300 text-blue-900', badge: 'bg-blue-100 text-blue-700 border-blue-200', dot: 'bg-blue-500' },
  diterima: { label: 'Surat Diterima', card: 'bg-green-50 border-green-300 text-green-900', badge: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
};
const ROOMS = ['Ruang Rapat Utama (Kapasitas 50)','Ruang Rapat Nusantara (Kapasitas 20)','Ruang VIP Eksekutif (Kapasitas 10)','Ruang Diskusi Mini (Kapasitas 5)'];
const dayNames = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];

// Kalender resmi Indonesia: hari libur nasional + cuti bersama.
// Sumber 2026: SKB 3 Menteri; sumber 2027: SKB 3 Menteri.
const HOLIDAYS = {
  '2026-01-01': 'Tahun Baru 2026 Masehi',
  '2026-01-16': 'Isra Mikraj Nabi Muhammad SAW',
  '2026-02-16': 'Cuti Bersama Tahun Baru Imlek 2577 Kongzili',
  '2026-02-17': 'Tahun Baru Imlek 2577 Kongzili',
  '2026-03-18': 'Cuti Bersama Hari Suci Nyepi',
  '2026-03-19': 'Hari Suci Nyepi (Tahun Baru Saka 1948)',
  '2026-03-20': 'Cuti Bersama Idulfitri 1447 H',
  '2026-03-21': 'Idulfitri 1447 H',
  '2026-03-22': 'Idulfitri 1447 H',
  '2026-03-23': 'Cuti Bersama Idulfitri 1447 H',
  '2026-03-24': 'Cuti Bersama Idulfitri 1447 H',
  '2026-04-03': 'Wafat Yesus Kristus',
  '2026-04-05': 'Kebangkitan Yesus Kristus (Paskah)',
  '2026-05-01': 'Hari Buruh Internasional',
  '2026-05-14': 'Kenaikan Yesus Kristus',
  '2026-05-15': 'Cuti Bersama Kenaikan Yesus Kristus',
  '2026-05-27': 'Iduladha 1447 H',
  '2026-05-28': 'Cuti Bersama Iduladha 1447 H',
  '2026-05-31': 'Hari Raya Waisak 2570 BE',
  '2026-06-01': 'Hari Lahir Pancasila',
  '2026-06-16': '1 Muharam / Tahun Baru Islam 1448 H',
  '2026-08-17': 'Proklamasi Kemerdekaan Republik Indonesia',
  '2026-08-25': 'Maulid Nabi Muhammad SAW',
  '2026-12-24': 'Cuti Bersama Kelahiran Yesus Kristus',
  '2026-12-25': 'Kelahiran Yesus Kristus (Natal)',
  '2027-01-01': 'Tahun Baru 2027 Masehi',
  '2027-01-05': 'Isra Mikraj Nabi Muhammad SAW',
  '2027-02-05': 'Cuti Bersama Tahun Baru Imlek 2578 Kongzili',
  '2027-02-06': 'Tahun Baru Imlek 2578 Kongzili',
  '2027-03-08': 'Hari Suci Nyepi (Tahun Baru Saka 1949)',
  '2027-03-09': 'Cuti Bersama Idulfitri 1448 H',
  '2027-03-10': 'Idulfitri 1448 H',
  '2027-03-11': 'Idulfitri 1448 H',
  '2027-03-12': 'Cuti Bersama Idulfitri 1448 H',
  '2027-03-15': 'Cuti Bersama Idulfitri 1448 H',
  '2027-03-25': 'Cuti Bersama Wafat Yesus Kristus',
  '2027-03-26': 'Wafat Yesus Kristus',
  '2027-03-28': 'Hari Kebangkitan Yesus Kristus (Paskah)',
  '2027-05-01': 'Hari Buruh Internasional',
  '2027-05-06': 'Kenaikan Yesus Kristus',
  '2027-05-17': 'Iduladha 1448 H',
  '2027-05-18': 'Cuti Bersama Iduladha 1448 H',
  '2027-05-19': 'Cuti Bersama Waisak 2571 BE',
  '2027-05-20': 'Hari Raya Waisak 2571 BE',
  '2027-06-01': 'Hari Lahir Pancasila',
  '2027-06-06': '1 Muharam / Tahun Baru Islam 1449 H',
  '2027-08-15': 'Maulid Nabi Muhammad SAW',
  '2027-08-17': 'Proklamasi Kemerdekaan Republik Indonesia',
  '2027-12-24': 'Cuti Bersama Kelahiran Yesus Kristus (Natal)',
  '2027-12-25': 'Kelahiran Yesus Kristus (Natal)',
  '2027-12-26': 'Isra Mikraj Nabi Muhammad SAW',
};

function getHoliday(dateString) { return HOLIDAYS[dateString] || ''; }
function isWeekend(dateString) { const d=new Date(`${dateString}T00:00:00`); return d.getDay()===0 || d.getDay()===6; }
function getHolidayLabel(dateString) { return getHoliday(dateString) || (isWeekend(dateString) ? 'Akhir pekan / tanggal merah' : ''); }
function getMonday(date=new Date()) { const d=new Date(date); d.setHours(0,0,0,0); const day=d.getDay(); const diff=day===0 ? -6 : 1-day; d.setDate(d.getDate()+diff); return d.toISOString().slice(0,10); }

const emptyForm = { title:'', room:ROOMS[0], pic:'', date:'', start:'', end:'', status:'belum' };
const MAX_FILE = 8 * 1024 * 1024;
const ALLOWED = ['application/pdf','image/jpeg','image/png'];

function formatDateLabel(dateString) { if (!dateString) return 'Pilih hari'; const d = new Date(`${dateString}T00:00:00`); return `${dayNames[(d.getDay()+6)%7]}, ${d.getDate()} ${d.toLocaleString('id-ID',{month:'short'})}`; }
function getDayKey(dateString) { const d = new Date(`${dateString}T00:00:00`); return dayNames[(d.getDay()+6)%7]; }
function fileToDataUrl(file) { return new Promise((resolve,reject)=>{ const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsDataURL(file); }); }

export default function RuangRapat() {
  const [items,setItems]=useState([]), [loading,setLoading]=useState(true), [error,setError]=useState('');
  const [showBook,setShowBook]=useState(false), [selected,setSelected]=useState(null);
  const [viewer,setViewer]=useState({open:false,name:'',data:''});
  const [weekStart,setWeekStart]=useState(()=>getMonday()), [form,setForm]=useState({...emptyForm,date:new Date().toLocaleDateString('en-CA')}), [saving,setSaving]=useState(false);

  const loadBookings=async()=>{ setLoading(true); try{const r=await api.get('/ruang-rapat');setItems(r.data.data||[]);setError('');}catch(e){setError(e.response?.data?.message||'Gagal memuat jadwal dari database.');}finally{setLoading(false);} };
  useEffect(()=>{loadBookings();},[]);
  const weekDates=useMemo(()=>{const start=new Date(`${weekStart}T00:00:00`);return Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d.toISOString().slice(0,10);});},[weekStart]);

  const saveBooking=async(e)=>{e.preventDefault();setSaving(true);try{const r=await api.post('/ruang-rapat',form);setItems(p=>[...p,r.data.data].sort((a,b)=>`${a.date} ${a.start}`.localeCompare(`${b.date} ${b.start}`)));setShowBook(false);setForm(emptyForm);setError('');}catch(e){setError(e.response?.data?.message||'Gagal menyimpan booking.');}finally{setSaving(false);}};
  const updateSelected=async(payload)=>{setSaving(true);try{const r=await api.put(`/ruang-rapat/${selected.id}`,payload);const updated={...selected,...payload};setItems(p=>p.map(x=>x.id===selected.id?updated:x));setSelected(updated);setError('');}catch(e){setError(e.response?.data?.message||'Gagal memperbarui booking.');}finally{setSaving(false);}};
  const moveWeek=(delta)=>{const d=new Date(`${weekStart}T00:00:00`);d.setDate(d.getDate()+delta*7);setWeekStart(d.toISOString().slice(0,10));};

  return <div className="menu-page menu-ruang-rapat max-w-[1400px] mx-auto">
    <div className="menu-hero mb-6"><div><span className="menu-kicker">BOOKING • RUANG RAPAT</span><h1 className="text-3xl font-bold">Jadwal Ruang Rapat</h1><p className="text-sm mt-1">Kelola agenda, PIC, surat booking, dan status penggunaan ruangan.</p></div><div className="menu-hero-icon"><span className="material-symbols-outlined">calendar_month</span></div></div>
    <div className="flex flex-col lg:flex-row justify-between items-start gap-4 mb-5"><div><h1 className="text-3xl font-bold">Jadwal & Booking Ruang Rapat</h1><p className="text-sm text-slate-600 mt-1">Klik kartu booking untuk memasukkan surat dan memperbarui status warna.</p></div><button onClick={()=>{setError('');setForm({...emptyForm,date:new Date().toLocaleDateString('en-CA')});setShowBook(true)}} className="bg-black text-white rounded-lg px-4 py-2.5 text-xs font-semibold shadow-sm">＋ Book Ruangan Rapat</button></div>
    <div className="bg-white border border-slate-200 rounded-xl p-4 mb-5 shadow-sm"><div className="flex flex-wrap items-center gap-3 text-xs font-medium"><span className="font-bold text-slate-700 mr-2">Petunjuk warna surat:</span>{Object.entries(STATUS_META).map(([k,m])=><span key={k} className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${m.badge}`}><span className={`w-2.5 h-2.5 rounded-full ${m.dot}`}/>{m.label}</span>)}</div></div>
    {error&&<div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-xs font-medium text-red-700">{error}</div>}
    <div className="calendar-shell bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm"><div className="calendar-toolbar p-4 border-b flex flex-col sm:flex-row justify-between gap-3 sm:items-center"><div><div className="font-bold text-sm">Kalender Booking Ruang Rapat</div><div className="text-xs text-slate-500 mt-1">Senin–Minggu · klik booking untuk detail & surat.</div></div><div className="flex items-center gap-2 text-xs"><button onClick={()=>moveWeek(-1)} className="border rounded px-2.5 py-1.5 hover:bg-slate-50">‹</button><span className="font-semibold px-2">{formatDateLabel(weekDates[0])} – {formatDateLabel(weekDates[6])}</span><button onClick={()=>moveWeek(1)} className="border rounded px-2.5 py-1.5 hover:bg-slate-50">›</button></div></div>
      <div className="overflow-x-auto"><div className="min-w-[1180px] grid grid-cols-7 divide-x divide-slate-200">{weekDates.map(date=>{const day=getDayKey(date), dayItems=items.filter(x=>x.date===date), holiday=getHoliday(date), weekend=isWeekend(date), holidayText=getHolidayLabel(date);return <div key={date} className={`min-h-[430px] ${holiday||weekend?'bg-red-50/70':'bg-slate-50/50'}`}><div className={`p-3 border-b ${holiday||weekend?'bg-red-100/90 border-red-200':'bg-slate-100/80'}`}><div className={`text-xs font-bold ${holiday||weekend?'text-red-800':'text-slate-800'}`}>{day}</div><div className={`text-[11px] font-semibold ${holiday||weekend?'text-red-700':'text-slate-500'}`}>{new Date(`${date}T00:00:00`).getDate()} {new Date(`${date}T00:00:00`).toLocaleString('id-ID',{month:'short'})}</div>{holidayText&&<div className="mt-1 text-[9px] leading-tight font-bold text-red-700">🔴 {holidayText}</div>}</div><div className="p-2.5 space-y-2.5">{loading?<div className="text-[11px] text-slate-400 text-center py-10">Memuat...</div>:dayItems.length===0?<div className="text-[11px] text-slate-400 text-center py-10">Belum ada booking</div>:dayItems.map(x=>{const m=STATUS_META[x.status]||STATUS_META.belum;return <button key={x.id} type="button" onClick={()=>setSelected(x)} className={`w-full text-left border rounded-xl p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${m.card}`}><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold">{x.start} – {x.end}</span><span className={`text-[9px] px-2 py-1 rounded-full border ${m.badge}`}>{m.label}</span></div><div className="font-bold text-xs mt-2">{x.title}</div><div className="text-[10px] mt-1 opacity-80">▣ {x.room}</div><div className="text-[10px] mt-1 font-semibold">♙ PIC: {x.pic}</div>{x.surat_name&&<div className="text-[9px] mt-2 truncate opacity-75">📄 {x.surat_name}</div>}</button>})}</div></div>})}</div></div>
    </div>
    {showBook&&<BookModal form={form} setForm={setForm} saving={saving} error={error} onClose={()=>setShowBook(false)} onSubmit={saveBooking}/>} 
    <DocumentViewer open={viewer.open} name={viewer.name} data={viewer.data} onClose={()=>setViewer({open:false,name:'',data:''})} />
    {selected&&<BookingModal booking={selected} saving={saving} onClose={()=>setSelected(null)} onUpdate={updateSelected} onView={(name,data)=>setViewer({open:true,name,data})}/>} 
  </div>;
}

function ModalShell({children,onClose,wide=false}){return <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className={`w-full ${wide?'max-w-3xl':'max-w-xl'} bg-[#f7f9fb] rounded-2xl shadow-2xl overflow-hidden`}>{children}</div></div>}
function Header({title,subtitle,onClose,icon='event'}){return <div className="bg-white border-b px-6 py-5 flex items-center justify-between"><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><span className="material-symbols-outlined">{icon}</span></div><div><div className="font-bold text-slate-900">{title}</div><div className="text-[11px] text-slate-500">{subtitle}</div></div></div><button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500"><span className="material-symbols-outlined">close</span></button></div>}
function BookModal({form,setForm,saving,onClose,onSubmit}){return <ModalShell onClose={onClose} wide><Header title="Book Ruangan Rapat" subtitle="Isi detail agenda, PIC, ruangan, dan waktu booking" onClose={onClose}/><form onSubmit={onSubmit} className="p-6 space-y-5"><div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="Topik / Agenda"><input required value={form.title} onChange={e=>setForm({...form,title:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Contoh: Rapat Koordinasi"/></Field><Field label="Nama PIC"><input required value={form.pic} onChange={e=>setForm({...form,pic:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Nama penanggung jawab"/></Field><Field label="Ruangan"><select value={form.room} onChange={e=>setForm({...form,room:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900">{ROOMS.map(x=><option key={x}>{x}</option>)}</select></Field><Field label="Hari / Tanggal"><input required type="date" value={form.date} onChange={e=>setForm({...form,date:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900"/>{form.date&&<p className="text-[11px] text-slate-500 mt-1">{formatDateLabel(form.date)}</p>}</Field><Field label="Jam Mulai"><input required type="time" value={form.start} onChange={e=>setForm({...form,start:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900"/></Field><Field label="Jam Selesai"><input required type="time" value={form.end} onChange={e=>setForm({...form,end:e.target.value})} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900"/></Field></div><div className="rounded-xl bg-slate-100 p-4 text-xs text-slate-600"><b>Status awal:</b> Merah — Belum Ada Surat. Setelah surat dimasukkan melalui kartu booking, status dapat diubah menjadi Ditinjau atau Diterima.</div><div className="flex justify-end gap-2 border-t pt-4"><button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border bg-white text-sm font-semibold">Batal</button><button disabled={saving} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold">{saving?'Menyimpan...':'Pesan Ruangan'}</button></div></form></ModalShell>}
function BookingModal({booking,saving,onClose,onUpdate,onView}){const [name,setName]=useState(booking.surat_name||'');const [data,setData]=useState(booking.surat_file_data||'');const [status,setStatus]=useState(booking.status||'belum');const [msg,setMsg]=useState('');const pick=async e=>{const f=e.target.files?.[0];if(!f)return;if(!ALLOWED.includes(f.type)){setMsg('Surat harus PDF, JPG, atau PNG.');return;}if(f.size>MAX_FILE){setMsg('Ukuran surat maksimal 8 MB.');return;}setName(f.name);setData(await fileToDataUrl(f));setStatus('ditinjau');setMsg('Surat berhasil dipilih. Klik Simpan untuk mengubah warna/status.');};const save=async()=>{await onUpdate({surat_name:name,surat_file_data:data,status});};const meta=STATUS_META[status]||STATUS_META.belum;return <ModalShell onClose={onClose}><Header title="Detail Booking & Surat" subtitle="Kelola surat untuk mengubah indikator warna booking" onClose={onClose} icon="description"/><div className="p-6 space-y-5"><div className={`rounded-xl border p-4 ${meta.card}`}><div className="flex items-center justify-between"><div><div className="font-bold text-sm">{booking.title}</div><div className="text-xs mt-1">{booking.room} · {booking.start}–{booking.end}</div><div className="text-xs font-semibold mt-1">PIC: {booking.pic}</div></div><span className={`px-3 py-1.5 rounded-full border text-xs font-bold ${meta.badge}`}>{meta.label}</span></div></div><div><label className="block text-xs font-bold text-slate-700 mb-2">Masukkan Surat</label><label className="relative flex items-center gap-4 p-5 rounded-xl border border-dashed border-slate-300 bg-white cursor-pointer hover:bg-slate-50"><span className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><span className="material-symbols-outlined text-slate-600">upload_file</span></span><div className="min-w-0 flex-1"><div className="text-sm font-semibold truncate">{name||'Pilih surat booking'}</div><div className="text-xs text-slate-500 mt-1">PDF, JPG, PNG · Maks. 8 MB</div></div><input type="file" className="absolute inset-0 opacity-0" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={pick}/></label>{msg&&<p className="text-xs text-slate-500 mt-2">{msg}</p>}</div><Field label="Status Surat"><select value={status} onChange={e=>setStatus(e.target.value)} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900"><option value="belum">🔴 Belum Ada Surat</option><option value="ditinjau">🔵 Surat Ditinjau</option><option value="diterima">🟢 Surat Diterima</option></select></Field>{data&&<button type="button" onClick={()=>onView(name,data)} className="text-xs font-semibold text-blue-700 hover:underline">Lihat surat yang dipilih</button>}<div className="flex justify-end gap-2 border-t pt-4"><button onClick={onClose} className="px-4 py-2.5 rounded-lg border bg-white text-sm font-semibold">Tutup</button><button disabled={saving} onClick={save} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold">{saving?'Menyimpan...':'Simpan & Ubah Warna'}</button></div></div></ModalShell>}
function Field({label,children}){return <div><label className="block text-xs font-bold text-slate-700 mb-1.5">{label}</label>{children}</div>}
