import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import BrandMark from '../components/BrandMark';

// Halaman tujuan link di email verifikasi Daftar Akun (/verifikasi-email#token=...).
// Token ada di #fragment (tidak terkirim ke server/log); setelah dibaca dihapus dari address bar & riwayat.
export default function VerifikasiEmail() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') || '');
  const [hasil, setHasil] = useState(token ? { status: 'memuat' } : { status: 'gagal', message: 'Link verifikasi tidak lengkap (token tidak ditemukan). Login untuk mengirim ulang link-nya.' });
  const dikirim = useRef(false);

  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
    // Sekali saja (StrictMode menjalankan efek dua kali; token hanya berlaku sekali pakai).
    if (!token || dikirim.current) return;
    dikirim.current = true;
    api.post('/auth/verify-email', { token })
      .then((r) => setHasil({ status: 'ok', message: r.data?.message, email: r.data?.email }))
      .catch((err) => setHasil({
        status: 'gagal',
        message: !err.response ? 'Tidak dapat terhubung ke server. Coba buka link ini lagi nanti.' : err.response.data?.message || 'Verifikasi email gagal.',
      }));
  }, [token]);

  return (
    <div className="min-h-screen flex flex-col justify-between">
      <header className="w-full bg-dinas-dark bg-kawung-gelap text-white px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" className="!border-white/20" />
          <div>
            <h1 className="font-display text-base font-extrabold text-white leading-tight">Biro Umum dan Rumah Tangga</h1>
            <p className="text-xs text-white/60 mt-0.5">Kementerian Ketenagakerjaan</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 text-center shadow-[0_1px_2px_rgba(14,30,51,.04),0_20px_50px_-24px_rgba(14,30,51,.3)]">
          <span className={`mx-auto w-14 h-14 rounded-full inline-flex items-center justify-center ${hasil.status === 'ok' ? 'bg-emerald-50 text-emerald-600' : hasil.status === 'gagal' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-400'}`}>
            <span className={`material-symbols-outlined text-[30px] ${hasil.status === 'memuat' ? 'animate-pulse' : ''}`}>
              {hasil.status === 'ok' ? 'mark_email_read' : hasil.status === 'gagal' ? 'error' : 'mail'}
            </span>
          </span>
          <h2 className="font-display text-2xl font-extrabold text-dinas-ink tracking-tight mt-4">
            {hasil.status === 'ok' ? 'Email terverifikasi' : hasil.status === 'gagal' ? 'Verifikasi gagal' : 'Memverifikasi email...'}
          </h2>
          {hasil.status !== 'memuat' && <p className="text-sm text-slate-600 mt-2">{hasil.message}</p>}
          {hasil.status === 'ok' && hasil.email && <p className="text-xs text-slate-500 mt-1">Akun <b>{hasil.email}</b> sekarang aktif.</p>}

          {hasil.status !== 'memuat' && (
            <Link to="/login" state={hasil.status === 'ok' && hasil.email ? { registered: true, email: hasil.email, message: 'Email berhasil diverifikasi. Silakan masuk.' } : undefined}
              className="mt-6 w-full py-3.5 px-4 bg-[#1e3a5f] hover:bg-[#152b47] text-white font-semibold rounded-lg text-sm inline-flex items-center justify-center gap-2 transition">
              {hasil.status === 'ok' ? 'Masuk sekarang' : 'Ke halaman Login'}
              <span className="material-symbols-outlined text-[18px]">login</span>
            </Link>
          )}
        </div>
      </main>

      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        © {new Date().getFullYear()} Biro Umum dan Rumah Tangga. Sistem Manajemen Fasilitas &amp; Operasional Kantor.
      </footer>
    </div>
  );
}
