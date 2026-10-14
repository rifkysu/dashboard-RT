import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../api';
import BrandMark from '../components/BrandMark';
import useRuangRapatLive from '../hooks/useRuangRapatLive';
import { iso } from '../hooks/useMonthSchedule';
import { RUANG, judulRuang, slugRuang, ruangDariSlug } from '../utils/ruang';

// Layar per ruangan (/ruang/:slug): dipasang di tablet/monitor depan tiap ruang rapat.
// Publik (tanpa login), hanya-lihat, memakai jadwal publik + sinyal live yang sama dengan landing/kiosk.

const HARI_KE_DEPAN = 7;
const SEGERA_MENIT = 15; // agenda berikutnya dianggap "segera" bila mulai <= 15 menit lagi
const IDLE_MS = 4000;

const pad = (n) => String(n).padStart(2, '0');
const menitDari = (hhmm) => { const [h, m] = String(hhmm).split(':').map(Number); return h * 60 + (m || 0); };
const tambahHari = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDurasi = (min) => {
  const h = Math.floor(min / 60), m = min % 60;
  if (!h) return `${m} menit`;
  return m ? `${h} jam ${m} menit` : `${h} jam`;
};
const labelHari = (d) => new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short' });
const mencakup = (x, d) => x.date <= d && (x.end_date || x.date) >= d;

function useJam() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);
  return now;
}

// Layar tidak boleh mati sendiri (Screen Wake Lock API; diabaikan bila browser tidak mendukung).
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

// Tombol kontrol & kursor disembunyikan bila tidak ada sentuhan/gerakan beberapa detik.
function useIdle() {
  const [idle, setIdle] = useState(false);
  useEffect(() => {
    let t = setTimeout(() => setIdle(true), IDLE_MS);
    const bangun = () => { setIdle(false); clearTimeout(t); t = setTimeout(() => setIdle(true), IDLE_MS); };
    const ev = ['mousemove', 'touchstart', 'keydown'];
    ev.forEach((e) => window.addEventListener(e, bangun, { passive: true }));
    return () => { clearTimeout(t); ev.forEach((e) => window.removeEventListener(e, bangun)); };
  }, []);
  return idle;
}

