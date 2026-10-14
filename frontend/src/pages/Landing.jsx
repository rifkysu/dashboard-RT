import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import RuangRapatSchedule from '../components/RuangRapatSchedule';
import GuestBooking from '../components/GuestBooking';
import useRuangRapatLive from '../hooks/useRuangRapatLive';
import { iso } from '../hooks/useMonthSchedule';
import api from '../api';
import { subscribeLive } from '../live';
import { RUANG, judulRuang, slugRuang } from '../utils/ruang';

const LAYANAN = [
  { icon: 'build', label: 'Pemeliharaan', desc: 'Pengajuan perbaikan gedung, sarana, dan prasarana kantor, dengan dokumen pendukung dari awal.', tags: ['Analisa & HPS', 'Pembayaran', 'Dokumentasi/BAST'], sep: '→' },
  { icon: 'shopping_cart', label: 'Pengadaan', desc: 'Pengadaan barang dan jasa dengan tahapan yang sama seperti pemeliharaan, sampai serah terima.', tags: ['Lelang', 'E-Purchasing', 'Pengadaan Langsung'] },
  { icon: 'directions_car', label: 'Kendaraan Dinas', desc: 'Data kendaraan dinas, dokumen BPKB/STNK, riwayat service, dan pengingat pajak H-14.', tags: ['Roda 2', 'Roda 4', 'Roda 6'] },
  { icon: 'calendar_month', label: 'Ruang Rapat', desc: 'Booking ruang rapat lengkap dengan surat permohonan. Jadwalnya terbuka untuk dilihat tanpa login.', tags: ['5 ruang', 'Surat permohonan', 'Multi-hari'] },
];


const LANGKAH = [
  { title: 'Daftar akun pegawai', desc: 'Isi nama, email, nomor HP, dan unit kerja. Masuk dengan email dan kata sandi.' },
  { title: 'Ajukan dari menu layanan', desc: 'Pilih Pemeliharaan, Pengadaan, atau Ruang Rapat, lengkapi formulir, lalu unggah dokumen pendukung.' },
  { title: 'Pantau sampai selesai', desc: 'Status bergerak dari Pending ke On Progress hingga Selesai, dan perubahannya langsung terlihat.', status: true },
];

