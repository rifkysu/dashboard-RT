import React from 'react';
import { useSearchParams } from 'react-router-dom';
import { judulRuang } from '../utils/ruang';
import useRuangInfo from '../hooks/useRuangInfo';
import { periodeMaintenance } from './RuangFoto';

// Menu per bagian (satuan kerja) untuk ruang rapat: jadwal pegawai, kiosk, landing, dan admin.
// Pilihan disimpan di URL (?bagian=Biro%20Umum, ?bagian=semua), jadi kiosk tiap satuan kerja bisa
// dibuka langsung dengan link bagiannya. Tanpa ?bagian -> bagian dari ?ruang (kalau ada), atau bagian pertama.
const SEMUA = 'semua';

// grup = [{ bagian, rooms }] dari useDaftarRuang(). Mengembalikan [bagian ('' = semua), setBagian, rooms bagian itu].
export function useBagian(grup) {
  const [params, setParams] = useSearchParams();
  const raw = params.get('bagian');
  const dariRuang = grup.find((g) => g.rooms.includes(params.get('ruang')))?.bagian;
  const bagian = raw === SEMUA ? '' : grup.some((g) => g.bagian === raw) ? raw : dariRuang ?? grup[0]?.bagian ?? '';
  const setBagian = (b) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    next.set('bagian', b || SEMUA);
    next.delete('ruang');
    return next;
  }, { replace: true, preventScrollReset: true });
  const rooms = bagian ? grup.find((g) => g.bagian === bagian)?.rooms || [] : grup.flatMap((g) => g.rooms);
  return [bagian, setBagian, rooms];
}

// Deretan tombol bagian. dark = untuk latar gelap (kiosk).
export default function BagianTabs({ grup, value, onChange, dark = false, className = '' }) {
  const total = grup.reduce((n, g) => n + g.rooms.length, 0);
  const opsi = [{ bagian: '', label: 'Semua bagian', n: total }, ...grup.map((g) => ({ bagian: g.bagian, label: g.bagian, n: g.rooms.length }))];
  const cls = (on) => (dark
    ? on ? 'bg-[#e4c27f] text-dinas-ink ring-[#e4c27f]' : 'bg-white/[.06] text-white/75 ring-white/15 hover:bg-white/10 hover:text-white'
    : on ? 'bg-slate-900 text-white ring-slate-900' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50');
  return (
    <div className={`flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 min-w-0 ${className}`} role="group" aria-label="Pilih bagian / satuan kerja">
      {opsi.map((o) => (
        <button key={o.bagian || SEMUA} type="button" onClick={() => onChange(o.bagian)} aria-pressed={value === o.bagian}
          className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full ring-1 text-xs font-semibold transition ${cls(value === o.bagian)}`}>
          {!o.bagian && <span className="material-symbols-outlined text-[15px]">apartment</span>}
          {o.label}
          <span className={`tabular-nums text-[10px] font-bold px-1.5 rounded-full ${value === o.bagian ? (dark ? 'bg-dinas-ink/15' : 'bg-white/20') : (dark ? 'bg-white/10' : 'bg-slate-100')}`}>{o.n}</span>
        </button>
      ))}
    </div>
  );
}

// Isi <select> ruangan, dikelompokkan per bagian. Ruangan lama yang sudah tidak ada di daftar
// (mis. booking lama setelah ruangannya dihapus) tetap ditampilkan supaya pilihan tidak hilang.
// Ruangan yang diblokir maintenance tanpa batas tanggal tidak bisa dipilih (kecuali memang ruangan booking yang
// sedang diedit). Blokir bertanggal hanya diberi label periodenya; tanggal yang kena ditolak server saat disimpan.
export function RuangOptions({ grup, value }) {
  const { info } = useRuangInfo();
  const ada = !value || grup.some((g) => g.rooms.includes(value));
  return (
    <>
      {!ada && <option value={value}>{judulRuang(value)}</option>}
      {grup.map((g) => (
        <optgroup key={g.bagian} label={g.bagian}>
          {g.rooms.map((r) => {
            const d = info?.[r];
            const periode = d?.maintenance ? periodeMaintenance(d) : '';
            const tutup = d?.maintenance && !periode;
            return <option key={r} value={r} disabled={tutup && r !== value}>{judulRuang(r)}{tutup ? ' — Maintenance (tidak bisa dibooking)' : periode ? ` — Maintenance ${periode}` : ''}</option>;
          })}
        </optgroup>
      ))}
    </>
  );
}
