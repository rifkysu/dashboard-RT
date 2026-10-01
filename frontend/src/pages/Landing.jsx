import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import RuangRapatSchedule from '../components/RuangRapatSchedule';
import api from '../api';
import { subscribeLive } from '../live';

const LAYANAN = [
  { icon: 'build', label: 'Pemeliharaan', desc: 'Pengajuan perbaikan gedung, sarana, dan prasarana. Diproses bertahap: analisa & HPS, invoice & pembayaran, lalu dokumentasi/BAST.' },
  { icon: 'shopping_cart', label: 'Pengadaan', desc: 'Pengadaan barang dan jasa melalui Lelang, E-Purchasing, atau Pengadaan Langsung, dengan tahapan yang sama seperti pemeliharaan.' },
  { icon: 'directions_car', label: 'Kendaraan Dinas', desc: 'Data kendaraan dinas beserta statusnya, dengan pengingat pajak yang jatuh tempo dalam 14 hari.' },
  { icon: 'calendar_month', label: 'Ruang Rapat', desc: 'Booking ruang rapat lengkap dengan surat permohonan. Jadwalnya bisa dilihat siapa saja tanpa login.' },
];

const RUANG = ['Serbaguna', 'Setjen II', 'Tri Dharma', 'Biro Umum', 'Graha Kemnaker'];

const LANGKAH = [
  { title: 'Daftar akun pegawai', desc: 'Isi nama, email, nomor HP, dan unit kerja. Setelah itu masuk dengan email dan kata sandi, atau lewat SSO.' },
  { title: 'Ajukan dari menu layanan', desc: 'Pilih Pemeliharaan, Pengadaan, atau Ruang Rapat, lalu lengkapi formulir dan unggah dokumen pendukung.' },
  { title: 'Pantau statusnya', desc: 'Setiap permintaan bergerak dari Pending ke On Progress hingga Selesai. Perubahan langsung terlihat di dashboard.' },
];

const NAV = [
  { href: '#layanan', label: 'Layanan' },
  { href: '#jadwal', label: 'Jadwal Ruang Rapat' },
  { href: '#cara', label: 'Cara Mengajukan' },
];

const EMAIL = 'biroumum@kemnaker.go.id';

