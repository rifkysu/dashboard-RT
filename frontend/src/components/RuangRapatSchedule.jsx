import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import useMonthSchedule, { monthKey } from '../hooks/useMonthSchedule';
import RoomDateGrid, { MonthFilter, monthLabel } from './RoomDateGrid';

const ROOMS = ['SERBAGUNA', 'SETJEN II', 'TRI DHARMA', 'BIRO UMUM', 'GRAHA KEMNAKER'];
const STATUS = { belum: 'bg-red-50 border-red-300 text-red-900', ditinjau: 'bg-blue-50 border-blue-300 text-blue-900', diterima: 'bg-green-50 border-green-300 text-green-900' };
// Booking multi-hari: tampil di setiap hari dari `date` s/d `end_date`.
const endOf = (x) => x.end_date || x.date;
const dayCount = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000) + 1;

// Jadwal ruang rapat read-only (data publik, tanpa login). Dipakai bersama
// oleh halaman kiosk /jadwal-rapat dan landing page di /.
// Pilihan ruangan disimpan di URL (?ruang=SERBAGUNA), jadi layar kiosk di depan satu ruangan
// bisa langsung dibuka dengan link itu. Filter hanya di tampilan: data & realtime tetap sama.
// autoRotate (kiosk): pilihan ruangan berputar sendiri (Semua -> tiap ruangan -> Semua ...) tiap
// 30 detik dan tabel digulir ke hari ini, jadi layar tidak perlu disentuh. Dibuka dengan ?ruang=...
// = layar untuk satu ruangan -> putar otomatis mati (bisa dinyalakan dengan tombolnya).
const AUTO_MS = 30000; // kiosk: ganti ruangan tiap 30 detik
const JEDA_MS = 30000; // disentuh/digulir -> putar otomatis berhenti 30 detik lalu lanjut sendiri

