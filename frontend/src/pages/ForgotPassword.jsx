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
        <div className="w-full max-w-[440px] bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-[0_1px_2px_rgba(14,30,51,.04),0_20px_50px_-24px_rgba(14,30,51,.3)]">

          <div className="mb-8">
            <h2 className="font-display text-2xl font-extrabold text-dinas-ink tracking-tight">Reset Kata Sandi</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Masukkan email akun kamu. Link reset kata sandi akan dibuatkan oleh Admin Biro Umum dan dikirim ke kamu secara langsung.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          {result ? (
            <div className="space-y-4">
              <div className="px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm rounded-lg">
                {result.message}
              </div>
              {result.resetUrl && <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Link Reset</label>
                <div className="flex items-stretch gap-2">
                  <input readOnly value={result.resetUrl} onFocus={(e) => e.target.select()} className="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 outline-none" />
                  <button type="button" onClick={copyLink} className="shrink-0 px-4 rounded-lg bg-[#1e3a5f] hover:bg-[#152b47] text-white text-xs font-semibold">
                    {copied ? 'Tersalin' : 'Salin'}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-2">Belum ada layanan email terpasang, jadi kirimkan link ini secara manual (WhatsApp/Slack/dsb) ke pengguna yang lupa kata sandi. Link berlaku 1 jam.</p>
              </div>}
            </div>
          ) : (
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Email</label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">mail</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nama@email.com"
                    className="w-full pl-11 pr-4 py-3 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 px-4 bg-[#1e3a5f] hover:bg-[#152b47] disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition"
              >
                {loading ? 'Memproses...' : 'Kirim Permintaan Reset'}
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
