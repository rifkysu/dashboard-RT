import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from './BrandMark';

const menu = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', tone: 'indigo', menuKey: 'dashboard' },
  { to: '/pemeliharaan', icon: 'build', label: 'Pemeliharaan', tone: 'emerald', menuKey: 'pemeliharaan' },
  { to: '/pengadaan', icon: 'shopping_cart', label: 'Pengadaan', tone: 'amber', menuKey: 'pengadaan' },
  { to: '/kendaraan', icon: 'directions_car', label: 'Kendaraan', tone: 'sky', menuKey: 'kendaraan' },
  { to: '/ruang-rapat', icon: 'calendar_month', label: 'Jadwal Ruang Rapat', tone: 'violet', menuKey: 'ruang-rapat' },
  { to: '/akun', icon: 'group', label: 'Akun & Akses', tone: 'rose', adminOnly: true },
];

// `collapsed` cuma berlaku di layar md ke atas (mode rail ikon-saja di desktop).
// Di mobile, sidebar selalu tampil penuh sebagai drawer overlay yang
// dibuka/ditutup lewat `mobileOpen`/`onMobileClose` -- nggak pernah ikut
// menyempit jadi mode ikon-saja walau `collapsed` true, supaya tetap gampang
// dibaca di layar kecil.
export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { user, logout, isMenuDown } = useAuth();
  const navigate = useNavigate();
  const roleLabel = { karyawan: 'Karyawan', kabag: 'Kepala Bagian', pic: 'PIC', admin: 'Admin' };
  const hideWhenCollapsed = collapsed ? 'md:hidden' : '';

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-30 md:hidden" onClick={onMobileClose} aria-hidden="true"></div>
      )}
      <aside className={`bg-white fixed left-0 top-0 h-full flex flex-col z-40 border-r border-slate-200 shadow-xl shadow-slate-900/5 transition-transform duration-300 md:transition-all w-64 ${collapsed ? 'md:w-20' : 'md:w-60'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Perluas menu' : 'Ciutkan menu'}
          className="hidden md:flex absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-500 hover:text-slate-900 hover:border-slate-300 z-30"
        >
          <span className="material-symbols-outlined text-[16px]">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
        </button>
        <button
          type="button"
          onClick={onMobileClose}
          title="Tutup menu"
          className="md:hidden absolute right-3 top-5 w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:bg-slate-100"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className={`py-6 border-b border-slate-100 px-5 ${collapsed ? 'md:px-3' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'md:justify-center' : ''}`}>
            <BrandMark size="md" />
            <div className={`min-w-0 ${hideWhenCollapsed}`}>
              <h1 className="text-base font-bold text-slate-900 truncate">Biro Umum</h1>
              <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400 mt-1">Rumah Tangga</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto overflow-x-hidden">
          <p className={`px-3 mb-3 text-[10px] uppercase tracking-[0.18em] font-bold text-slate-400 ${hideWhenCollapsed}`}>Menu Utama</p>
          {menu.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => {
            const down = item.menuKey ? isMenuDown(item.menuKey) : false;
            return (
            <NavLink key={item.to} to={item.to} onClick={onMobileClose} title={collapsed ? item.label : undefined}
              className={({isActive}) => `group flex items-center gap-3 px-3 py-3 mb-2 rounded-2xl text-sm transition-all duration-200 ${collapsed ? 'md:justify-center' : ''} ${
                isActive ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}>
              {({isActive}) => <>
                <span className={`relative w-10 h-10 rounded-xl flex items-center justify-center transition shrink-0 ${
                  item.tone === 'indigo' ? 'bg-indigo-50 text-indigo-500 group-hover:bg-indigo-100' :
                  item.tone === 'emerald' ? 'bg-emerald-50 text-emerald-500 group-hover:bg-emerald-100' :
                  item.tone === 'amber' ? 'bg-amber-50 text-amber-500 group-hover:bg-amber-100' :
                  item.tone === 'sky' ? 'bg-sky-50 text-sky-500 group-hover:bg-sky-100' :
                  item.tone === 'rose' ? 'bg-rose-50 text-rose-500 group-hover:bg-rose-100' :
                  'bg-violet-50 text-violet-500 group-hover:bg-violet-100'
                } ${isActive ? 'ring-1 ring-white/20' : ''}`}>
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  {down && <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-white ${collapsed ? 'hidden md:block' : 'hidden'}`}></span>}
                </span>
                <span className={`${isActive ? 'font-bold' : 'font-medium'} ${hideWhenCollapsed}`}>{item.label}</span>
                {down && <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-700'} ${hideWhenCollapsed}`}>MAINTENANCE</span>}
                {!down && isActive && <span className={`material-symbols-outlined ml-auto text-[17px] text-white/70 ${hideWhenCollapsed}`}>chevron_right</span>}
              </>}
            </NavLink>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <div className={`mx-1 mb-3 p-3 rounded-2xl bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 ${hideWhenCollapsed}`}>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-400 animate-pulse"></span>
              <span className="text-[11px] font-semibold text-slate-600">Sistem Aktif</span>
            </div>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <NavLink to="/profile" onClick={onMobileClose} title={collapsed ? 'Profil' : undefined} className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 mb-1 rounded-xl text-sm transition ${collapsed ? 'md:justify-center' : ''} ${isActive ? 'bg-slate-100' : 'hover:bg-slate-100'}`}>
              <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shrink-0 text-white text-sm font-bold">
                {(user?.nama_lengkap || 'U').trim().charAt(0).toUpperCase()}
              </span>
              <span className={`min-w-0 text-left ${hideWhenCollapsed}`}>
                <span className="block font-semibold text-slate-900 truncate text-sm">{user?.nama_lengkap || '-'}</span>
                <span className="block text-[11px] text-slate-500 truncate">{roleLabel[user?.role] || user?.role || '-'}</span>
              </span>
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/settings" onClick={onMobileClose} title={collapsed ? 'Settings' : undefined} className={({isActive}) => `flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition ${collapsed ? 'md:justify-center' : ''} ${isActive ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}>
                <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[18px]">settings</span></span>
                <span className={hideWhenCollapsed}>Settings</span>
              </NavLink>
            )}
            <button onClick={() => { logout(); navigate('/'); }} title={collapsed ? 'Logout' : undefined} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm text-slate-500 hover:bg-red-50 hover:text-red-500 transition ${collapsed ? 'md:justify-center' : ''}`}>
              <span className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[18px]">logout</span></span>
              <span className={hideWhenCollapsed}>Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
