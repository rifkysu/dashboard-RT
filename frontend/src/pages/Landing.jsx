import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import RuangRapatSchedule from '../components/RuangRapatSchedule';
import useRuangRapatLive from '../hooks/useRuangRapatLive';
import { iso } from '../hooks/useMonthSchedule';
import api from '../api';
import { subscribeLive } from '../live';

const LAYANAN = [
  { icon: 'build', label: 'Pemeliharaan', desc: 'Pengajuan perbaikan gedung, sarana, dan prasarana kantor, dengan dokumen pendukung dari awal.', tags: ['Analisa & HPS', 'Pembayaran', 'Dokumentasi/BAST'], sep: '→' },
  { icon: 'shopping_cart', label: 'Pengadaan', desc: 'Pengadaan barang dan jasa dengan tahapan yang sama seperti pemeliharaan, sampai serah terima.', tags: ['Lelang', 'E-Purchasing', 'Pengadaan Langsung'] },
  { icon: 'directions_car', label: 'Kendaraan Dinas', desc: 'Data kendaraan dinas, dokumen BPKB/STNK, riwayat service, dan pengingat pajak H-14.', tags: ['Roda 2', 'Roda 4', 'Roda 6'] },
  { icon: 'calendar_month', label: 'Ruang Rapat', desc: 'Booking ruang rapat lengkap dengan surat permohonan. Jadwalnya terbuka untuk dilihat tanpa login.', tags: ['5 ruang', 'Surat permohonan', 'Multi-hari'] },
];

const RUANG = ['SERBAGUNA', 'SETJEN II', 'TRI DHARMA', 'BIRO UMUM', 'GRAHA KEMNAKER'];
const judulRuang = (r) => r.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bIi\b/, 'II');

const LANGKAH = [
  { title: 'Daftar akun pegawai', desc: 'Isi nama, email, nomor HP, dan unit kerja. Masuk dengan email dan kata sandi.' },
  { title: 'Ajukan dari menu layanan', desc: 'Pilih Pemeliharaan, Pengadaan, atau Ruang Rapat, lengkapi formulir, lalu unggah dokumen pendukung.' },
  { title: 'Pantau sampai selesai', desc: 'Status bergerak dari Pending ke On Progress hingga Selesai, dan perubahannya langsung terlihat.' },
];

const NAV = [
  { href: '#layanan', label: 'Layanan' },
  { href: '#jadwal', label: 'Jadwal Ruang Rapat' },
  { href: '#cara', label: 'Cara Mengajukan' },
  { href: '#faq', label: 'FAQ' },
];

const KEUNGGULAN = [
  { icon: 'bolt', title: 'Realtime', desc: 'Perubahan status dan jadwal langsung terlihat tanpa memuat ulang halaman.' },
  { icon: 'folder_managed', title: 'Dokumen tercatat', desc: 'Dokumen pendukung, invoice, dan BAST tersimpan di setiap permintaan.' },
  { icon: 'verified_user', title: 'Akses sesuai peran', desc: 'Karyawan, PIC, Kepala Bagian, dan Admin punya hak akses masing-masing.' },
  { icon: 'devices', title: 'Bisa dari HP', desc: 'Tampilan menyesuaikan layar, nyaman dibuka dari komputer maupun ponsel.' },
];

const FAQ = [
  { q: 'Siapa yang bisa memakai aplikasi ini?', a: 'Pegawai yang memiliki email kedinasan @kemnaker.go.id. Daftar lewat halaman Daftar Akun; akun baru otomatis berperan Karyawan, dan peran lain diatur oleh Admin.' },
  { q: 'Apakah jadwal ruang rapat bisa dilihat tanpa login?', a: 'Bisa. Jadwal di halaman ini dan tampilan layar penuh (kiosk) terbuka untuk umum dan diperbarui otomatis. Untuk booking, Anda perlu masuk terlebih dahulu.' },
  { q: 'Bagaimana cara booking ruang rapat?', a: 'Masuk, buka menu Jadwal Ruang Rapat, lalu klik sel ruangan dan tanggal yang masih kosong (atau tombol Booking Ruang Rapat). Surat permohonan bisa diunggah saat itu juga atau menyusul; status surat berubah hijau setelah surat diunggah.' },
  { q: 'Bagaimana memantau permintaan pemeliharaan atau pengadaan?', a: 'Setiap permintaan punya nomor dan status Pending, On Progress, hingga Selesai. Perubahannya tampil langsung di menu terkait dan di Dashboard.' },
  { q: 'Saya lupa kata sandi, apa yang harus dilakukan?', a: 'Klik "Lupa kata sandi" di halaman Masuk. Link reset dikirim ke email Anda bila layanan email aktif; jika tidak, permintaan diteruskan ke Admin yang akan mengirimkan link reset (berlaku 1 jam).' },
];

