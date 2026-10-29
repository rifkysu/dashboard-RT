import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { subscribeLive } from '../live';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import RuangRapatSchedule from '../components/RuangRapatSchedule';
import GuestBooking from '../components/GuestBooking';
import { RuangFotoButton, RuangMaintenanceTag } from '../components/RuangFoto';
import useRuangRapatLive from '../hooks/useRuangRapatLive';
import { useDaftarRuang } from '../hooks/useRuangInfo';
import BagianTabs, { useBagian } from '../components/BagianTabs';
import { iso } from '../hooks/useMonthSchedule';
import { judulRuang } from '../utils/ruang';

// Kiosk /jadwal-rapat bisa dinonaktifkan admin lewat Settings > Mode Maintenance ("Kiosk Jadwal Rapat").
// Admin & Kabag yang sedang login tetap bisa membuka halaman ini (dengan banner pemberitahuan).
function useKioskMaintenance() {
  const [status, setStatus] = useState(null); // null = memuat; false = aktif normal; { message } = maintenance
  useEffect(() => {
    const refresh = () => api.get('/maintenance/public-status/kiosk')
      .then((r) => setStatus(r.data?.data?.is_active ? r.data.data : false))
      .catch(() => setStatus(false));
    refresh();
    return subscribeLive((topic) => { if (topic === 'maintenance' || topic === '*') refresh(); });
  }, []);
  return status;
}

function KioskMaintenanceNotice({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dinas-dark bg-kawung-gelap">
      <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-xl text-center">
        <BrandMark size="sm" className="mx-auto" />
        <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
          <span className="material-symbols-outlined text-[20px]">build</span>Sedang dalam pemeliharaan sistem
        </div>
        <h2 className="font-display text-xl font-extrabold text-dinas-ink mt-4">Kiosk jadwal ruang rapat sementara tidak tersedia</h2>
        <p className="text-sm text-slate-600 mt-2">{message || 'Silakan coba lagi nanti. Halaman ini akan kembali otomatis begitu pemeliharaan selesai.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/" className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Ke beranda</Link>
          <Link to="/login" className="px-5 py-2.5 rounded-lg bg-dinas text-white text-sm font-semibold hover:bg-dinas-dark">Masuk ke aplikasi</Link>
        </div>
      </div>
    </div>
  );
}

// Hero gelap kiosk: jam live, ringkasan hari ini, dan papan status tiap ruangan saat ini
// (logika status sama dengan layar per ruangan /ruang/:slug).
const SEGERA_MENIT = 15; // agenda berikutnya dianggap "segera" bila mulai <= 15 menit lagi
const pad = (n) => String(n).padStart(2, '0');
const menitDari = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };

const JAM_AWAL = 7;   // rentang timeline mini di kartu ruangan (melebar sendiri bila ada rapat di luar jam ini)
const JAM_AKHIR = 19;

