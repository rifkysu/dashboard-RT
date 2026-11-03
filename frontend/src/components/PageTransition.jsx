import React, { Suspense, useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

// Tampil sebentar saat file halaman (code splitting, lihat App.jsx) belum selesai diunduh.
// Biasanya tidak terlihat karena semua halaman sudah di-prefetch saat browser senggang.
function PageLoading() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-label="Memuat halaman">
      <span className="w-8 h-8 rounded-full border-[3px] border-slate-200 border-t-dinas animate-spin" aria-hidden="true"></span>
    </div>
  );
}

// Animasi masuk halaman tiap pindah layar (fade + geser naik sedikit, lihat .page-enter di
// app-theme.css). `key` = path, jadi pembungkus dipasang ulang dan animasinya diputar lagi
// setiap URL berganti. Posisi scroll dikembalikan ke atas supaya halaman baru tidak muncul
// di tengah-tengah bekas scroll halaman sebelumnya.
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <div key={pathname} className="page-enter"><Suspense fallback={<PageLoading />}>{children}</Suspense></div>;
}

// Layout route untuk halaman publik (landing, login, daftar, dst.).
export function PublicLayout() {
  return <PageTransition><Outlet /></PageTransition>;
}