const TEMA = {
  kosong: { label: 'Tersedia', dot: 'bg-emerald-400', pill: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/40', glow: 'rgba(16,185,129,.28)', bar: 'bg-emerald-400', ring: 'ring-emerald-400/60' },
  segera: { label: 'Segera digunakan', dot: 'bg-amber-400', pill: 'bg-amber-400/15 text-amber-300 ring-amber-400/40', glow: 'rgba(245,158,11,.28)', bar: 'bg-amber-400', ring: 'ring-amber-400/60' },
  dipakai: { label: 'Sedang digunakan', dot: 'bg-rose-500', pill: 'bg-rose-500/15 text-rose-300 ring-rose-500/40', glow: 'rgba(244,63,94,.30)', bar: 'bg-rose-500', ring: 'ring-rose-500/60' },
};

// Halaman pilih ruangan (/ruang, atau slug tidak dikenal).
function PilihRuang({ salah }) {
  useEffect(() => { document.title = 'Layar Ruang Rapat · Biro Umum'; }, []);
  return (
    <div className="min-h-screen landing-hero text-white flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-3xl">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" className="!border-white/20" />
          <div className="text-sm text-white/70">Biro Umum dan Rumah Tangga</div>
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-extrabold mt-6 tracking-tight">Pilih layar ruang rapat</h1>
        <p className="text-white/70 mt-2">{salah ? 'Ruangan tidak ditemukan. ' : ''}Buka halaman ruangan di tablet/monitor depan ruang tersebut. Tampilan diperbarui otomatis.</p>
        <div className="grid sm:grid-cols-2 gap-3 mt-8">
          {RUANG.map((r) => (
            <Link key={r} to={`/ruang/${slugRuang(r)}`} className="group flex items-center justify-between gap-3 rounded-2xl bg-white/5 ring-1 ring-white/15 px-5 py-4 transition hover:bg-white/10 hover:ring-kuningan/60">
              <span>
                <span className="block font-display text-lg font-bold">{judulRuang(r)}</span>
                <span className="block text-xs text-white/50 font-mono mt-0.5">/ruang/{slugRuang(r)}</span>
              </span>
              <span className="material-symbols-outlined text-white/50 transition group-hover:text-[#e4c27f] group-hover:translate-x-1">arrow_forward</span>
            </Link>
          ))}
        </div>
        <Link to="/" className="inline-flex items-center gap-1.5 mt-8 text-sm text-white/60 hover:text-white">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}

const AUTO_SLIDE_MS = 8000;   // geser ke hari berikutnya tiap 8 detik
const JEDA_SENTUH_MS = 30000; // setelah disentuh/diklik, auto-slide berhenti 30 detik
const geraknyaDikurangi = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Agenda 7 hari sebagai slide per hari: strip tanggal (tap), geser (swipe/scroll), tombol panah,
// dan bergeser otomatis saat layar dibiarkan (lalu memutar kembali ke hari ini).
function AgendaMingguan({ minggu, memuat, sekarang, menitSekarang, tema }) {
  const trackRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const idxRef = useRef(0);
  idxRef.current = idx;
  const sentuhTerakhir = useRef(0);

  const keHari = (i, halus = true) => {
    const el = trackRef.current;
    if (!el) return;
    const n = (i + minggu.length) % minggu.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: halus && !geraknyaDikurangi() ? 'smooth' : 'auto' });
    setIdx(n);
  };
  const pilih = (i) => { sentuhTerakhir.current = Date.now(); keHari(i); };
  const onScroll = () => {
    const el = trackRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.round(el.scrollLeft / el.clientWidth);
    if (i !== idxRef.current) setIdx(i);
  };

  useEffect(() => {
    const t = setInterval(() => {
      if (Date.now() - sentuhTerakhir.current < JEDA_SENTUH_MS) return;
      keHari(idxRef.current + 1);
    }, AUTO_SLIDE_MS);
    return () => clearInterval(t);
  }, [minggu.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Ukuran layar berubah (rotasi tablet) -> tetap di slide yang sama.
  useEffect(() => {
    const onResize = () => keHari(idxRef.current, false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const judulHari = (i, d) => (i === 0 ? 'Hari ini' : i === 1 ? 'Besok' : new Date(`${d}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long' }));
  const totalMinggu = minggu.reduce((n, h) => n + h.list.length, 0);

  return (
    <div className="mt-6 flex-1 min-h-0 rounded-3xl bg-white/[.06] ring-1 ring-white/10 backdrop-blur-sm flex flex-col overflow-hidden"
      onPointerDown={() => { sentuhTerakhir.current = Date.now(); }} onWheel={() => { sentuhTerakhir.current = Date.now(); }}>
      {/* Kepala: judul + panah */}
      <div className="px-5 pt-4 pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-display font-bold text-lg leading-tight">Agenda 7 hari</div>
          <div className="text-xs text-white/55 mt-0.5">{memuat ? 'Memuat…' : `${totalMinggu} rapat dalam seminggu`}</div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => pilih(idx - 1)} aria-label="Hari sebelumnya" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 inline-flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>
          <button type="button" onClick={() => pilih(idx + 1)} aria-label="Hari berikutnya" className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 inline-flex items-center justify-center">
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>
      </div>

      {/* Strip tanggal 7 hari */}
      <div className="grid grid-cols-7 gap-1.5 px-3 pb-3 border-b border-white/10" role="tablist" aria-label="Pilih hari">
        {minggu.map((h, i) => {
          const tgl = new Date(`${h.d}T00:00:00`);
          const aktif = i === idx;
          return (
            <button key={h.d} type="button" role="tab" aria-selected={aktif} onClick={() => pilih(i)}
              className={`relative rounded-xl py-2 flex flex-col items-center transition duration-300 ${aktif ? 'bg-[#e4c27f] text-dinas-ink shadow-[0_8px_20px_-10px_rgba(228,194,127,.8)] scale-105' : 'bg-white/5 hover:bg-white/10 text-white/80'}`}>
              <span className={`text-[10px] md:text-[11px] font-bold uppercase ${aktif ? 'text-dinas-ink/70' : 'text-white/50'}`}>{i === 0 ? 'Hari ini' : tgl.toLocaleDateString('id-ID', { weekday: 'short' })}</span>
              <span className="font-display text-lg md:text-xl font-extrabold leading-tight tabular-nums">{tgl.getDate()}</span>
              <span className={`mt-0.5 h-1.5 flex items-center gap-0.5`}>
                {h.list.slice(0, 3).map((x) => <span key={x.id} className={`w-1.5 h-1.5 rounded-full ${aktif ? 'bg-dinas-ink/70' : 'bg-[#e4c27f]'}`}></span>)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Slide per hari */}
      <div ref={trackRef} onScroll={onScroll}
        className="flex-1 min-h-0 max-h-[60vh] lg:max-h-none flex overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {minggu.map((h, i) => (
          <div key={h.d} className="w-full shrink-0 snap-start overflow-y-auto px-3 py-3" aria-hidden={i !== idx}>
            <div className="px-2 pb-2 flex items-baseline justify-between gap-2">
              <span className="font-semibold text-[#e4c27f] capitalize">{judulHari(i, h.d)}<span className="text-white/50 font-normal normal-case"> · {labelHari(h.d)}</span></span>
              <span className="text-xs font-bold px-2 py-1 rounded-md bg-white/10 text-white/70 shrink-0">{h.list.length} rapat</span>
            </div>
            {memuat && <div className="px-2 py-3 text-white/50">Memuat…</div>}
            {!memuat && !h.list.length && (
              <div className="px-2 py-8 flex flex-col items-center text-center text-white/50">
                <span className="material-symbols-outlined text-[40px] text-emerald-300/70">event_available</span>
                <span className="mt-2">Belum ada booking — ruangan tersedia seharian.</span>
              </div>
            )}
            <div className="space-y-2">
              {h.list.map((x) => {
                const lewat = i === 0 && menitDari(x.end) <= menitSekarang;
                const berjalan = i === 0 && x === sekarang;
                return (
                  <div key={x.id} className={`flex gap-4 rounded-2xl px-3 py-3 transition ${berjalan ? `bg-white/10 ring-2 ${tema.ring}` : 'bg-white/[.03]'} ${lewat ? 'opacity-40' : ''}`}>
                    <div className="shrink-0 w-[4.5rem] font-mono text-sm md:text-base tabular-nums leading-tight">
                      <div className="font-bold">{x.start}</div><div className="text-white/50">{x.end}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold md:text-lg leading-snug line-clamp-2">{x.title}</div>
                      {x.pic && <div className="text-sm text-white/55 truncate mt-0.5">{x.pic}</div>}
                      {berjalan && <div className="text-xs font-bold uppercase tracking-wider text-rose-300 mt-1">Sedang berlangsung</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Titik posisi slide */}
      <div className="flex justify-center gap-1.5 py-2.5 border-t border-white/10" aria-hidden="true">
        {minggu.map((h, i) => <span key={h.d} className={`h-1.5 rounded-full transition-all duration-300 ${i === idx ? 'w-5 bg-[#e4c27f]' : 'w-1.5 bg-white/25'}`}></span>)}
      </div>
    </div>
  );
}

export default function LayarRuang() {
  const { slug } = useParams();
  const room = ruangDariSlug(slug);
  if (!room) return <PilihRuang salah={!!slug} />;
  return <Layar key={room} room={room} />;
}

function Layar({ room }) {
  const now = useJam();
  const idle = useIdle();
  useLayarTetapMenyala();
  const [items, setItems] = useState(null);
  const [offline, setOffline] = useState(false);
  const [penuh, setPenuh] = useState(false);
  const reqRef = useRef(0);

  const today = iso(now);
  const jam = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const menitSekarang = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

  function load() {
    const id = ++reqRef.current;
    const from = iso();
    const to = iso(tambahHari(new Date(), HARI_KE_DEPAN - 1));
    api.get('/ruang-rapat/public-schedule', { params: { from, to } })
      .then((r) => {
        if (id !== reqRef.current) return;
        setItems((r.data.data || []).filter((x) => x.room === room && !x.cancelled));
        setOffline(false);
      })
      .catch(() => { if (id === reqRef.current) { setOffline(true); setItems((prev) => prev || []); } });
  }
  // Muat ulang tiap menit & saat tanggal berganti (layar menyala berhari-hari).
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, [today]); // eslint-disable-line react-hooks/exhaustive-deps
  useRuangRapatLive(load);

  useEffect(() => { document.title = `${judulRuang(room)} · Layar Ruang Rapat`; }, [room]);
  useEffect(() => {
    const onFs = () => setPenuh(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, []);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // Agenda 7 hari (hari ini + 6 hari berikutnya), ditampilkan sebagai slide per hari.
  const minggu = useMemo(() => Array.from({ length: HARI_KE_DEPAN }, (_, i) => {
    const d = iso(tambahHari(new Date(`${today}T00:00:00`), i));
    return { d, list: (items || []).filter((x) => mencakup(x, d)).sort((a, b) => a.start.localeCompare(b.start)) };
  }), [items, today]);
  const hariIni = minggu[0].list;

  const sekarang = hariIni.find((x) => menitDari(x.start) <= menitSekarang && menitSekarang < menitDari(x.end));
  const berikut = hariIni.find((x) => menitDari(x.start) > menitSekarang);
  const sisaKeBerikut = berikut ? Math.ceil(menitDari(berikut.start) - menitSekarang) : null;
  const status = sekarang ? 'dipakai' : berikut && sisaKeBerikut <= SEGERA_MENIT ? 'segera' : 'kosong';
  const tema = TEMA[status];
  const memuat = items === null;

  const tanggalPanjang = now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <div className={`relative min-h-screen lg:h-screen flex flex-col overflow-hidden bg-[#0b1626] text-white ${idle ? 'cursor-none' : ''}`}>
      {/* Latar: cahaya warna status + motif kawung */}
      <div className="absolute inset-0 bg-kawung-gelap opacity-60 [mask-image:radial-gradient(ellipse_at_top_left,#000_10%,transparent_65%)]" aria-hidden="true"></div>
      <div className="absolute inset-0 transition-[background] duration-1000" style={{ background: `radial-gradient(60% 70% at 15% 20%, ${memuat ? 'transparent' : tema.glow}, transparent 70%), radial-gradient(50% 60% at 100% 100%, rgba(184,137,59,.18), transparent 70%)` }} aria-hidden="true"></div>

      {/* Kepala */}
      <header className="relative flex items-center justify-between gap-4 px-5 md:px-10 pt-5 md:pt-7">
        <div className="flex items-center gap-3 min-w-0">
          <BrandMark size="sm" className="!border-white/20" />
          <div className="min-w-0">
            <div className="font-display text-sm font-extrabold leading-tight truncate">Biro Umum dan Rumah Tangga</div>
            <div className="text-[11px] text-white/55 leading-tight truncate">Kementerian Ketenagakerjaan</div>
          </div>
        </div>
        <div className={`flex items-center gap-2 transition-opacity duration-500 ${idle ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
          <Link to="/ruang" className="h-10 px-3 rounded-xl bg-white/10 ring-1 ring-white/15 text-sm font-semibold inline-flex items-center gap-1.5 hover:bg-white/15">
            <span className="material-symbols-outlined text-[18px]">meeting_room</span><span className="hidden sm:inline">Ganti ruangan</span>
          </Link>
          <button type="button" onClick={toggleFullscreen} className="w-10 h-10 rounded-xl bg-white/10 ring-1 ring-white/15 inline-flex items-center justify-center hover:bg-white/15" aria-label={penuh ? 'Keluar layar penuh' : 'Layar penuh'}>
            <span className="material-symbols-outlined text-[20px]">{penuh ? 'fullscreen_exit' : 'fullscreen'}</span>
          </button>
        </div>
      </header>

      <main className="relative flex-1 min-h-0 grid lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-6 lg:gap-10 px-5 md:px-10 py-6 md:py-8">
        {/* Kiri: nama ruang + status besar */}
        <section className="flex flex-col min-h-0 hero-in">
          <div className="text-sm md:text-base font-semibold uppercase tracking-[0.2em] text-[#e4c27f]">Ruang rapat</div>
          <h1 className="font-display font-extrabold tracking-tight leading-[1.02] text-[clamp(2.4rem,6vw,5.5rem)] mt-1">{judulRuang(room)}</h1>

          <div className="mt-5">
            {memuat ? (
              <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-white/10 text-white/70 text-lg font-bold">Memuat jadwal…</span>
            ) : (
              <span key={status} className={`hero-in inline-flex items-center gap-3 px-5 py-2.5 md:px-6 md:py-3 rounded-full ring-1 text-lg md:text-2xl font-extrabold uppercase tracking-wider ${tema.pill}`}>
                <span className="relative flex w-3.5 h-3.5"><span className={`absolute inset-0 rounded-full ${tema.dot} motion-safe:animate-ping opacity-75`}></span><span className={`relative w-3.5 h-3.5 rounded-full ${tema.dot}`}></span></span>
                {tema.label}
              </span>
            )}
          </div>

          {!memuat && (
            <div key={`${status}-${sekarang?.id ?? berikut?.id ?? 'x'}`} className="hero-in mt-6 md:mt-8 flex-1 min-h-0 flex flex-col justify-center rounded-3xl bg-white/[.06] ring-1 ring-white/10 backdrop-blur-sm p-6 md:p-9" style={{ '--d': '120ms' }}>
              {sekarang ? (
                <>
                  <div className="text-sm md:text-base text-white/60 font-semibold">Rapat berlangsung</div>
                  <div className="font-display font-extrabold text-[clamp(1.6rem,3.4vw,3rem)] leading-tight mt-2 line-clamp-3">{sekarang.title}</div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-base md:text-xl text-white/80">
                    <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-[22px] text-white/50">schedule</span>{sekarang.start} – {sekarang.end}</span>
                    {sekarang.pic && <span className="inline-flex items-center gap-2 min-w-0"><span className="material-symbols-outlined text-[22px] text-white/50">person</span><span className="truncate">{sekarang.pic}</span></span>}
                  </div>
                  <div className="mt-6">
                    <div className="h-2.5 rounded-full bg-white/10 overflow-hidden">
                      <div className={`h-full rounded-full ${tema.bar} transition-[width] duration-1000`} style={{ width: `${Math.min(100, ((menitSekarang - menitDari(sekarang.start)) / Math.max(1, menitDari(sekarang.end) - menitDari(sekarang.start))) * 100)}%` }}></div>
                    </div>
                    <div className="text-sm md:text-lg text-white/70 mt-2.5">Selesai dalam <b className="text-white">{fmtDurasi(Math.max(1, Math.ceil(menitDari(sekarang.end) - menitSekarang)))}</b>
                      {berikut && <span className="text-white/50"> · berikutnya {berikut.start}</span>}
                    </div>
                  </div>
                </>
              ) : berikut ? (
                <>
                  <div className="text-sm md:text-base text-white/60 font-semibold">{status === 'segera' ? `Rapat dimulai dalam ${fmtDurasi(Math.max(1, sisaKeBerikut))}` : `Kosong sampai pukul ${berikut.start}`}</div>
                  <div className="font-display font-extrabold text-[clamp(1.6rem,3.4vw,3rem)] leading-tight mt-2 line-clamp-3">{status === 'segera' ? berikut.title : 'Ruangan dapat digunakan'}</div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-base md:text-xl text-white/80">
                    {status === 'segera' ? (
                      <>
                        <span className="inline-flex items-center gap-2"><span className="material-symbols-outlined text-[22px] text-white/50">schedule</span>{berikut.start} – {berikut.end}</span>
                        {berikut.pic && <span className="inline-flex items-center gap-2 min-w-0"><span className="material-symbols-outlined text-[22px] text-white/50">person</span><span className="truncate">{berikut.pic}</span></span>}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-2 min-w-0"><span className="material-symbols-outlined text-[22px] text-white/50">event_upcoming</span><span className="truncate">Berikutnya: {berikut.title}</span></span>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-[56px] text-emerald-300">event_available</span>
                  <div className="font-display font-extrabold text-[clamp(1.6rem,3.4vw,3rem)] leading-tight mt-2">Ruangan tersedia</div>
                  <div className="text-base md:text-xl text-white/70 mt-2">{hariIni.length ? 'Tidak ada rapat lagi hari ini.' : 'Belum ada booking untuk hari ini.'}</div>
                </>
              )}
            </div>
          )}
        </section>

        {/* Kanan: jam + agenda */}
        <aside className="flex flex-col min-h-0 hero-in" style={{ '--d': '200ms' }}>
          <div className="text-right">
            <div className="font-display font-extrabold tabular-nums leading-none text-[clamp(3rem,7vw,6rem)] tracking-tight">
              {jam}<span className="text-[0.35em] text-white/50 align-top ml-1">{pad(now.getSeconds())}</span>
            </div>
            <div className="text-base md:text-lg text-white/70 mt-2 capitalize">{tanggalPanjang}</div>
          </div>

          <AgendaMingguan minggu={minggu} memuat={memuat} sekarang={sekarang} menitSekarang={menitSekarang} tema={tema} />
        </aside>
      </main>

      <footer className="relative px-5 md:px-10 pb-5 flex flex-wrap items-center justify-between gap-2 text-xs md:text-sm text-white/50">
        <span>Booking ruang rapat melalui aplikasi Biro Umum.</span>
        {offline
          ? <span className="inline-flex items-center gap-1.5 text-amber-300"><span className="material-symbols-outlined text-[16px]">wifi_off</span>Koneksi terputus, menampilkan data terakhir</span>
          : <span className="inline-flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse"></span>Diperbarui otomatis</span>}
      </footer>
    </div>
  );
}