const TEMA = {
  kosong: { label: 'Tersedia', dot: 'bg-emerald-400', pill: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/40', bar: 'from-emerald-400/80', kartu: 'ring-white/10' },
  segera: { label: 'Segera dipakai', dot: 'bg-amber-400', pill: 'bg-amber-400/15 text-amber-300 ring-amber-400/40', bar: 'from-amber-400/80', kartu: 'ring-amber-400/40 shadow-[0_0_44px_-14px_rgba(245,158,11,.65)]' },
  dipakai: { label: 'Sedang dipakai', dot: 'bg-rose-500', pill: 'bg-rose-500/15 text-rose-300 ring-rose-500/40', bar: 'from-rose-500/80', kartu: 'ring-rose-500/40 shadow-[0_0_44px_-14px_rgba(244,63,94,.7)]' },
  // Jadwal belum bisa dimuat (server/koneksi bermasalah): status tidak boleh ditebak "Tersedia".
  galat: { label: 'Status tidak diketahui', dot: 'bg-slate-400', pill: 'bg-white/10 text-white/60 ring-white/20', bar: 'from-slate-400/60', kartu: 'ring-white/10' },
};
const LEGENDA = ['kosong', 'segera', 'dipakai'];

const sapaan = (jam) => (jam < 11 ? { teks: 'Selamat pagi', icon: 'wb_twilight' } : jam < 15 ? { teks: 'Selamat siang', icon: 'light_mode' } : jam < 18 ? { teks: 'Selamat sore', icon: 'wb_sunny' } : { teks: 'Selamat malam', icon: 'dark_mode' });
const fmtSisa = (min) => { const h = Math.floor(min / 60), m = min % 60; return h ? `${h}j ${m}m` : `${m} mnt`; };

// Layar kiosk tidak boleh mati sendiri (Screen Wake Lock API; diabaikan bila browser tidak mendukung).
function useLayarTetapMenyala() {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return undefined;
    let lock = null;
    let aktif = true;
    const minta = async () => {
      try { if (aktif && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch { /* ditolak browser */ }
    };
    minta();
    document.addEventListener('visibilitychange', minta);
    return () => { aktif = false; document.removeEventListener('visibilitychange', minta); lock?.release?.().catch(() => {}); };
  }, []);
}
// Warna kartu booking di tabel (sama dengan STATUS di RuangRapatSchedule).
const KETERANGAN = [
  { label: 'Belum ada surat', cls: 'bg-red-50 border-red-300' },
  { label: 'Surat ditinjau', cls: 'bg-blue-50 border-blue-300' },
  { label: 'Surat diterima', cls: 'bg-green-50 border-green-300' },
];

function useJam() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

// Booking hari ini (semua ruangan): ikut sinyal live, dimuat ulang tiap menit & saat tanggal berganti.
// Gagal memuat -> `gagal` true dan data terakhir (kalau ada) tetap dipakai; jangan pernah dianggap "kosong",
// supaya kiosk tidak menampilkan semua ruangan "Tersedia" saat server/koneksi bermasalah. Dicoba ulang tiap 15 detik.
function useJadwalHariIni(today) {
  const [items, setItems] = useState(null);
  const [gagal, setGagal] = useState(false);
  const [dimuatPada, setDimuatPada] = useState(null);
  const reqRef = useRef(0);
  function load() {
    const id = ++reqRef.current;
    const d = iso();
    api.get('/ruang-rapat/public-schedule', { params: { from: d, to: d } })
      .then((r) => {
        if (id !== reqRef.current) return;
        setItems((r.data.data || []).filter((x) => !x.cancelled && (x.end_date || x.date) >= d && x.date <= d));
        setGagal(false);
        setDimuatPada(new Date());
      })
      .catch(() => { if (id === reqRef.current) setGagal(true); });
  }
  useEffect(() => {
    // Tanggal berganti: data kemarin tidak berlaku lagi untuk status hari ini.
    setItems((prev) => (prev && dimuatPada && iso(dimuatPada) !== today ? null : prev));
    load();
  }, [today]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setInterval(load, gagal ? 15000 : 60000); return () => clearInterval(t); }, [gagal]); // eslint-disable-line react-hooks/exhaustive-deps
  useRuangRapatLive(load);
  return { items, gagal, dimuatPada };
}

function statusRuang(list, menit) {
  const sekarang = list.find((x) => menitDari(x.start) <= menit && menit < menitDari(x.end));
  const berikut = list.find((x) => menitDari(x.start) > menit);
  const sisa = berikut ? Math.ceil(menitDari(berikut.start) - menit) : null;
  return { sekarang, berikut, sisa, status: sekarang ? 'dipakai' : berikut && sisa <= SEGERA_MENIT ? 'segera' : 'kosong' };
}

