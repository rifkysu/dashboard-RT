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

const NAV = [
  { href: '#fitur', label: 'Fitur' },
  { href: '#alur', label: 'Alur' },
  { href: '#jadwal', label: 'Jadwal Rapat' },
];

const STEPS = [
  { icon: 'person_add', title: 'Daftar akun pegawai', desc: 'Buat akun dan masuk ke dashboard sesuai hak akses Anda.' },
  { icon: 'edit_note', title: 'Ajukan permintaan', desc: 'Ajukan pemeliharaan, pengadaan, kendaraan, atau booking ruang rapat.' },
  { icon: 'monitoring', title: 'Pantau secara real-time', desc: 'Status permintaan diperbarui otomatis tanpa perlu memuat ulang.' },
];

function LandingMaintenanceNotice({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#0b1026]">
      <div className="max-w-xl w-full bg-white/[0.04] border border-amber-400/30 rounded-2xl shadow-2xl shadow-black/30 p-8 text-center backdrop-blur">
        <div className="w-16 h-16 rounded-2xl bg-amber-400/15 text-amber-300 flex items-center justify-center mx-auto mb-4">
          <span className="material-symbols-outlined text-[32px]">build</span>
        </div>
        <h2 className="text-xl font-bold text-white">Sedang Dalam Mode Maintenance</h2>
        <p className="text-sm text-slate-400 mt-2">{message || 'Halaman ini sedang dalam mode maintenance. Silakan coba lagi nanti.'}</p>
        <Link to="/login" className="inline-flex items-center gap-2 mt-6 px-5 py-2.5 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-indigo-50 transition">
          Masuk ke Dashboard
        </Link>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const [landingDown, setLandingDown] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

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

  if (loading || landingDown === null) return <div className="min-h-screen flex items-center justify-center bg-[#0b1026] text-slate-400">Memuat...</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  if (landingDown) return <LandingMaintenanceNotice message={landingDown.message} />;

  return (
    <div className="min-h-screen flex flex-col bg-[#0b1026] text-slate-200">
      {/* Top bar: transparan di atas hero, berubah jadi kapsul kaca saat di-scroll */}
      <div className="fixed top-0 inset-x-0 z-40">
        <div className={`hidden sm:block overflow-hidden transition-all duration-300 ${scrolled ? 'max-h-0 opacity-0' : 'max-h-10 opacity-100'}`}>
          <div className="max-w-[1300px] mx-auto px-4 md:px-8 py-2 flex items-center justify-between text-xs text-white/60 border-b border-white/10">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">mail</span>
              biroumum@kemnaker.go.id
            </div>
            <div className="flex items-center gap-5">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                Sistem Aktif &amp; Real-time
              </span>
              <Link to="/jadwal-rapat" className="inline-flex items-center gap-1 hover:text-white transition">
                <span className="material-symbols-outlined text-[14px]">tv</span>
                Kiosk Jadwal Rapat
              </Link>
            </div>
          </div>
        </div>

        <div className={`transition-all duration-300 ${scrolled ? 'px-3 md:px-6 pt-3' : 'px-0 pt-0'}`}>
          <header
            className={`mx-auto flex items-center justify-between transition-all duration-300 ${
              scrolled
                ? 'max-w-[1200px] rounded-full bg-slate-900/60 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/20 pl-3 pr-2 py-2'
                : 'max-w-[1300px] bg-transparent border border-transparent px-4 md:px-8 py-4'
            }`}
          >
            <Link to="/" className="flex items-center gap-3">
              <BrandMark size="sm" className="!border-white/20" />
              <div>
                <h1 className="text-base font-extrabold text-white leading-none tracking-tight">Biro Umum</h1>
                <p className="text-[11px] text-white/60 mt-1">Rumah Tangga &amp; Administrasi</p>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-1 p-1 rounded-full bg-white/[0.06] border border-white/10 text-sm font-semibold text-white/70">
              {NAV.map((n) => (
                <a key={n.href} href={n.href} className="px-4 py-1.5 rounded-full hover:bg-white/10 hover:text-white transition">{n.label}</a>
              ))}
            </nav>
            <div className="flex items-center gap-2">
              <Link to="/login" className="hidden sm:inline-block px-4 py-2.5 rounded-full text-sm font-semibold text-white/80 hover:text-white hover:bg-white/10 transition">
                Masuk
              </Link>
              <Link to="/register" className="group inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full bg-white text-slate-900 text-sm font-bold shadow-lg shadow-indigo-500/20 hover:bg-indigo-50 transition">
                Daftar
                <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition">arrow_forward</span>
              </Link>
            </div>
          </header>
        </div>
      </div>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden bg-[#0b1026] px-4 md:px-8 pt-32 pb-28 md:pt-44 md:pb-40">
          <div className="landing-aurora absolute -top-40 -left-24 w-[520px] h-[520px] rounded-full bg-indigo-600/40 blur-[110px]"></div>
          <div className="landing-aurora absolute top-10 right-[-120px] w-[480px] h-[480px] rounded-full bg-fuchsia-600/30 blur-[110px]" style={{ animationDelay: '-5s' }}></div>
          <div className="landing-aurora absolute bottom-[-180px] left-1/3 w-[520px] h-[420px] rounded-full bg-sky-500/25 blur-[110px]" style={{ animationDelay: '-9s' }}></div>
          <div className="landing-grid absolute inset-0"></div>

          <div className="relative max-w-[1300px] mx-auto grid md:grid-cols-2 gap-14 md:gap-10 items-center">
            <div className="text-center md:text-left landing-rise">
              <div className="inline-flex items-center gap-2 pl-1.5 pr-3.5 py-1.5 rounded-full bg-white/[0.07] border border-white/15 text-white/90 text-xs font-semibold mb-7 backdrop-blur">
                <span className="px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 text-[10px] font-bold tracking-wide">LIVE</span>
                Sistem terpusat &amp; real-time
              </div>
              <h2 className="text-4xl md:text-6xl font-extrabold text-white tracking-tight leading-[1.08]">
                Operasional kantor,{' '}
                <span className="bg-gradient-to-r from-amber-200 via-pink-300 to-violet-300 bg-clip-text text-transparent">jadi lebih ringan.</span>
              </h2>
              <p className="text-base md:text-lg text-slate-300/90 mt-6 max-w-xl mx-auto md:mx-0 leading-relaxed">
                Satu pintu untuk pemeliharaan fasilitas, pengadaan barang &amp; jasa, kendaraan dinas, dan booking ruang rapat &mdash; semuanya terpusat &amp; real-time.
              </p>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-9">
                <Link to="/register" className="group inline-flex items-center gap-2 px-6 py-3.5 bg-white text-slate-900 text-sm font-bold rounded-full shadow-2xl shadow-indigo-500/30 hover:-translate-y-0.5 transition">
                  Daftar Akun Pegawai
                  <span className="material-symbols-outlined text-[18px] group-hover:translate-x-0.5 transition">arrow_forward</span>
                </Link>
                <a href="#jadwal" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/20 bg-white/5 text-white text-sm font-bold hover:bg-white/10 backdrop-blur transition">
                  <span className="material-symbols-outlined text-[18px]">calendar_month</span>
                  Lihat Jadwal Rapat
                </a>
              </div>
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-7 gap-y-3 mt-10 text-slate-400 text-xs font-medium">
                <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] text-indigo-300">apps</span>4 Modul Terintegrasi</span>
                <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] text-amber-300">bolt</span>Sinkron Real-time</span>
                <span className="inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px] text-emerald-300">verified_user</span>Aman &amp; Terpusat</span>
              </div>
            </div>

            {/* Product preview mockup */}
            <div className="relative hidden md:block landing-rise" style={{ animationDelay: '.15s' }}>
              <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-indigo-500/30 via-fuchsia-500/20 to-sky-400/30 blur-2xl"></div>
              <div className="landing-float relative bg-[#111735]/90 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/50 ring-1 ring-white/10 overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-3 bg-white/[0.03] border-b border-white/10">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-400"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                  <span className="ml-3 flex-1 max-w-[260px] px-3 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-slate-400 font-medium truncate">biroumum.kemnaker.go.id/dashboard</span>
                </div>
                <div className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[11px] font-bold text-slate-500 tracking-widest">RINGKASAN HARI INI</div>
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>Live</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {FEATURES.map((f) => (
                      <div key={f.label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3 flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white shadow-sm shrink-0`}>
                          <span className="material-symbols-outlined text-[16px]">{f.icon}</span>
                        </div>
                        <div className="text-[11px] font-semibold text-slate-200 leading-tight">{f.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="rounded-xl border border-white/10 divide-y divide-white/10">
                    <div className="flex items-center gap-3 p-3">
                      <span className="material-symbols-outlined text-emerald-400 text-[18px]">check_circle</span>
                      <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-slate-100 truncate">Booking Ruang Serbaguna disetujui</div></div>
                      <span className="text-[10px] font-bold text-emerald-300 bg-emerald-400/10 px-2 py-0.5 rounded-full">Selesai</span>
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <span className="material-symbols-outlined text-amber-400 text-[18px]">schedule</span>
                      <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-slate-100 truncate">Pengadaan ATK sedang diproses</div></div>
                      <span className="text-[10px] font-bold text-amber-300 bg-amber-400/10 px-2 py-0.5 rounded-full">Proses</span>
                    </div>
                    <div className="flex items-center gap-3 p-3">
                      <span className="material-symbols-outlined text-sky-400 text-[18px]">directions_car</span>
                      <div className="flex-1 min-w-0"><div className="text-xs font-semibold text-slate-100 truncate">Kendaraan dinas siap digunakan</div></div>
                      <span className="text-[10px] font-bold text-sky-300 bg-sky-400/10 px-2 py-0.5 rounded-full">Tersedia</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="landing-float-slow absolute -bottom-8 -left-10 bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/40 border border-white/10 p-3.5 flex items-center gap-3 w-60">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="material-symbols-outlined text-[20px]">event_available</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white">Booking Diterima</div>
                  <div className="text-[10px] text-slate-400">Ruang Serbaguna &middot; 09:00</div>
                </div>
              </div>

              <div className="landing-float-slow absolute -top-6 -right-6 bg-slate-900/80 backdrop-blur-xl rounded-2xl shadow-2xl shadow-black/40 border border-white/10 px-4 py-3 flex items-center gap-2.5" style={{ animationDelay: '-4s' }}>
                <div className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                </div>
                <div>
                  <div className="text-sm font-extrabold text-white leading-none">Real-time</div>
                  <div className="text-[10px] text-slate-400 mt-1">Sinkron otomatis</div>
                </div>
              </div>
            </div>
          </div>

        </section>

        <div className="max-w-[1300px] mx-auto px-4 md:px-8 -mt-16 md:-mt-24 relative z-10">
          {/* Features */}
          <section id="fitur" className="scroll-mt-28">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FEATURES.map((f, i) => (
                <div
                  key={f.label}
                  className="landing-rise group relative bg-[#121936]/80 backdrop-blur-xl rounded-3xl border border-white/10 shadow-2xl shadow-black/30 p-6 hover:-translate-y-1 hover:border-white/20 hover:bg-[#161e40]/90 transition duration-300 overflow-hidden"
                  style={{ animationDelay: `${0.2 + i * 0.08}s` }}
                >
                  <div className={`absolute -top-16 -right-16 w-40 h-40 rounded-full bg-gradient-to-br ${f.gradient} opacity-20 group-hover:opacity-40 blur-2xl transition duration-500`}></div>
                  <div className={`relative w-12 h-12 rounded-2xl bg-gradient-to-br ${f.gradient} flex items-center justify-center text-white shadow-lg mb-5 group-hover:scale-105 transition`}>
                    <span className="material-symbols-outlined text-[24px]">{f.icon}</span>
                  </div>
                  <div className="relative font-bold text-base text-white">{f.label}</div>
                  <div className="relative text-sm text-slate-400 mt-1.5 leading-relaxed">{f.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* How it works */}
          <section id="alur" className="scroll-mt-28 mt-24 md:mt-28">
            <div className="text-center max-w-2xl mx-auto">
              <div className="text-xs font-bold tracking-[0.2em] text-indigo-300">ALUR PENGGUNAAN</div>
              <h3 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight mt-3">Mulai dalam tiga langkah</h3>
              <p className="text-sm md:text-base text-slate-400 mt-3">Dari pendaftaran hingga pemantauan, semua permintaan tercatat rapi di satu tempat.</p>
            </div>
            <div className="relative grid md:grid-cols-3 gap-10 md:gap-5 mt-12">
              <div className="hidden md:block absolute top-9 left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-indigo-400/50 to-transparent"></div>
              {STEPS.map((s, i) => (
                <div key={s.title} className="relative text-center px-4">
                  <div className="relative mx-auto w-[72px] h-[72px] rounded-full bg-[#121936] border border-white/10 shadow-lg shadow-indigo-500/10 flex items-center justify-center">
                    <span className="material-symbols-outlined text-[28px] text-indigo-300">{s.icon}</span>
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-gradient-to-br from-indigo-500 to-violet-500 text-white text-[11px] font-bold flex items-center justify-center ring-4 ring-[#0b1026]">{i + 1}</span>
                  </div>
                  <div className="font-bold text-white mt-5">{s.title}</div>
                  <div className="text-sm text-slate-400 mt-1.5 max-w-xs mx-auto leading-relaxed">{s.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* Schedule */}
          <section id="jadwal" className="scroll-mt-28 mt-24 md:mt-28 relative overflow-hidden rounded-[28px] bg-[#0f1530] border border-white/10 p-5 md:p-10 shadow-2xl shadow-black/30">
            <div className="landing-grid absolute inset-0"></div>
            <div className="absolute -top-24 -right-16 w-80 h-80 rounded-full bg-violet-600/40 blur-[90px]"></div>
            <div className="absolute -bottom-28 -left-20 w-96 h-96 rounded-full bg-indigo-600/40 blur-[90px]"></div>

            <div className="relative flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-white text-xs font-semibold mb-3 backdrop-blur">
                  <span className="material-symbols-outlined text-[16px]">calendar_month</span>
                  Jadwal Ruang Rapat
                </div>
                <h3 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">Cek Ketersediaan Ruang Rapat</h3>
                <p className="text-sm md:text-base text-slate-300 mt-2 max-w-2xl">Lihat jadwal dan ketersediaan ruang rapat secara real-time, tanpa perlu login.</p>
              </div>
              <Link to="/jadwal-rapat" className="self-start md:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-full border border-white/20 bg-white/5 text-white text-sm font-semibold hover:bg-white/10 transition shrink-0">
                <span className="material-symbols-outlined text-[18px]">open_in_full</span>
                Mode Kiosk
              </Link>
            </div>

            <div className="relative mt-7 landing-dark-schedule">
              <RuangRapatSchedule />
            </div>
          </section>

          {/* Closing CTA */}
          <section className="my-20 relative overflow-hidden rounded-[28px] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 px-6 py-12 md:px-14 md:py-16 text-center shadow-2xl shadow-violet-600/20">
            <div
              className="absolute inset-0 opacity-20"
              style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }}
            ></div>
            <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[600px] h-40 rounded-full bg-white/20 blur-3xl"></div>
            <div className="relative">
              <h3 className="text-2xl md:text-4xl font-extrabold text-white tracking-tight">Punya akun pegawai?</h3>
              <p className="text-sm md:text-base text-white/80 mt-3 max-w-xl mx-auto">Masuk untuk mengelola pemeliharaan, pengadaan, kendaraan, dan booking ruang rapat.</p>
              <div className="flex flex-wrap justify-center gap-3 mt-8">
                <Link to="/login" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full bg-white text-slate-900 text-sm font-bold shadow-xl shadow-black/10 hover:-translate-y-0.5 transition">
                  <span className="material-symbols-outlined text-[18px]">login</span>
                  Masuk / Login
                </Link>
                <Link to="/register" className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-white/40 text-white text-sm font-bold hover:bg-white/10 transition">
                  Daftar Akun
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="w-full bg-[#080c1f] border-t border-white/10">
        <div className="max-w-[1300px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-3">
            <BrandMark size="xs" />
            <div>
              <div className="text-sm font-bold text-white">Biro Umum dan Rumah Tangga</div>
              <div className="text-xs text-slate-400">Sistem Manajemen Fasilitas &amp; Operasional Kantor</div>
            </div>
          </div>
          <nav className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs font-semibold text-slate-400">
            {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-white transition">{n.label}</a>)}
            <Link to="/jadwal-rapat" className="hover:text-white transition">Kiosk</Link>
            <Link to="/login" className="hover:text-white transition">Masuk</Link>
          </nav>
        </div>
        <div className="border-t border-white/5 py-4 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Biro Umum dan Rumah Tangga. Seluruh hak dilindungi.
        </div>
      </footer>
    </div>
  );
}