function LandingMaintenanceNotice({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-[#f2f4f7]">
      <div className="max-w-lg w-full bg-white border border-slate-200 rounded-lg p-8">
        <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
          <span className="material-symbols-outlined text-[20px]">build</span>Sedang dalam pemeliharaan sistem
        </div>
        <h2 className="text-xl font-bold text-slate-900 mt-3">Halaman ini sementara tidak tersedia</h2>
        <p className="text-sm text-slate-600 mt-2">{message || 'Silakan coba lagi nanti.'}</p>
        <Link to="/login" className="inline-block mt-6 px-5 py-2.5 rounded-md bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#152b47]">
          Masuk ke aplikasi
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
    return subscribeLive((topic) => { if (topic === 'maintenance' || topic === '*') refresh(); });
  }, []);

  if (loading || landingDown === null) return <div className="min-h-screen flex items-center justify-center bg-[#f2f4f7] text-slate-500 text-sm">Memuat…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  if (landingDown) return <LandingMaintenanceNotice message={landingDown.message} />;

  return (
    <div className="min-h-screen flex flex-col bg-[#f2f4f7] text-slate-800">
      {/* Strip instansi */}
      <div className="bg-[#152b47] text-white/75 text-xs">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-1.5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
          <span>Kementerian Ketenagakerjaan Republik Indonesia</span>
          <span className="hidden sm:inline select-all">{EMAIL}</span>
        </div>
      </div>

      <header className="sticky top-0 z-40 bg-white border-b border-slate-200">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" />
            <div className="min-w-0">
              <div className="text-sm font-bold text-slate-900 leading-tight truncate">Biro Umum dan Rumah Tangga</div>
              <div className="text-[11px] text-slate-500 leading-tight truncate">Aplikasi Layanan Internal</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-[#1e3a5f]">{n.label}</a>)}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/register" className="hidden sm:inline-block px-4 py-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-slate-500">Daftar</Link>
            <Link to="/login" className="px-4 py-2 rounded-md bg-[#1e3a5f] text-white text-sm font-semibold hover:bg-[#152b47]">Masuk</Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Pembuka */}
        <section className="bg-[#1e3a5f] text-white">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-14 md:py-20 grid md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 md:gap-16 items-start">
            <div>
              <h1 className="text-3xl md:text-[2.6rem] font-bold leading-tight tracking-tight [text-wrap:balance]">
                Pemeliharaan, pengadaan, kendaraan dinas, dan ruang rapat dalam satu aplikasi.
              </h1>
              <p className="text-base text-white/80 mt-5 max-w-[60ch] leading-relaxed">
                Pegawai mengajukan permintaan dan memantau prosesnya dari sini. Biro Umum menindaklanjuti setiap permintaan sampai selesai, dan semua riwayatnya tercatat.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <Link to="/login" className="px-5 py-3 rounded-md bg-white text-[#1e3a5f] text-sm font-bold hover:bg-slate-100">Masuk ke aplikasi</Link>
                <Link to="/register" className="px-5 py-3 rounded-md border border-white/40 text-white text-sm font-semibold hover:bg-white/10">Daftar akun pegawai</Link>
              </div>
            </div>

            <div className="bg-white/[0.06] border border-white/15 rounded-lg">
              <div className="px-5 py-3 border-b border-white/15 text-sm font-semibold">Ruang rapat yang bisa dipesan</div>
              <ul className="divide-y divide-white/10">
                {RUANG.map((r) => (
                  <li key={r} className="px-5 py-2.5 text-sm text-white/90">{r}</li>
                ))}
              </ul>
              <a href="#jadwal" className="block px-5 py-3 border-t border-white/15 text-sm font-semibold text-white hover:bg-white/5">Lihat jadwal hari ini ↓</a>
            </div>
          </div>
        </section>

        {/* Layanan */}
        <section id="layanan" className="scroll-mt-20 max-w-[1200px] mx-auto px-4 md:px-8 py-14 md:py-16">
          <h2 className="text-2xl font-bold text-slate-900">Layanan</h2>
          <p className="text-sm text-slate-600 mt-1.5 max-w-[60ch]">Empat layanan yang bisa diajukan dan dipantau setelah masuk.</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-8 mt-8">
            {LAYANAN.map((l) => (
              <div key={l.label} className="border-t-2 border-[#1e3a5f] pt-4">
                <div className="flex items-center gap-2 font-bold text-slate-900">
                  <span className="material-symbols-outlined text-[20px] text-[#1e3a5f]">{l.icon}</span>{l.label}
                </div>
                <p className="text-sm text-slate-600 mt-2 leading-relaxed">{l.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Jadwal */}
        <section id="jadwal" className="scroll-mt-20 bg-white border-y border-slate-200">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-14 md:py-16">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold text-slate-900">Jadwal ruang rapat</h2>
                <p className="text-sm text-slate-600 mt-1.5 max-w-[60ch]">Cek ruang yang masih kosong sebelum mengajukan booking. Jadwal ini bisa dilihat tanpa login.</p>
              </div>
              <Link to="/jadwal-rapat" className="self-start md:self-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-md border border-slate-300 text-sm font-semibold text-slate-700 hover:border-slate-500 shrink-0">
                <span className="material-symbols-outlined text-[18px]">tv</span>Tampilan layar penuh (kiosk)
              </Link>
            </div>
            <div className="mt-6">
              <RuangRapatSchedule />
            </div>
          </div>
        </section>

        {/* Cara mengajukan */}
        <section id="cara" className="scroll-mt-20 max-w-[1200px] mx-auto px-4 md:px-8 py-14 md:py-16">
          <h2 className="text-2xl font-bold text-slate-900">Cara mengajukan</h2>
          <ol className="grid md:grid-cols-3 gap-8 mt-8">
            {LANGKAH.map((s, i) => (
              <li key={s.title} className="flex gap-4">
                <span className="w-8 h-8 shrink-0 rounded-full border-2 border-[#1e3a5f] text-[#1e3a5f] text-sm font-bold flex items-center justify-center tabular-nums">{i + 1}</span>
                <div>
                  <div className="font-bold text-slate-900">{s.title}</div>
                  <p className="text-sm text-slate-600 mt-1.5 leading-relaxed">{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-10 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
            <span>Sudah punya akun?</span>
            <Link to="/login" className="font-semibold text-[#1e3a5f] hover:underline">Masuk sekarang →</Link>
          </div>
        </section>
      </main>

      <footer className="bg-[#152b47] text-white/70">
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-8 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <div className="text-sm font-bold text-white">Biro Umum dan Rumah Tangga</div>
            <div className="text-xs mt-1">Kementerian Ketenagakerjaan Republik Indonesia</div>
            <div className="text-xs mt-1 select-all">{EMAIL}</div>
          </div>
          <nav className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold">
            {NAV.map((n) => <a key={n.href} href={n.href} className="hover:text-white">{n.label}</a>)}
            <Link to="/jadwal-rapat" className="hover:text-white">Kiosk</Link>
            <Link to="/login" className="hover:text-white">Masuk</Link>
          </nav>
        </div>
        <div className="border-t border-white/10 py-4 text-center text-xs text-white/50">
          © {new Date().getFullYear()} Biro Umum dan Rumah Tangga
        </div>
      </footer>
    </div>
  );
}
