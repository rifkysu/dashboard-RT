import React, { useEffect, useState } from 'react';
import api from '../api';
import { useFeedback } from './Feedback';
import useLive from '../hooks/useLive';

// Khusus admin/kabag: semua akun Google (tamu) yang login di landing page untuk booking ruang rapat
// (tabel guest_accounts). Dipakai di Dashboard dan menu Akun & Akses.
// Akun yang spam bisa diblokir -> sesi tamu tsb langsung diputus & tidak bisa booking lagi.
const fmtShort = (v) => new Date(`${v}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
const fmtWaktu = (v) => {
  const d = new Date(v);
  const sameDay = d.toDateString() === new Date().toDateString();
  return sameDay ? `Hari ini, ${d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : d.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
};

export default function GuestAccounts({ className = 'mt-7' }) {
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
  // Tamu login Google / booking / membatalkan -> daftar langsung diperbarui.
  useLive(['ruang-rapat', 'guest-accounts'], load);

  async function toggleBlock(g) {
    const blocked = !g.is_blocked;
    const ok = await confirm({
      title: blocked ? 'Blokir akun tamu?' : 'Buka blokir akun tamu?',
      message: blocked ? `${g.nama} (${g.email}) tidak akan bisa login Google & mengajukan booking lagi. Booking yang sudah ada tidak terhapus.` : `${g.nama} (${g.email}) bisa login Google & mengajukan booking lagi.`,
      tone: blocked ? 'danger' : 'info', icon: blocked ? 'block' : 'lock_open', confirmText: blocked ? 'Blokir' : 'Buka blokir',
    });
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

  const sudahBooking = rows ? rows.filter((g) => g.total_booking > 0).length : 0;

  return (
    <div className={`${className} bg-white border border-slate-200 rounded-xl overflow-hidden`}>
      <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <span className="dash-module-icon dash-module-icon-sm"><span className="material-symbols-outlined text-[19px]">person_check</span></span>
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-slate-900 leading-tight">Akun Google Tamu (Login + Booking Ruang Rapat)</h2>
            <p className="text-[11px] text-slate-500">Semua akun yang login Google di landing page (tabel guest_accounts){rows ? ` · ${rows.length} akun, ${sudahBooking} sudah booking` : ''}</p>
          </div>
        </div>
        <button onClick={load} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
          <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
        </button>
      </div>
      {rows && rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-5 py-2.5 font-semibold">Akun</th>
                <th className="text-left px-3 py-2.5 font-semibold">Booking terakhir</th>
                <th className="text-left px-3 py-2.5 font-semibold">Login terakhir</th>
                <th className="text-center px-3 py-2.5 font-semibold">Booking</th>
                <th className="text-right px-5 py-2.5 font-semibold">Status</th>
              </tr>
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
                    ) : <span className="text-[12px] text-slate-400">Belum mengisi form booking</span>}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-slate-600 whitespace-nowrap">{g.last_login_at ? fmtWaktu(g.last_login_at) : '-'}</td>
                  <td className="px-3 py-3 text-center whitespace-nowrap">
                    <div className="font-bold tabular-nums text-slate-700">{g.total_booking}</div>
                    {g.dibatalkan_sendiri > 0 && <div className="text-[10px] text-red-600">{g.dibatalkan_sendiri} dibatalkan sendiri</div>}
                  </td>
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
          <p className="mt-1 text-xs text-slate-400">{failed ? 'Gagal memuat akun tamu. Pastikan backend sudah di-restart.' : rows ? 'Belum ada tamu yang login Google.' : 'Memuat…'}</p>
        </div>
      )}
    </div>
  );
}
