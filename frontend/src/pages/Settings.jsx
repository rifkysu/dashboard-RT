import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { useFeedback } from '../components/Feedback';

const MENU_LABELS = {
  landing: 'Landing Page',
  dashboard: 'Dashboard',
  pemeliharaan: 'Pemeliharaan',
  pengadaan: 'Pengadaan',
  kendaraan: 'Kendaraan',
  'ruang-rapat': 'Jadwal Ruang Rapat',
};
const MENU_ORDER = ['landing', 'dashboard', 'pemeliharaan', 'pengadaan', 'kendaraan', 'ruang-rapat'];
const MENU_ICONS = { landing: 'public', dashboard: 'dashboard', pemeliharaan: 'build', pengadaan: 'shopping_cart', kendaraan: 'directions_car', 'ruang-rapat': 'calendar_month' };

export default function Settings() {
  const { user, isAdmin, maintenance, refreshMaintenance } = useAuth();

  if (user && !isAdmin) return <Navigate to="/dashboard" replace />;

  return (
    <div className="menu-page menu-settings max-w-4xl mx-auto">
      <div className="menu-hero mb-6"><div><span className="menu-kicker">Biro Umum / Settings</span><h1 className="text-3xl font-bold">Settings</h1><p className="text-sm mt-1">Pengaturan mode maintenance sistem Biro Umum.</p></div></div>
      <div className="space-y-4">
        <MaintenancePanel maintenance={maintenance} refreshMaintenance={refreshMaintenance} />
      </div>
    </div>
  );
}

function MaintenancePanel({ maintenance, refreshMaintenance }) {
  const [saving, setSaving] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [error, setError] = useState('');
  const { confirm, toast } = useFeedback();

  async function toggle(menuKey, nextActive) {
    if (nextActive && !(await confirm({ title: `Aktifkan maintenance ${MENU_LABELS[menuKey]}?`, message: `Menu ${MENU_LABELS[menuKey]} langsung tidak bisa diakses semua pengguna selain Admin & Kepala Bagian${menuKey === 'landing' ? ', termasuk pengunjung publik' : ''}.`, confirmText: 'Ya, Aktifkan Maintenance', tone: 'warning', icon: 'build' }))) return;
    setSaving(menuKey); setError('');
    try {
      await api.put(`/maintenance/${menuKey}`, { is_active: nextActive });
      refreshMaintenance();
      toast(nextActive ? `Maintenance ${MENU_LABELS[menuKey]} diaktifkan.` : `${MENU_LABELS[menuKey]} kembali aktif untuk semua pengguna.`);
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
      toast(`Pesan maintenance ${MENU_LABELS[menuKey]} disimpan.`);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal menyimpan pesan.');
    } finally {
      setSaving(null);
    }
  }

  const activeCount = MENU_ORDER.filter((k) => maintenance[k]?.is_active).length;

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-1">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><span className="material-symbols-outlined text-[22px]">construction</span></span>
          <div>
            <h2 className="font-bold text-slate-900 leading-tight">Mode Maintenance</h2>
            <p className="text-[11px] text-slate-500">Atur menu yang sedang tidak bisa diakses pengguna.</p>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${activeCount ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}`}>
          <span className={`w-2 h-2 rounded-full ${activeCount ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
          {activeCount ? `${activeCount} menu maintenance` : 'Semua menu aktif'}
        </span>
      </div>
      <p className="text-xs text-slate-500 mt-3 mb-4 leading-5">Nonaktifkan menu tertentu untuk role selain Admin &amp; Kepala Bagian. Admin dan Kepala Bagian selalu bisa akses semua menu, kapan pun. Khusus "Landing Page", ini juga berlaku untuk pengunjung publik yang belum login.</p>
      {error && <div className="mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
      <div className="grid md:grid-cols-2 gap-3">
        {MENU_ORDER.map((key) => {
          const row = maintenance[key] || {};
          const active = !!row.is_active;
          const draft = drafts[key] !== undefined ? drafts[key] : (row.message || '');
          const busy = saving === key;
          return (
            <div key={key} className={`rounded-xl border p-4 transition-colors ${active ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${active ? 'bg-amber-100 text-amber-700' : 'bg-dinas-soft text-dinas'}`}><span className="material-symbols-outlined text-[19px]">{MENU_ICONS[key]}</span></span>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm text-slate-800 truncate">{MENU_LABELS[key]}</div>
                    <div className={`text-[10px] font-bold ${active ? 'text-amber-700' : 'text-emerald-700'}`}>{active ? 'MAINTENANCE' : 'AKTIF'}</div>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={active}
                  onClick={() => toggle(key, !active)}
                  disabled={busy}
                  aria-label={`Toggle maintenance ${MENU_LABELS[key]}`}
                  title={active ? 'Matikan maintenance' : 'Aktifkan maintenance'}
                  className={`w-11 h-6 rounded-full relative transition-colors shrink-0 disabled:opacity-60 ${active ? 'bg-amber-500' : 'bg-slate-300'}`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${active ? 'left-[22px]' : 'left-0.5'}`}></span>
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDrafts((d) => ({ ...d, [key]: e.target.value }))}
                  placeholder="Pesan untuk pengguna (opsional)"
                  maxLength={255}
                  className="flex-1 min-w-0 h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs outline-none focus:border-slate-900"
                />
                <button
                  type="button"
                  onClick={() => saveMessage(key)}
                  disabled={busy}
                  className="px-3.5 h-9 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-60 shrink-0"
                >
                  {busy ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
