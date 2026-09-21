import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menu = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', tone: 'indigo' },
  { to: '/pemeliharaan', icon: 'build', label: 'Pemeliharaan', tone: 'emerald' },
  { to: '/pengadaan', icon: 'shopping_cart', label: 'Pengadaan', tone: 'amber' },
  { to: '/kendaraan', icon: 'directions_car', label: 'Kendaraan', tone: 'sky' },
  { to: '/ruang-rapat', icon: 'calendar_month', label: 'Jadwal Ruang Rapat', tone: 'violet' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const roleLabel = { karyawan: 'Karyawan', kabag: 'Kepala Bagian', pic: 'PIC', admin: 'Admin' };

  return (
    <aside className="bg-slate-950 fixed left-0 top-0 h-full w-60 flex flex-col z-20 shadow-2xl shadow-slate-900/20">
      <div className="px-5 py-6 border-b border-white/10 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/40">
            <span className="material-symbols-outlined text-[23px]">account_balance</span>
          </div>
          <div>
            <h1 className="text-base font-bold text-white">Biro Umum</h1>
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">Rumah Tangga</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-5 overflow-y-auto">
        <p className="px-3 mb-3 text-[10px] uppercase tracking-[0.18em] font-bold text-slate-500">Menu Utama</p>
        {menu.map((item) => (
          <NavLink key={item.to} to={item.to}
            className={({isActive}) => `group flex items-center gap-3 px-3 py-3 mb-2 rounded-2xl text-sm transition-all duration-200 ${
              isActive ? 'bg-white text-slate-900 shadow-lg shadow-black/10' : 'text-slate-300 hover:bg-white/10 hover:text-white'
            }`}>
            {({isActive}) => <>
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center transition ${
                item.tone === 'indigo' ? 'bg-indigo-500/15 text-indigo-400 group-hover:bg-indigo-500/25' :
                item.tone === 'emerald' ? 'bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25' :
                item.tone === 'amber' ? 'bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25' :
                item.tone === 'sky' ? 'bg-sky-500/15 text-sky-400 group-hover:bg-sky-500/25' :
                'bg-violet-500/15 text-violet-400 group-hover:bg-violet-500/25'
              } ${isActive ? 'ring-1 ring-slate-200/80' : ''}`}>
                <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
              </span>
              <span className={isActive ? 'font-bold' : 'font-medium'}>{item.label}</span>
              {isActive && <span className="material-symbols-outlined ml-auto text-[17px] text-slate-400">chevron_right</span>}
            </>}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <div className="mx-1 mb-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-500/15 to-blue-500/10 border border-white/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse"></span>
            <span className="text-[11px] font-semibold text-slate-300">Sistem Aktif</span>
          </div>
        </div>
        <div className="border-t border-white/10 pt-3">
          <NavLink to="/settings" className={({isActive}) => `flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition ${isActive ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/10 hover:text-white'}`}>
            <span className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">settings</span></span> Settings
          </NavLink>
          <button onClick={() => { logout(); navigate('/login'); }} className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-slate-400 hover:bg-red-500/10 hover:text-red-300 transition">
            <span className="w-9 h-9 rounded-xl bg-slate-800 flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">logout</span></span> Logout
          </button>
        </div>
      </div>
    </aside>
  );
}
