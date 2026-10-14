import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import useRuangRapatLive from '../hooks/useRuangRapatLive';
import { useAuth, isAdminRole } from '../context/AuthContext';
import { useFeedback } from '../components/Feedback';
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

const fmtJam = (d) => d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }).replace('.', ':');

// Jam berjalan di panel sapaan. Komponen terpisah supaya detaknya tidak me-render ulang seluruh dashboard.
function LiveClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 10000); return () => clearInterval(t); }, []);
  return (
    <div className="dash-clock">
      <span className="material-symbols-outlined text-[18px]">schedule</span>
      <span className="font-display text-2xl font-extrabold tabular-nums leading-none">{fmtJam(now)}</span>
    </div>
  );
}

// Kartu ringkasan. `value` null = data belum pernah termuat, tampil "–" (bukan 0).
function StatCard({ icon, value, label, hint, tone, to, delay = 0 }) {
  const navigate = useNavigate();
  const Tag = to ? 'button' : 'div';
  const active = Boolean(value);
  const t = TONE[active ? tone : 'slate'];
  return (
    <Tag onClick={to ? () => navigate(to) : undefined} style={{ '--dash-delay': `${delay}ms` }}
      className={`dash-stat dash-rise group text-left bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3.5 ${to ? 'dash-lift' : ''}`}>
      <span className={`dash-stat-bar ${t.bar}`}></span>
      <span className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${t.chip}`}>
        <span className="material-symbols-outlined text-[22px]">{icon}</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center justify-between gap-2 text-xs font-semibold text-slate-600">
          {label}
          {to && <span className="material-symbols-outlined text-[16px] text-slate-400 transition-transform group-hover:translate-x-0.5">arrow_forward</span>}
        </span>
        <span className={`block mt-1 font-display text-[30px] font-extrabold leading-none tabular-nums ${active ? t.text : 'text-slate-900'}`}>{value ?? '–'}</span>
        {hint && <span className="block text-[11px] text-slate-500 mt-1.5 leading-4">{hint}</span>}
      </span>
    </Tag>
  );
}

function ModuleCard({ icon, title, desc, badge, badgeTone = 'slate', to, delay = 0, children }) {
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(to)} style={{ '--dash-delay': `${delay}ms` }}
      className="dash-module dash-rise dash-lift text-left group bg-white border border-slate-200 rounded-xl p-5 flex flex-col">
      <div className="flex justify-between items-start gap-3">
        <span className="dash-module-icon"><span className="material-symbols-outlined text-[22px]">{icon}</span></span>
        {badge && <span className={`text-[11px] font-bold px-2 py-1 rounded-md whitespace-nowrap ${TONE[badgeTone].chip}`}>{badge}</span>}
      </div>
      <h2 className="mt-3.5 text-base font-bold text-slate-900">{title}</h2>
      <p className="text-xs text-slate-500 mt-0.5 leading-5">{desc}</p>
      {children}
      <div className="mt-auto pt-4">
        <div className="dash-module-cta">Buka {title}<span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-x-1">arrow_forward</span></div>
      </div>
    </button>
  );
}

// Komposisi status permintaan: cincin donat + jumlah & persentase tiap status.
const RING = { red: '#ef4444', amber: '#f59e0b', emerald: '#10b981' };
function StatusMix({ data }) {
  const parts = [
    { k: 'pending', n: data.pending, tone: 'red' },
    { k: 'on_progress', n: data.on_progress, tone: 'amber' },
    { k: 'selesai', n: data.selesai, tone: 'emerald' },
  ];
  const total = parts.reduce((s, p) => s + p.n, 0);
  const R = 30; const C = 2 * Math.PI * R;
  let offset = 0;
  return (
    <div className="mt-4 flex items-center gap-4">
      <div className="relative w-[76px] h-[76px] shrink-0">
        <svg viewBox="0 0 76 76" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="38" cy="38" r={R} fill="none" strokeWidth="9" className="dash-ring-track" />
          {total > 0 && parts.map((p) => {
            if (!p.n) return null;
            const len = (p.n / total) * C;
            const el = <circle key={p.k} cx="38" cy="38" r={R} fill="none" stroke={RING[p.tone]} strokeWidth="9" strokeDasharray={`${len} ${C - len}`} strokeDashoffset={-offset} className="dash-ring-seg" />;
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-lg font-extrabold leading-none tabular-nums text-slate-900">{total}</span>
          <span className="text-[9px] font-semibold text-slate-500 mt-0.5">total</span>
        </div>
      </div>
      <ul className="flex-1 min-w-0 space-y-1.5 text-[11px]">
        {parts.map((p) => (
          <li key={p.k} className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${TONE[p.tone].bar}`}></span>
            <span className="text-slate-600 flex-1 truncate">{statusLabel[p.k]}</span>
            <b className="text-slate-900 tabular-nums">{p.n}</b>
            <span className="w-8 text-right text-slate-400 tabular-nums">{total ? Math.round((p.n / total) * 100) : 0}%</span>
          </li>
        ))}
      </ul>
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

