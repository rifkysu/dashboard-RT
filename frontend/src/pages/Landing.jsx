import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import RuangRapatSchedule from '../components/RuangRapatSchedule';
import api from '../api';

const FEATURES = [
  { icon: 'build', label: 'Pemeliharaan', desc: 'Kelola perbaikan & perawatan fasilitas', gradient: 'from-emerald-500 to-teal-600' },
  { icon: 'shopping_cart', label: 'Pengadaan', desc: 'Proses pengadaan barang & jasa', gradient: 'from-amber-500 to-orange-600' },
  { icon: 'directions_car', label: 'Kendaraan', desc: 'Pantau status & data kendaraan dinas', gradient: 'from-sky-500 to-blue-600' },
  { icon: 'calendar_month', label: 'Ruang Rapat', desc: 'Booking & jadwal ruang rapat', gradient: 'from-violet-500 to-fuchsia-600' },
];

function LandingMaintenanceNotice({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="max-w-xl w-full bg-white border border-amber-200 rounded-2xl shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px]">build</span>
        </div>
        <h2 className="text-xl font-bold text-slate-900">Sedang Dalam Mode Maintenance</h2>
        <p className="text-sm text-slate-500 mt-2">{message || 'Halaman ini sedang dalam mode maintenance. Silakan coba lagi nanti.'}</p>
        <Link to="/login" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 transition">
          Masuk ke Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const [landingDown, setLandingDown] = useState(null);

  useEffect(() => {
    function refresh() {
      api.get('/maintenance/landing-status').then((res) => {
        setLandingDown(res.data?.data?.is_active ? res.data.data : false);
      }).catch(() => setLandingDown(false));
    }
    refresh();
    const streamUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/maintenance/stream`;
    const es = new EventSource(streamUrl);
    es.onmessage = refresh;
    return () => es.close();
  }, []);

  if (loading || landingDown === null) return <div className="min-h-screen flex items-center justify-center text-slate-500">Memuat...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  if (landingDown) return <LandingMaintenanceNotice message={landingDown.message} />;

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      {/* Utility bar */}
      <div className="hidden sm:flex w-full bg-slate-900 text-white text-xs px-6 py-1.5 items-center justify-between">
        <div className="flex items-center gap-1.5 text-white/70">
          <span className="material-symbols-outlined text-[14px]">mail</span>
          biroumum@kemnaker.go.id
        </div>
        <div className="flex items-center gap-5">
          <span className="inline-flex items-center gap-1.5 text-white/70">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            Sistem Aktif &amp; Real-time
          </span>
          <Link to="/jadwal-rapat" className="text-white/70 hover:text-white transition">Kiosk Jadwal Rapat</Link>
        </div>
      </div>

      <header className="w-full bg-white/90 backdrop-blur border-b border-slate-200 px-6 py-3.5 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">Biro Umum</h1>
            <p className="text-xs text-slate-500 mt-0.5">Rumah Tangga &amp; Administrasi</p>
          </div>
        </div>
        <nav className="hidden md:flex items-center gap-7 text-sm font-semibold text-slate-600">
          <a href="#fitur" className="hover:text-slate-900 transition">Fitur</a>
          <a href="#jadwal" className="hover:text-slate-900 transition">Jadwal Rapat</a>
        </nav>
        <div className="flex items-center gap-2.5">
          <Link to="/login" className="hidden sm:inline-block px-4 py-2.5 text-sm font-semibold text-slate-700 hover:text-slate-900 transition">
            Masuk
          </Link>
          <Link to="/register" className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border-2 border-slate-900 text-slate-900 text-sm font-bold hover:bg-slate-900 hover:text-white transition">
            Daftar Gratis
          </Link>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-gradient-to-br from-indigo-700 via-blue-700 to-violet-700 px-4 md:px-8 pt-14 pb-24 md:pt-20 md:pb-32">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-white/10 blur-2xl"></div>
          <div className="absolute top-1/2 left-1/3 w-64 h-64 rounded-full bg-fuchsia-400/10 blur-3xl"></div>
          <div className="relative max-w-[1300px] mx-auto grid md:grid-cols-2 gap-12 md:gap-8 items-center">
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/20 text-white text-xs font-semibold mb-6 backdrop-blur">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Sistem Aktif &amp; Real-time
              </div>
              <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-tight">
                Atur operasional kantor<br className="hidden md:block" /> lebih mudah dengan <span className="text-amber-300">Biro Umum</span>
              </h2>
              <p className="text-sm md:text-base text-white/80 mt-4 max-w-lg mx-auto md:mx-0">
                Satu pintu untuk pemeliharaan fasilitas, pengadaan barang &amp; jasa, kendaraan dinas, dan booking ruang rapat &mdash; semuanya terpusat &amp; real-time.
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-8">
                <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-indigo-700 text-sm font-bold rounded-xl shadow-xl shadow-black/10 hover:-translate-y-0.5 transition">
                  Daftar Akun Pegawai
                  <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                </Link>
                <a href="#jadwal" className="inline-flex items-center gap-2 px-6 py-3 text-white text-sm font-bold hover:text-white/80 transition">
                  <span className="w-9 h-9 rounded-full bg-white/15 border border-white/30 flex items-center justify-center backdrop-blur">
                    <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  </span>
                  Lihat Jadwal Rapat
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-6 gap-y-2 mt-9 text-white/70 text-xs">
                <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">apps</span>4 Modul Terintegrasi</span>
                <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">bolt</span>Real-time</span>
                <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">lock</span>Aman &amp; Terpusat</span>
              </div>
            </div>

            {/* Product preview mockup */}
            <div className="relative hidden md:block">
              <div className="relative bg-white rounded-2xl shadow-2xl shadow-black/40 border border-white/20 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-3 bg-slate-100 border-b border-slate-200">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span className="ml-3 text-[11px] text-slate-400 font-medium truncate">biroumum.kemnaker.go.id/dashboard</span>
                </div>
                <div className="p-5">
                  <div className="text-[11px] font-bold text-slate-400 tracking-wide mb-3">RINGKASAN HARI INI</div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {FEATURES.map((f) => (
                      <div key={f.label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white mb-2`}>
                          <span className="material-symbols-outlined text-[16px]">{f.icon}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-700 leading-tight">{f.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-slate-100 divide-y divide-slate-100">
                    <div className="flex items-center gap-3 p-3">
                      <span className="material-symbols-outlined text-emerald-600 text-[18px]">check_circle</span>
                      <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-slate-800 truncate">Booking Ruang Serbaguna disetujui</div></div>
                      <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Selesai</span>
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <span className="material-symbols-outlined text-amber-600 text-[18px]">schedule</span>
                      <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-slate-800 truncate">Pengadaan ATK sedang diproses</div></div>
                      <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">Proses</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute -bottom-6 -left-8 bg-white rounded-xl shadow-xl border border-slate-100 p-3 flex items-center gap-3 w-56">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[20px]">check_circle</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800">Booking Diterima</div>
                  <div className="text-[10px] text-slate-500">Ruang Serbaguna &middot; 09:00</div>
                </div>
              </div>

              <div className="absolute -top-5 -right-5 bg-white rounded-xl shadow-xl border border-slate-100 px-4 py-2.5 flex items-center gap-2.5">
                <span className="material-symbols-outlined text-indigo-600 text-[20px]">bolt</span>
                <div>
                  <div className="text-sm font-extrabold text-slate-900 leading-none">Real-time</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Sinkron otomatis</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="max-w-[1500px] mx-auto px-4 md:px-8 -mt-12 md:-mt-16 relative z-10">
          {/* Feature strip */}
          <div id="fitur" className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 scroll-mt-24">
            {FEATURES.map((f) => (
              <div key={f.label} className="bg-white rounded-2xl border-2 border-slate-200 hover:border-indigo-300 shadow-lg shadow-slate-200/50 p-4 md:p-5 transition">
                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white shadow-sm mb-3`}>
                  <span className="material-symbols-outlined text-[22px]">{f.icon}</span>
                </div>
                <div className="font-bold text-sm text-slate-900">{f.label}</div>
                <div className="text-xs text-slate-500 mt-1 leading-snug">{f.desc}</div>
              </div>
            ))}
          </div>

          {/* Schedule */}
          <div id="jadwal" className="scroll-mt-24 mt-14 relative overflow-hidden rounded-3xl border border-white/20 bg-gradient-to-br from-indigo-700 via-blue-700 to-violet-700 p-5 md:p-10 shadow-xl shadow-indigo-900/20">
            <div
              className="absolute inset-0 opacity-[0.15]"
              style={{ backgroundImage: 'radial-gradient(currentColor 1.5px, transparent 1.5px)', backgroundSize: '22px 22px', color: '#ffffff' }}
            ></div>
            <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-white/10 blur-3xl"></div>
            <div className="absolute -bottom-24 -left-20 w-80 h-80 rounded-full bg-fuchsia-400/20 blur-3xl"></div>
            <div className="absolute top-1/3 right-1/4 w-40 h-40 rounded-full bg-sky-300/20 blur-3xl"></div>

            <div className="relative">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-white/15 border border-white/20 text-white text-xs font-semibold mb-3 backdrop-blur">
                <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                Jadwal Ruang Rapat
              </div>
              <h3 className="text-2xl md:text-3xl font-bold text-white">Cek Ketersediaan Ruang Rapat</h3>
              <p className="text-sm text-white/80 mt-1.5 max-w-2xl">Lihat jadwal dan ketersediaan ruang rapat secara real-time, tanpa perlu login.</p>
            </div>

            <div className="relative mt-6">
              <RuangRapatSchedule />
            </div>
          </div>

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