const STATUS_CHIPS = [
  { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  { label: 'On Progress', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  { label: 'Selesai', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
];

// Kata yang bergantian di judul hero.
const ROTASI = ['pemeliharaan.', 'pengadaan.', 'kendaraan dinas.', 'ruang rapat.'];

// Pita sorotan fitur di bawah kartu keunggulan.
const SOROTAN = ['Analisa & HPS', 'Pembayaran GUP/TUP/LS', 'Dokumentasi BAST', 'E-Purchasing', 'Pengingat pajak H-14', 'Riwayat service kendaraan', 'Surat permohonan rapat', 'Booking multi-hari', 'Tampilan kiosk', 'Update realtime'];

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
  { q: 'Apakah jadwal ruang rapat bisa dilihat tanpa login?', a: 'Bisa. Jadwal di halaman ini dan tampilan layar penuh (kiosk) terbuka untuk umum dan diperbarui otomatis. Untuk booking, masuk dengan akun pegawai, atau klik "Login dengan Google untuk booking" di bagian Jadwal Ruang Rapat bila belum punya akun pegawai.' },
  { q: 'Bagaimana cara booking ruang rapat?', a: 'Masuk, buka menu Jadwal Ruang Rapat, lalu klik sel ruangan dan tanggal yang masih kosong (atau tombol Booking Ruang Rapat). Surat permohonan bisa diunggah saat itu juga atau menyusul; status surat berubah hijau setelah surat diunggah.' },
  { q: 'Bagaimana memantau permintaan pemeliharaan atau pengadaan?', a: 'Setiap permintaan punya nomor dan status Pending, On Progress, hingga Selesai. Perubahannya tampil langsung di menu terkait dan di Dashboard.' },
  { q: 'Saya lupa kata sandi, apa yang harus dilakukan?', a: 'Klik "Lupa kata sandi" di halaman Masuk. Link reset dikirim ke email Anda bila layanan email aktif; jika tidak, permintaan diteruskan ke Admin yang akan mengirimkan link reset (berlaku 1 jam).' },
];

const STATS = [
  { value: 4, label: 'layanan terpadu' },
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

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: hover) and (pointer: fine)').matches && !reducedMotion();

// Simpan posisi kursor relatif elemen ke --mx/--my (untuk efek cahaya .landing-spotlight / .card-spotlight).
// Ditulis langsung ke style supaya tidak memicu render ulang React.
function trackPointer(e) {
  const el = e.currentTarget;
  const r = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${e.clientX - r.left}px`);
  el.style.setProperty('--my', `${e.clientY - r.top}px`);
}

// Kata di judul hero yang berganti tiap beberapa detik (pembaca layar mendapat teks lengkap lewat sr-only).
// Saat gerakan dikurangi, CSS mengubah pergantiannya menjadi fade saja (tanpa geser/blur).
function RotatingWords({ words, interval = 2600 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  const prev = (i - 1 + words.length) % words.length;
  return (
    <span className="rotating-words" aria-hidden="true">
      {words.map((w, n) => <span key={w} className={`text-emas emas-shimmer ${n === i ? 'is-active' : n === prev ? 'is-prev' : ''}`}>{w}</span>)}
    </span>
  );
}

// Angka yang menghitung naik saat pertama kali terlihat.
function CountUp({ to, duration = 1400 }) {
  const ref = useRef(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined' || reducedMotion()) { setN(to); return undefined; }
    let raf = 0;
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const t0 = performance.now();
      const tick = (t) => {
        const p = Math.min(1, (t - t0) / duration);
        setN(Math.round(to * (1 - (1 - p) ** 3)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [to, duration]);
  return <span ref={ref}>{n}</span>;
}

// Kartu yang sedikit miring 3D mengikuti kursor (hanya perangkat dengan mouse).
function TiltCard({ children }) {
  const ref = useRef(null);
  const [enabled] = useState(finePointer);
  function move(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(1100px) rotateX(${(-y * 7).toFixed(2)}deg) rotateY(${(x * 9).toFixed(2)}deg) scale(1.01)`;
  }
  function leave() { if (ref.current) ref.current.style.transform = ''; }
  return (
    <div ref={ref} onMouseMove={enabled ? move : undefined} onMouseLeave={enabled ? leave : undefined} className="transition-transform duration-200 ease-out [transform-style:preserve-3d]">
      {children}
    </div>
  );
}

// Tombol "magnetik": sedikit tertarik ke arah kursor saat disorot (hanya perangkat dengan mouse).
function Magnetic({ children, strength = 0.28 }) {
  const ref = useRef(null);
  const [enabled] = useState(finePointer);
  function move(e) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.transform = `translate(${((e.clientX - r.left - r.width / 2) * strength).toFixed(1)}px, ${((e.clientY - r.top - r.height / 2) * strength).toFixed(1)}px)`;
  }
  function leave() { if (ref.current) ref.current.style.transform = ''; }
  return (
    <span ref={ref} onMouseMove={enabled ? move : undefined} onMouseLeave={enabled ? leave : undefined} className="inline-flex transition-transform duration-300 ease-out">
      {children}
    </span>
  );
}

// Partikel emas di hero; posisi & tempo tetap (bukan acak) supaya render stabil.
const PARTIKEL = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  y: `${(i * 53 + 7) % 92}%`,
  size: 2 + (i % 3),
  t: `${10 + ((i * 7) % 9)}s`,
  delay: `${-((i * 1.7) % 12).toFixed(1)}s`,
  dx: `${((i % 5) - 2) * 18}px`,
  o: (0.35 + (i % 4) * 0.15).toFixed(2),
}));
function HeroParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
      {PARTIKEL.map((p, i) => (
        <span key={i} className="hero-particle" style={{ left: p.left, width: p.size, height: p.size, '--y': p.y, '--t': p.t, '--delay': p.delay, '--dx': p.dx, '--o': p.o }}></span>
      ))}
    </div>
  );
}

