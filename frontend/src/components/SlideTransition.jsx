import React, { useState } from 'react';

// Transisi geser saat pindah "slide" (tahap 1-2-3, minggu kalender, tab kendaraan).
// `index` = urutan slide yang sedang tampil: kalau naik, isi baru masuk dari kanan;
// kalau turun, dari kiri. Tampilan pertama kali tidak dianimasikan (sudah ada transisi halaman).
// Pembungkus induknya sebaiknya `overflow-hidden` supaya geseran tidak memunculkan scrollbar sesaat.
export default function SlideTransition({ index, children, className = '' }) {
  const [state, setState] = useState({ index, dir: '' });
  // Arah dihitung saat index berubah dan disimpan di state (bukan ref), supaya kelas animasinya
  // tidak hilang di render berikutnya (mis. saat mengetik) lalu memutus animasi di tengah jalan.
  if (state.index !== index) setState({ index, dir: index > state.index ? 'slide-in-next' : 'slide-in-prev' });
  return <div key={index} className={`${state.dir} ${className}`}>{children}</div>;
}
