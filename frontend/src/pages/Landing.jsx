import React from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import RuangRapatSchedule from '../components/RuangRapatSchedule';

const FEATURES = [
  { icon: 'build', label: 'Pemeliharaan', desc: 'Kelola perbaikan & perawatan fasilitas', gradient: 'from-emerald-500 to-teal-600' },
  { icon: 'shopping_cart', label: 'Pengadaan', desc: 'Proses pengadaan barang & jasa', gradient: 'from-amber-500 to-orange-600' },
  { icon: 'directions_car', label: 'Kendaraan', desc: 'Pantau status & data kendaraan dinas', gradient: 'from-sky-500 to-blue-600' },
  { icon: 'calendar_month', label: 'Ruang Rapat', desc: 'Booking & jadwal ruang rapat', gradient: 'from-violet-500 to-fuchsia-600' },
];

export default function Landing() {
  const { user, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  if (user) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full bg-white/80 backdrop-blur border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">Biro Umum</h1>
            <p className="text-xs text-slate-500 mt-0.5">Rumah Tangga &amp; Administrasi</p>
          </div>
        </div>
        <Link to="/login" className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-xl shadow-lg shadow-slate-900/10 transition">
          Masuk ke Dashboard
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </Link>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 px-4 md:px-8 py-14 md:py-20">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-fuchsia-400/10 blur-3xl"></div>
          <div className="relative max-w-[1100px] mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold mb-6 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Sistem Aktif &amp; Real-time
            </div>
            <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
              Portal Biro Umum &amp;<br className="hidden md:block" /> Rumah Tangga
            </h2>
            <p className="text-sm md:text-base text-white/80 mt-4 max-w-xl mx-auto">
              Satu pintu untuk pemeliharaan fasilitas, pengadaan barang &amp; jasa, kendaraan dinas, dan booking ruang rapat.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 mt-8">
              <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-700 text-sm font-bold rounded-xl shadow-xl shadow-black/10 hover:-translate-y-0.5 transition">
                Masuk ke Dashboard
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
              <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 border border-white/30 text-white text-sm font-bold rounded-xl backdrop-blur hover:bg-white/20 transition">
                Daftar Akun Pegawai
              </Link>
            </div>
          </div>
        </section>

        <div className="max-w-[1500px] mx-auto px-4 md:px-8 -mt-8 md:-mt-10 relative z-10">
          {/* Feature strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-white rounded-2xl border border-slate-200 shadow-lg shadow-slate-200/50 p-4 md:p-5">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white shadow-sm mb-3`}>
                  <span className="material-symbols-outlined text-[22px]">{f.icon}</span>
                </div>
                <div className="font-bold text-sm text-slate-900">{f.label}</div>
                <div className="text-xs text-slate-500 mt-1 leading-snug">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Schedule */}
          <div className="mt-10 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
              <span className="material-symbols-outlined text-[16px]">calendar_month</span>
              Jadwal Ruang Rapat
            </div>
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900">Cek Ketersediaan Ruang Rapat</h3>
            <p className="text-sm text-slate-500 mt-1.5 max-w-2xl">Lihat jadwal dan ketersediaan ruang rapat secara real-time, tanpa perlu login.</p>
          </div>

          <RuangRapatSchedule />

          {/* Closing CTA */}
          <div className="my-10 relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-5 shadow-xl">
            <div className="absolute -right-10 -top-10 w-56 h-56 rounded-full bg-white/5 blur-2xl"></div>
            <div className="relative">
              <h3 className="font-bold text-white text-lg">Punya akun pegawai?</h3>
              <p className="text-sm text-white/70 mt-1 max-w-md">Masuk untuk mengelola pemeliharaan, pengadaan, kendaraan, dan booking ruang rapat.</p>
            </div>
            <div className="relative flex gap-3 shrink-0">
              <Link to="/login" className="px-5 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-bold hover:bg-slate-100 transition">Masuk / Login</Link>
              <Link to="/register" className="px-5 py-2.5 rounded-xl border border-white/30 text-white text-sm font-bold hover:bg-white/10 transition">Daftar Akun</Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        © 2024 Biro Umum dan Rumah Tangga. Sistem Manajemen Fasilitas &amp; Operasional Kantor.
      </footer>
    </div>
  );
}
