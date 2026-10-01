import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import useRuangRapatLive from '../hooks/useRuangRapatLive';
import { useAuth } from '../context/AuthContext';
import useLive from '../hooks/useLive';

const fallback = { pemeliharaan: { pending: 0, on_progress: 0, selesai: 0 }, pengadaan: { pending: 0, on_progress: 0, selesai: 0 }, kendaraan: { total: 0, belum_bayar_pajak: 0, pajak_segera: 0, pajak_segera_list: [] }, ruang_rapat: { jam: '', kosong_sekarang: 0, total_ruang: 0, rooms: [] } };

// Warna hanya dipakai untuk arti status, sama dengan halaman Pemeliharaan/Pengadaan:
// merah = perlu tindakan (Pending), kuning = berjalan (On Progress), hijau = beres (Selesai).
const TONE = {
  red: { chip: 'bg-red-50 text-red-700', bar: 'bg-red-500', text: 'text-red-700' },
  amber: { chip: 'bg-amber-50 text-amber-700', bar: 'bg-amber-400', text: 'text-amber-700' },
  emerald: { chip: 'bg-emerald-50 text-emerald-700', bar: 'bg-emerald-500', text: 'text-emerald-700' },
  slate: { chip: 'bg-slate-100 text-slate-600', bar: 'bg-slate-300', text: 'text-slate-600' },
};
const statusBadge = {
  pending: 'bg-red-50 text-red-700 border border-red-200',
  on_progress: 'bg-amber-50 text-amber-700 border border-amber-200',
  selesai: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
};
const statusLabel = { pending: 'Pending', on_progress: 'On Progress', selesai: 'Selesai' };

