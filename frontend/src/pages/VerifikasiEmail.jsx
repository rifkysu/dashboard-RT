import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import AuthShell from '../components/AuthShell';

// Halaman tujuan link di email verifikasi Daftar Akun (/verifikasi-email#token=...).
// Token ada di #fragment (tidak terkirim ke server/log); setelah dibaca dihapus dari address bar & riwayat.
// Pemilik email mengisi kata sandi yang dibuat saat daftar: akun hanya aktif bila cocok, supaya email yang
// didaftarkan ulang orang lain (dengan sandi lain) tidak ikut teraktifkan saat pemiliknya mengklik link.
export default function VerifikasiEmail() {
  const [token] = useState(
    () => new URLSearchParams(window.location.hash.slice(1)).get('token') || '',
  );
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);
  const [password, setPassword] = useState('');
  const [lihat, setLihat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(
    token
      ? null
      : {
          message:
            'Link verifikasi tidak lengkap (token tidak ditemukan). Login untuk mengirim ulang link-nya.',
        },
  );
  const [hasil, setHasil] = useState(null); // { message, email } setelah berhasil

  async function kirim(e) {
    e.preventDefault();
    if (!password || loading) return;
    setLoading(true);
    setError(null);
    try {
      const r = await api.post('/auth/verify-email', { token, password });
      setHasil({ message: r.data?.message, email: r.data?.email });
    } catch (err) {
      setError({
        code: err.response?.data?.code,
        message: !err.response
          ? 'Tidak dapat terhubung ke server. Coba lagi sebentar lagi.'
          : err.response.data?.message || 'Verifikasi email gagal.',
      });
    } finally {
      setLoading(false);
    }
  }

  const salahSandi = error?.code === 'PASSWORD_MISMATCH';
  return (
    <AuthShell>
      <div className="auth-kartu auth-kartu-emas w-full max-w-[440px] bg-white rounded-2xl border border-white/40 p-8 sm:p-10">
        <div className="text-center">
          <span
            className={`mx-auto w-14 h-14 rounded-full inline-flex items-center justify-center ${hasil ? 'bg-emerald-50 text-emerald-600' : 'bg-dinas-soft text-dinas'}`}
          >
            <span className="material-symbols-outlined text-[30px]">
              {hasil ? 'mark_email_read' : 'mail_lock'}
            </span>
          </span>
          <h2 className="font-display text-2xl font-extrabold text-dinas-ink tracking-tight mt-4">
            {hasil ? 'Email terverifikasi' : 'Verifikasi Email'}
          </h2>
          {!hasil && (
            <p className="text-sm text-slate-500 mt-1.5">
              Masukkan kata sandi yang Anda buat saat mendaftar untuk mengaktifkan akun.
            </p>
          )}
        </div>

        {hasil ? (
          <>
            <p className="text-sm text-slate-600 mt-3 text-center">{hasil.message}</p>
            {hasil.email && (
              <p className="text-xs text-slate-500 mt-1 text-center">
                Akun <b>{hasil.email}</b> sekarang aktif.
              </p>
            )}
            <Link
              to="/login"
              state={
                hasil.email
                  ? {
                      registered: true,
                      email: hasil.email,
                      message: 'Email berhasil diverifikasi. Silakan masuk.',
                    }
                  : undefined
              }
              className="mt-6 w-full py-3.5 px-4 bg-[#1e3a5f] hover:bg-[#152b47] text-white font-semibold rounded-lg text-sm inline-flex items-center justify-center gap-2 transition"
            >
              Masuk sekarang<span className="material-symbols-outlined text-[18px]">login</span>
            </Link>
          </>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={kirim}>
            {error && (
              <div
                className={`px-4 py-3 text-sm rounded-lg border ${salahSandi ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-red-50 border-red-200 text-red-700'}`}
              >
                {error.message}
                {salahSandi && (
                  <Link
                    to="/register"
                    className="mt-2 block text-xs font-semibold text-[#1e3a5f] hover:underline"
                  >
                    Daftar ulang dengan kata sandi saya →
                  </Link>
                )}
              </div>
            )}
            {token && (
              <>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                    key
                  </span>
                  <input
                    type={lihat ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    autoComplete="current-password"
                    placeholder="Kata sandi saat mendaftar"
                    maxLength={128}
                    aria-label="Kata sandi saat mendaftar"
                    className="w-full pl-11 pr-11 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] transition"
                  />
                  <button
                    type="button"
                    onClick={() => setLihat((v) => !v)}
                    aria-label={lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      {lihat ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full py-3.5 px-4 bg-[#1e3a5f] hover:bg-[#152b47] disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition"
                >
                  {loading ? 'Memverifikasi...' : 'Verifikasi & Aktifkan Akun'}
                  <span className="material-symbols-outlined text-[18px]">check</span>
                </button>
              </>
            )}
            <div className="pt-2 text-center">
              <Link
                to="/login"
                className="text-sm text-slate-600 hover:text-slate-900 font-semibold"
              >
                Ke halaman Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </AuthShell>
  );
}