// Khusus admin/kabag: akun Google (tamu) yang sudah mengisi form booking ruang rapat dari landing page.
// Akun yang spam bisa diblokir -> sesi tamu tsb langsung diputus & tidak bisa booking lagi.
function GuestAccounts() {
  const { confirm, alert, toast } = useFeedback();
  const [rows, setRows] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(null);
  function load() {
    api.get('/guest/admin/accounts')
      .then((r) => { setRows(r.data.data || []); setFailed(false); })
      .catch(() => setFailed(true));
  }
  useEffect(() => { load(); }, []);
  useRuangRapatLive(load);

  async function toggleBlock(g) {
    const blocked = !g.is_blocked;
    const ok = await confirm({ title: blocked ? 'Blokir akun tamu?' : 'Buka blokir akun tamu?', message: blocked ? `${g.nama} (${g.email}) tidak akan bisa login Google & mengajukan booking lagi. Booking yang sudah ada tidak terhapus.` : `${g.nama} (${g.email}) bisa login Google & mengajukan booking lagi.`, tone: blocked ? 'danger' : 'info', icon: blocked ? 'block' : 'lock_open', confirmText: blocked ? 'Blokir' : 'Buka blokir' });
    if (!ok) return;
    setBusy(g.id);
    try {
      const r = await api.put(`/guest/admin/accounts/${g.id}/block`, { blocked });
      setRows((list) => list.map((x) => (x.id === g.id ? { ...x, is_blocked: blocked } : x)));
      toast(r.data.message);
    } catch (e) {
      alert({ title: 'Gagal', message: e.response?.data?.message || 'Gagal mengubah status akun tamu.', tone: 'error' });
    } finally { setBusy(null); }
  }

  return (
    <div className="mt-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center gap-3">
        <span className="dash-module-icon dash-module-icon-sm"><span className="material-symbols-outlined text-[19px]">person_check</span></span>
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 leading-tight">Akun Google Pengaju Booking</h2>
          <p className="text-[11px] text-slate-500">Tamu yang login Google di landing page dan mengisi form booking ruang rapat{rows ? ` · ${rows.length} akun` : ''}</p>
        </div>
      </div>
      {rows && rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr><th className="text-left px-5 py-2.5 font-semibold">Akun</th><th className="text-left px-3 py-2.5 font-semibold">Booking terakhir</th><th className="text-center px-3 py-2.5 font-semibold">Total</th><th className="text-right px-5 py-2.5 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((g) => (
                <tr key={g.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3 min-w-[200px]">
                      {g.foto ? <img src={g.foto} alt="" referrerPolicy="no-referrer" className="w-8 h-8 rounded-full border border-slate-200" /> : <span className="w-8 h-8 rounded-full bg-dinas-soft text-dinas flex items-center justify-center text-xs font-bold">{(g.nama || '?')[0].toUpperCase()}</span>}
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-800 truncate">{g.nama}</div>
                        <div className="text-[11px] text-slate-500 truncate">{g.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3 min-w-[220px]">
                    {g.last_booking ? (
                      <>
                        <div className="text-[13px] font-semibold text-slate-800 truncate max-w-[280px]">{g.last_booking.title}{g.last_booking.cancelled && <span className="ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-50 text-red-700">Batal</span>}</div>
                        <div className="text-[11px] text-slate-500">{g.last_booking.room} · {fmtShort(g.last_booking.date)}{g.last_booking.end_date !== g.last_booking.date ? `–${fmtShort(g.last_booking.end_date)}` : ''} · {g.last_booking.start}–{g.last_booking.end} · diajukan {fmtWaktu(g.last_booking.created_at)}</div>
                      </>
                    ) : '-'}
                  </td>
                  <td className="px-3 py-3 text-center font-bold tabular-nums text-slate-700">{g.total_booking}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => toggleBlock(g)} disabled={busy === g.id} className={`inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold disabled:opacity-60 ${g.is_blocked ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'border border-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                      <span className="material-symbols-outlined text-[15px]">{g.is_blocked ? 'block' : 'shield_person'}</span>{g.is_blocked ? 'Diblokir · Buka' : 'Blokir'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-5 py-8 text-center">
          <span className="material-symbols-outlined text-[30px] text-slate-300">{failed ? 'cloud_off' : 'inbox'}</span>
          <p className="mt-1 text-xs text-slate-400">{failed ? 'Gagal memuat akun tamu.' : rows ? 'Belum ada tamu yang mengisi form booking.' : 'Memuat…'}</p>
        </div>
      )}
    </div>
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

  const perluTindakan = totalPending + pajakTindakan;
  const modulIcon = { Pemeliharaan: 'build', Pengadaan: 'shopping_cart' };

  return (
    <div className="menu-page menu-dashboard relative">
      <div className="menu-hero dash-hero mb-6">
        <div className="min-w-0">
          <span className="menu-kicker">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</span>
          <h1>{sapaan()}{user?.nama_lengkap ? `, ${user.nama_lengkap.split(' ')[0]}` : ''}</h1>
          <p className="text-sm mt-1">Ringkasan permintaan, pajak kendaraan, dan ruang rapat hari ini.</p>
          {ready && (
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="dash-hero-chip"><span className={`dash-dot ${perluTindakan ? 'bg-amber-400' : 'bg-emerald-400'}`}></span>{perluTindakan ? `${perluTindakan} hal perlu ditindaklanjuti` : 'Semua beres, tidak ada yang tertunda'}</span>
              {rr.total_ruang > 0 && <span className="dash-hero-chip"><span className="material-symbols-outlined text-[15px]">meeting_room</span>{rr.kosong_sekarang} dari {rr.total_ruang} ruang rapat kosong</span>}
            </div>
          )}
        </div>
        <LiveClock />
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
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-7">
        <StatCard delay={0} icon="pending_actions" tone="red" value={v(totalPending)} label="Permintaan Pending" hint={ready ? `Pemeliharaan ${pm.pending} · Pengadaan ${pg.pending}` : 'Menunggu diproses'} />
        <StatCard delay={60} icon="autorenew" tone="amber" value={v(totalProgress)} label="On Progress" hint={ready ? `Dari ${totalSemua} total permintaan` : 'Sedang berjalan'} />
        <StatCard delay={120} icon="receipt_long" tone={kd.belum_bayar_pajak ? 'red' : 'amber'} value={v(pajakTindakan)} label="Pajak Perlu Tindakan" hint={ready ? `${kd.belum_bayar_pajak} belum bayar · ${kd.pajak_segera} jatuh tempo ≤ 14 hari` : 'Belum bayar / segera jatuh tempo'} to="/kendaraan" />
        <StatCard delay={180} icon="meeting_room" tone="emerald" value={v(rr.kosong_sekarang)} label="Ruang Rapat Kosong" hint={ready && rr.total_ruang ? `Dari ${rr.total_ruang} ruang · pukul ${rr.jam}` : 'Saat ini'} to="/ruang-rapat" />
      </div>

      {/* Menu layanan */}
      <div className="mb-3">
        <h2 className="text-lg font-bold text-slate-900">Menu Layanan</h2>
        <p className="text-[11px] text-slate-500">Pilih menu untuk melihat detail dan mengelola data.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <ModuleCard delay={80} icon="build" title="Pemeliharaan" desc="Permintaan perbaikan gedung dan fasilitas." badge={ready ? `${pm.pending} pending` : null} badgeTone={pm.pending ? 'red' : 'slate'} to="/pemeliharaan">
          <StatusMix data={pm} />
        </ModuleCard>
        <ModuleCard delay={140} icon="shopping_cart" title="Pengadaan" desc="Status barang dan jasa dalam proses pengadaan." badge={ready ? `${pg.pending} pending` : null} badgeTone={pg.pending ? 'red' : 'slate'} to="/pengadaan">
          <StatusMix data={pg} />
        </ModuleCard>
        <ModuleCard delay={200} icon="directions_car" title="Kendaraan" desc="Data kendaraan dinas dan jadwal pajaknya." badge={ready ? (kd.belum_bayar_pajak ? `${kd.belum_bayar_pajak} belum bayar pajak` : `${kd.total} kendaraan`) : null} badgeTone={kd.belum_bayar_pajak ? 'red' : 'slate'} to="/kendaraan">
          {ready && <PajakSegera list={kd.pajak_segera_list || []} />}
        </ModuleCard>
        <ModuleCard delay={260} icon="calendar_month" title="Ruang Rapat" desc="Jadwal dan status ruang rapat hari ini." badge={ready && rr.total_ruang ? `${rr.kosong_sekarang}/${rr.total_ruang} kosong` : null} badgeTone={ready && rr.total_ruang && !rr.kosong_sekarang ? 'red' : 'emerald'} to="/ruang-rapat">
          {ready && <RuangStatus info={rr} />}
        </ModuleCard>
      </div>

      {isAdminRole(user?.role) && <GuestAccounts />}

      {/* Aktivitas terbaru */}
      <div className="mt-7 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="dash-module-icon dash-module-icon-sm"><span className="material-symbols-outlined text-[19px]">history</span></span>
            <div>
              <h2 className="text-lg font-bold text-slate-900 leading-tight">Aktivitas Terbaru</h2>
              <p className="text-[11px] text-slate-500">20 perubahan terakhir di Pemeliharaan dan Pengadaan{loadedAt ? ` · diperbarui ${fmtTime(loadedAt)}` : ''}</p>
            </div>
          </div>
          <button onClick={load} disabled={refreshing} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60">
            <span className={`material-symbols-outlined text-[16px] ${refreshing ? 'animate-spin' : ''}`}>refresh</span>{refreshing ? 'Memuat…' : 'Refresh'}
          </button>
        </div>
        {activities.length ? (
          <ul className="divide-y divide-slate-100">
            {activities.map((a, i) => (
              <li key={`${a.kode}-${i}`} className="flex items-center gap-3.5 px-5 py-3 hover:bg-slate-50">
                <span className="shrink-0 w-9 h-9 rounded-full bg-dinas-soft text-dinas flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">{modulIcon[a.modul] || 'description'}</span>
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-slate-800 truncate">{a.deskripsi}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                    <span className="font-semibold text-slate-600">{a.modul}</span>
                    <span className="font-mono text-slate-400">{a.kode}</span>
                    <span className="sm:hidden">· {a.waktu ? fmtWaktu(a.waktu) : '-'}</span>
                  </div>
                </div>
                <span className="hidden sm:block shrink-0 text-[11px] text-slate-500 whitespace-nowrap">{a.waktu ? fmtWaktu(a.waktu) : '-'}</span>
                <span className={`shrink-0 inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold whitespace-nowrap ${statusBadge[a.status] || statusBadge.pending}`}>{statusLabel[a.status] || a.status}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="px-5 py-10 text-center">
            <span className="material-symbols-outlined text-[32px] text-slate-300">{activitiesState === 'error' ? 'cloud_off' : 'inbox'}</span>
            <p className="mt-1 text-xs text-slate-400">
              {activitiesState === 'loading' ? 'Memuat aktivitas…' : activitiesState === 'error' ? 'Gagal memuat aktivitas. Tekan Refresh untuk mencoba lagi.' : 'Belum ada aktivitas.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