// Posisi jam (HH:MM) pada lini waktu 07:00-19:00, dalam persen.
const JAM_MULAI = 7 * 60, JAM_RENTANG = 12 * 60;
const posJam = (hhmm) => {
  const [h, m] = String(hhmm).split(':').map(Number);
  return Math.max(0, Math.min(100, ((h * 60 + (m || 0) - JAM_MULAI) / JAM_RENTANG) * 100));
};

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
    return { room, list, now: list.find((x) => x.start <= jam && jam < x.end), next: list.find((x) => x.start > jam) };
  });
  const kosong = rooms.filter((r) => !r.now).length;
  const tanggal = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="relative bg-white text-slate-800 rounded-2xl overflow-hidden">
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
          <li key={r.room}>
           <Link to={`/ruang/${slugRuang(r.room)}`} title={`Buka layar ${judulRuang(r.room)}`} className="group px-5 py-3 flex items-center gap-3 transition-colors hover:bg-slate-50">
            <span className="relative flex w-2 h-2 shrink-0">
              {items && r.now && <span className="absolute inset-0 rounded-full bg-red-400 opacity-75 motion-safe:animate-ping"></span>}
              <span className={`relative w-2 h-2 rounded-full ${!items ? 'bg-slate-300' : r.now ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-dinas-ink">{judulRuang(r.room)}</div>
              {items && r.now && <div className="text-xs text-slate-500 truncate">{r.now.title}</div>}
              {items && (
                <div className="relative mt-1.5 h-1.5 rounded-full bg-slate-100" title="Pemakaian ruang hari ini, 07.00–19.00" aria-hidden="true">
                  {r.list.map((x, n) => (
                    <span key={`${x.start}-${x.end}-${n}`} className={`absolute inset-y-0 rounded-full ${x === r.now ? 'bg-red-400' : x.end <= jam ? 'bg-slate-300' : 'bg-dinas/40'}`}
                      style={{ left: `${posJam(x.start)}%`, width: `${Math.max(2, posJam(x.end) - posJam(x.start))}%` }}></span>
                  ))}
                  <span className="absolute -top-0.5 -bottom-0.5 w-[2px] rounded bg-kuningan" style={{ left: `${posJam(jam)}%` }}></span>
                </div>
              )}
            </div>
            <div className="text-right text-xs shrink-0">
              {!items ? <span className="text-slate-400">Memuat…</span>
                : r.now ? <span className="font-semibold text-red-600">Dipakai s/d {r.now.end}</span>
                  : <span className="font-semibold text-emerald-700">Kosong{r.next && <span className="font-normal text-slate-500"> · booking {r.next.start}</span>}</span>}
            </div>
            <span className="material-symbols-outlined text-[16px] text-slate-300 -mr-1 transition group-hover:text-kuningan group-hover:translate-x-0.5">chevron_right</span>
           </Link>
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
      <span className="eyebrow-line h-[2px] rounded bg-kuningan"></span>{children}
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

  // Parallax hero: tulis posisi gulir ke --sy (hanya selama hero masih di layar).
  const heroRef = useRef(null);
  useEffect(() => {
    const el = heroRef.current;
    if (!ready || !el || reducedMotion()) return undefined;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y <= window.innerHeight * 1.2) el.style.setProperty('--sy', String(Math.round(y)));
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', onScroll); };
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
        <section ref={heroRef} className="relative landing-hero text-white overflow-hidden" onMouseMove={trackPointer}>
          <div className="absolute inset-0 parallax-bg" aria-hidden="true">
            <div className="absolute inset-0 bg-kawung-gelap [mask-image:radial-gradient(ellipse_at_top_left,#000_20%,transparent_70%)]"></div>
            <div className="absolute inset-0 landing-dots [mask-image:radial-gradient(ellipse_at_80%_40%,#000_10%,transparent_65%)]"></div>
            <div className="absolute left-1/2 top-1/2 w-[900px] h-[900px] -translate-x-1/2 -translate-y-1/2 opacity-70"><div className="w-full h-full rounded-full landing-aurora"></div></div>
            <div className="absolute -top-32 -right-24 w-[520px] h-[520px] rounded-full bg-kuningan/20 blur-[120px] landing-glow"></div>
            <div className="absolute -bottom-40 -left-32 w-[460px] h-[460px] rounded-full bg-accent/20 blur-[120px] landing-glow [animation-delay:-3s]"></div>
          </div>
          <HeroParticles />
          <div className="absolute inset-0 landing-spotlight pointer-events-none" aria-hidden="true"></div>
          <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 pt-14 pb-20 md:pt-20 md:pb-28 grid lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] gap-12 lg:gap-16 items-center">
            <div className="parallax-slow">
              <span className="hero-in inline-flex items-center gap-2 pl-1.5 pr-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 text-xs font-semibold text-white/85 backdrop-blur" style={{ '--d': '0ms' }}>
                <span className="px-2 py-0.5 rounded-full bg-kuningan text-[10px] font-bold uppercase tracking-wider text-white">Internal</span>
                Aplikasi Layanan Biro Umum
              </span>
              <h1 className="font-display mt-6 text-[2.4rem] sm:text-[3.4rem] lg:text-[4.1rem] font-extrabold leading-[1.05] tracking-[-0.03em]">
                <span className="line-mask"><span className="line-inner" style={{ '--d': '120ms' }}>Satu pintu untuk urusan</span></span>
                <span className="line-mask"><span className="line-inner" style={{ '--d': '260ms' }}><RotatingWords words={ROTASI} /></span></span>
                <span className="sr-only">pemeliharaan, pengadaan, kendaraan dinas, dan ruang rapat.</span>
              </h1>
              <p className="hero-in text-base md:text-lg text-white/75 mt-6 max-w-[56ch] leading-relaxed" style={{ '--d': '420ms' }}>
                Ajukan pemeliharaan dan pengadaan, kelola kendaraan dinas, dan pesan ruang rapat. Biro Umum menindaklanjuti setiap permintaan sampai selesai, dan semua riwayatnya tercatat.
              </p>
              <div className="hero-in flex flex-wrap gap-3 mt-9" style={{ '--d': '560ms' }}>
                <Magnetic>
                  <Link to="/login" className="btn-shine group inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white text-dinas text-sm font-bold shadow-[0_10px_30px_-10px_rgba(0,0,0,.5)] transition hover:bg-[#f7efe0] hover:shadow-[0_14px_36px_-10px_rgba(184,137,59,.6)]">
                    Masuk ke aplikasi<span className="material-symbols-outlined text-[18px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                  </Link>
                </Magnetic>
                <Magnetic strength={0.2}>
                  <Link to="/register" className="px-6 py-3.5 rounded-xl border border-white/30 bg-white/5 text-white text-sm font-semibold backdrop-blur transition hover:bg-white/15 hover:border-white/50">Daftar akun pegawai</Link>
                </Magnetic>
              </div>
              <dl className="mt-12 flex flex-wrap gap-x-10 gap-y-5">
                {STATS.map((st, i) => (
                  <div key={st.label} className="hero-in border-l-2 border-kuningan/70 pl-4 flex flex-col-reverse" style={{ '--d': `${700 + i * 110}ms` }}>
                    <dt className="text-xs text-white/60 mt-0.5">{st.label}</dt>
                    <dd className="font-display text-2xl md:text-3xl font-extrabold tracking-tight tabular-nums inline-flex items-center gap-2">
                      {typeof st.value === 'number' ? <CountUp to={st.value} /> : (
                        <><span className="relative flex w-2.5 h-2.5"><span className="absolute inset-0 rounded-full bg-emerald-400 motion-safe:animate-ping"></span><span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400"></span></span>{st.value}</>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
            <div className="relative parallax-fast">
              <div className="hero-card-in">
                <div className="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-kuningan/30 via-white/5 to-accent/25 blur-2xl landing-glow" aria-hidden="true"></div>
                <div className="relative landing-float">
                  <TiltCard><div className="border-beam shadow-[0_30px_80px_-28px_rgba(0,0,0,.7)]"><RuangHariIni /></div></TiltCard>
                </div>
                <div className="hidden xl:flex absolute -left-20 -top-12 landing-float-b glass-chip rounded-2xl pl-2 pr-4 py-2 items-center gap-2.5 text-white" aria-hidden="true">
                  <span className="w-9 h-9 rounded-xl bg-emerald-400/90 text-emerald-950 flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">task_alt</span></span>
                  <span><span className="block text-[11px] text-white/60 leading-tight">Status permintaan</span><span className="block text-sm font-bold leading-tight">Selesai &amp; tercatat</span></span>
                </div>
                <div className="hidden xl:flex absolute -right-6 -bottom-16 landing-float-b [animation-delay:-4s] glass-chip rounded-2xl pl-2 pr-4 py-2 items-center gap-2.5 text-white" aria-hidden="true">
                  <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f6e2b6] to-kuningan text-dinas-ink flex items-center justify-center"><span className="material-symbols-outlined text-[20px]">notifications_active</span></span>
                  <span><span className="block text-[11px] text-white/60 leading-tight">Pengingat pajak</span><span className="block text-sm font-bold leading-tight">H-14 otomatis</span></span>
                </div>
              </div>
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
                  <span className="pop-in"><span className="w-10 h-10 rounded-xl bg-[#f7efe0] text-kuningan-ink flex items-center justify-center transition-colors group-hover:bg-kuningan group-hover:text-white">
                    <span className="material-symbols-outlined text-[20px]">{k.icon}</span>
                  </span></span>
                  <div className="font-display font-bold text-dinas-ink mt-3">{k.title}</div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{k.desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* Pita sorotan fitur */}
        <section className="landing-marquee overflow-hidden mt-10 md:mt-14" aria-label="Sorotan fitur">
          <div className="landing-marquee-track gap-3 py-1">
            {[...SOROTAN, ...SOROTAN].map((s, i) => (
              <span key={i} aria-hidden={i >= SOROTAN.length ? 'true' : undefined}
                className="shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 text-sm font-semibold text-dinas-ink shadow-[0_4px_14px_-10px_rgba(14,30,51,.4)]">
                <span className="w-1.5 h-1.5 rounded-full bg-kuningan"></span>{s}
              </span>
            ))}
          </div>
        </section>

        {/* Layanan */}
        <section id="layanan" className="scroll-mt-20 max-w-[1200px] mx-auto px-4 md:px-8 pt-12 pb-16 md:pt-16 md:pb-24">
          <Reveal className="max-w-2xl">
            <Eyebrow>Layanan</Eyebrow>
            <h2 className="font-display text-3xl md:text-[2.25rem] font-extrabold text-dinas-ink mt-3 tracking-tight">Empat layanan, <span className="text-emas-gelap">satu alur kerja</span></h2>
            <p className="text-slate-600 mt-3 leading-relaxed">Setiap permintaan tercatat dengan nomor, tahapan, dan dokumennya, sehingga mudah ditelusuri kapan saja.</p>
          </Reveal>
          <div className="grid sm:grid-cols-2 gap-5 mt-10">
            {LAYANAN.map((l, idx) => (
              <Reveal key={l.label} delay={idx * 90}>
                <div onMouseMove={trackPointer} className="card-spotlight group relative h-full overflow-hidden bg-white rounded-2xl border border-slate-200 p-6 md:p-7 shadow-[0_1px_2px_rgba(14,30,51,.04),0_8px_24px_-14px_rgba(14,30,51,.18)] transition duration-300 hover:-translate-y-1 hover:border-kuningan/40 hover:shadow-[0_2px_4px_rgba(14,30,51,.04),0_24px_48px_-20px_rgba(14,30,51,.35)]">
                  <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-dinas via-kuningan to-dinas origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100" aria-hidden="true"></div>
                  <span className="material-symbols-outlined watermark-icon absolute -right-6 -bottom-8 text-dinas/[0.05] transition duration-500 group-hover:text-kuningan/[0.12] group-hover:-rotate-6 pointer-events-none" aria-hidden="true">{l.icon}</span>
                  <span className="absolute top-6 right-6 font-mono text-xs font-semibold text-slate-300 transition-colors group-hover:text-kuningan" aria-hidden="true">0{idx + 1}</span>
                  <div className="flex items-center gap-3">
                    <span className="pop-in"><span className="w-12 h-12 rounded-xl bg-gradient-to-br from-dinas to-dinas-ink text-white flex items-center justify-center shadow-[0_8px_20px_-8px_rgba(30,58,95,.7)] transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3"><span className="material-symbols-outlined text-[22px]">{l.icon}</span></span></span>
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
                <h2 className="font-display text-3xl md:text-[2.25rem] font-extrabold text-dinas-ink mt-3 tracking-tight">Jadwal <span className="text-emas-gelap">ruang rapat</span></h2>
                <p className="text-slate-600 mt-3 leading-relaxed">Cek ruang yang masih kosong sebelum mengajukan booking. Jadwal ini terbuka tanpa login dan diperbarui otomatis.</p>
              </div>
              <Link to="/jadwal-rapat" className="self-start md:self-auto inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold text-dinas transition hover:border-dinas hover:bg-dinas hover:text-white shrink-0">
                <span className="material-symbols-outlined text-[18px]">tv</span>Tampilan layar penuh (kiosk)
              </Link>
            </Reveal>
            <Reveal delay={60} className="mt-8">
              <GuestBooking />
            </Reveal>
            <Reveal delay={100} className="mt-8">
              <RuangRapatSchedule />
            </Reveal>
            <Reveal delay={150} className="mt-10">
              <div className="flex items-center gap-2 font-display font-bold text-dinas-ink">
                <span className="material-symbols-outlined text-[20px] text-kuningan">tablet_mac</span>Layar per ruangan
              </div>
              <p className="text-sm text-slate-600 mt-1">Buka di tablet atau monitor depan ruangan: status Tersedia/Digunakan, rapat berlangsung, dan agenda hari ini, diperbarui otomatis.</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-4">
                {RUANG.map((r) => (
                  <Link key={r} to={`/ruang/${slugRuang(r)}`} onMouseMove={trackPointer}
                    className="card-spotlight group relative overflow-hidden rounded-2xl bg-gradient-to-br from-dinas to-dinas-ink text-white p-4 shadow-[0_12px_30px_-18px_rgba(14,30,51,.7)] transition duration-300 hover:-translate-y-1 hover:shadow-[0_20px_40px_-18px_rgba(14,30,51,.8)]">
                    <div className="absolute inset-0 bg-kawung-gelap opacity-60" aria-hidden="true"></div>
                    <span className="relative material-symbols-outlined text-[22px] text-[#e4c27f]">meeting_room</span>
                    <div className="relative font-display font-bold mt-2 leading-tight">{judulRuang(r)}</div>
                    <div className="relative mt-3 inline-flex items-center gap-1 text-xs font-semibold text-white/70 group-hover:text-white">
                      Buka layar<span className="material-symbols-outlined text-[15px] transition-transform group-hover:translate-x-1">arrow_forward</span>
                    </div>
                  </Link>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* Cara mengajukan */}
        <section id="cara" className="scroll-mt-20 relative landing-hero text-white overflow-hidden">
          <div className="absolute inset-0 bg-kawung-gelap opacity-70 [mask-image:radial-gradient(ellipse_at_top_right,#000_15%,transparent_70%)]" aria-hidden="true"></div>
          <div className="absolute inset-0 landing-dots [mask-image:linear-gradient(to_bottom,transparent,#000_40%,transparent)] opacity-60" aria-hidden="true"></div>
          <div className="absolute -left-24 top-10 w-96 h-96 rounded-full bg-kuningan/20 blur-[110px] landing-glow pointer-events-none" aria-hidden="true"></div>
          <div className="relative max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24">
          <Reveal>
            <Eyebrow light>Cara mengajukan</Eyebrow>
            <h2 className="font-display text-3xl md:text-[2.25rem] font-extrabold mt-3 tracking-tight">Tiga langkah dari pengajuan <span className="text-emas emas-shimmer">sampai selesai</span></h2>
          </Reveal>
          <ol className="relative grid md:grid-cols-3 gap-4 md:gap-6 mt-10">
            <Reveal className="draw-x hidden md:block absolute top-[2.875rem] left-12 right-[30%] h-px bg-[repeating-linear-gradient(90deg,#b8893b_0_6px,transparent_6px_12px)]"></Reveal>
            {LANGKAH.map((s, i) => (
              <Reveal as="li" key={s.title} delay={i * 120} className="relative">
                <div className="group h-full rounded-2xl p-6 bg-white/[0.06] border border-white/10 backdrop-blur-sm transition duration-300 hover:bg-white/[0.1] hover:border-kuningan/50 hover:-translate-y-1 hover:shadow-[0_24px_50px_-26px_rgba(0,0,0,.8)]">
                  <span className="step-ring relative z-10 w-11 h-11 rounded-full bg-gradient-to-br from-[#f6e2b6] via-kuningan to-kuningan-ink text-white font-display font-extrabold flex items-center justify-center ring-4 ring-[#142a47] tabular-nums shadow-[0_8px_24px_-6px_rgba(228,194,127,.7)]">{i + 1}</span>
                  <div className="font-display font-bold text-white text-lg mt-5">{s.title}</div>
                  <p className="text-sm text-white/70 mt-2 leading-relaxed max-w-[38ch]">{s.desc}</p>
                  {s.status && (
                    <div className="flex flex-wrap items-center gap-1.5 mt-4" aria-hidden="true">
                      {STATUS_CHIPS.map((c, n) => (
                        <React.Fragment key={c.label}>
                          {n > 0 && <span className="material-symbols-outlined text-[14px] text-slate-400">arrow_forward</span>}
                          <span className={`text-[11px] font-bold px-2 py-1 rounded-md ring-1 ${c.cls}`}>{c.label}</span>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>
              </Reveal>
            ))}
          </ol>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="scroll-mt-20 bg-white border-y border-slate-200">
          <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-16 md:py-24 grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] gap-10">
            <Reveal>
              <Eyebrow>FAQ</Eyebrow>
              <h2 className="font-display text-3xl md:text-[2.25rem] font-extrabold text-dinas-ink mt-3 tracking-tight">Pertanyaan yang <span className="text-emas-gelap">sering diajukan</span></h2>
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
              <Link to="/login" className="btn-shine group inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white text-dinas text-sm font-bold transition hover:-translate-y-0.5 hover:bg-[#f7efe0]">
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
