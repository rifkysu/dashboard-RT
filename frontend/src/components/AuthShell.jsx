import React from 'react';
import BrandMark from './BrandMark';

// Kerangka bersama halaman akun (Login, Daftar, Lupa & Reset Kata Sandi, Verifikasi Email):
// latar biru dinas bermotif kawung dengan cahaya emas lembut, header merek, dan footer.
// `action` = elemen kanan atas header (mis. tombol Masuk). Anak = kartu halaman itu sendiri.
export default function AuthShell({ children, action = null }) {
  return (
    <div className="auth-bg min-h-screen flex flex-col">
      <div className="auth-orb auth-orb-emas" aria-hidden="true" />
      <div className="auth-orb auth-orb-biru" aria-hidden="true" />

      <header className="relative z-10 w-full px-5 sm:px-8 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark size="sm" className="!border-white/30 shadow-lg" />
          <div className="min-w-0">
            <h1 className="font-display text-sm sm:text-base font-extrabold text-white leading-tight truncate">
              Biro Umum dan Rumah Tangga
            </h1>
            <p className="text-[11px] sm:text-xs text-[#e4c27f] mt-0.5">
              Kementerian Ketenagakerjaan
            </p>
          </div>
        </div>
        {action}
      </header>

      <main className="auth-main relative z-20 flex-1 flex items-center justify-center px-4 sm:px-6 py-6 md:py-10">
        {children}
      </main>

      <footer className="relative z-10 w-full px-4 py-5 text-center text-[11px] text-white/55">
        © {new Date().getFullYear()} Biro Umum dan Rumah Tangga · Sistem Manajemen Fasilitas &amp;
        Operasional Kantor
      </footer>
    </div>
  );
}
