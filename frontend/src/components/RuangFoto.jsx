import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import useRuangInfo, { fotoRuangDari } from '../hooks/useRuangInfo';
import FotoRuangSlideshow from './FotoRuangSlideshow';
import { judulRuang, slugRuang } from '../utils/ruang';
import { temaRuang } from '../utils/temaRuang';

// Foto & fasilitas ruang rapat (dari menu admin "Foto & Fasilitas Ruang") untuk semua tempat yang
// menampilkan ruang rapat: landing, kiosk, tabel jadwal, form booking pegawai & tamu, dashboard.

// Link dokumentasi foto ruangan (mis. folder Google Drive dari satuan kerja), dibuka di tab baru.
export function LinkFotoRuang({ href, className = '', children = 'Dokumentasi foto' }) {
  if (!href) return null;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className={`inline-flex items-center gap-1 ${className}`}>
      <span className="material-symbols-outlined text-[15px]">add_to_drive</span>{children}
    </a>
  );
}

// Foto sampul kecil; ikon ruangan bila belum ada foto.
export function RuangThumb({ room, className = 'w-10 h-10 rounded-lg', iconClass = 'text-[18px]' }) {
  const { info } = useRuangInfo();
  const sampul = info?.[room]?.foto?.[0];
  return sampul
    ? <img src={sampul.src} alt="" loading="lazy" className={`shrink-0 object-cover bg-slate-200 ${className}`} />
    : <span className={`shrink-0 inline-flex items-center justify-center bg-slate-100 text-slate-400 ${className}`} aria-hidden="true"><span className={`material-symbols-outlined ${iconClass}`}>meeting_room</span></span>;
}