export default function RuangRapatSchedule({ autoRotate = false }) {
  const s = useMonthSchedule('/ruang-rapat/public-schedule');
  const rooms = useMemo(() => [...ROOMS, ...[...new Set(s.items.map((x) => x.room).filter((r) => r && !ROOMS.includes(r)))].sort()], [s.items]);
  const [params, setParams] = useSearchParams();
  const urlRoom = rooms.includes(params.get('ruang')) ? params.get('ruang') : '';
  // Putaran otomatis memakai state lokal (bukan URL), supaya reload kiosk tidak "terkunci" di satu ruangan.
  const [autoRoom, setAutoRoom] = useState(null);
  const picked = autoRotate && autoRoom !== null && (autoRoom === '' || rooms.includes(autoRoom)) ? autoRoom : urlRoom;
  const [auto, setAuto] = useState(() => autoRotate && !params.get('ruang'));
  const [jedaSampai, setJedaSampai] = useState(0);
  const [sisaJeda, setSisaJeda] = useState(0);
  const [putaran, setPutaran] = useState(0);
  const jeda = () => { if (auto) setJedaSampai(Date.now() + JEDA_MS); };

  function pickRoom(room) {
    setAutoRoom(room);
    jeda();
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (room) next.set('ruang', room); else next.delete('ruang');
      return next;
    }, { replace: true, preventScrollReset: true });
  }
  const selectRef = useRef(s.selectMonth);
  selectRef.current = s.selectMonth;
  const monthsRef = useRef(s.months);
  monthsRef.current = s.months;
  useEffect(() => {
    if (!auto) return undefined;
    const sisa = jedaSampai - Date.now();
    if (sisa > 0) {
      const t = setTimeout(() => setJedaSampai(0), sisa);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      const urutan = ['', ...rooms];
      setAutoRoom(urutan[(urutan.indexOf(picked) + 1) % urutan.length]);
      // Kiosk selalu kembali ke bulan berjalan supaya baris "hari ini" bisa digulir.
      if (monthsRef.current[0] !== monthKey()) selectRef.current(monthKey());
      setPutaran((n) => n + 1);
    }, AUTO_MS);
    return () => clearTimeout(t);
  }, [auto, picked, jedaSampai, rooms.join('|')]); // eslint-disable-line react-hooks/exhaustive-deps -- isi daftar ruangan, bukan identitas array (data live tidak me-reset timer)

  useEffect(() => {
    if (!jedaSampai) { setSisaJeda(0); return undefined; }
    const tick = () => setSisaJeda(Math.max(0, Math.ceil((jedaSampai - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [jedaSampai]);
  const dijeda = auto && sisaJeda > 0;

  const last = s.months[s.months.length - 1];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-slate-800" onPointerDown={jeda} onWheel={jeda}>
      <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row justify-between gap-3 xl:items-center">
        <div>
          <div className="font-bold text-sm text-slate-800">Jadwal Ruang Rapat{picked && ` · ${picked}`}</div>
          <div className="text-xs text-slate-500 mt-1 inline-flex flex-wrap items-center gap-1.5">
            {monthLabel(s.months[0])}{last !== s.months[0] && ` – ${monthLabel(last)}`} &middot; gulir ke bawah untuk bulan berikutnya &middot;
            <span>diperbarui otomatis</span>
          </div>
        </div>
        <MonthFilter months={s.months} onSelect={s.selectMonth} />
      </div>
      <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-slate-500">Ruangan</span>
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1 min-w-0 flex-1" role="group" aria-label="Pilih ruangan">
          {['', ...rooms].map((room) => (
            <button
              key={room || 'semua'}
              type="button"
              onClick={() => pickRoom(room)}
              aria-pressed={picked === room}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${picked === room ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
            >
              {room || 'Semua Ruangan'}
            </button>
          ))}
        </div>
        {autoRotate && (
          <button type="button" onClick={() => { setAuto((a) => !a); setJedaSampai(0); }} aria-pressed={auto}
            title={auto ? 'Matikan putar otomatis' : 'Nyalakan putar otomatis'}
            className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${auto ? 'bg-sky-50 text-[#1e3a5f] border-sky-200 hover:bg-sky-100' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
            <span className="material-symbols-outlined text-[16px]">{!auto ? 'play_circle' : dijeda ? 'pause_circle' : 'autoplay'}</span>
            <span aria-live="polite">{!auto ? 'Putar otomatis: mati' : dijeda ? `Dijeda · lanjut ${sisaJeda} dtk` : 'Ganti ruangan otomatis · 30 dtk'}</span>
          </button>
        )}
      </div>
      {autoRotate && (
        <div className="h-1 bg-slate-100" aria-hidden="true">
          {auto && !dijeda && <div key={`${picked}-${putaran}-${jedaSampai}`} className="layar-progress h-full bg-[#1e3a5f]" style={{ animationDuration: `${AUTO_MS}ms` }}></div>}
        </div>
      )}
      {s.error && <div className="m-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{s.error}</div>}
      <RoomDateGrid
        scrollToTodayKey={autoRotate ? `${picked}|${putaran}` : undefined}
        months={s.months}
        rooms={picked ? [picked] : rooms}
        items={picked ? s.items.filter((x) => x.room === picked) : s.items}
        loading={s.loading}
        loadingMore={s.loadingMore}
        hasMore={s.hasMore}
        onLoadMore={s.loadMore}
        renderItem={(x, date) => (
          <div key={x.id} className={`border rounded-lg p-2 select-none ${STATUS[x.status] || STATUS.belum}`}>
            <div className="text-[10px] font-bold">{x.start} – {x.end}{endOf(x) !== x.date && <span className="font-semibold opacity-75"> · Hari {dayCount(x.date, date)}/{dayCount(x.date, endOf(x))}</span>}</div>
            <div className="font-bold text-xs mt-1 leading-snug">{x.title}</div>
            <div className="text-[10px] font-semibold mt-0.5">♙ {x.pic}</div>
          </div>
        )}
      />
    </div>
  );
}
