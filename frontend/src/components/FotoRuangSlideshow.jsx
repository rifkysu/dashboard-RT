import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

// Slideshow foto ruangan di layar ruangan (/ruang/:slug): crossfade + zoom pelan (Ken Burns),
// berganti sendiri tiap 5 detik, bisa digeser (swipe) / panah, dan diketuk untuk dilihat layar penuh.
const GANTI_MS = 5000;
const JEDA_SENTUH_MS = 10000;  // setelah disentuh, slideshow berhenti 10 detik lalu lanjut sendiri
const TUTUP_LIGHTBOX_MS = 45000; // tampilan penuh tertutup sendiri agar layar kembali ke jadwal
const SWIPE_PX = 40;

function useGeser(onKiri, onKanan, onKetuk) {
  const awal = useRef(null);
  return {
    onPointerDown: (e) => { awal.current = { x: e.clientX, y: e.clientY }; },
    onPointerUp: (e) => {
      if (!awal.current) return;
      const dx = e.clientX - awal.current.x;
      const dy = e.clientY - awal.current.y;
      awal.current = null;
      if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? onKanan : onKiri)();
      else if (Math.abs(dx) < 8 && Math.abs(dy) < 8) onKetuk?.();
    },
    onPointerCancel: () => { awal.current = null; },
  };
}

