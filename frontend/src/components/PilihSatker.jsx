import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { SATUAN_KERJA } from '../utils/satuanKerja';

// Isian "Satuan kerja / bagian" ruang rapat (menu Foto & Fasilitas Ruang): ketik untuk mencari, atau pilih dari
// daftar satuan kerja Kemnaker (utils/satuanKerja.js). Satuan kerja yang sudah punya ruangan tampil paling atas
// beserta jumlah ruangannya. Nama yang tidak ada di daftar tetap boleh diketik (jadi bagian baru).
// terpakai = { "Biro Umum": 6, ... } (jumlah ruangan per satuan kerja saat ini).
export default function PilihSatker({ value, onChange, terpakai = {}, className = '', placeholder = 'Ketik atau pilih satuan kerja', autoFocus = false }) {
  const [buka, setBuka] = useState(false);
  const [aktif, setAktif] = useState(-1);
  // Daftar baru disaring setelah admin mengetik; saat baru dibuka tampil lengkap walau isian sudah terisi.
  const [mengetik, setMengetik] = useState(false);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const id = useId();
  const q = mengetik ? value.trim().toLowerCase() : '';

  // Grup: "Sudah punya ruangan" lalu grup daftar Kemnaker (tanpa yang sudah tampil di atas). Saring sesuai ketikan;
  // mengetik nama grup (mis. "binalavotas") menampilkan seluruh isi grupnya.
  const grup = useMemo(() => {
    const ada = Object.keys(terpakai);
    const cocok = (nama, g) => !q || nama.toLowerCase().includes(q) || g.toLowerCase().includes(q);
    const out = [{ grup: 'Sudah punya ruangan', unit: ada.filter((n) => cocok(n, 'sudah punya ruangan')) }];
    for (const g of SATUAN_KERJA) out.push({ grup: g.grup, unit: g.unit.filter((n) => !ada.includes(n) && cocok(n, g.grup)) });
    return out.filter((g) => g.unit.length);
  }, [terpakai, q]);
  const opsi = grup.flatMap((g) => g.unit);
  const persis = opsi.some((n) => n.toLowerCase() === q);
  const ketik = value.trim();

  const pilih = (nama) => { onChange(nama); setBuka(false); setAktif(-1); setMengetik(false); };
  // Pilihan yang disorot keyboard selalu terlihat di daftar.
  useEffect(() => { if (aktif >= 0) listRef.current?.querySelector(`[data-i="${aktif}"]`)?.scrollIntoView({ block: 'nearest' }); }, [aktif]);
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!buka) { setBuka(true); return; }
      if (!opsi.length) return;
      const n = opsi.length;
      setAktif((a) => (e.key === 'ArrowDown' ? (a + 1) % n : (a <= 0 ? n - 1 : a - 1)));
    } else if (e.key === 'Enter' && buka) {
      e.preventDefault(); // jangan kirim form
      if (aktif >= 0 && opsi[aktif]) pilih(opsi[aktif]); else setBuka(false);
    } else if (e.key === 'Escape' && buka) {
      e.stopPropagation(); // tutup daftar saja, bukan dialog tambah ruangan
      setBuka(false);
    }
  };

  let i = -1;
  return (
    <div className={`relative ${className}`}>
      <input ref={inputRef} value={value} autoFocus={autoFocus} maxLength={150} placeholder={placeholder} autoComplete="off"
        role="combobox" aria-expanded={buka} aria-controls={`${id}-list`} aria-autocomplete="list"
        aria-activedescendant={buka && aktif >= 0 ? `${id}-${aktif}` : undefined}
        onChange={(e) => { onChange(e.target.value); setBuka(true); setAktif(-1); setMengetik(true); }}
        onFocus={() => setBuka(true)} onClick={() => setBuka(true)} onBlur={() => { setBuka(false); setMengetik(false); }} onKeyDown={onKeyDown}
        className="w-full h-10 pl-3 pr-9 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-dinas focus:ring-2 focus:ring-dinas/15" />
      <button type="button" tabIndex={-1} aria-label="Tampilkan daftar satuan kerja" onMouseDown={(e) => {
          e.preventDefault();
          // Fokuskan isian dulu supaya daftar tertutup lagi (onBlur) saat admin klik di luar.
          if (document.activeElement !== inputRef.current) { inputRef.current?.focus(); setBuka(true); } else setBuka((b) => !b);
        }}
        className="absolute right-1 top-1 w-8 h-8 rounded-md text-slate-400 hover:text-slate-700 inline-flex items-center justify-center">
        <span className={`material-symbols-outlined text-[20px] transition ${buka ? 'rotate-180' : ''}`}>expand_more</span>
      </button>
      {buka && (
        <div ref={listRef} id={`${id}-list`} role="listbox" aria-label="Daftar satuan kerja"
          onMouseDown={(e) => e.preventDefault()} // klik pilihan tidak membuat input kehilangan fokus dulu
          className="absolute z-30 left-0 right-0 mt-1 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white shadow-xl pb-1">
          {q && !persis && (
            <button type="button" onClick={() => pilih(ketik.replace(/\s+/g, ' '))}
              className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs text-dinas font-semibold hover:bg-slate-50 border-b border-slate-100">
              <span className="material-symbols-outlined text-[17px]">add</span>
              <span className="min-w-0 truncate">Pakai "{ketik}" sebagai satuan kerja baru</span>
            </button>
          )}
          {grup.map((g) => (
            <div key={g.grup} role="group" aria-label={g.grup}>
              <div className="sticky top-0 z-10 bg-white/95 backdrop-blur px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate" title={g.grup}>{g.grup}</div>
              {g.unit.map((nama) => {
                i += 1;
                const idx = i;
                const on = nama === value;
                return (
                  <div key={nama} id={`${id}-${idx}`} data-i={idx} role="option" aria-selected={on} onClick={() => pilih(nama)} onMouseEnter={() => setAktif(idx)}
                    className={`mx-1 px-2 py-1.5 rounded-lg flex items-center gap-2 cursor-pointer text-sm ${idx === aktif ? 'bg-slate-100' : ''} ${on ? 'font-semibold text-dinas' : 'text-slate-700'}`}>
                    <span className="min-w-0 flex-1 truncate" title={nama}>{nama}</span>
                    {terpakai[nama] ? <span className="shrink-0 text-[10px] font-semibold text-slate-500 tabular-nums">{terpakai[nama]} ruangan</span> : null}
                    {on && <span className="material-symbols-outlined shrink-0 text-[17px]">check</span>}
                  </div>
                );
              })}
            </div>
          ))}
          {!opsi.length && !q && <p className="px-3 py-4 text-xs text-slate-500">Belum ada daftar satuan kerja.</p>}
        </div>
      )}
    </div>
  );
}
