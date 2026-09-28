import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import BrandMark from './BrandMark';

// Popup animasi logo (dipakai saat login & logout): logo muncul lalu bergerak naik-turun dengan
// pusaran biru berputar, progress bar terisi selama `duration` ms, lalu onDone() dipanggil.
// Dirender ke <body> lewat portal supaya selalu menutupi layar penuh, walaupun dipanggil dari
// dalam elemen ber-transform (mis. Sidebar versi HP).
export default function LoginSplash({ name, title = 'Selamat datang', subtitle = 'Menyiapkan dashboard Anda...', duration = 3000, onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm feedback-fade" role="status" aria-live="polite">
      <div className="w-full max-w-sm bg-white rounded-3xl shadow-2xl px-8 py-10 text-center feedback-pop">
        <div className="relative mx-auto w-40 h-40 flex items-center justify-center">
          {/* Pusaran biru berputar di belakang logo + dua cincin berputar berlawanan arah. */}
          <div className="splash-halo absolute -inset-3 rounded-full blur-lg opacity-80" style={{ background: 'conic-gradient(from 0deg, #2563eb, #60a5fa, transparent 35%, #4f46e5, #93c5fd, transparent 75%, #2563eb)' }} />
          <div className="splash-ring absolute inset-0 rounded-full border-4 border-transparent border-t-blue-600 border-r-sky-400" />
          <div className="splash-ring-rev absolute inset-2 rounded-full border-[3px] border-transparent border-b-indigo-500 border-l-blue-300" />
          <div className="splash-logo relative">
            <div className="splash-bob">
              <BrandMark size="xl" className="rounded-2xl shadow-lg" />
            </div>
          </div>
        </div>
        <h2 className="mt-6 text-xl font-bold text-slate-900">{title}{name ? ',' : ''}</h2>
        {name && <p className="mt-1 text-base font-semibold text-blue-700 truncate">{name}</p>}
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        <div className="mt-6 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
          <div className="splash-progress h-full rounded-full bg-gradient-to-r from-blue-600 to-indigo-600" style={{ '--splash-ms': `${duration}ms` }} />
        </div>
      </div>
    </div>,
    document.body
  );
}