const STATS = [
  { value: '4', label: 'layanan terpadu' },
  { value: RUANG.length, label: 'ruang rapat' },
  { value: 'Live', label: 'status realtime' },
];

const EMAIL = 'biroumum@kemnaker.go.id';
const jamSekarang = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

// Bagian halaman muncul pelan saat discroll ke layar (gaya .reveal di app-theme.css).
function Reveal({ children, delay = 0, className = '', as: Tag = 'div' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setShown(true); return undefined; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setShown(true); io.disconnect(); } }, { threshold: 0.12 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref} style={{ '--reveal-delay': `${delay}ms` }} className={`reveal ${shown ? 'is-visible' : ''} ${className}`}>{children}</Tag>;
}

// Status tiap ruang rapat hari ini dari jadwal publik: Dipakai s/d jam X, atau Kosong (+ booking berikutnya).
function RuangHariIni() {
  const [items, setItems] = useState(null);
  const [jam, setJam] = useState(jamSekarang);
  const today = iso();

  function load() {
    api.get('/ruang-rapat/public-schedule', { params: { from: today, to: today } })
      .then((r) => setItems(r.data.data || []))
      .catch(() => setItems((prev) => prev || []));
  }
  useEffect(() => {
    load();
    const t = setInterval(() => setJam(jamSekarang()), 30000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useRuangRapatLive(load);

  const rooms = RUANG.map((room) => {
    const list = (items || [])
      .filter((x) => x.room === room && !x.cancelled && x.date <= today && (x.end_date || x.date) >= today)
      .sort((a, b) => a.start.localeCompare(b.start));
    return { room, now: list.find((x) => x.start <= jam && jam < x.end), next: list.find((x) => x.start > jam) };
  });
  const kosong = rooms.filter((r) => !r.now).length;
  const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="relative bg-white text-slate-800 rounded-2xl shadow-[0_30px_80px_-28px_rgba(0,0,0,.7)] ring-1 ring-white/20 overflow-hidden">
      <div className="h-1 bg-gradient-to-r from-kuningan via-[#e4c27f] to-kuningan"></div>
      <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-dinas-ink">Ruang rapat hari ini</span>
            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
              <span className="relative flex w-1.5 h-1.5"><span className="absolute inset-0 rounded-full bg-red-500 motion-safe:animate-ping"></span><span className="relative w-1.5 h-1.5 rounded-full bg-red-500"></span></span>Live
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{tanggal} · pukul {jam}</div>
        </div>
        {items && <span className="shrink-0 text-[11px] font-bold px-2 py-1 rounded-md bg-emerald-50 text-emerald-700">{kosong}/{RUANG.length} kosong</span>}
      </div>
      <ul className="border-t border-slate-100 divide-y divide-slate-100">
        {rooms.map((r) => (
          <li key={r.room} className="px-5 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50">
            <span className="relative flex w-2 h-2 shrink-0">
              {items && r.now && <span className="absolute inset-0 rounded-full bg-red-400 opacity-75 motion-safe:animate-ping"></span>}
              <span className={`relative w-2 h-2 rounded-full ${!items ? 'bg-slate-300' : r.now ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-dinas-ink">{judulRuang(r.room)}</div>
              {items && r.now && <div className="text-xs text-slate-500 truncate">{r.now.title}</div>}
            </div>
            <div className="text-right text-xs shrink-0">
              {!items ? <span className="text-slate-400">Memuat…</span>
                : r.now ? <span className="font-semibold text-red-600">Dipakai s/d {r.now.end}</span>
                  : <span className="font-semibold text-emerald-700">Kosong{r.next && <span className="font-normal text-slate-500"> · booking {r.next.start}</span>}</span>}
            </div>
          </li>
        ))}
      </ul>
      <a href="#jadwal" className="group flex items-center justify-between px-5 py-3 bg-slate-50 border-t border-slate-100 text-xs font-bold text-dinas hover:bg-slate-100">
        Lihat jadwal lengkap<span className="material-symbols-outlined text-[16px] transition-transform group-hover:translate-y-0.5">arrow_downward</span>
      </a>
    </div>
  );
}

// Posisi gulir halaman (0..1). Dipakai komponen kecil di bawah supaya hanya mereka yang
// di-render ulang saat digulir, bukan seluruh landing page.
function useScrollRatio() {
  const [ratio, setRatio] = useState(0);
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        setRatio(max > 0 ? Math.min(1, window.scrollY / max) : 0);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, []);
  return ratio;
}

// Garis kemajuan baca di bawah header.
function ScrollProgress() {
  const ratio = useScrollRatio();
  return <div className="absolute left-0 bottom-0 w-full h-[2px] bg-gradient-to-r from-kuningan to-[#e4c27f] origin-left" style={{ transform: `scaleX(${ratio})` }} aria-hidden="true"></div>;
}

// Tombol bulat "kembali ke atas", muncul setelah halaman digulir cukup jauh.
function BackToTop() {
  const show = useScrollRatio() > 0.15;
  return (
    <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} aria-label="Kembali ke atas" tabIndex={show ? 0 : -1}
      className={`fixed right-4 bottom-4 md:right-6 md:bottom-6 z-40 w-11 h-11 rounded-full bg-dinas text-white flex items-center justify-center shadow-[0_12px_28px_-10px_rgba(14,30,51,.7)] transition duration-300 hover:bg-dinas-dark hover:-translate-y-0.5 ${show ? 'opacity-100' : 'opacity-0 pointer-events-none translate-y-2'}`}>
      <span className="material-symbols-outlined text-[20px]">arrow_upward</span>
    </button>
  );
}

function Eyebrow({ children, light }) {
  return (
    <div className={`flex items-center gap-2 text-sm font-semibold ${light ? 'text-[#e4c27f]' : 'text-kuningan-ink'}`}>
      <span className="w-6 h-[2px] rounded bg-kuningan"></span>{children}
    </div>
  );
}

function LandingMaintenanceNotice({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dinas-dark bg-kawung-gelap">
      <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-xl">
        <div className="flex items-center gap-2 text-amber-700 text-sm font-semibold">
          <span className="material-symbols-outlined text-[20px]">build</span>Sedang dalam pemeliharaan sistem
        </div>
        <h2 className="font-display text-xl font-extrabold text-dinas-ink mt-3">Halaman ini sementara tidak tersedia</h2>
        <p className="text-sm text-slate-600 mt-2">{message || 'Silakan coba lagi nanti.'}</p>
        <Link to="/login" className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-dinas text-white text-sm font-semibold hover:bg-dinas-dark">
          Masuk ke aplikasi
        </Link>
      </div>
    </div>
  );
}

export default function Landing() {
  const { user, loading } = useAuth();
  const [landingDown, setLandingDown] = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState('');

  useEffect(() => {
    function refresh() {
      api.get('/maintenance/landing-status').then((res) => {
        setLandingDown(res.data?.data?.is_active ? res.data.data : false);
      }).catch(() => setLandingDown(false));
    }
    refresh();
    return subscribeLive((topic) => { if (topic === 'maintenance' || topic === '*') refresh(); });
  }, []);

  useEffect(() => {
    // Gulir halus untuk tautan #layanan dll. -- hanya selama di landing page (bukan seluruh aplikasi).
    const root = document.documentElement;
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) root.style.scrollBehavior = 'smooth';
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); root.style.scrollBehavior = ''; };
  }, []);

  // Penanda menu aktif di header sesuai bagian yang sedang terlihat (scrollspy).
  const ready = !loading && landingDown === false && !user;
  useEffect(() => {
    if (!ready || typeof IntersectionObserver === 'undefined') return undefined;
    const els = NAV.map((n) => document.querySelector(n.href)).filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) setActive(`#${e.target.id}`); });
    }, { rootMargin: '-45% 0px -50% 0px' });
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [ready]);

  if (loading || landingDown === null) return <div className="min-h-screen flex items-center justify-center bg-dinas-dark text-white/60 text-sm">Memuat…</div>;
  if (user) return <Navigate to="/dashboard" replace />;
  if (landingDown) return <LandingMaintenanceNotice message={landingDown.message} />;

  return (
    <div className="min-h-screen flex flex-col bg-[#f3f4f7] text-slate-800">
      <header className={`sticky top-0 z-40 backdrop-blur-md border-b text-white transition-[background-color,box-shadow,border-color] duration-300 ${scrolled ? 'bg-dinas-ink/90 border-white/10 shadow-[0_8px_30px_-12px_rgba(0,0,0,.5)]' : 'bg-dinas-dark border-transparent'}`}>
        <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" className="!border-white/20" />
            <div className="min-w-0">
              <div className="font-display text-sm font-extrabold leading-tight truncate tracking-tight">Biro Umum dan Rumah Tangga</div>
              <div className="text-[11px] text-white/60 leading-tight truncate">Kementerian Ketenagakerjaan</div>
            </div>
          </Link>
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-white/70">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} aria-current={active === n.href ? 'location' : undefined} className={`relative py-1 transition-colors hover:text-white after:absolute after:left-0 after:-bottom-0.5 after:h-[2px] after:w-full after:origin-left after:rounded after:bg-kuningan after:transition-transform hover:after:scale-x-100 ${active === n.href ? 'text-white after:scale-x-100' : 'after:scale-x-0'}`}>{n.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2 shrink-0">
            <Link to="/register" className="hidden sm:inline-block px-4 py-2 rounded-lg text-sm font-semibold text-white/85 transition-colors hover:bg-white/10">Daftar</Link>
            <Link to="/login" className="px-4 py-2 rounded-lg bg-white text-dinas text-sm font-bold shadow-sm transition hover:bg-[#f7efe0] hover:shadow-[0_0_0_4px_rgba(184,137,59,.25)]">Masuk</Link>
            <button type="button" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen} aria-label={menuOpen ? 'Tutup menu' : 'Buka menu'} className="md:hidden w-10 h-10 -mr-2 rounded-lg flex items-center justify-center text-white hover:bg-white/10">
              <span className="material-symbols-outlined">{menuOpen ? 'close' : 'menu'}</span>
            </button>
          </div>
        </div>
        {menuOpen && (
          <nav className="landing-mobile-menu md:hidden border-t border-white/10 px-4 pb-4 pt-2">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} onClick={() => setMenuOpen(false)} className={`flex items-center justify-between px-3 py-3 rounded-lg text-sm font-semibold ${active === n.href ? 'bg-white/10 text-white' : 'text-white/75 hover:bg-white/5'}`}>
                {n.label}<span className="material-symbols-outlined text-[18px] text-white/40">chevron_right</span>
              </a>
            ))}
            <Link to="/register" className="mt-2 flex justify-center px-3 py-3 rounded-lg border border-white/20 text-sm font-semibold text-white">Daftar akun pegawai</Link>
          </nav>
        )}
        <ScrollProgress />
      </header>

      <main className="flex-1">
        {/* Pembuka */}
        <section className="relative landing-hero text-white overflow-hidden">
          <div className="absolute inset-0 bg-kawung-gelap [mask-image:radial-gradient(ellipse_at_top_left,#000_20%,transparent_70%)]" aria-hidden="true"></div>
          <div className="absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full bg-kuningan/20 blur-[120px] landing-glow pointer-events-none" aria-hidden="true"></div>
          <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 pt-14 pb-20 md:pt-20 md:pb-28 grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-12 lg:gap-16 items-center">
            <div className="page-enter">
              <span className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 text-xs font-semibold text-white/85 backdrop-blur">
                <span className="px-2 py-0.5 rounded-full bg-kuningan text-[10px] font-bold uppercase tracking-wider text-white">Internal</span>
                Aplikasi Layanan Biro Umum
              </span>
              <h1 className="font-display mt-6 text-[2.2rem] sm:text-5xl lg:text-[3.6rem] font-extrabold leading-[1.05] tracking-[-0.03em] [text-wrap:balance]">
                Satu pintu untuk <span className="text-emas">layanan rumah tangga</span> kantor.
              </h1>
              <p className="text-base md:text-lg text-white/75 mt-6 max-w-[56ch] leading-relaxed">
                Ajukan pemeliharaan dan pengadaan, kelola kendaraan dinas, dan pesan ruang rapat. Biro Umum menindaklanjuti setiap permintaan sampai selesai, dan semua riwayatnya tercatat.
              </p>
              <div className="flex flex-wrap gap-3 mt-9">
                <Link to="/login" className="group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-dinas text-sm font-bold shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] transition hover:-translate-y-0.5 hover:bg-[#f7efe0] hover:shadow-[0_14px_36px_-10px_rgba(184,137,59,.6)]">
                  Masuk ke aplikasi<span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                </Link>
                <Link to="/register" className="px-6 py-3.5 rounded-xl border border-white/30 bg-white/5 text-white text-sm font-semibold backdrop-blur transition hover:bg-white/15 hover:border-white/50">Daftar akun pegawai</Link>
              </div>
              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
                {STATS.map((st) => (
                  <div key={st.label} className="border-l-2 border-kuningan/70 pl-4 flex flex-col-reverse">
                    <dt className="text-xs text-white/60 mt-0.5">{st.label}</dt>
                    <dd className="font-display text-2xl md:text-3xl font-extrabold tracking-tight tabular-nums">{st.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative">
              <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-kuningan/30 via-white/5 to-accent/25 blur-2xl" aria-hidden="true"></div>
              <div className="relative landing-float"><RuangHariIni /></div>
            </div>
          </div>
          <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-kuningan/60 to-transparent" aria-hidden="true"></div>
        </section>

        {/* Keunggulan: menumpang di batas bawah hero */}
        <section className="relative z-10 max-w-[1200px] mx-auto px-4 md:px-8 -mt-10 md:-mt-14">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {KEUNGGULAN.map((k, i) => (
              <Reveal key={k.title} delay={i * 80}>
                <div className="group h-full rounded-2xl bg-white border border-slate-200 p-4 md:p-5 shadow-[0_18px_40px_-24px_rgba(14,30,51,.45)] transition duration-300 hover:-translate-y-1 hover:border-kuningan/40">
                  <span className="w-10 h-10 rounded-xl bg-[#f7efe0] text-kuningan-ink flex items-center justify-center transition-colors group-hover:bg-kuningan group-hover:text-white">
                    <span className="material-symbols-outlined text-[20px]">{k.icon}</span>
                  </span>
                  <div className="font-display font-bold text-dinas-ink mt-3">{k.title}</div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{k.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Layanan */}
        <section id="layanan" className="scroll-mt-20 max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
          <Reveal className="max-w-2xl">
            <Eyebrow>Layanan</Eyebrow>
            <h2 className="font-display text-3xl md:text-[2.25rem] font-extrabold text-dinas-ink mt-3 tracking-tight">Empat layanan, satu alur kerja</h2>
            <p className="text-slate-600 mt-3 leading-relaxed">Setiap permintaan tercatat dengan nomor, tahapan, dan dokumennya, sehingga mudah ditelusuri kapan saja.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-5 mt-10">
            {LAYANAN.map((l, idx) => (
              <Reveal key={l.label} delay={idx * 90}>
                <div className="group relative h-full overflow-hidden bg-white rounded-2xl border border-slate-200 p-6 md:p-7 shadow-[0_1px_2px_rgba(14,30,51,.04),0_8px_24px_-14px_rgba(14,30,51,.18)] transition duration-300 hover:-translate-y-1 hover:border-kuningan/40 hover:shadow-[0_2px_4px_rgba(14,30,51,.04),0_24px_48px_-20px_rgba(14,30,51,.35)]">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-dinas via-kuningan to-dinas origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" aria-hidden="true"></div>
                  <span className="absolute top-6 right-6 font-mono text-xs font-semibold text-slate-300 transition-colors group-hover:text-kuningan" aria-hidden="true">0{idx + 1}</span>
                  <div className="flex items-center gap-3">
                    <span className="w-12 h-12 rounded-xl bg-gradient-to-br from-dinas to-dinas-ink text-white flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(30,58,95,.7)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"><span className="material-symbols-outlined text-[22px]">{l.icon}</span></span>
                    <h3 className="font-display text-lg font-extrabold text-dinas-ink">{l.label}</h3>
                  </div>
                  <p className="text-sm text-slate-600 mt-4 leading-relaxed">{l.desc}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-5">
                    {l.tags.map((t, i) => (
                      <React.Fragment key={t}>
                        {i > 0 && l.sep && <span className="text-slate-400 text-xs">{l.sep}</span>}
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-[#f7efe0] text-kuningan-ink">{t}</span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Jadwal */}
        <section id="jadwal" className="scroll-mt-20 bg-white border-y border-slate-200">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
            <Reveal className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div className="max-w-2xl">
                <Eyebrow>Jadwal</Eyebrow>
                <h2 className="font-display text-3xl md:text-[2.25rem] font-extrabold text-dinas-ink mt-3 tracking-tight">Jadwal ruang rapat</h2>
                <p className="text-slate-600 mt-3 leading-relaxed">Cek ruang yang masih kosong sebelum mengajukan booking. Jadwal ini terbuka tanpa login dan diperbarui otomatis.</p>
              </div>
              <Link to="/jadwal-rapat" className="self-start md:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-dinas transition hover:border-dinas hover:bg-dinas hover:text-white shrink-0">
                <span className="material-symbols-outlined text-[18px]">tv</span>Tampilan layar penuh (kiosk)
              </Link>
            </Reveal>
            <Reveal delay={100} className="mt-8">
              <RuangRapatSchedule />
            </Reveal>
          </div>
        </section>

        {/* Cara mengajukan */}
        <section id="cara" className="scroll-mt-20 max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
          <Reveal>
            <Eyebrow>Cara mengajukan</Eyebrow>
            <h2 className="font-display text-3xl md:text-[2.25rem] font-extrabold text-dinas-ink mt-3 tracking-tight">Tiga langkah dari pengajuan sampai selesai</h2>
          </Reveal>
          <ol className="relative grid md:grid-cols-3 gap-4 md:gap-6 mt-10">
            <div className="hidden md:block absolute top-[2.875rem] left-12 right-[30%] h-px bg-[repeating-linear-gradient(90deg,#b8893b_0_6px,transparent_6px_12px)]" aria-hidden="true"></div>
            {LANGKAH.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 120} className="relative">
                <div className="group h-full rounded-2xl p-6 transition duration-300 hover:bg-white hover:shadow-[0_16px_40px_-24px_rgba(14,30,51,.35)]">
                  <span className="relative z-10 w-11 h-11 rounded-full bg-gradient-to-br from-kuningan to-kuningan-ink text-white font-display font-extrabold flex items-center justify-center ring-4 ring-[#f3f4f7] group-hover:ring-white tabular-nums shadow-[0_8px_18px_-8px_rgba(122,90,32,.8)]">{i + 1}</span>
                  <div className="font-display font-bold text-dinas-ink text-lg mt-5">{s.title}</div>
                  <p className="text-sm text-slate-600 mt-2 leading-relaxed max-w-[38ch]">{s.desc}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-white border-y border-slate-200">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-10">
            <Reveal>
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="font-display text-3xl md:text-[2.25rem] font-extrabold text-dinas-ink mt-3 tracking-tight">Pertanyaan yang sering diajukan</h2>
              <p className="text-slate-600 mt-3 leading-relaxed">Belum menemukan jawabannya? Hubungi Biro Umum di <a href={`mailto:${EMAIL}`} className="font-semibold text-dinas hover:underline">{EMAIL}</a>.</p>
            </Reveal>
            <Reveal delay={100} className="space-y-3">
              {FAQ.map((f, i) => (
                <details key={f.q} className="landing-faq group rounded-2xl border border-slate-200 bg-[#f8f9fb] open:bg-white open:shadow-[0_16px_40px_-26px_rgba(14,30,51,.45)] open:border-kuningan/40 transition" open={i === 0}>
                  <summary className="flex items-center justify-between gap-4 cursor-pointer list-none px-5 py-4 font-display font-bold text-dinas-ink">
                    {f.q}
                    <span className="shrink-0 w-8 h-8 rounded-full bg-white border border-slate-200 flex items-center justify-center text-dinas transition-transform group-open:rotate-45">
                      <span className="material-symbols-outlined text-[18px]">add</span>
                    </span>
                  </summary>
                  <p className="px-5 pb-5 -mt-1 text-sm text-slate-600 leading-relaxed">{f.a}</p>
                </details>
              ))}
            </Reveal>
          </div>
        </section>

        {/* Penutup */}
        <section className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-20">
          <Reveal className="relative overflow-hidden rounded-3xl landing-hero text-white px-6 py-10 md:px-12 md:py-14 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-[0_30px_60px_-30px_rgba(14,30,51,.7)]">
            <div className="absolute inset-0 bg-kawung-gelap" aria-hidden="true"></div>
            <div className="absolute -right-20 -bottom-24 w-80 h-80 rounded-full bg-kuningan/30 blur-[90px] landing-glow pointer-events-none" aria-hidden="true"></div>
            <div className="relative">
              <h2 className="font-display text-2xl md:text-3xl font-extrabold tracking-tight">Sudah punya akun pegawai?</h2>
              <p className="text-white/75 mt-2">Masuk untuk mengajukan dan memantau permintaan Anda.</p>
            </div>
            <div className="relative flex flex-wrap gap-3">
              <Link to="/login" className="group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-dinas text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#f7efe0]">
                Masuk<span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
              </Link>
              <Link to="/register" className="px-6 py-3 rounded-xl border border-white/35 bg-white/5 text-sm font-semibold transition hover:bg-white/15">Daftar akun</Link>
            </div>
          </Reveal>
        </section>
      </main>

      <footer className="relative bg-dinas-ink text-white/65 overflow-hidden">
        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-kuningan/50 to-transparent" aria-hidden="true"></div>
        <div className="absolute inset-0 bg-kawung-gelap opacity-60 [mask-image:linear-gradient(to_top,#000,transparent)]" aria-hidden="true"></div>
        <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-12 grid gap-10 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <div className="flex items-center gap-3">
              <BrandMark size="sm" className="!border-white/20" />
              <div>
                <div className="font-display text-sm font-extrabold text-white">Biro Umum dan Rumah Tangga</div>
                <div className="text-xs mt-0.5">Kementerian Ketenagakerjaan Republik Indonesia</div>
              </div>
            </div>
            <p className="text-xs leading-relaxed mt-4 max-w-[42ch]">Aplikasi internal untuk pengajuan pemeliharaan, pengadaan, pengelolaan kendaraan dinas, dan booking ruang rapat.</p>
            <a href={`mailto:${EMAIL}`} className="mt-4 inline-flex items-center gap-2 text-xs font-semibold text-white/85 hover:text-white">
              <span className="material-symbols-outlined text-[16px] text-[#e4c27f]">mail</span>{EMAIL}
            </a>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-white/90">Layanan</div>
            <ul className="mt-3 space-y-2 text-xs">
              {LAYANAN.map((l) => <li key={l.label}><a href="#layanan" className="inline-flex items-center gap-2 transition-colors hover:text-white"><span className="material-symbols-outlined text-[15px] text-white/40">{l.icon}</span>{l.label}</a></li>)}
            </ul>
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-white/90">Tautan</div>
            <ul className="mt-3 space-y-2 text-xs">
              {NAV.map((n) => <li key={n.href}><a href={n.href} className="transition-colors hover:text-white">{n.label}</a></li>)}
              <li><Link to="/jadwal-rapat" className="transition-colors hover:text-white">Tampilan kiosk</Link></li>
              <li><Link to="/login" className="transition-colors hover:text-white">Masuk</Link> · <Link to="/register" className="transition-colors hover:text-white">Daftar</Link></li>
            </ul>
          </div>
        </div>
        <div className="relative border-t border-white/10 py-4 text-center text-xs text-white/45">
          © {new Date().getFullYear()} Biro Umum dan Rumah Tangga
        </div>
      </footer>

      <BackToTop />
    </div>
  );
}
