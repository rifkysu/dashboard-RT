import React, { useState } from 'react';
import { holidayLabel } from '../utils/holidays';

const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const DAYS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const todayISO = () => { const t = new Date(); return iso(t.getFullYear(), t.getMonth(), t.getDate()); };
const shortLabel = (s) => { const d = new Date(`${s}T00:00:00`); return `${DAYS[(d.getDay() + 6) % 7]}, ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)} ${d.getFullYear()}`; };

// Kalender pilih banyak tanggal (boleh loncat-loncat): klik tanggal untuk memilih / membatalkan pilihan.
// value = array 'YYYY-MM-DD' terurut. Tanggal yang berurutan nanti digabung backend jadi satu booking multi-hari.
export default function MultiDatePicker({ value, onChange, max = 60 }) {
  const [view, setView] = useState(() => { const d = new Date(`${value[0] || todayISO()}T00:00:00`); return { y: d.getFullYear(), m: d.getMonth() }; });
  const selected = new Set(value);
  const today = todayISO();
  const first = new Date(view.y, view.m, 1);
  const lead = (first.getDay() + 6) % 7; // kolom pertama = Senin
  const total = new Date(view.y, view.m + 1, 0).getDate();
  const cells = [...Array(lead).fill(null), ...Array.from({ length: total }, (_, i) => i + 1)];
  const shift = (n) => setView(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  function toggle(day) {
    const key = iso(view.y, view.m, day);
    if (selected.has(key)) onChange(value.filter((x) => x !== key));
    else if (value.length < max) onChange([...value, key].sort());
  }

  return (
    <div className="rounded-xl border border-slate-300 bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya" className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">‹</button>
        <div className="text-sm font-bold text-slate-800">{MONTHS[view.m]} {view.y}</div>
        <button type="button" onClick={() => shift(1)} aria-label="Bulan berikutnya" className="w-8 h-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600">›</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAYS.map((d, i) => <div key={d} className={`text-[10px] font-bold py-1 ${i > 4 ? 'text-red-500' : 'text-slate-500'}`}>{d}</div>)}
        {cells.map((day, i) => {
          if (!day) return <div key={`x${i}`} />;
          const key = iso(view.y, view.m, day);
          const on = selected.has(key);
          const holiday = holidayLabel(key);
          const red = i % 7 > 4 || holiday;
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(day)}
              aria-pressed={on}
              title={holiday || undefined}
              className={`h-9 rounded-lg text-sm font-semibold transition ${on ? 'bg-slate-900 text-white' : red ? 'text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-100'} ${key === today && !on ? 'ring-1 ring-violet-400' : ''}`}
            >
              {day}
            </button>
          );
        })}
      </div>
      <div className="mt-3 pt-3 border-t border-slate-200">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-slate-700">{value.length ? `${value.length} tanggal dipilih` : 'Klik tanggal di kalender (boleh loncat-loncat)'}</span>
          {value.length > 0 && <button type="button" onClick={() => onChange([])} className="font-semibold text-red-600 hover:underline">Hapus semua</button>}
        </div>
        {value.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2 max-h-28 overflow-y-auto">
            {value.map((d) => (
              <span key={d} className={`inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full border text-[11px] font-semibold ${holidayLabel(d) ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-slate-50 border-slate-200 text-slate-700'}`} title={holidayLabel(d) || undefined}>
                {shortLabel(d)}
                <button type="button" onClick={() => onChange(value.filter((x) => x !== d))} aria-label={`Hapus ${shortLabel(d)}`} className="w-4 h-4 rounded-full hover:bg-black/10 leading-none">×</button>
              </span>
            ))}
          </div>
        )}
        {value.length >= max && <p className="text-[11px] text-amber-700 font-semibold mt-2">Maksimal {max} tanggal per pengajuan.</p>}
      </div>
    </div>
  );
}