// Timeline mini satu hari: blok tiap rapat (lewat = redup, berjalan = merah, nanti = emas) + penanda waktu sekarang.
function TimelineHari({ list, menit, rentang }) {
  const [awal, akhir] = rentang;
  const total = akhir - awal;
  const pos = (m) => `${Math.min(100, Math.max(0, ((m - awal) / total) * 100))}%`;
  const jamLabel = Array.from({ length: 5 }, (_, i) => Math.round(awal / 60 + (i * total) / 60 / 4));
  return (
    <span className="block" aria-hidden="true">
      <span className="relative block h-2 rounded-full bg-white/10 overflow-hidden">
        {list.map((x) => {
          const s = menitDari(x.start), e = menitDari(x.end);
          const warna = e <= menit ? 'bg-white/25' : s <= menit ? 'bg-rose-500' : 'bg-[#e4c27f]';
          return <span key={x.id} className={`absolute inset-y-0 rounded-full ${warna}`} style={{ left: pos(s), width: `max(4px, calc(${pos(e)} - ${pos(s)}))` }}></span>;
        })}
        {menit >= awal && menit <= akhir && <span className="absolute -inset-y-0 w-0.5 bg-white shadow-[0_0_6px_rgba(255,255,255,.9)]" style={{ left: pos(menit) }}></span>}
      </span>
      <span className="mt-1 flex justify-between text-[9px] font-mono tabular-nums text-white/35">
        {jamLabel.map((j) => <span key={j}>{pad(j)}</span>)}
      </span>
    </span>
  );
}

