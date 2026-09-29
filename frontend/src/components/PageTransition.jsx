import React, { useLayoutEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';

// Animasi masuk halaman tiap pindah layar (fade + geser naik sedikit, lihat .page-enter di
// app-theme.css). `key` = path, jadi pembungkus dipasang ulang dan animasinya diputar lagi
// setiap URL berganti. Posisi scroll dikembalikan ke atas supaya halaman baru tidak muncul
// di tengah-tengah bekas scroll halaman sebelumnya.
export default function PageTransition({ children }) {
  const { pathname } = useLocation();
  useLayoutEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return <div key={pathname} className="page-enter">{children}</div>;
}

// Layout route untuk halaman publik (landing, login, daftar, dst.).
export function PublicLayout() {
  return <PageTransition><Outlet /></PageTransition>;
}
