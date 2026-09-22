import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api';

const roleLabel = { karyawan: 'Karyawan', kabag: 'Kepala Bagian', pic: 'PIC', admin: 'Admin' };
const MENU_LABELS = {
  dashboard: 'Dashboard',
  pemeliharaan: 'Pemeliharaan',
  pengadaan: 'Pengadaan',
  kendaraan: 'Kendaraan',
  'ruang-rapat': 'Jadwal Ruang Rapat',
};
const MENU_ORDER = ['dashboard', 'pemeliharaan', 'pengadaan', 'kendaraan', 'ruang-rapat'];

export default function Settings() {
  const { user, maintenance, refreshMaintenance } = useAuth();
  const [notif, setNotif] = useState(true);

  return (
    <div className="menu-page menu-settings max-w-4xl mx-auto">
      <div className="settings-profile-strip">
        <div className="settings-profile-avatar">{(user?.nama_lengkap || 'U').trim().charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <div className="settings-profile-name">{user?.nama_lengkap || '-'}</div>
          <div className="settings-profile-role">{roleLabel[user?.role] || user?.role || '-'}</div>
        </div>
      </div>
      <div className="menu-hero mb-6"><div><span className="menu-kicker">KONFIGURASI • SISTEM</span><h1 className="text-3xl font-bold">Settings</h1><p className="text-sm mt-1">Pengaturan akun dan preferensi sistem Biro Umum.</p></div><div className="menu-hero-icon"><span className="material-symbols-outlined">settings</span></div></div>
      <div className="space-y-4">
        <section className="bg-white border border-slate-300 rounded-md p-5">
          <h2 className="font-bold mb-4">Profil Pengguna</h2>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div><label className="text-xs text-slate-500">Nama Lengkap</label><p className="mt-1 border rounded p-2.5">{user?.nama_lengkap || '-'}</p></div>
            <div><label className="text-xs text-slate-500">Email</label><p className="mt-1 border rounded p-2.5">{user?.email || '-'}</p></div>
            <div><label className="text-xs text-slate-500">Peran</label><p className="mt-1 border rounded p-2.5">{roleLabel[user?.role] || user?.role || '-'}</p></div>
          </div>
        </section>
        <section className="bg-white border border-slate-300 rounded-md p-5"><h2 className="font-bold">Preferensi</h2><label className="flex items-center justify-between py-4"><span><b className="block text-sm">Notifikasi</b><small className="text-xs text-slate-500">Terima pemberitahuan terkait aktivitas layanan.</small></span><input type="checkbox" checked={notif} onChange={e => setNotif(e.target.checked)} className="w-5 h-5" /></label></section>
        {user?.role === 'admin' && <MaintenancePanel maintenance={maintenance} refreshMaintenance={refreshMaintenance} />}
      </div>
    </div>
  );
}

function MaintenancePanel({ maintenance, refreshMaintenance }) {
  const [saving, setSaving] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');

  async function toggle(menuKey, nextActive) {
    setSaving(menuKey); setError('');
    try {
      await api.put(`/maintenance/${menuKey}`, { is_active: nextActive });
      refreshMaintenance();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memperbarui status maintenance.');
    } finally {
      setSaving(null);
    }
  }

  async function saveMessage(menuKey) {
    setSaving(menuKey); setError('');
    try {
      await api.put(`/maintenance/${menuKey}`, { message: drafts[menuKey] ?? '' });
      refreshMaintenance();
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan pesan.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <section className="bg-white border border-slate-300 rounded-md p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-amber-600 text-[20px]">build</span>
        <h2 className="font-bold">Mode Maintenance</h2>
      </div>
      <p className="text-xs text-slate-500 mb-4">Nonaktifkan menu tertentu untuk role selain Admin. Admin selalu bisa akses semua menu, kapan pun.</p>
      {error && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
      <div className="space-y-3">
        {MENU_ORDER.map((key) => {
          const row = maintenance[key] || {};
          const active = !!row.is_active;
          const draft = drafts[key] !== undefined ? drafts[key] : (row.message || '');
          const busy = saving === key;
          return (
            <div key={key} className={`rounded-xl border p-4 transition ${active ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => toggle(key, !active)}
                    disabled={busy}
                    aria-label={`Toggle maintenance ${MENU_LABELS[key]}`}
                    className={`w-11 h-6 rounded-full relative transition shrink-0 disabled:opacity-60 ${active ? 'bg-amber-500' : 'bg-slate-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition ${active ? 'left-5' : 'left-0.5'}`}></span>
                  </button>
                  <span className="font-semibold text-sm text-slate-800">{MENU_LABELS[key]}</span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${active ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-600'}`}>{active ? 'MAINTENANCE' : 'AKTIF'}</span>
              </div>
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  placeholder="Pesan custom untuk pengguna (opsional)"
                  maxLength={255}
                  className="flex-1 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => saveMessage(key)}
                  disabled={busy}
                  className="px-4 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-60 shrink-0"
                >
                  {busy ? 'Menyimpan...' : 'Simpan Pesan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
