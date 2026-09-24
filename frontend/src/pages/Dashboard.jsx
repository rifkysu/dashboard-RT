import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import useRuangRapatLive from '../hooks/useRuangRapatLive';

const fallback = { pemeliharaan: { pending: 0, on_progress: 0, selesai: 0 }, pengadaan: { pending: 0, on_progress: 0, selesai: 0 }, kendaraan: { total: 0, belum_bayar_pajak: 0, pajak_segera: 0, pajak_segera_list: [] }, ruang_rapat: { jam: '', kosong_sekarang: 0, total_ruang: 0, rooms: [] } };

const TONES = {
  indigo: 'from-indigo-600 to-blue-600',
  amber: 'from-amber-500 to-orange-600',
  emerald: 'from-emerald-500 to-teal-600',
  violet: 'from-violet-600 to-fuchsia-600',
};
const SOFT = {
  indigo: 'bg-indigo-50 text-indigo-700',
  amber: 'bg-amber-50 text-amber-700',
  emerald: 'bg-emerald-50 text-emerald-700',
  violet: 'bg-violet-50 text-violet-700',
};
const statusBadge = {
  pending: 'bg-red-50 text-red-700 border border-red-200',
  on_progress: 'bg-amber-50 text-amber-700 border border-amber-200',
  selesai: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};
const statusLabel = { pending: 'Pending', on_progress: 'On Progress', selesai: 'Selesai' };

function StatCard({ icon, value, label, hint, tone }) {
  return (
    <div className="relative overflow-hidden bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-sm">
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${TONES[tone]}`}></div>
      <span className={`w-11 h-11 rounded-xl flex items-center justify-center ${SOFT[tone]}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <div className="mt-4 text-3xl font-extrabold text-slate-900 leading-none">{value}</div>
      <div className="text-xs font-semibold text-slate-600 mt-2">{label}</div>
      {hint && <div className="text-[11px] text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

function ModuleCard({ icon, title, desc, badge, to, tone, progress, extra }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} className="text-left group relative overflow-hidden bg-white border-2 border-slate-200 rounded-3xl p-5 min-h-[190px] flex flex-col shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-indigo-300 transition-all duration-300">
      <div className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${TONES[tone]}`}></div>
      <div className="flex justify-between items-start">
        <span className={`w-12 h-12 rounded-2xl flex items-center justify-center ${SOFT[tone]} group-hover:scale-105 transition`}>
          <span className="material-symbols-outlined text-[25px]">{icon}</span>
        </span>
        <span className={`text-[11px] font-bold px-3 py-1.5 rounded-full ${SOFT[tone]}`}>{badge}</span>
      </div>
      <h2 className="text-lg font-bold mt-5 text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-1 leading-5">{desc}</p>
      {extra}
      {progress != null && (
        <div className="mt-3">
          <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full bg-gradient-to-r ${TONES[tone]}`} style={{ width: `${progress}%` }}></div>
          </div>
          <div className="text-[10px] text-slate-400 mt-1">{progress}% selesai</div>
        </div>
      )}
      <div className="mt-auto pt-4 flex items-center text-xs font-bold text-slate-600 group-hover:text-slate-900">
        Buka Menu <span className="material-symbols-outlined text-[16px] ml-1 group-hover:translate-x-1 transition">arrow_forward</span>
      </div>
    </button>
  );
}

