import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../components/Feedback';

const roleLabel = { karyawan: 'Karyawan', kabag: 'Kepala Bagian', pic: 'PIC', admin: 'Admin' };
const roleBadge = {
  karyawan: 'bg-slate-100 text-slate-700 border border-slate-300',
  pic: 'bg-blue-50 text-blue-700 border border-blue-200',
  kabag: 'bg-violet-50 text-violet-700 border border-violet-200',
  admin: 'bg-amber-50 text-amber-700 border border-amber-200',
};

function fmt(v) {
  return v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
}

// Nomor HP lokal (08xx) -> format internasional untuk link wa.me (628xx).
function waNumber(noHp) {
  const digits = String(noHp || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `62${digits.slice(1)}`;
  return digits;
}

export default function Akun() {
  const { user, refreshResetRequests } = useAuth();
  const { confirm, toast } = useFeedback();
  const [resetLink, setResetLink] = useState(null);
  const [copied, setCopied] = useState(false);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  function load() {
    setLoading(true);
    api.get('/users').then((res) => { setData(res.data.data || []); setError(''); })
      .catch((err) => setError(err.response?.data?.message || 'Gagal memuat daftar akun.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function toggleBan(target) {
    const nextActive = !target.is_active;
    const ok = nextActive
      ? await confirm({ title: 'Aktifkan kembali akun?', message: `Akun "${target.nama_lengkap}" (${target.email}) akan bisa login dan mengakses sistem lagi.`, confirmText: 'Ya, Aktifkan', tone: 'success', icon: 'how_to_reg' })
      : await confirm({ title: 'Ban akun ini?', message: `Akun "${target.nama_lengkap}" (${target.email}) langsung keluar dari sistem dan tidak bisa login sampai diaktifkan kembali.`, confirmText: 'Ya, Ban Akun', tone: 'danger', icon: 'block' });
    if (!ok) return;
    setBusyId(target.id);
    setError('');
    try {
      await api.put(`/users/${target.id}/status`, { is_active: nextActive });
      setData((current) => current.map((u) => (u.id === target.id ? { ...u, is_active: nextActive } : u)));
      toast(nextActive ? `Akun ${target.nama_lengkap} diaktifkan kembali.` : `Akun ${target.nama_lengkap} berhasil di-ban.`);
      refreshResetRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui status akun.');
    } finally {
      setBusyId(null);
    }
  }

  async function makeResetLink(target) {
    if (!(await confirm({ title: 'Kirim link reset kata sandi?', message: `Link reset untuk "${target.nama_lengkap}" (${target.email}) berlaku 1 jam. Pastikan permintaan ini benar dari pemilik akun.`, confirmText: 'Ya, Kirim Link', tone: 'info', icon: 'lock_reset' }))) return;
    setBusyId(target.id);
    setError('');
    try {
      const res = await api.post(`/users/${target.id}/reset-link`);
      setResetLink({ url: res.data.resetUrl, nama: target.nama_lengkap, no_hp: target.no_hp, email: target.email, emailed: res.data.emailed, emailError: res.data.email_error });
      setCopied(false);
      // Permintaan dianggap sudah ditangani -> hilangkan penanda & perbarui badge sidebar.
      setData((current) => current.map((u) => (u.id === target.id ? { ...u, reset_requested_at: null } : u)));
      refreshResetRequests();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat link reset.');
    } finally {
      setBusyId(null);
    }
  }

  async function copyResetLink() {
    try {
      await navigator.clipboard.writeText(resetLink.url);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const pendingResets = data.filter((u) => u.reset_requested_at && u.is_active);

  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="menu-page menu-akun relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="menu-hero mb-6">
        <div>
          <span className="menu-kicker">ADMIN • MANAJEMEN AKUN</span>
          <h1 className="text-2xl font-bold">Akun & Akses Pengguna</h1>
          <p className="text-sm mt-1">Pantau siapa saja yang punya akses ke sistem, role, dan kapan terakhir login.</p>
        </div>
        <div className="menu-hero-icon"><span className="material-symbols-outlined">group</span></div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="text-sm text-slate-600">{data.length} akun terdaftar</div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

      {pendingResets.length > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-3">
          <span className="material-symbols-outlined text-amber-600">notifications_active</span>
          <div>
            <b>{pendingResets.length} akun meminta reset kata sandi:</b> {pendingResets.map((u) => u.nama_lengkap).join(', ')}.
            <div className="text-xs mt-0.5">Pastikan permintaan memang dari pemilik akun, lalu klik <b>Kirim Link</b> pada barisnya.</div>
          </div>
        </div>
      )}

      <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-lg shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr className="divide-x divide-slate-200">
                {['Nama Lengkap', 'Email', 'Role', 'No. HP', 'Unit Kerja', 'Login Via', 'Status', 'Tanggal Daftar', 'Terakhir Login', 'Aksi'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={10} className="py-8 text-center text-slate-400">Memuat data...</td></tr>}
              {!loading && data.length === 0 && <tr><td colSpan={10} className="py-8 text-center text-slate-400">Belum ada akun.</td></tr>}
              {data.map((u) => {
                const isSelf = u.id === user?.id;
                return (
                <tr key={u.id} className="divide-x divide-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{u.nama_lengkap}{isSelf && <span className="ml-1.5 text-[10px] font-bold text-indigo-600">(Kamu)</span>}{u.reset_requested_at && u.is_active && <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold whitespace-nowrap"><span className="material-symbols-outlined text-[12px]">lock_reset</span>Minta reset · {fmt(u.reset_requested_at)}</div>}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${roleBadge[u.role] || roleBadge.karyawan}`}>{roleLabel[u.role] || u.role}</span></td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{u.no_hp || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{u.unit_kerja || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize whitespace-nowrap">{u.sso_provider ? `SSO (${u.sso_provider})` : 'Email/Password'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {u.is_active ? 'Aktif' : 'Di-ban'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{u.last_login_at ? fmt(u.last_login_at) : <span className="text-slate-400 italic">Belum pernah login</span>}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                    {u.is_active && (
                      <button
                        type="button"
                        onClick={() => makeResetLink(u)}
                        disabled={busyId === u.id}
                        title="Buat & kirim link reset kata sandi"
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-60 whitespace-nowrap ${u.reset_requested_at ? 'border-amber-400 bg-amber-500 text-white hover:bg-amber-600' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        Kirim Link
                      </button>
                    )}
                    {isSelf ? (
                      <span className="text-[11px] text-slate-400 italic">Akun sendiri</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleBan(u)}
                        disabled={busyId === u.id}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-60 transition ${u.is_active ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                      >
                        {busyId === u.id ? 'Memproses...' : u.is_active ? 'Ban Akun' : 'Aktifkan'}
                      </button>
                    )}
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {resetLink && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setResetLink(null); }}>
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">Link Reset Kata Sandi</h2>
                <p className="text-xs text-slate-500 mt-1">Untuk <b>{resetLink.nama}</b> · berlaku 1 jam · hanya bisa dipakai sekali.</p>
              </div>
              <button type="button" onClick={() => setResetLink(null)} className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500"><span className="material-symbols-outlined">close</span></button>
            </div>
            {resetLink.emailed && <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">✓ Link sudah dikirim ke email <b>{resetLink.email}</b>. Salin / WhatsApp di bawah hanya cadangan kalau email tidak masuk.</div>}
            {resetLink.emailError && <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{resetLink.emailError}</div>}
            <input readOnly value={resetLink.url} onFocus={(e) => e.target.select()} className="mt-4 w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none" />
            <div className="mt-4 flex flex-wrap gap-2 justify-end">
              <button type="button" onClick={copyResetLink} className="px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold">{copied ? 'Tersalin ✓' : 'Salin Link'}</button>
              {waNumber(resetLink.no_hp) && (
                <a
                  href={`https://wa.me/${waNumber(resetLink.no_hp)}?text=${encodeURIComponent(`Halo ${resetLink.nama}, berikut link untuk mengatur ulang kata sandi akun Biro Umum Anda (berlaku 1 jam):
${resetLink.url}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700"
                >
                  Kirim via WhatsApp ({resetLink.no_hp})
                </a>
              )}
            </div>
            {!waNumber(resetLink.no_hp) && <p className="text-[11px] text-slate-500 mt-3">Akun ini belum punya nomor HP, jadi salin link lalu kirim lewat kanal lain (Slack/Teams/langsung).</p>}
          </div>
        </div>
      )}
    </div>
  );
}
