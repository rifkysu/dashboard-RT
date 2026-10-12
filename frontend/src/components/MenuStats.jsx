import React from 'react';

// Deret kartu ringkasan di bawah header menu (Pemeliharaan, Pengadaan, Kendaraan, Ruang Rapat).
// items: [{ key, icon, label, value, hint, tone, active, onClick }]
//   tone   -> warna arti status: red / amber / emerald / dinas (netral)
//   onClick-> kartu jadi tombol filter cepat; `active` menandai filter yang sedang dipakai.
const TONE = {
  red: { chip: 'bg-red-50 text-red-700', bar: 'bg-red-500', text: 'text-red-700' },
  amber: { chip: 'bg-amber-50 text-amber-700', bar: 'bg-amber-400', text: 'text-amber-700' },
  emerald: { chip: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  dinas: { chip: 'bg-dinas-soft text-dinas', bar: 'bg-dinas', text: 'text-slate-900' },
};

export default function MenuStats({ items }) {
  return (
    <div className={`grid grid-cols-2 ${items.length > 3 ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-3 sm:gap-4 mb-5`}>
      {items.map((it, i) => {
        const t = TONE[it.tone] || TONE.dinas;
        const Tag = it.onClick ? 'button' : 'div';
        return (
          <Tag key={it.key} type={it.onClick ? 'button' : undefined} onClick={it.onClick} aria-pressed={it.onClick ? Boolean(it.active) : undefined}
            style={{ '--dash-delay': `${i * 50}ms` }}
            className={`menu-stat dash-rise group text-left bg-white border border-slate-200 rounded-xl p-3.5 sm:p-4 flex items-center gap-3 ${it.onClick ? 'dash-lift' : ''} ${it.active ? 'is-active' : ''}`}>
            <span className={`dash-stat-bar ${t.bar}`}></span>
            <span className={`shrink-0 w-10 h-10 sm:w-11 sm:h-11 rounded-xl flex items-center justify-center ${t.chip}`}>
              <span className="material-symbols-outlined text-[20px] sm:text-[22px]">{it.icon}</span>
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[11px] sm:text-xs font-semibold text-slate-600 truncate">{it.label}</span>
              <span className={`block mt-0.5 font-display text-2xl sm:text-[26px] font-extrabold leading-none tabular-nums ${it.value ? t.text : 'text-slate-900'}`}>{it.value ?? '–'}</span>
              {it.hint && <span className="block text-[10.5px] text-slate-500 mt-1 truncate">{it.hint}</span>}
            </span>
            {it.active && <span className="material-symbols-outlined text-[18px] text-dinas shrink-0">filter_alt</span>}
          </Tag>
        );
      })}
    </div>
  );
}
