import React from 'react';
import { PASSWORD_RULES } from '../utils/validation';

// Daftar syarat kata sandi di bawah kolom kata sandi (Daftar Akun & Reset Kata Sandi):
// tiap syarat langsung tercentang hijau begitu terpenuhi saat diketik.
export default function SyaratSandi({ value = '', className = '' }) {
  return (
    <ul className={`mt-1.5 space-y-0.5 ${className}`} aria-label="Syarat kata sandi">
      {PASSWORD_RULES.map((r) => {
        const ok = r.test(value);
        return (
          <li key={r.key} className={`flex items-center gap-1.5 text-[11px] transition-colors ${ok ? 'text-emerald-700' : 'text-slate-500'}`}>
            <span className={`material-symbols-outlined text-[14px] ${ok ? 'text-emerald-600' : 'text-slate-300'}`} aria-hidden="true">{ok ? 'check_circle' : 'radio_button_unchecked'}</span>
            <span>{r.label}<span className="sr-only">{ok ? ' (terpenuhi)' : ' (belum)'}</span></span>
          </li>
        );
      })}
    </ul>
  );
}
