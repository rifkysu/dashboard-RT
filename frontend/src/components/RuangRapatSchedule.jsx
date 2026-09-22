import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { holidayLabel } from '../utils/holidays';

const dayNames = ['Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu'];
const STATUS = { belum:'bg-red-50 border-red-300 text-red-900', ditinjau:'bg-blue-50 border-blue-300 text-blue-900', diterima:'bg-green-50 border-green-300 text-green-900' };
function iso(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function monday(d=new Date()){const x=new Date(d),n=x.getDay();x.setDate(x.getDate()+(n===0?-6:1-n));return iso(x)}
function dates(start){const x=new Date(`${start}T00:00:00`);return Array.from({length:7},(_,i)=>{const d=new Date(x);d.setDate(x.getDate()+i);return iso(d)})}
function label(v){const d=new Date(`${v}T00:00:00`);return `${d.getDate()} ${d.toLocaleString('id-ID',{month:'short'})}`}
const cutiBersamaLabel = holidayLabel;

// Jadwal ruang rapat read-only (data publik, tanpa login). Dipakai bersama
// oleh halaman kiosk /jadwal-rapat dan landing page di /.
export default function RuangRapatSchedule() {
  const [items,setItems]=useState([]),[week,setWeek]=useState(monday()),[loading,setLoading]=useState(true),[error,setError]=useState('');
  const load=async()=>{try{const r=await api.get('/ruang-rapat/public-schedule');setItems(r.data.data||[]);setError('')}catch(e){setError(e.response?.data?.message||'Jadwal belum dapat dimuat.')}finally{setLoading(false)}};
  useEffect(()=>{load();const t=setInterval(load,30000);return()=>clearInterval(t)},[]);
  const ds=useMemo(()=>dates(week),[week]);
  const isCurrentWeek = week === monday();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between gap-3 sm:items-center">
        <div>
          <div className="font-bold text-sm text-slate-800">Jadwal Ruang Rapat</div>
          <div className="text-xs text-slate-500 mt-1">Navigasi bebas ke minggu berapa pun &middot; data diperbarui setiap 30 detik.</div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={()=>{const d=new Date(`${week}T00:00:00`);d.setDate(d.getDate()-7);setWeek(iso(d))}} className="border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">‹</button>
          <span className="font-semibold px-1 whitespace-nowrap">{label(ds[0])} – {label(ds[6])}</span>
          <button onClick={()=>{const d=new Date(`${week}T00:00:00`);d.setDate(d.getDate()+7);setWeek(iso(d))}} className="border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50">›</button>
          {!isCurrentWeek && <button onClick={()=>setWeek(monday())} className="border border-slate-200 rounded-lg px-3 py-2 hover:bg-slate-50 font-semibold text-slate-600">Hari Ini</button>}
        </div>
      </div>
      {error && <div className="m-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      <div className="overflow-x-auto">
        <div className="min-w-[1180px] grid grid-cols-7 divide-x divide-slate-200">
          {ds.map(date=>{
            const d=new Date(`${date}T00:00:00`), idx=(d.getDay()+6)%7, its=items.filter(x=>x.date===date), today=iso()===date, cuti=cutiBersamaLabel(date);
            return (
              <div key={date} className="min-h-[420px]">
                <div className={`p-4 border-b border-slate-200 ${today?'bg-violet-100':cuti?'bg-amber-100/70':'bg-slate-50'} ${cuti?'text-amber-700':idx>=5?'text-red-600':''}`}>
                  <div className="font-bold text-sm">{dayNames[idx]}{today?' • HARI INI':''}</div>
                  <div className="text-xs text-slate-500">{label(date)}</div>
                  {cuti && <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-200/70 text-amber-800 text-[9px] font-bold">📅 {cuti}</div>}
                </div>
                <div className="p-3 space-y-3">
                  {loading ? <div className="text-xs text-slate-400 text-center py-10">Memuat...</div>
                    : its.length===0 ? <div className="text-xs text-slate-400 text-center py-10">Tidak ada rapat</div>
                    : its.map(x => (
                      <div key={x.id} className={`border rounded-xl p-3 select-none ${STATUS[x.status]||STATUS.belum}`}>
                        <div className="text-xs font-bold">{x.start} – {x.end}</div>
                        <div className="font-bold text-sm mt-2">{x.title}</div>
                        <div className="text-xs mt-1">▣ {x.room}</div>
                        <div className="text-xs font-semibold mt-1">♙ PIC: {x.pic}</div>
                      </div>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