const fmtShort = (v) => new Date(`${v}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

// Peringatan pajak kendaraan jatuh tempo <= 2 minggu (H-14) di kotak Kendaraan.
function PajakSegera({ list }) {
  if (!list.length) {
    return <div className="mt-3 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">✓ Tidak ada pajak jatuh tempo 2 minggu ke depan</div>;
  }
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2">
      <div className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
        <span className="material-symbols-outlined text-[14px]">schedule</span>{list.length} pajak jatuh tempo ≤ 2 minggu
      </div>
      <ul className="mt-1.5 space-y-1">
        {list.slice(0, 3).map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="font-semibold text-slate-700 truncate">{k.plate}</span>
            <span className={`shrink-0 font-bold ${k.sisa_hari <= 3 ? 'text-red-600' : 'text-amber-700'}`}>{k.sisa_hari === 0 ? 'Hari ini' : `H-${k.sisa_hari}`} · {fmtShort(k.waktu_pajak)}</span>
          </li>
        ))}
      </ul>
      {list.length > 3 && <div className="mt-1 text-[10px] text-amber-700">+{list.length - 3} kendaraan lainnya</div>}
    </div>
  );
}

// Status tiap ruang rapat saat ini di kotak Ruang Rapat: Kosong / Dipakai s/d jam X.
function RuangStatus({ info }) {
  if (!info.rooms.length) return null;
  return (
    <div className={`mt-3 rounded-lg border px-2.5 py-2 ${info.kosong_sekarang > 0 ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
      <div className={`text-[11px] font-bold flex items-center gap-1 ${info.kosong_sekarang > 0 ? 'text-emerald-800' : 'text-red-700'}`}>
        <span className="material-symbols-outlined text-[14px]">{info.kosong_sekarang > 0 ? 'meeting_room' : 'event_busy'}</span>
        {info.kosong_sekarang > 0 ? `${info.kosong_sekarang} ruang kosong sekarang` : 'Semua ruang sedang dipakai'}{info.jam && ` · ${info.jam}`}
      </div>
      <ul className="mt-1.5 space-y-1">
        {info.rooms.map((r) => (
          <li key={r.room} className="flex items-center justify-between gap-2 text-[11px]" title={r.dipakai ? `Dipakai: ${r.agenda}` : r.berikutnya ? `Booking berikutnya jam ${r.berikutnya}` : 'Tidak ada booking lagi hari ini'}>
            <span className="font-semibold text-slate-700 truncate">{r.room}</span>
            {r.dipakai
              ? <span className="shrink-0 font-bold text-red-600">Dipakai s/d {r.sampai}</span>
              : <span className="shrink-0 font-bold text-emerald-700">Kosong{r.berikutnya ? ` · s/d ${r.berikutnya}` : ''}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(fallback);
  const [activities, setActivities] = useState([]);

  function load() {
    api.get('/dashboard/summary').then((r) => setSummary({ ...fallback, ...r.data, kendaraan: { ...fallback.kendaraan, ...(r.data?.kendaraan || {}) }, ruang_rapat: { ...fallback.ruang_rapat, ...(r.data?.ruang_rapat || {}) } })).catch(() => {});
    api.get('/dashboard/activities').then((r) => setActivities(r.data.data || [])).catch(() => {});
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);
  useRuangRapatLive(load);

  const totalPending = summary.pemeliharaan.pending + summary.pengadaan.pending;
  const totalProgress = summary.pemeliharaan.on_progress + summary.pengadaan.on_progress;
  const totalSelesai = summary.pemeliharaan.selesai + summary.pengadaan.selesai;
  const totalSemua = totalPending + totalProgress + totalSelesai;
  const pct = (m) => { const t = m.pending + m.on_progress + m.selesai; return t ? Math.round((m.selesai / t) * 100) : 0; };

  return (
    <div className="menu-page menu-dashboard max-w-[1180px] mx-auto" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="menu-hero mb-6">
        <div>
          <span className="menu-kicker">PORTAL • BIRO UMUM</span>
          <h1 className="text-3xl font-bold">Selamat Datang di Dashboard</h1>
          <p className="text-sm mt-1">Pusat monitoring layanan, asset, pengadaan, pemeliharaan, dan ruang rapat.</p>
        </div>
        <div className="menu-hero-icon"><span className="material-symbols-outlined">dashboard</span></div>
      </div>

      {/* KPI stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-7">
        <StatCard tone="violet" icon="apps" value={totalSemua} label="Total Permintaan" hint="Pemeliharaan + Pengadaan" />
        <StatCard tone="amber" icon="hourglass_top" value={totalPending} label="Pending" hint="Menunggu diproses" />
        <StatCard tone="indigo" icon="autorenew" value={totalProgress} label="On Progress" hint="Sedang berjalan" />
        <StatCard tone="emerald" icon="task_alt" value={totalSelesai} label="Selesai" hint="Sudah tuntas" />
      </div>

      <div className="mb-5">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-bold mb-3">
          <span className="material-symbols-outlined text-[15px]">auto_awesome</span>Portal Administrasi Biro Umum
        </div>
        <p className="text-sm text-slate-500 mt-1">Pilih layanan yang ingin kamu kelola hari ini.</p>
      </div>

      {/* Module cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <ModuleCard tone="emerald" icon="build" title="Pemeliharaan" desc="Permintaan perbaikan gedung dan fasilitas." badge={`${summary.pemeliharaan.pending} Pending`} to="/pemeliharaan" progress={pct(summary.pemeliharaan)} />
        <ModuleCard tone="amber" icon="shopping_cart" title="Pengadaan" desc="Status barang dan jasa dalam proses pengadaan." badge={`Proses: ${summary.pengadaan.on_progress}`} to="/pengadaan" progress={pct(summary.pengadaan)} />
        <ModuleCard tone="indigo" icon="directions_car" title="Kendaraan" desc="Monitoring penggunaan kendaraan dinas." badge={summary.kendaraan.belum_bayar_pajak > 0 ? `${summary.kendaraan.belum_bayar_pajak} Belum Bayar Pajak` : 'Pajak Lunas Semua'} to="/kendaraan" extra={<PajakSegera list={summary.kendaraan.pajak_segera_list || []} />} />
        <ModuleCard tone="violet" icon="calendar_month" title="Ruang Rapat" desc="Jadwal penggunaan ruang rapat." badge={summary.ruang_rapat.total_ruang ? (summary.ruang_rapat.kosong_sekarang > 0 ? `${summary.ruang_rapat.kosong_sekarang} Ruang Kosong` : 'Semua Terpakai') : 'Agenda'} to="/ruang-rapat" extra={<RuangStatus info={summary.ruang_rapat} />} />
      </div>

      {/* Recent activity */}
      <div className="mt-6 bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-lg shadow-slate-200/40">
        <div className="px-5 py-4 border-b-2 border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Aktivitas Terbaru</h2>
          <button onClick={load} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900">
            <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr className="divide-x divide-slate-200">
                {['Modul', 'Deskripsi', 'Status', 'Waktu'].map((x) => <th key={x} className="text-left px-5 py-3 uppercase text-slate-600 font-semibold">{x}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.length ? activities.map((a, i) => (
                <tr key={i} className="divide-x divide-slate-100 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-semibold text-slate-700">{a.modul}</td>
                  <td className="px-5 py-3 text-slate-600">{a.kode} — {a.deskripsi}</td>
                  <td className="px-5 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold ${statusBadge[a.status] || statusBadge.pending}`}>{statusLabel[a.status] || a.status}</span></td>
                  <td className="px-5 py-3 text-slate-500">{a.waktu ? new Date(a.waktu).toLocaleString('id-ID') : '-'}</td>
                </tr>
              )) : <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">Belum ada aktivitas.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
