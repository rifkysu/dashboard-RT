import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from './BrandMark';
import LoginSplash from './LoginSplash';

const menu = [
  { to: '/dashboard', icon: 'dashboard', label: 'Dashboard', menuKey: 'dashboard' },
  { to: '/pemeliharaan', icon: 'build', label: 'Pemeliharaan', menuKey: 'pemeliharaan' },
  { to: '/pengadaan', icon: 'shopping_cart', label: 'Pengadaan', menuKey: 'pengadaan' },
  { to: '/kendaraan', icon: 'directions_car', label: 'Kendaraan', menuKey: 'kendaraan' },
  { to: '/ruang-rapat', icon: 'calendar_month', label: 'Jadwal Ruang Rapat', menuKey: 'ruang-rapat' },
  { to: '/akun', icon: 'group', label: 'Akun & Akses', adminOnly: true },
];

// `collapsed` cuma berlaku di layar md ke atas (mode rail ikon-saja di desktop).
// Di mobile, sidebar selalu tampil penuh sebagai drawer overlay yang
// dibuka/ditutup lewat `mobileOpen`/`onMobileClose` -- nggak pernah ikut
// menyempit jadi mode ikon-saja walau `collapsed` true, supaya tetap gampang
// dibaca di layar kecil.
export default function Sidebar({ collapsed, onToggle, mobileOpen, onMobileClose }) {
  const { user, logout, isMenuDown, resetRequestCount } = useAuth();
  // Popup animasi logo ~3 detik sebelum benar-benar logout.
  const [leaving, setLeaving] = useState(false);
  const navigate = useNavigate();
  const roleLabel = { karyawan: 'Karyawan', kabag: 'Kepala Bagian', pic: 'PIC', admin: 'Admin' };
  const hideWhenCollapsed = collapsed ? 'md:hidden' : '';

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-30 md:hidden" onClick={onMobileClose} aria-hidden="true"></div>
      )}
      <aside className={`bg-dinas-dark bg-kawung-gelap text-white fixed left-0 top-0 h-full flex flex-col z-40 transition-transform duration-300 md:transition-all w-64 ${collapsed ? 'md:w-20' : 'md:w-60'} ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}>
        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? 'Perluas menu' : 'Ciutkan menu'}
          className="hidden md:flex absolute -right-3 top-8 w-6 h-6 rounded-full bg-white border border-slate-200 shadow-md items-center justify-center text-slate-600 hover:text-slate-900 z-30"
        >
          <span className="material-symbols-outlined text-[16px]">{collapsed ? 'chevron_right' : 'chevron_left'}</span>
        </button>
        <button
          type="button"
          onClick={onMobileClose}
          title="Tutup menu"
          className="md:hidden absolute right-3 top-5 w-9 h-9 rounded-lg flex items-center justify-center text-white/70 hover:bg-white/10"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className={`py-6 border-b border-white/10 px-5 ${collapsed ? 'md:px-3' : ''}`}>
          <div className={`flex items-center gap-3 ${collapsed ? 'md:justify-center' : ''}`}>
            <BrandMark size="md" />
            <div className={`min-w-0 ${hideWhenCollapsed}`}>
              <h1 className="font-display text-base font-extrabold text-white truncate tracking-tight">Biro Umum</h1>
              <p className="text-[11px] text-white/60 mt-0.5">dan Rumah Tangga</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto overflow-x-hidden">
          <p className={`px-3 mb-3 text-[11px] font-semibold text-white/45 ${hideWhenCollapsed}`}>Menu Utama</p>
          {menu.filter((item) => !item.adminOnly || user?.role === 'admin').map((item) => {
            const down = item.menuKey ? isMenuDown(item.menuKey) : false;
            // Badge permintaan reset kata sandi di menu Akun & Akses (admin).
            const notif = item.to === '/akun' ? resetRequestCount : 0;
            return (
            <NavLink key={item.to} to={item.to} onClick={onMobileClose} title={collapsed ? item.label : undefined}
              className={({isActive}) => `group relative flex items-center gap-3 px-3 py-2.5 mb-0.5 rounded-lg text-sm transition-colors ${collapsed ? 'md:justify-center' : ''} ${
                isActive ? 'bg-white/[0.12] text-white' : 'text-white/70 hover:bg-white/[0.06] hover:text-white'
              }`}>
              {({isActive}) => <>
                {isActive && <span className="absolute left-0 top-2 bottom-2 w-[3px] rounded-r bg-kuningan" aria-hidden="true"></span>}
                <span className={`relative w-6 h-6 flex items-center justify-center shrink-0 ${isActive ? 'text-[#e4c27f]' : 'text-white/55 group-hover:text-white/85'}`}>
                  <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                  {down && <span className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-500 border-2 border-dinas-dark ${collapsed ? 'hidden md:block' : 'hidden'}`}></span>}
                  {notif > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold flex items-center justify-center border-2 border-dinas-dark">{notif}</span>}
                </span>
                <span className={`${isActive ? 'font-bold' : 'font-medium'} ${hideWhenCollapsed}`}>{item.label}</span>
                {down && <span className={`ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full ${isActive ? 'bg-amber-400 text-amber-950' : 'bg-amber-400/20 text-amber-200'} ${hideWhenCollapsed}`}>MAINTENANCE</span>}
              </>}
            </NavLink>
            );
          })}
        </nav>

        <div className="px-3 pb-4">
          <div className="border-t border-white/10 pt-3">
            <NavLink to="/profile" onClick={onMobileClose} title={collapsed ? 'Profil' : undefined} className={({isActive}) => `flex items-center gap-3 px-3 py-2 mb-1 rounded-lg text-sm transition ${collapsed ? 'md:justify-center' : ''} ${isActive ? 'bg-white/[0.12]' : 'hover:bg-white/[0.06]'}`}>
              <span className="w-8 h-8 rounded-full bg-kuningan flex items-center justify-center shrink-0 text-white text-sm font-bold">
                {(user?.nama_lengkap || 'U').trim().charAt(0).toUpperCase()}
              </span>
              <span className={`min-w-0 text-left ${hideWhenCollapsed}`}>
                <span className="block font-semibold text-white truncate text-sm">{user?.nama_lengkap || '-'}</span>
                <span className="block text-[11px] text-white/55 truncate">{roleLabel[user?.role] || user?.role || '-'}</span>
              </span>
            </NavLink>
            {user?.role === 'admin' && (
              <NavLink to="/settings" onClick={onMobileClose} title={collapsed ? 'Settings' : undefined} className={({isActive}) => `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${collapsed ? 'md:justify-center' : ''} ${isActive ? 'bg-white/[0.12] text-white' : 'text-white/65 hover:bg-white/[0.06] hover:text-white'}`}>
                <span className="w-8 h-6 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[20px]">settings</span></span>
                <span className={hideWhenCollapsed}>Settings</span>
              </NavLink>
            )}
            <button onClick={() => setLeaving(true)} disabled={leaving} title={collapsed ? 'Logout' : undefined} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/65 hover:bg-red-500/15 hover:text-red-200 transition ${collapsed ? 'md:justify-center' : ''}`}>
              <span className="w-8 h-6 flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[20px]">logout</span></span>
              <span className={hideWhenCollapsed}>Logout</span>
            </button>
          </div>
        </div>
      </aside>
      {leaving && <LoginSplash name={user?.nama_lengkap} title="Sampai jumpa" subtitle="Mengakhiri sesi Anda..." onDone={() => { logout(); navigate('/'); }} />}
    </>
  );
}
