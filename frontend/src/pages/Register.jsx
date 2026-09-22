import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';

export default function Register() {
  const [form, setForm] = useState({
    nama_lengkap: '',
    email: '',
    no_hp: '',
    unit_kerja: '',
    role: '',
    password: '',
    confirm: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (form.password !== form.confirm) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    if (form.password.length < 8) {
      setError('Kata sandi minimal 8 karakter.');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/register', {
        nama_lengkap: form.nama_lengkap,
        email: form.email,
        no_hp: form.no_hp,
        unit_kerja: form.unit_kerja,
        role: form.role,
        password: form.password,
      });
      login(res.data.token, res.data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mendaftar. Silakan coba lagi.');
    } finally {
      setLoading(false);
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
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-500 hidden sm:inline">Sudah punya akun?</span>
          <Link to="/login" className="px-3.5 py-1.5 rounded-lg border border-slate-200 font-semibold text-slate-700 hover:bg-slate-50 transition">
            Masuk (Login)
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[560px] bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-200/80 p-8 sm:p-10 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-emerald-500 via-blue-600 to-slate-900"></div>

          <div className="mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-md bg-emerald-50 text-emerald-700 text-xs font-semibold mb-3">
              <span className="material-symbols-outlined text-[16px]">person_add</span>
              Registrasi Pegawai Baru
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Daftar Akun Pegawai</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Lengkapi data di bawah ini untuk mendapatkan hak akses pada portal operasional Biro Umum.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl">
              {error}
            </div>
          )}

          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Nama Lengkap &amp; Gelar *
              </label>
              <input
                type="text"
                required
                value={form.nama_lengkap}
                onChange={(e) => update('nama_lengkap', e.target.value)}
                placeholder="Misal: Ahmad Fauzi, S.E."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Email Kedinasan *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="nama@kemnaker.go.id"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor WhatsApp / HP *
                </label>
                <input
                  type="tel"
                  required
                  value={form.no_hp}
                  onChange={(e) => update('no_hp', e.target.value)}
                  placeholder="08123456789"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Unit Kerja / Bagian *
                </label>
                <select
                  required
                  value={form.unit_kerja}
                  onChange={(e) => update('unit_kerja', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition cursor-pointer"
                >
                  <option value="">Pilih Bagian...</option>
                  <option value="rt">Bagian Rumah Tangga</option>
                  <option value="perlengkapan">Bagian Perlengkapan &amp; Pengadaan</option>
                  <option value="kendaraan">Subbag Pengelolaan Kendaraan</option>
                  <option value="protokol">Subbag Persuratan &amp; Protokoler</option>
                  <option value="lainnya">Unit Kerja Lainnya</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Peran / Hak Akses *
                </label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition cursor-pointer"
                >
                  <option value="" disabled>Pilih Peran</option>
                  <option value="karyawan">Karyawan</option>
                  {/* Role "PIC" SENGAJA tidak ditampilkan di sini.
                      PIC hanya bisa diberikan oleh admin lewat pgAdmin4. */}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 -mt-2">
              *Akun yang didaftarkan mandiri hanya memiliki role Karyawan. Role PIC dan Kabag diberikan manual melalui database.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kata Sandi *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Ulangi Kata Sandi *
                </label>
                <input
                  type="password"
                  required
                  value={form.confirm}
                  onChange={(e) => update('confirm', e.target.value)}
                  placeholder="Konfirmasi kata sandi"
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/20 focus:border-blue-600 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" required className="w-4 h-4 mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Saya menyatakan bahwa data yang diisikan adalah benar dan bersedia mematuhi ketentuan keamanan data operasional internal Biro Umum.
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold rounded-xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10 transition"
            >
              {loading ? 'Memproses...' : 'Daftar & Masuk ke Dashboard'}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Sudah memiliki akun terdaftar?
              <Link to="/login" className="text-blue-600 hover:text-blue-700 font-semibold ml-1">
                Masuk di sini
              </Link>
            </p>
          </div>
        </div>
      </main>

      <footer className="w-full py-4 text-center text-xs text-slate-400 border-t border-slate-100 bg-white">
        © 2024 Biro Umum dan Rumah Tangga. Sistem Manajemen Fasilitas &amp; Operasional Kantor.
      </footer>
    </div>
  );
}
