import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Anti-spam: kalau backend balas 429 (terlalu banyak percobaan login),
  // tombol dikunci sampai waktu tunggunya habis (biasanya 1 menit).
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!lockedUntil) return;
    const t = setInterval(() => {
      if (lockedUntil - Date.now() <= 0) {
        setLockedUntil(0);
        clearInterval(t);
      } else {
        setNow(Date.now());
      }
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const secondsLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const isLocked = secondsLeft > 0;

  async function handleSubmit(e) {
    e.preventDefault();
    if (isLocked) return;
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      if (err.response?.status === 429) {
        const retrySeconds = Number(err.response.headers?.['retry-after']) || 60;
        setLockedUntil(Date.now() + retrySeconds * 1000);
        setNow(Date.now());
        setError(err.response?.data?.message || `Terlalu banyak percobaan login. Coba lagi dalam ${retrySeconds} detik.`);
      } else {
        setError(err.response?.data?.message || 'Gagal login. Periksa email/kata sandi Anda.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleSSOLogin() {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
    window.location.href = `${apiUrl}/auth/google`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#167992] p-4 sm:p-6">
      <div className="w-full max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-white/80 hover:text-white font-semibold mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Kembali ke Menu Utama
        </Link>

        <div className="grid md:grid-cols-2 bg-white rounded-[2rem] shadow-2xl shadow-slate-300/50 border border-slate-200/60 overflow-hidden">
          {/* Kiri: form login */}
          <div className="p-8 sm:p-12 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-8">
              <BrandMark size="sm" />
              <div>
                <h1 className="text-sm font-bold text-slate-900 leading-none">Biro Umum</h1>
                <p className="text-[11px] text-slate-500 mt-0.5">Rumah Tangga &amp; Administrasi</p>
              </div>
            </div>

            <h2 className="text-3xl font-extrabold text-slate-900">Masuk</h2>
            <p className="text-sm text-slate-500 mt-1.5 mb-7">
              Akses layanan pemeliharaan, pengadaan, kendaraan, dan jadwal ruang rapat.
            </p>

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
                {error}
              </div>
            )}

            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full pl-12 pr-4 py-3.5 bg-slate-100 border border-transparent rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
                  required
                />
              </div>

              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  key
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Kata Sandi"
                  className="w-full pl-12 pr-11 py-3.5 bg-slate-100 border border-transparent rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>

              <div className="text-right">
                <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Lupa kata sandi?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading || isLocked}
                className="w-full py-3.5 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 disabled:opacity-60 text-white font-semibold rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition"
              >
                {isLocked ? (
                  <>
                    <span className="material-symbols-outlined text-[18px]">lock_clock</span>
                    Coba lagi dalam {secondsLeft} detik
                  </>
                ) : (
                  <>
                    {loading ? 'Memproses...' : 'Masuk ke Dashboard'}
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </>
                )}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-slate-400 font-medium">Atau</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSSOLogin}
                className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2.5 transition"
              >
                <span className="material-symbols-outlined text-[18px] text-blue-600">domain</span>
                Masuk dengan Akun Kemenaker / Intranet (SSO)
              </button>
            </form>

            <p className="mt-7 text-center text-xs text-slate-500 md:hidden">
              Belum memiliki akun pegawai?
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold ml-1">
                Daftar Akun Baru
              </Link>
            </p>

            <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-[11px] font-semibold text-slate-500">Sistem Aktif &amp; Aman</span>
            </div>
          </div>

          {/* Kanan: panel ajakan daftar akun, disembunyikan di mobile */}
          <div className="hidden md:flex relative flex-col items-center justify-center text-center p-10 bg-gradient-to-br from-indigo-600 via-blue-600 to-violet-600 rounded-tl-[160px] rounded-bl-[160px] text-white overflow-hidden">
            <div className="absolute -top-16 -right-10 w-56 h-56 rounded-full bg-white/10 blur-3xl"></div>
            <div className="absolute -bottom-20 left-0 w-64 h-64 rounded-full bg-fuchsia-400/15 blur-3xl"></div>
            <div className="relative">
              <span className="inline-flex w-16 h-16 rounded-2xl bg-white/15 border border-white/25 items-center justify-center mb-6">
                <span className="material-symbols-outlined text-[32px]">waving_hand</span>
              </span>
              <h3 className="text-3xl font-extrabold leading-tight">Halo,<br />Rekan Kerja!</h3>
              <p className="text-sm text-white/85 mt-4 max-w-[240px] mx-auto leading-relaxed">
                Belum punya akun pegawai? Daftar sekarang untuk mengakses pemeliharaan, pengadaan, kendaraan, dan booking ruang rapat.
              </p>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 mt-8 px-8 py-3 rounded-full border-2 border-white text-sm font-bold hover:bg-white hover:text-indigo-700 transition"
              >
                Daftar Akun Baru
              </Link>
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-white/70">
          © 2024 Biro Umum dan Rumah Tangga. Sistem Manajemen Fasilitas &amp; Operasional Kantor.
        </p>
      </div>
    </div>
  );
}
