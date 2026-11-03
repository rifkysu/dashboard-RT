import React, { lazy, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute, { MenuGate } from './components/ProtectedRoute';
import { PublicLayout } from './components/PageTransition';

// Tiap halaman jadi file JS terpisah (code splitting): pembukaan pertama cukup mengunduh halaman
// yang sedang dibuka, bukan seluruh aplikasi. Setelah halaman tampil, sisanya diunduh diam-diam
// saat browser senggang (lihat prefetchPages) supaya pindah menu tetap instan.
const pages = {
  Login: () => import('./pages/Login'), Register: () => import('./pages/Register'),
  ForgotPassword: () => import('./pages/ForgotPassword'), ResetPassword: () => import('./pages/ResetPassword'), VerifikasiEmail: () => import('./pages/VerifikasiEmail'),
  Dashboard: () => import('./pages/Dashboard'), Pemeliharaan: () => import('./pages/Pemeliharaan'), Pengadaan: () => import('./pages/Pengadaan'),
  Kendaraan: () => import('./pages/Kendaraan'), RuangRapat: () => import('./pages/RuangRapat'), Settings: () => import('./pages/Settings'), Profile: () => import('./pages/Profile'), Akun: () => import('./pages/Akun'),
  PublicRuangRapat: () => import('./pages/PublicRuangRapat'), LayarRuang: () => import('./pages/LayarRuang'), FotoRuang: () => import('./pages/FotoRuang'), Riwayat: () => import('./pages/Riwayat'),
  Landing: () => import('./pages/Landing'),
};
// Setelah aplikasi di-deploy ulang, file halaman lama (nama ber-hash) sudah terhapus dari server;
// tab yang masih terbuka gagal mengunduhnya saat pindah menu -> muat ulang sekali agar memakai versi baru.
function lazyPage(load) {
  return lazy(() => load().then((mod) => {
    try { sessionStorage.removeItem('chunkReload'); } catch {}
    return mod;
  }, (err) => {
    let sudah = false;
    try { sudah = sessionStorage.getItem('chunkReload') === '1'; sessionStorage.setItem('chunkReload', '1'); } catch {}
    if (sudah) throw err;
    window.location.reload();
    return new Promise(() => {});
  }));
}
const Login = lazyPage(pages.Login);
const Register = lazyPage(pages.Register);
const ForgotPassword = lazyPage(pages.ForgotPassword);
const ResetPassword = lazyPage(pages.ResetPassword);
const VerifikasiEmail = lazyPage(pages.VerifikasiEmail);
const Dashboard = lazyPage(pages.Dashboard);
const Pemeliharaan = lazyPage(pages.Pemeliharaan);
const Pengadaan = lazyPage(pages.Pengadaan);
const Kendaraan = lazyPage(pages.Kendaraan);
const RuangRapat = lazyPage(pages.RuangRapat);
const Settings = lazyPage(pages.Settings);
const Profile = lazyPage(pages.Profile);
const Akun = lazyPage(pages.Akun);
const PublicRuangRapat = lazyPage(pages.PublicRuangRapat);
const LayarRuang = lazyPage(pages.LayarRuang);
const FotoRuang = lazyPage(pages.FotoRuang);
const Riwayat = lazyPage(pages.Riwayat);
const Landing = lazyPage(pages.Landing);

// Layar ruangan (/ruang) & kiosk (/jadwal-rapat) tidak pernah pindah menu -> tidak perlu prefetch.
function prefetchPages() {
  if (/^\/(ruang|jadwal-rapat)(\/|$)/.test(window.location.pathname)) return;
  const idle = window.requestIdleCallback || ((fn) => setTimeout(fn, 1500));
  idle(() => Object.values(pages).forEach((load) => load().catch(() => {})));
}

export default function App(){
 useEffect(prefetchPages, []);
 return <Routes>
  <Route element={<PublicLayout/>}>
   <Route path="/" element={<Landing/>}/><Route path="/login" element={<Login/>}/><Route path="/jadwal-rapat" element={<PublicRuangRapat/>}/><Route path="/ruang" element={<LayarRuang/>}/><Route path="/ruang/:slug" element={<LayarRuang/>}/><Route path="/register" element={<Register/>}/><Route path="/forgot-password" element={<ForgotPassword/>}/><Route path="/reset-password" element={<ResetPassword/>}/><Route path="/verifikasi-email" element={<VerifikasiEmail/>}/>
  </Route>
  {/* Layout login dipasang sekali: sidebar tetap, cuma isi halaman yang berganti (lihat ProtectedRoute.jsx). */}
  <Route element={<ProtectedRoute/>}>
   <Route path="/dashboard" element={<MenuGate menuKey="dashboard"><Dashboard/></MenuGate>}/><Route path="/pemeliharaan" element={<MenuGate menuKey="pemeliharaan"><Pemeliharaan/></MenuGate>}/><Route path="/pengadaan" element={<MenuGate menuKey="pengadaan"><Pengadaan/></MenuGate>}/>
   <Route path="/kendaraan" element={<MenuGate menuKey="kendaraan"><Kendaraan/></MenuGate>}/><Route path="/ruang-rapat" element={<MenuGate menuKey="ruang-rapat"><RuangRapat/></MenuGate>}/><Route path="/settings" element={<Settings/>}/><Route path="/profile" element={<Profile/>}/><Route path="/akun" element={<Akun/>}/><Route path="/foto-ruang" element={<FotoRuang/>}/><Route path="/riwayat" element={<Riwayat/>}/>
  </Route>
  <Route path="*" element={<Navigate to="/" replace/>}/>
 </Routes>
}
