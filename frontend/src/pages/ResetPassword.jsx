import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import AuthShell from '../components/AuthShell';
import { passwordIssue } from '../utils/validation';
import SyaratSandi from '../components/SyaratSandi';

export default function ResetPassword() {
  // Token ada di #fragment (tidak terkirim ke server/log). ?token= tetap dibaca untuk link lama.
  // Setelah dibaca, token dihapus dari address bar & riwayat browser.
  const [token] = useState(
    () =>
      new URLSearchParams(window.location.hash.slice(1)).get('token') ||
      new URLSearchParams(window.location.search).get('token') ||
      '',
  );
  useEffect(() => {
    if (token) window.history.replaceState(null, '', window.location.pathname);
  }, [token]);
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!token) {
      setError('Link reset tidak valid. Silakan minta link reset baru.');
      return;
    }
    const pwIssue = passwordIssue(password);
    if (pwIssue) {
      setError(pwIssue);
      return;
    }
    if (password !== confirm) {
      setError('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mereset kata sandi.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <div className="auth-kartu auth-kartu-emas w-full max-w-[440px] bg-white rounded-2xl border border-white/40 p-8 sm:p-10">
        <div className="mb-8">
          <h2 className="font-display text-2xl font-extrabold text-dinas-ink tracking-tight">
            Buat Kata Sandi Baru
          </h2>
          <p className="text-sm text-slate-500 mt-1.5">Link ini berlaku 1 jam sejak dibuat.</p>
        </div>

        {!token && (
          <div className="mb-4 px-4 py-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg">
            Link tidak lengkap (token tidak ditemukan). Minta link reset baru.
          </div>
        )}

        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
            {error}
          </div>
        )}

        {done ? (
          <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg">
            Kata sandi berhasil diubah. Mengalihkan ke halaman login...
          </div>
        ) : (
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Kata Sandi Baru
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  key
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Contoh: Biroumum2026"
                  className="w-full pl-11 pr-11 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  className="absolute right-1 top-1/2 -translate-y-1/2 w-10 h-10 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              <SyaratSandi value={password} />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Konfirmasi Kata Sandi
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ulangi kata sandi baru"
                className="w-full px-4 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading || !token}
              className="w-full py-3.5 px-4 bg-[#1e3a5f] hover:bg-[#152b47] disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition"
            >
              {loading ? 'Menyimpan...' : 'Simpan Kata Sandi Baru'}
              <span className="material-symbols-outlined text-[18px]">check</span>
            </button>
          </form>
        )}

        <div className="mt-8 pt-6 border-t border-slate-100 text-center">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-semibold py-2 -my-2"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Kembali ke Login
          </Link>
        </div>
      </div>
    </AuthShell>
  );
}
