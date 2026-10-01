import React, { useLayoutEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import PageTransition from './PageTransition';
import { useAuth } from '../context/AuthContext';
import { readTheme, saveTheme, applyTheme } from '../theme';

function MaintenanceNotice({ message }) {
  return (
    <div className="max-w-xl mx-auto mt-16 bg-white border border-amber-200 rounded-2xl shadow-sm p-8 text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
        <span className="material-symbols-outlined text-[32px]">build</span>
      </div>
      <h2 className="text-xl font-bold text-slate-900">Sedang Dalam Mode Maintenance</h2>
      <p className="text-sm text-slate-500 mt-2">{message || 'Menu ini sedang dalam mode maintenance. Silakan coba lagi nanti.'}</p>
    </div>
  );
}

// Menu yang sedang maintenance (dan user bukan admin/kabag) -> tampilkan pemberitahuan, bukan isi halaman.
export function MenuGate({ menuKey, children }) {
  const { isMenuDown, maintenance } = useAuth();
  return isMenuDown(menuKey) ? <MaintenanceNotice message={maintenance[menuKey]?.message} /> : children;
}

// Layout semua halaman yang butuh login. Dipasang SEKALI sebagai layout route (lihat App.jsx):
// sidebar & header tetap di tempat saat pindah menu, cuma isi halaman (Outlet) yang berganti
// dengan animasi -- sebelumnya tiap menu memasang ulang seluruh kerangka sehingga layar "berkedip".
export default function ProtectedRoute() {
  const { user, loading, loggedOut } = useAuth();
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('sidebarCollapsed') === '1'; } catch { return false; }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  // Tema Terang/Gelap hanya berlaku selama berada di layout dashboard; keluar (landing/login) kembali terang.
  const [theme, setTheme] = useState(readTheme);
  useLayoutEffect(() => {
    applyTheme(theme);
    return () => applyTheme('light');
  }, [theme]);
  function changeTheme(next) { saveTheme(next); setTheme(next); }

  function toggleSidebar() {
    setCollapsed((c) => {
      const next = !c;
      try { localStorage.setItem('sidebarCollapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  // Habis klik Logout -> ke landing page; sesi berakhir karena hal lain (token habis, dll.) -> ke /login.
  if (!user) return <Navigate to={loggedOut ? '/' : '/login'} replace />;
  return (
    <div className="app-shell-bg min-h-screen">
      <Sidebar collapsed={collapsed} onToggle={toggleSidebar} mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} theme={theme} onThemeChange={changeTheme} />
      <div className={`min-h-screen transition-all duration-300 ml-0 ${collapsed ? 'md:ml-20' : 'md:ml-60'}`}>
        <header className="md:hidden sticky top-0 z-20 bg-dinas-dark bg-kawung-gelap text-white px-4 py-3 flex items-center gap-3">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Buka menu" className="w-10 h-10 rounded-lg flex items-center justify-center text-white hover:bg-white/10">
            <span className="material-symbols-outlined">menu</span>
          </button>
          <span className="font-display font-extrabold text-white text-sm tracking-tight">Biro Umum <span className="font-sans font-medium text-white/60">dan Rumah Tangga</span></span>
        </header>
        <main className="app-main p-4 sm:p-5 md:p-7 min-h-screen">
          <PageTransition><Outlet /></PageTransition>
        </main>
      </div>
    </div>
  );
}
