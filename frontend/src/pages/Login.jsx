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
    <div className="min-h-screen flex flex-col justify-between">
      <header className="w-full border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-3">
          <BrandMark size="sm" />
          <div>
            <h1 className="text-base font-bold text-slate-900 leading-none">Biro Umum</h1>
            <p className="text-xs text-slate-500 mt-0.5">Rumah Tangga &amp; Administrasi</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-xs font-semibold">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Sistem Aktif &amp; Aman
        </span>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[440px]">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-semibold mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Kembali ke Menu Utama
        </Link>
        <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900"></div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
              <span className="material-symbols-outlined text-[16px]">lock</span>
              Autentikasi Pegawai
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Masuk ke Portal</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Akses layanan pemeliharaan, pengadaan, kendaraan, dan jadwal ruang rapat.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                Email
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                  Kata Sandi
                </label>
                <Link to="/forgot-password" className="text-xs font-semibold text-blue-600 hover:text-blue-700">
                  Lupa kata sandi?
                </Link>
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  key
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan kata sandi"
                  className="w-full pl-11 pr-11 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || isLocked}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition"
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
              className="w-full py-3 px-4 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 flex items-center justify-center gap-2.5 transition"
            >
              <span className="material-symbols-outlined text-[18px] text-blue-600">domain</span>
              Masuk dengan Akun Kemenaker / Intranet (SSO)
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Belum memiliki akun pegawai?
              <Link to="/register" className="text-blue-600 hover:text-blue-700 font-semibold ml-1">
                Daftar Akun Baru
              </Link>
            </p>
          </div>
        </div>
        </div>
      </main>

      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        © 2024 Biro Umum dan Rumah Tangga. Sistem Manajemen Fasilitas &amp; Operasional Kantor.
      </footer>
    </div>
  );
}
