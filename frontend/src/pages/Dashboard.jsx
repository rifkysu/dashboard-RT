import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';

const fallback = { pemeliharaan: { pending: 0, on_progress: 0, selesai: 0 }, pengadaan: { pending: 0, on_progress: 0, selesai: 0 } };

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

function ModuleCard({ icon, title, desc, badge, to, tone, progress }) {
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

export default function Dashboard() {
  const [summary, setSummary] = useState(fallback);
  const [activities, setActivities] = useState([]);

  function load() {
    api.get('/dashboard/summary').then((r) => setSummary(r.data)).catch(() => {});
    api.get('/dashboard/activities').then((r) => setActivities(r.data.data || [])).catch(() => {});
  }
  useEffect(load, []);

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
        <ModuleCard tone="indigo" icon="directions_car" title="Kendaraan" desc="Monitoring penggunaan kendaraan dinas." badge="Tersedia" to="/kendaraan" />
        <ModuleCard tone="violet" icon="calendar_month" title="Ruang Rapat" desc="Jadwal penggunaan ruang rapat." badge="Agenda" to="/ruang-rapat" />
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