function Lightbox({ foto, idx, setIdx, onClose }) {
  const n = foto.length;
  const ke = (d) => setIdx((i) => (i + d + n) % n);
  useEffect(() => {
    // Fase capture + stopPropagation: Esc/panah di sini tidak ikut menutup popup/form di belakangnya.
    const onKey = (e) => {
      if (['Escape', 'ArrowRight', 'ArrowLeft'].includes(e.key)) e.stopPropagation();
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') ke(1);
      else if (e.key === 'ArrowLeft') ke(-1);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(onClose, TUTUP_LIGHTBOX_MS); return () => clearTimeout(t); }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps
  const geser = useGeser(() => ke(-1), () => ke(1));
  const f = foto[idx];

  // Portal ke body: kartu slideshow memakai backdrop-filter yang membuat position:fixed terkurung di dalamnya.
  return createPortal(
    <div className="fixed inset-0 z-[70] bg-black/90 backdrop-blur-sm flex flex-col feedback-fade" role="dialog" aria-modal="true" aria-label="Foto ruangan">
      <div className="flex items-center justify-between gap-3 px-5 py-4 text-white">
        <div className="min-w-0">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-aksen">Foto {idx + 1} / {n}</div>
          <div className="font-semibold md:text-lg truncate mt-0.5">{f.caption}</div>
        </div>
        <button type="button" onClick={onClose} aria-label="Tutup" className="w-11 h-11 shrink-0 rounded-xl bg-white/10 ring-1 ring-white/15 inline-flex items-center justify-center hover:bg-white/20">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>
      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4 pb-4 touch-pan-y select-none" {...geser}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        <img key={f.src} src={f.src} alt={f.caption} draggable={false} className="max-w-full max-h-full object-contain rounded-xl shadow-2xl feedback-pop" />
        {n > 1 && (
          <>
            <button type="button" onClick={() => ke(-1)} aria-label="Foto sebelumnya" className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 ring-1 ring-white/20 text-white inline-flex items-center justify-center hover:bg-white/20">
              <span className="material-symbols-outlined text-[28px]">chevron_left</span>
            </button>
            <button type="button" onClick={() => ke(1)} aria-label="Foto berikutnya" className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-white/10 ring-1 ring-white/20 text-white inline-flex items-center justify-center hover:bg-white/20">
              <span className="material-symbols-outlined text-[28px]">chevron_right</span>
            </button>
          </>
        )}
      </div>
      <div className="flex justify-center gap-2 pb-5">
        {foto.map((x, i) => (
          <button key={x.src} type="button" onClick={() => setIdx(i)} aria-label={`Foto ${i + 1}`}
            className={`h-14 w-20 rounded-lg overflow-hidden ring-2 transition ${i === idx ? 'ring-aksen opacity-100' : 'ring-transparent opacity-50 hover:opacity-80'}`}>
            <img src={x.src} alt="" className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}

export default function FotoRuangSlideshow({ data, className = '', style }) {
  const { foto, fasilitas = [] } = data;
  const n = foto.length;
  const [idxState, setIdx] = useState(0);
  // Foto bisa berkurang saat admin menghapusnya (data live) -> jangan menunjuk foto yang sudah tidak ada.
  const idx = idxState < n ? idxState : 0;
  const [jedaSampai, setJedaSampai] = useState(0);
  const [penuh, setPenuh] = useState(false);
  // Tiap kali foto aktif, kuncinya naik agar animasi zoom mulai ulang; foto yang sedang memudar
  // tetap memakai kunci lamanya sehingga zoom-nya tidak meloncat balik.
  const putaran = useRef({});
  const kunciRef = useRef(-1);
  if (kunciRef.current !== idx) { kunciRef.current = idx; putaran.current[idx] = (putaran.current[idx] || 0) + 1; }

  const sentuh = () => setJedaSampai(Date.now() + JEDA_SENTUH_MS);
  const ke = (d) => { sentuh(); setIdx((i) => ((i < n ? i : 0) + d + n) % n); };
  const geser = useGeser(() => ke(-1), () => ke(1), () => { sentuh(); setPenuh(true); });

  // Ganti foto otomatis; berhenti selama dijeda (disentuh) atau saat tampilan penuh terbuka.
  useEffect(() => {
    if (n < 2 || penuh) return undefined;
    const sisa = jedaSampai - Date.now();
    if (sisa > 0) { const t = setTimeout(() => setJedaSampai(0), sisa); return () => clearTimeout(t); }
    const t = setTimeout(() => setIdx((i) => ((i < n ? i : 0) + 1) % n), GANTI_MS);
    return () => clearTimeout(t);
  }, [idx, jedaSampai, penuh, n]);

  const berjalan = n > 1 && !penuh && jedaSampai <= Date.now();

  return (
    <div className={`relative flex flex-col min-h-0 rounded-3xl overflow-hidden ring-1 ring-white/10 bg-white/[.06] backdrop-blur-sm ${className}`} style={style}>
      {/* Foto: semua ditumpuk, yang aktif muncul (crossfade) sambil zoom pelan */}
      <div className="relative flex-1 min-h-[10rem] overflow-hidden cursor-zoom-in touch-pan-y select-none" {...geser}
        role="button" tabIndex={0} aria-label="Lihat foto ruangan layar penuh"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setPenuh(true); } }}>
        {foto.map((f, i) => (
          <div key={f.src} className={`absolute inset-0 transition-opacity duration-[1200ms] ease-out ${i === idx ? 'opacity-100' : 'opacity-0'}`} aria-hidden={i !== idx}>
            <img src={f.src} alt={f.caption} draggable={false}
              key={putaran.current[i] || 0}
              className={`w-full h-full object-cover ${putaran.current[i] ? 'foto-kenburns' : ''}`}
              style={{ objectPosition: 'center 40%', '--kb-x': i % 2 ? '-3%' : '3%', animationDuration: `${GANTI_MS + 1500}ms` }} />
          </div>
        ))}
        {/* Gradasi agar teks terbaca */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b1626] via-[#0b1626]/20 to-[#0b1626]/40 pointer-events-none" aria-hidden="true"></div>

        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2 pointer-events-none">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/35 backdrop-blur-md ring-1 ring-white/15 text-xs font-bold uppercase tracking-wider">
            <span className="material-symbols-outlined text-[16px] text-aksen">photo_library</span>Foto ruangan
          </span>
          <span className="px-2.5 py-1 rounded-full bg-black/35 backdrop-blur-md ring-1 ring-white/15 text-xs font-bold tabular-nums">{idx + 1} / {n}</span>
        </div>

        {n > 1 && (
          <>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => ke(-1)} aria-label="Foto sebelumnya"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/35 backdrop-blur-md ring-1 ring-white/20 inline-flex items-center justify-center hover:bg-black/55">
              <span className="material-symbols-outlined">chevron_left</span>
            </button>
            <button type="button" onPointerDown={(e) => e.stopPropagation()} onPointerUp={(e) => e.stopPropagation()} onClick={() => ke(1)} aria-label="Foto berikutnya"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/35 backdrop-blur-md ring-1 ring-white/20 inline-flex items-center justify-center hover:bg-black/55">
              <span className="material-symbols-outlined">chevron_right</span>
            </button>
          </>
        )}

        <div className="absolute left-0 right-0 bottom-0 px-5 pb-4 pointer-events-none">
          <div key={idx} className="hero-in font-semibold md:text-lg leading-snug drop-shadow-[0_2px_8px_rgba(0,0,0,.6)]">{foto[idx].caption}</div>
          <div className="mt-3 flex items-center gap-1.5" aria-hidden="true">
            {foto.map((f, i) => (
              <span key={f.src} className="relative h-1 flex-1 max-w-16 rounded-full bg-white/25 overflow-hidden">
                {i < idx && <span className="absolute inset-0 bg-aksen"></span>}
                {i === idx && (berjalan
                  ? <span key={`${idx}-${jedaSampai}`} className="absolute inset-0 layar-progress bg-aksen" style={{ animationDuration: `${GANTI_MS}ms` }}></span>
                  : <span className="absolute inset-0 bg-aksen-70"></span>)}
              </span>
            ))}
            <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-semibold text-white/70">
              <span className="material-symbols-outlined text-[15px]">zoom_in</span>Ketuk untuk perbesar
            </span>
          </div>
        </div>
      </div>

      {fasilitas.length > 0 && (
        <div className="px-4 py-3 border-t border-white/10">
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-white/50 mb-2">Fasilitas</div>
          <ul className="flex flex-wrap gap-1.5 lg:flex-nowrap lg:overflow-x-auto xl:flex-wrap xl:overflow-visible [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {fasilitas.map((f, i) => (
              <li key={f.label} className="hero-in shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[.07] ring-1 ring-white/10 text-xs md:text-sm font-semibold text-white/85" style={{ '--d': `${300 + i * 70}ms` }}>
                <span className="material-symbols-outlined text-[17px] text-aksen">{f.icon}</span>{f.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {penuh && <Lightbox foto={foto} idx={idx} setIdx={(v) => { sentuh(); setIdx(v); }} onClose={() => { sentuh(); setPenuh(false); }} />}
    </div>
  );
}
