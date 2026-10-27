import React, { useEffect, useMemo, useRef, useState } from 'react';
import { holidayLabel } from '../utils/holidays';
import { RuangFotoButton, RuangThumb } from './RuangFoto';
import { iso, monthKey, monthDays, MAX_MONTHS } from '../hooks/useMonthSchedule';
import { judulRuang } from '../utils/ruang';

const DAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
export const MONTH_NAMES = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const endOf = (x) => x.end_date || x.date;
// Lebar tetap kolom tanggal & tiap ruangan: nama ruangan panjang turun ke baris berikutnya, bukan melebarkan kolom.
const DATE_W = 150;
const COL_W = 210;

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
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${active ? 'bg-slate-900 text-white border-slate-900' : loaded ? 'bg-sky-50 text-[#1e3a5f] border-sky-200' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'} ${key === current && !active ? 'ring-1 ring-violet-400' : ''}`}
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
// onAddBooking(date, room): kalau diisi, tiap sel punya tombol "+ Booking" (sel kosong: seluruh sel bisa diklik)
// yang membuka form booking dengan ruangan & tanggal sel tersebut sudah terisi.
// scrollToTodayKey (kiosk): setiap nilainya berubah (mis. ganti ruangan otomatis), tabel digulir halus ke baris hari ini.
export default function RoomDateGrid({ months, rooms, items, loading, loadingMore, hasMore, onLoadMore, renderItem, onAddBooking, scrollToTodayKey }) {
  const scrollRef = useRef(null);
  const headRef = useRef(null);
  const sentinelRef = useRef(null);
  const visibleRef = useRef(false);
  const moreRef = useRef(onLoadMore);
  moreRef.current = () => { if (hasMore && !loading && !loadingMore) onLoadMore(); };
  const today = iso();

  // Geser kiri/kanan: scrollbar horizontal ada di dasar kotak (yang terus bertambah karena infinite scroll),
  // jadi ditambah tombol panah + bayangan tepi selama masih ada kolom ruangan yang tersembunyi.
  const [geser, setGeser] = useState({ kiri: false, kanan: false });
  useEffect(() => {
    const box = scrollRef.current;
    if (!box) return undefined;
    const cek = () => setGeser((g) => {
      const kiri = box.scrollLeft > 4;
      const kanan = box.scrollLeft + box.clientWidth < box.scrollWidth - 4;
      return g.kiri === kiri && g.kanan === kanan ? g : { kiri, kanan };
    });
    cek();
    box.addEventListener('scroll', cek, { passive: true });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(cek) : null;
    ro?.observe(box);
    if (box.firstElementChild) ro?.observe(box.firstElementChild);
    return () => { box.removeEventListener('scroll', cek); ro?.disconnect(); };
  }, [rooms.length]);
  const geserKe = (arah) => {
    const box = scrollRef.current;
    if (!box) return;
    const langkah = Math.max(COL_W, Math.floor((box.clientWidth - DATE_W) / COL_W) * COL_W);
    box.scrollBy({ left: arah * langkah, behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  // Seret dengan mouse (klik-tahan lalu geser) untuk menggulir tabel ke samping/atas-bawah, seperti geser jari
  // di layar sentuh (sentuhan sudah digulir bawaan browser). Klik biasa pada booking/tombol tetap berfungsi;
  // klik yang terjadi di akhir seretan dibatalkan supaya tidak membuka booking tanpa sengaja.
  const seret = useRef(null);
  const [menyeret, setMenyeret] = useState(false);
  const mulaiSeret = (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0 || e.target.closest('input, select, textarea, [contenteditable]')) return;
    const box = scrollRef.current;
    seret.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop, gerak: false, id: e.pointerId };
  };
  const saatSeret = (e) => {
    const sr = seret.current;
    if (!sr || e.pointerId !== sr.id) return;
    const dx = e.clientX - sr.x, dy = e.clientY - sr.y;
    if (!sr.gerak) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      sr.gerak = true;
      setMenyeret(true);
      scrollRef.current.setPointerCapture?.(e.pointerId);
    }
    scrollRef.current.scrollLeft = sr.left - dx;
    scrollRef.current.scrollTop = sr.top - dy;
  };
  const selesaiSeret = (e) => {
    const sr = seret.current;
    if (!sr || e.pointerId !== sr.id) return;
    seret.current = null;
    if (sr.gerak) {
      setMenyeret(false);
      // Klik yang menyusul pointerup setelah menyeret jangan diteruskan ke booking/tombol di bawah kursor.
      const blok = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener('click', blok, { capture: true, once: true });
      setTimeout(() => window.removeEventListener('click', blok, { capture: true }), 0);
    }
  };

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

  useEffect(() => {
    if (scrollToTodayKey === undefined || loading) return;
    const box = scrollRef.current;
    const row = box?.querySelector(`[data-day="${today}"]`);
    if (!row) return;
    const top = box.scrollTop + row.getBoundingClientRect().top - box.getBoundingClientRect().top - (headRef.current?.offsetHeight || 0);
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    box.scrollTo({ top, left: 0, behavior: reduce ? 'auto' : 'smooth' });
  }, [scrollToTodayKey, loading, today]);

  const panah = 'absolute top-1/2 -translate-y-1/2 z-40 w-10 h-10 rounded-full bg-white/95 text-slate-700 shadow-lg ring-1 ring-slate-200 inline-flex items-center justify-center hover:bg-slate-900 hover:text-white transition';
  return (
    <div className="relative">
    {geser.kiri && <div className="pointer-events-none absolute inset-y-0 z-30 w-8 bg-gradient-to-r from-slate-900/10 to-transparent" style={{ left: DATE_W }} aria-hidden="true"></div>}
    {geser.kanan && <div className="pointer-events-none absolute inset-y-0 right-0 z-30 w-10 bg-gradient-to-l from-slate-900/15 to-transparent" aria-hidden="true"></div>}
    {geser.kiri && <button type="button" onClick={() => geserKe(-1)} aria-label="Geser ke ruangan sebelumnya" title="Geser ke kiri" className={panah} style={{ left: DATE_W + 8 }}><span className="material-symbols-outlined">chevron_left</span></button>}
    {geser.kanan && <button type="button" onClick={() => geserKe(1)} aria-label="Geser ke ruangan berikutnya" title="Geser ke kanan" className={`${panah} right-3`}><span className="material-symbols-outlined">chevron_right</span></button>}
    <div ref={scrollRef} onPointerDown={mulaiSeret} onPointerMove={saatSeret} onPointerUp={selesaiSeret} onPointerCancel={selesaiSeret}
      className={`relative max-h-[72vh] overflow-auto overscroll-contain ${geser.kiri || geser.kanan ? (menyeret ? 'cursor-grabbing select-none' : 'cursor-grab') : ''}`}>
      <table className="w-full table-fixed border-separate border-spacing-0" style={{ minWidth: DATE_W + rooms.length * COL_W }}>
        <colgroup>
          <col style={{ width: DATE_W }} />
          {rooms.map((room) => <col key={room} style={{ width: COL_W }} />)}
        </colgroup>
        <thead ref={headRef}>
          <tr>
            <th className="sticky top-0 left-0 z-30 bg-slate-100 border-b-2 border-r border-slate-200 text-left px-3 py-3 text-[11px] font-bold text-slate-700 uppercase tracking-wider w-[150px] min-w-[150px]">Tanggal</th>
            {rooms.map((room) => (
              <th key={room} title={judulRuang(room)} className="sticky top-0 z-20 bg-slate-100 border-b-2 border-l border-slate-200 text-left px-3 py-2 text-[11px] font-bold text-slate-700 align-top">
                {/* Klik = popup foto & fasilitas ruangan (dikelola admin di menu Foto & Fasilitas Ruang) */}
                <RuangFotoButton room={room} className="group w-full flex items-center gap-2.5 text-left rounded-lg -mx-1 px-1 py-0.5 hover:bg-white/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-dinas/30">
                  <RuangThumb room={room} className="w-9 h-9 rounded-lg ring-1 ring-black/5 transition group-hover:ring-kuningan/60" iconClass="text-[17px]" />
                  <span className="min-w-0">
                    <span className="line-clamp-2 leading-snug">{judulRuang(room)}</span>
                    <span className="block text-[10px] font-semibold normal-case tracking-normal text-slate-500 group-hover:text-dinas">Lihat foto & fasilitas</span>
                  </span>
                </RuangFotoButton>
              </th>
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
                const rowBg = isToday ? 'bg-sky-50/70' : cuti ? 'bg-amber-50/60' : weekend ? 'bg-red-50/40' : '';
                return (
                  <tr key={date} data-day={date}>
                    <td className={`sticky left-0 z-10 border-b border-r border-slate-200 px-3 py-2.5 align-top w-[150px] min-w-[150px] ${isToday ? 'bg-sky-100' : cuti ? 'bg-amber-100' : weekend ? 'bg-red-50' : 'bg-white'}`}>
                      <div className={`text-xs font-bold ${cuti ? 'text-amber-700' : weekend ? 'text-red-600' : 'text-slate-800'}`}>{DAY_NAMES[idx]}</div>
                      <div className="text-[11px] text-slate-500">{d.getDate()} {d.toLocaleString('id-ID', { month: 'short' })} {d.getFullYear()}</div>
                      {isToday && <div className="mt-1 inline-block px-1.5 py-0.5 rounded bg-[#1e3a5f] text-white text-[9px] font-bold">HARI INI</div>}
                      {cuti && <div className="mt-1 text-[9px] font-bold text-amber-800 leading-tight">{cuti}</div>}
                    </td>
                    {rooms.map((room) => {
                      const list = cells.get(`${date}|${room}`) || [];
                      return (
                        <td key={room} className={`border-b border-l border-slate-200 p-1.5 align-top ${rowBg}`}>
                          <div className="group/cell space-y-1.5 min-h-[44px]">
                            {list.map((x) => renderItem(x, date))}
                            {onAddBooking && (list.length ? (
                              <button type="button" onClick={() => onAddBooking(date, room)} title={`Booking ${room} · ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                                className="cell-add w-full flex items-center justify-center gap-1 py-1 rounded-md border border-dashed border-slate-300 text-[10px] font-semibold text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-[#1e3a5f]">
                                <span className="material-symbols-outlined text-[14px]">add</span>Tambah
                              </button>
                            ) : (
                              <button type="button" onClick={() => onAddBooking(date, room)} title={`Booking ${room} · ${d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                                className="cell-add w-full min-h-[44px] flex items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 text-[11px] font-semibold text-slate-500 hover:border-sky-300 hover:bg-sky-50 hover:text-[#1e3a5f]">
                                <span className="material-symbols-outlined text-[16px]">add</span>Booking
                              </button>
                            ))}
                          </div>
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
    </div>
  );
}