// Popup gelap: slideshow foto + fasilitas + tautan ke layar ruangan.
export function RuangInfoDialog({ room, onClose }) {
  const { info } = useRuangInfo();
  const data = fotoRuangDari(info, room);
  const d = info?.[room];
  useEffect(() => {
    // Fase capture + stopPropagation: Esc hanya menutup popup ini, bukan form booking di belakangnya.
    // Saat tampilan penuh foto terbuka, Esc untuk menutup tampilan penuh itu dulu (ditangani lightbox).
    const onKey = (e) => {
      if (e.key !== 'Escape' || document.querySelector('[role="dialog"][aria-label="Foto ruangan"]')) return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey, true); document.body.style.overflow = prev; };
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-950/75 backdrop-blur-sm flex overflow-y-auto p-3 sm:p-6 feedback-fade" role="dialog" aria-modal="true" aria-label={`Foto & fasilitas ${judulRuang(room)}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={temaRuang(room, info).style} className="m-auto w-full max-w-3xl rounded-3xl bg-latar text-white ring-1 ring-white/10 shadow-2xl overflow-hidden feedback-pop">
        <div className="flex items-center justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-aksen">{d?.satuan_kerja || 'Ruang rapat'}</div>
            <div className="font-display text-2xl font-extrabold leading-tight">{judulRuang(room)}</div>
            {d?.kapasitas && <div className="mt-1 inline-flex items-center gap-1 text-sm text-white/65"><span className="material-symbols-outlined text-[16px]">chair</span>Kapasitas {d.kapasitas} kursi</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Tutup" className="w-10 h-10 shrink-0 rounded-xl bg-white/10 ring-1 ring-white/15 inline-flex items-center justify-center hover:bg-white/20">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
        <div className="p-5">
          {!info ? <div className="h-[22rem] flex items-center justify-center text-white/60">Memuat foto…</div>
            : data ? <FotoRuangSlideshow data={data} className="h-[min(34rem,68vh)]" />
              : (
                <div className="h-[16rem] rounded-3xl bg-white/[.06] ring-1 ring-white/10 flex flex-col items-center justify-center text-center px-6">
                  <span className="material-symbols-outlined text-[44px] text-white/40">no_photography</span>
                  <div className="font-semibold mt-2">Belum ada foto untuk ruangan ini</div>
                  <div className="text-sm text-white/55 mt-1">{d?.link_foto ? 'Lihat dokumentasi foto ruangan lewat tautan di bawah.' : 'Foto & fasilitas ditambahkan Admin Biro Umum.'}</div>
                  {d?.fasilitas?.length > 0 && (
                    <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
                      {d.fasilitas.map((f) => (
                        <li key={f.label} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/10 text-xs font-semibold text-white/80">
                          <span className="material-symbols-outlined text-[15px] text-aksen">{f.icon}</span>{f.label}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
        </div>
        <div className="px-5 pb-5 -mt-1 flex flex-wrap justify-end gap-x-5 gap-y-2">
          <LinkFotoRuang href={d?.link_foto} className="text-sm font-semibold text-aksen hover:text-white">Dokumentasi foto (Google Drive)</LinkFotoRuang>
          <a href={`/ruang/${slugRuang(room)}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/70 hover:text-white">
            <span className="material-symbols-outlined text-[18px]">tablet_mac</span>Buka layar ruangan
          </a>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Tombol apa saja (thumbnail, teks, ikon) yang membuka popup foto & fasilitas ruangan.
export function RuangFotoButton({ room, className = '', title, children, onOpen }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} title={title ?? `Lihat foto & fasilitas ${judulRuang(room)}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onOpen?.(); setOpen(true); }}>
        {children}
      </button>
      {open && <RuangInfoDialog room={room} onClose={() => setOpen(false)} />}
    </>
  );
}

// Label "Maintenance" untuk ruangan yang sedang diblokir Admin/Kabag (menu Foto & Fasilitas Ruang).
// Tidak tampil apa-apa bila ruangan bisa dibooking. dark = untuk latar gelap (kiosk, layar ruangan).
export function RuangMaintenanceTag({ room, dark = false, className = '' }) {
  const { info } = useRuangInfo();
  const d = info?.[room];
  if (!d?.maintenance) return null;
  return (
    <span title={d.maintenance_ket ? `Maintenance: ${d.maintenance_ket}` : 'Sedang maintenance, tidak bisa dibooking'}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold normal-case tracking-normal ${dark ? 'bg-amber-400 text-amber-950' : 'bg-amber-100 text-amber-800 ring-1 ring-amber-300'} ${className}`}>
      <span className="material-symbols-outlined text-[13px]">construction</span>Maintenance
    </span>
  );
}

// Kartu ringkas di form booking: foto-foto kecil + fasilitas ruangan yang sedang dipilih.
export function RuangPilihanInfo({ room }) {
  const { info } = useRuangInfo();
  if (!room) return <div className="hidden md:flex h-full min-h-[4.5rem] items-center justify-center rounded-xl border border-dashed border-slate-300 text-xs text-slate-400">Pilih ruangan untuk melihat foto & fasilitasnya</div>;
  const data = info?.[room];
  const foto = data?.foto || [];
  const fasilitas = data?.fasilitas || [];
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5">
      {data?.maintenance && (
        <div className="mb-2 flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
          <span className="material-symbols-outlined text-[15px]">construction</span>
          <span>Ruangan sedang maintenance{data.maintenance_ket ? `: ${data.maintenance_ket}` : ''}. Sementara tidak bisa dibooking — pilih ruangan lain.</span>
        </div>
      )}
      <div className="flex items-center gap-2.5">
        {foto.length ? (
          <RuangFotoButton room={room} className="relative shrink-0 flex -space-x-3 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-dinas/40">
            {foto.slice(0, 3).map((f, i) => (
              <img key={f.id} src={f.src} alt="" loading="lazy" className="w-12 h-12 rounded-lg object-cover ring-2 ring-white bg-slate-200" style={{ zIndex: 3 - i }} />
            ))}
          </RuangFotoButton>
        ) : <RuangThumb room={room} className="w-12 h-12 rounded-lg" />}
        <div className="min-w-0 flex-1">
          <div className="text-xs font-bold text-slate-800 truncate">{judulRuang(room)}</div>
          {(data?.satuan_kerja || data?.kapasitas) && <div className="text-[11px] text-slate-500 truncate">{[data.satuan_kerja, data.kapasitas && `${data.kapasitas} kursi`].filter(Boolean).join(' · ')}</div>}
          {info ? (
            <div className="flex flex-wrap gap-x-3">
              {foto.length
                ? <RuangFotoButton room={room} className="text-[11px] font-semibold text-dinas hover:underline inline-flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">photo_library</span>Lihat {foto.length} foto{fasilitas.length ? ' & fasilitas' : ''}</RuangFotoButton>
                : !data?.link_foto && <span className="text-[11px] text-slate-500">Belum ada foto ruangan</span>}
              <LinkFotoRuang href={data?.link_foto} className="text-[11px] font-semibold text-dinas hover:underline" />
            </div>
          ) : <div className="text-[11px] text-slate-400">Memuat…</div>}
        </div>
      </div>
      {fasilitas.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-1">
          {fasilitas.slice(0, 6).map((f) => (
            <li key={f.label} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-semibold text-slate-600">
              <span className="material-symbols-outlined text-[13px] text-kuningan">{f.icon}</span>{f.label}
            </li>
          ))}
          {fasilitas.length > 6 && <li className="px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">+{fasilitas.length - 6} lainnya</li>}
        </ul>
      )}
    </div>
  );
}
