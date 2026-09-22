import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import BrandMark from '../components/BrandMark';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);
    try {
      const res = await api.post('/auth/forgot-password', { email });
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal membuat link reset password.');
    } finally {
      setLoading(false);
    }
  }

  async function copyLink() {
    if (!result?.resetUrl) return;
    try {
      await navigator.clipboard.writeText(result.resetUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
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
      </header>

      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[440px] bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-900"></div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-semibold mb-3">
              <span className="material-symbols-outlined text-[16px]">password</span>
              Lupa Kata Sandi
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Reset Kata Sandi</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Masukkan email akun kamu. Sistem akan membuat link reset kata sandi yang berlaku 1 jam.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-xl">
                {result.message}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Link Reset</label>
                <div className="flex items-stretch gap-2">
                  <input readOnly value={result.resetUrl} onFocus={(e) => e.target.select()} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 outline-none" />
                  <button type="button" onClick={copyLink} className="shrink-0 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold">
                    {copied ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Belum ada layanan email terpasang, jadi kirimkan link ini secara manual (WhatsApp/Slack/dsb) ke pengguna yang lupa kata sandi. Link berlaku 1 jam.</p>
              </div>
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Email</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">mail</span>
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition"
              >
                {loading ? 'Memproses...' : 'Buat Link Reset'}
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <Link to="/login" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-semibold">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Kembali ke Login
            </Link>
          </div>
        </div>
      </main>

      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        © 2024 Biro Umum dan Rumah Tangga. Sistem Manajemen Fasilitas &amp; Operasional Kantor.
      </footer>
    </div>
  );
}