const sapaan = () => { const h = new Date().getHours(); return h < 11 ? 'Selamat pagi' : h < 15 ? 'Selamat siang' : h < 18 ? 'Selamat sore' : 'Selamat malam'; };
const fmtShort = (v) => new Date(`${v}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const fmtTime = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
const fmtWaktu = (v) => {
  const d = new Date(v);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `Hari ini, ${fmtTime(d)}` : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// Satu sel di strip ringkasan. `value` null = data belum pernah termuat, tampil "–" (bukan 0).
function StatCell({ value, label, hint, tone, to }) {
  const navigate = useNavigate();
  const Tag = to ? 'button' : 'div';
  return (
    <Tag onClick={to ? () => navigate(to) : undefined} className={`text-left bg-white px-5 py-4 ${to ? 'hover:bg-slate-50 transition-colors' : ''}`}>
      <div className="text-xs font-semibold text-slate-600">{label}</div>
      <div className={`mt-1.5 text-3xl font-bold leading-none tabular-nums ${value ? TONE[tone].text : 'text-slate-900'}`}>{value ?? '–'}</div>
      {hint && <div className="text-[11px] text-slate-500 mt-1.5">{hint}</div>}
    </Tag>
  );
}

function ModuleCard({ icon, title, desc, badge, badgeTone = 'slate', to, children }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} className="text-left group bg-white border border-slate-200 rounded-lg p-5 flex flex-col hover:border-slate-400 transition-colors">
      <div className="flex justify-between items-center gap-3">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 whitespace-nowrap">
          <span className="material-symbols-outlined text-[20px] text-slate-500">{icon}</span>{title}
        </h2>
        {badge && <span className={`text-[11px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${TONE[badgeTone].chip}`}>{badge}</span>}
      </div>
      <p className="text-xs text-slate-500 mt-1 leading-5">{desc}</p>
      {children}
      <div className="mt-auto pt-4 text-xs font-semibold text-[#1e3a5f] group-hover:underline">Buka {title} →</div>
    </button>
  );
}

// Komposisi status permintaan: satu batang bersegmen + jumlah tiap status.
function StatusMix({ data }) {
  const parts = [
    { k: 'pending', n: data.pending, tone: 'red' },
    { k: 'on_progress', n: data.on_progress, tone: 'amber' },
    { k: 'selesai', n: data.selesai, tone: 'emerald' },
  ];
  const total = parts.reduce((s, p) => s + p.n, 0);
  return (
    <div className="mt-3">
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
        {total > 0 && parts.map((p) => p.n > 0 && <div key={p.k} className={TONE[p.tone].bar} style={{ width: `${(p.n / total) * 100}%` }}></div>)}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600">
        {parts.map((p) => (
          <span key={p.k} className="inline-flex items-center gap-1 whitespace-nowrap">
            <span className={`w-2 h-2 rounded-full ${TONE[p.tone].bar}`}></span>
            <b className="text-slate-900 tabular-nums">{p.n}</b> {statusLabel[p.k]}
          </span>
        ))}
      </div>
    </div>
  );
}

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
    <ul className="mt-3 rounded-lg border border-slate-200 divide-y divide-slate-100">
      {info.rooms.map((r) => (
        <li key={r.room} className="flex items-center justify-between gap-2 text-[11px] px-2.5 py-1.5" title={r.dipakai ? `Dipakai: ${r.agenda}` : r.berikutnya ? `Booking berikutnya jam ${r.berikutnya}` : 'Tidak ada booking lagi hari ini'}>
          <span className="font-semibold text-slate-700 truncate">{r.room}</span>
          {r.dipakai
            ? <span className="shrink-0 font-bold text-red-600">Dipakai s/d {r.sampai}</span>
            : <span className="shrink-0 font-bold text-emerald-700">Kosong{r.berikutnya ? ` s/d ${r.berikutnya}` : ''}</span>}
        </li>
      ))}
    </ul>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [summary, setSummary] = useState(fallback);
  const [activities, setActivities] = useState([]);
  // null = belum pernah berhasil dimuat; Date = waktu terakhir berhasil.
  const [loadedAt, setLoadedAt] = useState(null);
  const [summaryError, setSummaryError] = useState(false);
  const [activitiesState, setActivitiesState] = useState('loading');
  const [refreshing, setRefreshing] = useState(false);

  function load() {
    setRefreshing(true);
    const s = api.get('/dashboard/summary')
      .then((r) => {
        setSummary({ ...fallback, ...r.data, kendaraan: { ...fallback.kendaraan, ...(r.data?.kendaraan || {}) }, ruang_rapat: { ...fallback.ruang_rapat, ...(r.data?.ruang_rapat || {}) } });
        setLoadedAt(new Date());
        setSummaryError(false);
      })
      .catch(() => setSummaryError(true));
    const a = api.get('/dashboard/activities')
      .then((r) => { setActivities(r.data.data || []); setActivitiesState('ok'); })
      .catch(() => setActivitiesState((prev) => (prev === 'ok' ? 'ok' : 'error')));
    Promise.allSettled([s, a]).then(() => setRefreshing(false));
  }
  useEffect(() => {
    load();
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, []);
  useRuangRapatLive(load);
  // Angka & aktivitas Pemeliharaan/Pengadaan/pajak kendaraan ikut realtime.
  useLive(['pemeliharaan', 'pengadaan', 'kendaraan'], load);

  const ready = loadedAt !== null;
  const { pemeliharaan: pm, pengadaan: pg, kendaraan: kd, ruang_rapat: rr } = summary;
  const totalPending = pm.pending + pg.pending;
  const totalProgress = pm.on_progress + pg.on_progress;
  const totalSemua = totalPending + totalProgress + pm.selesai + pg.selesai;
  const pajakTindakan = kd.belum_bayar_pajak + kd.pajak_segera;
  const v = (n) => (ready ? n : null);

  return (
    <div className="menu-page menu-dashboard relative">
      <div className="menu-hero mb-6">
        <div>
          <span className="menu-kicker">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <h1>{sapaan()}{user?.nama_lengkap ? `, ${user.nama_lengkap.split(' ')[0]}` : ''}</h1>
          <p className="text-sm mt-1">Ringkasan permintaan, pajak kendaraan, dan ruang rapat hari ini.</p>
        </div>
      </div>

      {summaryError && (
        <div role="alert" className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span className="material-symbols-outlined text-[20px]">error</span>
          <span className="flex-1 min-w-[200px]">
            {ready ? `Gagal memperbarui data. Angka di bawah adalah data terakhir pukul ${fmtTime(loadedAt)}.` : 'Gagal memuat data dashboard. Periksa koneksi lalu coba lagi.'}
          </span>
          <button onClick={load} disabled={refreshing} className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-xs font-bold hover:bg-red-100 disabled:opacity-60">
            {refreshing ? 'Memuat…' : 'Coba lagi'}
          </button>
        </div>
      )}

      {/* Ringkasan: hal yang perlu ditindaklanjuti lebih dulu */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200 rounded-lg overflow-hidden mb-7">
        <StatCell tone="red" value={v(totalPending)} label="Permintaan Pending" hint={ready ? `Pemeliharaan ${pm.pending} · Pengadaan ${pg.pending}` : 'Menunggu diproses'} />
        <StatCell tone="amber" value={v(totalProgress)} label="On Progress" hint={ready ? `Dari ${totalSemua} total permintaan` : 'Sedang berjalan'} />
        <StatCell tone={kd.belum_bayar_pajak ? 'red' : 'amber'} value={v(pajakTindakan)} label="Pajak Kendaraan Perlu Tindakan" hint={ready ? `${kd.belum_bayar_pajak} belum bayar · ${kd.pajak_segera} jatuh tempo ≤ 14 hari` : 'Belum bayar / segera jatuh tempo'} to="/kendaraan" />
        <StatCell tone="emerald" value={v(rr.kosong_sekarang)} label="Ruang Rapat Kosong" hint={ready && rr.total_ruang ? `Dari ${rr.total_ruang} ruang · pukul ${rr.jam}` : 'Saat ini'} to="/ruang-rapat" />
      </div>

      {/* Menu layanan */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <ModuleCard icon="build" title="Pemeliharaan" desc="Permintaan perbaikan gedung dan fasilitas." badge={ready ? `${pm.pending} pending` : null} badgeTone={pm.pending ? 'red' : 'slate'} to="/pemeliharaan">
          <StatusMix data={pm} />
        </ModuleCard>
        <ModuleCard icon="shopping_cart" title="Pengadaan" desc="Status barang dan jasa dalam proses pengadaan." badge={ready ? `${pg.pending} pending` : null} badgeTone={pg.pending ? 'red' : 'slate'} to="/pengadaan">
          <StatusMix data={pg} />
        </ModuleCard>
        <ModuleCard icon="directions_car" title="Kendaraan" desc="Data kendaraan dinas dan jadwal pajaknya." badge={ready ? (kd.belum_bayar_pajak ? `${kd.belum_bayar_pajak} belum bayar pajak` : `${kd.total} kendaraan`) : null} badgeTone={kd.belum_bayar_pajak ? 'red' : 'slate'} to="/kendaraan">
          {ready && <PajakSegera list={kd.pajak_segera_list || []} />}
        </ModuleCard>
        <ModuleCard icon="calendar_month" title="Ruang Rapat" desc="Jadwal dan status ruang rapat hari ini." badge={ready && rr.total_ruang ? `${rr.kosong_sekarang}/${rr.total_ruang} kosong` : null} badgeTone={ready && rr.total_ruang && !rr.kosong_sekarang ? 'red' : 'emerald'} to="/ruang-rapat">
          {ready && <RuangStatus info={rr} />}
        </ModuleCard>
      </div>

      {/* Aktivitas terbaru */}
      <div className="mt-6 bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Aktivitas Terbaru</h2>
            <p className="text-[11px] text-slate-500">20 perubahan terakhir di Pemeliharaan dan Pengadaan{loadedAt ? ` · diperbarui ${fmtTime(loadedAt)}` : ''}</p>
          </div>
          <button onClick={load} disabled={refreshing} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-60">
            <span className={`material-symbols-outlined text-[16px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>{refreshing ? 'Memuat…' : 'Refresh'}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Modul', 'Deskripsi', 'Status', 'Waktu'].map((x) => <th key={x} className="text-left px-5 py-3 uppercase tracking-wide text-slate-600 font-semibold">{x}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activities.length ? activities.map((a, i) => (
                <tr key={`${a.kode}-${i}`} className="hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-semibold text-slate-700 whitespace-nowrap">{a.modul}</td>
                  <td className="px-5 py-3 text-slate-600 min-w-[220px]"><span className="font-mono text-slate-400 mr-2">{a.kode}</span>{a.deskripsi}</td>
                  <td className="px-5 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${statusBadge[a.status] || statusBadge.pending}`}>{statusLabel[a.status] || a.status}</span></td>
                  <td className="px-5 py-3 text-slate-500 whitespace-nowrap">{a.waktu ? fmtWaktu(a.waktu) : '-'}</td>
                </tr>
              )) : (
                <tr><td colSpan={4} className="px-5 py-6 text-center text-slate-400">
                  {activitiesState === 'loading' ? 'Memuat aktivitas…' : activitiesState === 'error' ? 'Gagal memuat aktivitas. Tekan Refresh untuk mencoba lagi.' : 'Belum ada aktivitas.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
