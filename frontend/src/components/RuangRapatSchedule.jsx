import React, { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import useMonthSchedule from '../hooks/useMonthSchedule';
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
export default function RuangRapatSchedule() {
  const s = useMonthSchedule('/ruang-rapat/public-schedule');
  const rooms = useMemo(() => [...ROOMS, ...[...new Set(s.items.map((x) => x.room).filter((r) => r && !ROOMS.includes(r)))].sort()], [s.items]);
  const [params, setParams] = useSearchParams();
  const picked = rooms.includes(params.get('ruang')) ? params.get('ruang') : '';
  function pickRoom(room) {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (room) next.set('ruang', room); else next.delete('ruang');
      return next;
    }, { replace: true, preventScrollReset: true });
  }
  const last = s.months[s.months.length - 1];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden text-slate-800">
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
      <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-slate-500">Ruangan</span>
        <div className="flex gap-1.5 overflow-x-auto pb-1 sm:pb-0 -mx-1 px-1" role="group" aria-label="Pilih ruangan">
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
      </div>
      {s.error && <div className="m-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{s.error}</div>}
      <RoomDateGrid
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