// Kartu status satu ruangan; klik = popup foto & fasilitas.
function KartuRuang({ room, list, menit, memuat, galat, foto, kapasitas, delay, rentang }) {
  const st = statusRuang(list, menit);
  const kunci = galat ? 'galat' : memuat ? 'kosong' : st.status;
  const tema = TEMA[kunci];
  const sisaRapat = list.filter((x) => menitDari(x.end) > menit).length;
  const progres = st.sekarang ? (menit - menitDari(st.sekarang.start)) / Math.max(1, menitDari(st.sekarang.end) - menitDari(st.sekarang.start)) : 0;
  return (
    <div className="hero-in" style={{ '--d': `${delay}ms` }}>
      <RuangFotoButton room={room} className={`group relative w-full h-full text-left overflow-hidden rounded-2xl bg-white/[.06] ring-1 ${tema.kartu} backdrop-blur-sm transition duration-300 hover:-translate-y-1 hover:bg-white/10 hover:ring-[#e4c27f]/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e4c27f]`}>
        {foto && <img src={foto} alt="" loading="lazy" className="absolute inset-0 w-full h-full object-cover opacity-30 transition duration-700 group-hover:scale-105 group-hover:opacity-40" />}
        <span className="absolute inset-0 bg-gradient-to-t from-[#0b1626] via-[#0b1626]/85 to-[#0b1626]/40" aria-hidden="true"></span>
        <span className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${tema.bar} to-transparent`} aria-hidden="true"></span>
        <span className="relative flex flex-col h-full p-4">
          <span className="flex items-start justify-between gap-2">
            <span className="font-display font-extrabold text-base leading-tight">{judulRuang(room)}</span>
            <span className="material-symbols-outlined text-[18px] text-white/40 transition group-hover:text-[#e4c27f]">photo_library</span>
          </span>
          <RuangMaintenanceTag room={room} dark className="mt-1 self-start" />
          {kapasitas && <span className="mt-1 inline-flex items-center gap-1 text-[11px] text-white/50"><span className="material-symbols-outlined text-[14px]">chair</span>{kapasitas} kursi</span>}
          {memuat ? (
            <span className="mt-3 h-6 w-28 rounded-full bg-white/10 animate-pulse"></span>
          ) : (
            <span className={`mt-3 self-start inline-flex items-center gap-2 px-2.5 py-1 rounded-full ring-1 text-[11px] font-bold uppercase tracking-wider ${tema.pill}`}>
              <span className="relative flex w-2 h-2">
                {(kunci === 'segera' || kunci === 'dipakai') && <span className={`absolute inset-0 rounded-full ${tema.dot} motion-safe:animate-ping`}></span>}
                <span className={`relative w-2 h-2 rounded-full ${tema.dot}`}></span>
              </span>
              {tema.label}
            </span>
          )}
          <span className="mt-3 flex-1 min-h-[3.25rem] text-sm">
            {memuat ? null : galat ? (
              <span className="block text-white/55">Jadwal belum dapat dimuat. Mencoba lagi otomatis…</span>
            ) : st.sekarang ? (
              <>
                <span className="block font-semibold leading-snug line-clamp-2">{st.sekarang.title}</span>
                <span className="mt-1.5 flex flex-wrap items-center justify-between gap-x-2 text-[11px] text-white/55 whitespace-nowrap">
                  <span className="font-mono tabular-nums">{st.sekarang.start} – {st.sekarang.end}</span>
                  <span className="font-semibold text-rose-300">sisa {fmtSisa(Math.max(1, Math.ceil(menitDari(st.sekarang.end) - menit)))}</span>
                </span>
                <span className="mt-1 block h-1 rounded-full bg-white/10 overflow-hidden">
                  <span className="block h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-300 transition-[width] duration-1000" style={{ width: `${Math.round(progres * 100)}%` }}></span>
                </span>
              </>
            ) : st.berikut ? (
              <>
                <span className="block text-xs text-white/55">{st.status === 'segera' ? `Mulai dalam ${Math.max(1, st.sisa)} menit` : 'Berikutnya'} · <span className="font-mono tabular-nums">{st.berikut.start}</span></span>
                <span className="block font-semibold leading-snug line-clamp-2 mt-0.5">{st.berikut.title}</span>
              </>
            ) : (
              <span className="block text-white/55">Kosong sampai akhir hari</span>
            )}
          </span>
          <span className="mt-3 pt-3 border-t border-white/10">
            {!memuat && !galat && <TimelineHari list={list} menit={menit} rentang={rentang} />}
            <span className="mt-1.5 block text-[11px] font-semibold text-white/50">
              {memuat ? 'Memuat…' : galat ? 'Menunggu koneksi ke server…' : sisaRapat ? `${sisaRapat} rapat tersisa hari ini` : 'Tidak ada rapat lagi hari ini'}
            </span>
          </span>
        </span>
      </RuangFotoButton>
    </div>
  );
}

// Pita agenda berjalan: rapat yang sedang/akan berlangsung hari ini di semua ruangan.
// Isi digandakan supaya geser (marquee) menyambung tanpa jeda; berhenti saat disentuh/hover.
function TickerAgenda({ list, menit, memuat, galat }) {
  const sisa = list.filter((x) => menitDari(x.end) > menit).sort((a, b) => a.start.localeCompare(b.start) || a.room.localeCompare(b.room));
  // Agenda sedikit -> diulang dalam tiap separuh pita supaya pita tetap penuh (tidak ada celah kosong saat bergeser).
  const ulang = sisa.length ? Math.ceil(6 / sisa.length) : 0;
  const isi = (salinan) => Array.from({ length: ulang }, () => sisa).flat().map((x, i) => {
    const jalan = menitDari(x.start) <= menit;
    return (
      <span key={`${salinan}-${i}-${x.id}`} className="shrink-0 inline-flex items-center gap-2.5 pr-8" aria-hidden={salinan || i >= sisa.length ? 'true' : undefined}>
        <span className={`w-1.5 h-1.5 rounded-full ${jalan ? 'bg-rose-400' : 'bg-[#e4c27f]'}`}></span>
        <span className="font-mono tabular-nums text-white/80">{x.start}–{x.end}</span>
        <span className="font-bold text-[#e4c27f]">{judulRuang(x.room)}</span>
        <span className="text-white/85">{x.title}</span>
        {jalan && <span className="px-1.5 py-0.5 rounded bg-rose-500/20 text-rose-300 text-[10px] font-bold uppercase tracking-wider">Berlangsung</span>}
      </span>
    );
  });
  return (
    <div className="hero-in mt-4 flex items-stretch rounded-2xl bg-black/20 ring-1 ring-white/10 overflow-hidden" style={{ '--d': '700ms' }}>
      <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[#e4c27f] text-dinas-ink text-xs font-extrabold uppercase tracking-wider">
        <span className="material-symbols-outlined text-[18px]">campaign</span><span className="hidden sm:inline">Agenda hari ini</span>
      </div>
      <div className="relative flex-1 min-w-0 flex items-center text-sm [mask-image:linear-gradient(90deg,transparent,#000_4%,#000_96%,transparent)]">
        {memuat ? <span className="px-4 text-white/50">Memuat agenda…</span>
          : galat ? <span className="px-4 text-amber-200/80">Agenda belum dapat dimuat — periksa koneksi. Mencoba lagi otomatis…</span>
          : !sisa.length ? <span className="px-4 text-white/60">Tidak ada agenda tersisa hari ini — semua ruangan dapat dibooking.</span>
          : (
            <div className="kiosk-marquee flex w-max pl-4 py-2.5" style={{ animationDuration: `${Math.max(25, sisa.length * ulang * 7)}s` }}>
              {isi(0)}{isi(1)}
            </div>
          )}
      </div>
    </div>
  );
}

function KioskHero() {
  const now = useJam();
  useLayarTetapMenyala();
  const { items, gagal, dimuatPada } = useJadwalHariIni(iso(now));
  const { rooms: semua, grup, info } = useDaftarRuang();
  const [bagian, setBagian, roomsBagian] = useBagian(grup);
  const [penuh, setPenuh] = useState(false);
  useEffect(() => {
    const onFs = () => setPenuh(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const menit = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
  const galat = items === null && gagal; // belum pernah berhasil dimuat
  const memuat = items === null && !gagal;
  const tanpaAngka = memuat || galat;
  // Status, ringkasan, & pita agenda hanya untuk bagian (satuan kerja) yang dipilih.
  const rooms = bagian ? roomsBagian : [...semua, ...[...new Set((items || []).map((x) => x.room).filter((r) => r && !semua.includes(r)))].sort()];
  const list = (items || []).filter((x) => rooms.includes(x.room));
  const perRuang = Object.fromEntries(rooms.map((r) => [r, list.filter((x) => x.room === r).sort((a, b) => a.start.localeCompare(b.start))]));
  const status = rooms.map((r) => statusRuang(perRuang[r], menit).status);
  const ringkas = [
    { label: 'Rapat hari ini', value: tanpaAngka ? '–' : list.length, icon: 'event' },
    { label: 'Sedang berlangsung', value: tanpaAngka ? '–' : status.filter((x) => x === 'dipakai').length, icon: 'groups' },
    { label: 'Ruangan tersedia', value: tanpaAngka ? '–' : `${status.filter((x) => x !== 'dipakai').length}/${rooms.length}`, icon: 'meeting_room' },
  ];
  const tanggal = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const salam = sapaan(now.getHours());
  // Rentang timeline sama untuk semua kartu supaya blok antar-ruangan sejajar.
  const rentang = [
    Math.min(JAM_AWAL * 60, ...list.map((x) => Math.floor(menitDari(x.start) / 60) * 60)),
    Math.max(JAM_AKHIR * 60, ...list.map((x) => Math.ceil(menitDari(x.end) / 60) * 60)),
  ];

  return (
    <header className="relative overflow-hidden landing-hero text-white">
      <div className="absolute inset-0 bg-kawung-gelap opacity-50 [mask-image:radial-gradient(ellipse_at_top_left,#000_10%,transparent_70%)]" aria-hidden="true"></div>
      <div className="absolute -top-24 right-[8%] w-[28rem] h-[28rem] rounded-full bg-[#b8893b]/20 blur-3xl landing-glow pointer-events-none" aria-hidden="true"></div>
      <div className="absolute -bottom-32 -left-24 w-[26rem] h-[26rem] rounded-full bg-blue-500/15 blur-3xl landing-glow pointer-events-none" style={{ animationDelay: '-3s' }} aria-hidden="true"></div>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e4c27f]/60 to-transparent" aria-hidden="true"></div>
      <div className="relative max-w-[1500px] mx-auto px-4 md:px-6 pt-5 pb-24 md:pb-28">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <BrandMark size="sm" className="!border-white/20" />
            <span className="min-w-0">
              <span className="block font-display text-sm font-extrabold leading-tight truncate">Biro Umum dan Rumah Tangga</span>
              <span className="block text-[11px] text-white/55 leading-tight truncate">Kementerian Ketenagakerjaan</span>
            </span>
          </Link>
          <div className="flex items-center gap-2 shrink-0">
            {gagal ? (
              <span className="inline-flex items-center gap-2 h-10 px-3 rounded-xl bg-amber-400/15 ring-1 ring-amber-400/40 text-amber-200 text-xs font-bold" title="Koneksi ke server terputus; mencoba lagi otomatis">
                <span className="material-symbols-outlined text-[18px]">cloud_off</span>
                <span className="hidden sm:inline">{dimuatPada ? `Offline · data ${pad(dimuatPada.getHours())}:${pad(dimuatPada.getMinutes())}` : 'Offline'}</span>
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-2 h-10 px-3 rounded-xl bg-white/10 ring-1 ring-white/15 text-xs font-bold uppercase tracking-wider">
                <span className="relative flex w-2 h-2"><span className="absolute inset-0 rounded-full bg-emerald-400 motion-safe:animate-ping"></span><span className="relative w-2 h-2 rounded-full bg-emerald-400"></span></span>Live
              </span>
            )}
            <Link to="/ruang" className="h-10 px-3 rounded-xl bg-white/10 ring-1 ring-white/15 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-white/15">
              <span className="material-symbols-outlined text-[18px]">tv</span><span className="hidden md:inline">Layar per ruangan</span>
            </Link>
            <button type="button" onClick={toggleFullscreen} className="w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/15 inline-flex items-center justify-center hover:bg-white/15" aria-label={penuh ? 'Keluar layar penuh' : 'Layar penuh'}>
              <span className="material-symbols-outlined text-[20px]">{penuh ? 'fullscreen_exit' : 'fullscreen'}</span>
            </button>
          </div>
        </div>

        <div className="mt-8 md:mt-10 grid lg:grid-cols-[minmax(0,1fr)_auto] gap-6 lg:gap-10 items-end">
          <div className="min-w-0">
            <div className="hero-in text-xs md:text-sm font-semibold uppercase tracking-[0.2em] text-[#e4c27f]">Kiosk informasi</div>
            <h1 className="hero-in font-display font-extrabold tracking-tight leading-[1.05] text-[clamp(2rem,4.5vw,3.75rem)] mt-1" style={{ '--d': '80ms' }}>
              Jadwal <span className="text-emas">Ruang Rapat</span>
            </h1>
            <p className="hero-in text-sm md:text-base text-white/65 mt-3 max-w-2xl leading-relaxed" style={{ '--d': '160ms' }}>
              Cek ruangan yang kosong, lihat agenda yang sedang berlangsung, lalu ajukan booking. Data diperbarui otomatis secara real-time.
            </p>
            <div className="hero-in mt-5 grid grid-cols-3 sm:flex sm:flex-wrap gap-2 sm:gap-2.5" style={{ '--d': '240ms' }}>
              {ringkas.map((r) => (
                <div key={r.label} className="flex items-center gap-3 rounded-2xl bg-white/[.07] ring-1 ring-white/10 px-3 sm:pr-4 py-2.5">
                  <span className="hidden sm:inline-flex w-9 h-9 rounded-xl bg-[#e4c27f]/15 text-[#e4c27f] items-center justify-center"><span className="material-symbols-outlined text-[20px]">{r.icon}</span></span>
                  <span>
                    <span className="block font-display text-xl font-extrabold leading-none tabular-nums">{r.value}</span>
                    <span className="block text-[11px] text-white/55 mt-1">{r.label}</span>
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div className="hero-in lg:text-right" style={{ '--d': '200ms' }}>
            <div className="mb-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 text-xs font-semibold text-[#e4c27f]">
              <span className="material-symbols-outlined text-[16px]">{salam.icon}</span>{salam.teks}
            </div>
            <div className="font-display font-extrabold tabular-nums leading-none text-[clamp(2.75rem,6vw,5rem)]">
              {pad(now.getHours())}:{pad(now.getMinutes())}<span className="text-[0.45em] text-white/45 align-top ml-1">{pad(now.getSeconds())}</span>
            </div>
            <div className="mt-2 text-sm md:text-base font-semibold text-white/70 capitalize">{tanggal}</div>
          </div>
        </div>

        <div className="mt-8">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div className="text-xs font-bold uppercase tracking-wider text-white/60">Status ruangan saat ini{bagian && <span className="text-[#e4c27f]"> · {bagian}</span>}</div>
            <div className="hidden sm:flex items-center gap-3 text-[11px] text-white/55">
              {LEGENDA.map((k) => TEMA[k]).map((t) => <span key={t.label} className="inline-flex items-center gap-1.5"><span className={`w-2 h-2 rounded-full ${t.dot}`}></span>{t.label}</span>)}
            </div>
          </div>
          <BagianTabs grup={grup} value={bagian} onChange={setBagian} dark className="mb-3" />
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
            {rooms.map((r, i) => (
              <KartuRuang key={r} room={r} list={perRuang[r]} menit={menit} memuat={memuat} galat={galat} foto={info?.[r]?.foto?.[0]?.src} kapasitas={info?.[r]?.kapasitas} delay={300 + Math.min(i, 10) * 70} rentang={rentang} />
            ))}
          </div>
          <TickerAgenda list={list} menit={menit} memuat={memuat} galat={galat} />
        </div>
      </div>
    </header>
  );
}

export default function PublicRuangRapat() {
  const { isAdmin, loading } = useAuth();
  const down = useKioskMaintenance();
  useEffect(() => { document.title = 'Jadwal Ruang Rapat · Biro Umum'; }, []);

  if (down === null || loading) return <div className="min-h-screen flex items-center justify-center bg-[#0e1e33] text-white/50 text-sm">Memuat…</div>;
  if (down && !isAdmin) return <KioskMaintenanceNotice message={down.message} />;

  return (
    <div className="min-h-screen bg-[#f2f4f7]">
      {down && (
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-200 text-sm text-amber-800">
          <span className="material-symbols-outlined text-[20px]">build</span>
          <b>Mode maintenance kiosk aktif.</b> Pengunjung melihat halaman pemeliharaan; Anda melihat halaman ini karena login sebagai Admin/Kabag.
          <Link to="/settings" className="ml-auto font-semibold underline">Atur di Settings</Link>
        </div>
      )}
      <KioskHero />
      <main className="relative max-w-[1500px] mx-auto px-4 md:px-6 -mt-14 md:-mt-16 pb-8">
        <div className="mb-6"><GuestBooking /></div>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-1">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-1 h-6 rounded-full bg-kuningan" aria-hidden="true"></span>
            <h2 className="font-display text-lg font-extrabold text-dinas-ink">Kalender booking</h2>
            <span className="hidden md:inline text-xs text-slate-500">· ruangan berganti otomatis tiap 30 detik, tabel selalu kembali ke hari ini</span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] font-semibold text-slate-600">
            {KETERANGAN.map((k) => <span key={k.label} className="inline-flex items-center gap-1.5"><span className={`w-3.5 h-3.5 rounded border ${k.cls}`}></span>{k.label}</span>)}
          </div>
        </div>
        <div className="rounded-lg shadow-[0_16px_40px_-28px_rgba(14,30,51,.5)]">
          <RuangRapatSchedule autoRotate />
        </div>
        <div className="mt-4 flex items-start gap-2 text-xs text-slate-500">
          <span className="material-symbols-outlined text-[16px]">info</span>
          <span>Jadwal di halaman ini hanya untuk dilihat (tanpa edit, cancel, atau upload surat). Tamu tanpa akun pegawai bisa booking lewat tombol Login dengan Google di atas.</span>
        </div>
      </main>
      <footer className="relative overflow-hidden bg-dinas-ink text-white/60">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e4c27f]/50 to-transparent" aria-hidden="true"></div>
        <div className="max-w-[1500px] mx-auto px-4 md:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <BrandMark size="xs" className="!border-white/20" />
            <span><span className="font-semibold text-white/85">Biro Umum dan Rumah Tangga</span> · Kementerian Ketenagakerjaan</span>
          </div>
          <div className="flex items-center gap-4 font-semibold">
            <Link to="/" className="hover:text-white">Beranda</Link>
            <Link to="/ruang" className="hover:text-white">Layar ruangan</Link>
            <Link to="/login" className="inline-flex items-center gap-1 text-[#e4c27f] hover:text-white"><span className="material-symbols-outlined text-[16px]">login</span>Masuk pegawai</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
