import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

const roleLabel = { karyawan: 'Karyawan', kabag: 'Kepala Bagian', pic: 'PIC', admin: 'Admin' };

export default function Profile() {
  const { user } = useAuth();
  const [notif, setNotif] = useState(true);

  return (
    <div className="menu-page menu-profile max-w-4xl mx-auto">
      <div className="settings-profile-strip">
        <div className="settings-profile-avatar">{(user?.nama_lengkap || 'U').trim().charAt(0).toUpperCase()}</div>
        <div className="min-w-0">
          <div className="settings-profile-name">{user?.nama_lengkap || '-'}</div>
          <div className="settings-profile-role">{roleLabel[user?.role] || user?.role || '-'}</div>
        </div>
      </div>
      <div className="menu-hero mb-6"><div><span className="menu-kicker">AKUN • PROFIL</span><h1 className="text-3xl font-bold">Profil Saya</h1><p className="text-sm mt-1">Informasi akun dan preferensi pribadi kamu.</p></div><div className="menu-hero-icon"><span className="material-symbols-outlined">person</span></div></div>
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
      </div>
    </div>
  );
}
