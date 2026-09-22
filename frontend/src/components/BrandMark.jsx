import React, { useState } from 'react';

const SIZE = { xs: 'w-9 h-9', sm: 'w-10 h-10', md: 'w-11 h-11' };
const ICON_SIZE = { xs: 'text-[18px]', sm: 'text-[20px]', md: 'text-[23px]' };

// Menampilkan logo Kemnaker (public/logo-kemnaker.png). Kalau file belum
// tersedia, otomatis fallback ke ikon lama supaya UI tidak pernah rusak.
export default function BrandMark({ size = 'sm', className = '' }) {
  const [failed, setFailed] = useState(false);
  const boxSize = SIZE[size] || SIZE.sm;

  if (failed) {
    return (
      <div className={`${boxSize} rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-sm shrink-0 ${className}`}>
        <span className={`material-symbols-outlined ${ICON_SIZE[size] || ICON_SIZE.sm}`}>account_balance</span>
      </div>
    );
  }

  return (
    <div className={`${boxSize} rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden shrink-0 ${className}`}>
      <img
        src="/logo-kemnaker.png"
        alt="Logo Kementerian Ketenagakerjaan"
        className="w-full h-full object-contain p-1"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
