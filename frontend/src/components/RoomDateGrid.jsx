import React, { useEffect, useMemo, useRef, useState } from 'react';
import { holidayLabel } from '../utils/holidays';
import { iso, monthKey, monthDays, MAX_MONTHS } from '../hooks/useMonthSchedule';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const endOf = (x) => x.end_date || x.date;

export function monthLabel(key) { const [y, m] = key.split('-').map(Number); return `${MONTH_NAMES[m - 1]} ${y}`; }

// Quick filter bulan: pilih tahun lalu klik bulan -> jadwal mulai dari bulan tsb.
export function MonthFilter({ months, onSelect }) {
  const anchor = months[0];
  const [year, setYear] = useState(() => Number(anchor.slice(0, 4)));
  useEffect(() => { setYear(Number(anchor.slice(0, 4))); }, [anchor]);
  const current = monthKey();
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => setYear((y) => y - 1)} aria-label="Tahun sebelumnya" className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">‹</button>
        <span className="w-12 text-center text-sm font-bold text-slate-800">{year}</span>
        <button type="button" onClick={() => setYear((y) => y + 1)} aria-label="Tahun berikutnya" className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">›</button>
      </div>
      <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1">
        {MONTH_NAMES.map((name, i) => {
          const key = `${year}-${String(i + 1).padStart(2, '0')}`;
          const active = key === anchor;
          const loaded = !active && months.includes(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => onSelect(key)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active ? 'bg-slate-900 text-white border-slate-900' : loaded ? 'bg-violet-50 text-violet-700 border-violet-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} ${key === current && !active ? 'ring-1 ring-violet-400' : ''}`}
            >
              {name.slice(0, 3)}
            </button>
          );
        })}
      </div>
      {anchor !== current && (
        <button type="button" onClick={() => onSelect(current)} className="shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50">Bulan Ini</button>
      )}
    </div>
  );
}

// Grid jadwal: ruangan horizontal (kolom), tanggal vertikal (baris), dikelompokkan per bulan.
// Header ruangan & kolom tanggal menempel saat digulir; bulan berikutnya dimuat otomatis
// saat sentinel di bawah terlihat (infinite scroll).
export default function RoomDateGrid({ months, rooms, items, loading, loadingMore, hasMore, onLoadMore, renderItem }) {
  const scrollRef = useRef(null);
  const headRef = useRef(null);
  const sentinelRef = useRef(null);
  const visibleRef = useRef(false);
  const moreRef = useRef(onLoadMore);
  moreRef.current = () => { if (hasMore && !loading && !loadingMore) onLoadMore(); };
  const today = iso();

  // Booking -> sel (tanggal|ruangan). Booking multi-hari masuk ke setiap hari dalam rentangnya.
  const cells = useMemo(() => {
    const map = new Map();
    for (const x of items) {
      const d = new Date(`${x.date}T00:00:00`);
      const end = endOf(x);
      for (let day = iso(d); day <= end; d.setDate(d.getDate() + 1), day = iso(d)) {
        const k = `${day}|${x.room}`;
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(x);
      }
    }
    for (const list of map.values()) list.sort((a, b) => a.start.localeCompare(b.start));
    return map;
  }, [items]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      visibleRef.current = entry.isIntersecting;
      if (entry.isIntersecting) moreRef.current();
    }, { root: scrollRef.current, rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  // Bulan yang baru dimuat masih pendek sehingga sentinel tetap terlihat -> lanjut muat.
  useEffect(() => { if (!loadingMore && visibleRef.current) moreRef.current(); }, [loadingMore, loading]);

  // Ganti bulan lewat filter -> gulir ke hari ini (kalau ada di bulan itu) atau ke atas.
  const scrolledFor = useRef(null);
  useEffect(() => {
    if (loading || scrolledFor.current === months[0]) return;
    scrolledFor.current = months[0];
    const box = scrollRef.current;
    if (!box) return;
    const row = months[0] === monthKey() ? box.querySelector(`[data-day="${today}"]`) : null;
    box.scrollTop = row ? box.scrollTop + row.getBoundingClientRect().top - box.getBoundingClientRect().top - (headRef.current?.offsetHeight || 0) : 0;
  }, [loading, months, today]);

  return (
    <div ref={scrollRef} className="relative max-h-[72vh] overflow-auto overscroll-contain">
      <table className="w-full border-separate border-spacing-0" style={{ minWidth: 150 + rooms.length * 190 }}>
        <thead ref={headRef}>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-slate-100 border-b-2 border-r border-slate-200 text-left px-3 py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider w-[150px] min-w-[150px]">Tanggal</th>
            {rooms.map((room) => (
              <th key={room} className="sticky top-0 z-20 bg-slate-100 border-b-2 border-l border-slate-200 text-left px-3 py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider min-w-[190px]">{room}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {months.map((key) => (
            <React.Fragment key={key}>
              <tr>
                <td colSpan={rooms.length + 1} className="bg-slate-800 text-white border-b border-slate-700 p-0">
                  <div className="sticky left-0 inline-block px-3 py-2 text-xs font-bold tracking-wide">{monthLabel(key)}</div>
                </td>
              </tr>
              {monthDays(key).map((date) => {
                const d = new Date(`${date}T00:00:00`);
                const idx = (d.getDay() + 6) % 7;
                const isToday = date === today;
                const cuti = holidayLabel(date);
                const weekend = idx >= 5;
                const rowBg = isToday ? 'bg-violet-50' : cuti ? 'bg-amber-50/60' : weekend ? 'bg-red-50/40' : '';
                return (
                  <tr key={date} data-day={date}>
                    <td className={`sticky left-0 z-10 border-b border-r border-slate-200 px-3 py-2.5 align-top w-[150px] min-w-[150px] ${isToday ? 'bg-violet-100' : cuti ? 'bg-amber-100' : weekend ? 'bg-red-50' : 'bg-white'}`}>
                      <div className={`text-xs font-bold ${cuti ? 'text-amber-700' : weekend ? 'text-red-600' : 'text-slate-800'}`}>{DAY_NAMES[idx]}</div>
                      <div className="text-[11px] text-slate-500">{d.getDate()} {d.toLocaleString('id-ID', { month: 'short' })} {d.getFullYear()}</div>
                      {isToday && <div className="mt-1 inline-block px-1.5 py-0.5 rounded bg-violet-600 text-white text-[9px] font-bold">HARI INI</div>}
                      {cuti && <div className="mt-1 text-[9px] font-bold text-amber-800 leading-tight">{cuti}</div>}
                    </td>
                    {rooms.map((room) => {
                      const list = cells.get(`${date}|${room}`) || [];
                      return (
                        <td key={room} className={`border-b border-l border-slate-200 p-1.5 align-top min-w-[190px] ${rowBg}`}>
                          <div className="space-y-1.5 min-h-[44px]">{list.map((x) => renderItem(x, date))}</div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </React.Fragment>
          ))}
        </tbody>
      </table>
      {loading && <div className="absolute inset-x-0 top-12 flex justify-center pointer-events-none"><span className="px-3 py-1.5 rounded-full bg-slate-900/80 text-white text-xs font-semibold shadow">Memuat jadwal...</span></div>}
      <div ref={sentinelRef} className="sticky left-0 py-4 text-center text-xs text-slate-400">
        {loadingMore ? 'Memuat bulan berikutnya...' : hasMore ? 'Gulir ke bawah untuk memuat bulan berikutnya' : `Maksimal ${MAX_MONTHS} bulan ditampilkan. Pilih bulan lain lewat filter.`}
      </div>
    </div>
  );
}
