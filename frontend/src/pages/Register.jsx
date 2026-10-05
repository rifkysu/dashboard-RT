import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api';
import { validateRegister, normalizePhone } from '../utils/validation';
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
    agree: false,
  });
  const [error, setError] = useState('');
  // Pesan error per kolom ({ field: pesan }) -> ditampilkan di bawah kolom yang salah.
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setFieldErrors((fe) => (fe[field] ? { ...fe, [field]: undefined } : fe));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;
    setError('');
    const errors = validateRegister(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setError('Periksa kembali data yang ditandai merah.');
      return;
    }

    setLoading(true);
    try {
      const email = form.email.trim().toLowerCase();
      await api.post('/auth/register', {
        nama_lengkap: form.nama_lengkap.trim(),
        email,
        no_hp: normalizePhone(form.no_hp),
        unit_kerja: form.unit_kerja,
        role: form.role,
        password: form.password,
      });
      // Tidak login otomatis: pengguna diarahkan ke halaman Login dan masuk dengan akun barunya.
      navigate('/login', { replace: true, state: { registered: true, email } });
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message || 'Gagal mendaftar. Silakan coba lagi.';
      if (status === 409) setFieldErrors({ email: message });
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = (field, base) => `${base}${fieldErrors[field] ? ' !border-red-400 !bg-red-50/40' : ''}`;

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
        <div className="flex items-center gap-3 text-xs">
          <span className="text-white/60 hidden sm:inline">Sudah punya akun?</span>
          <Link to="/login" className="px-3.5 py-1.5 rounded-lg bg-white font-bold text-dinas hover:bg-[#f7efe0] transition">
            Masuk (Login)
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-6 md:p-10">
        <div className="w-full max-w-[560px]">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-semibold mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Kembali ke beranda
        </Link>
        <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 shadow-[0_1px_2px_rgba(14,30,51,.04),0_20px_50px_-24px_rgba(14,30,51,.3)]">

          <div className="mb-8">
            <h2 className="font-display text-2xl font-extrabold text-dinas-ink tracking-tight">Daftar Akun Pegawai</h2>
            <p className="text-sm text-slate-500 mt-1.5">
              Lengkapi data di bawah ini untuk mendapatkan hak akses pada portal operasional Biro Umum.
            </p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
              {error}
            </div>
          )}

          <form noValidate className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Nama Lengkap &amp; Gelar *
              </label>
              <input
                type="text"
                required
                value={form.nama_lengkap}
                onChange={(e) => update('nama_lengkap', e.target.value)}
                placeholder="Misal: Ahmad Fauzi, S.E."
                className={inputCls('nama_lengkap', "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition")}
              />
              {fieldErrors.nama_lengkap && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.nama_lengkap}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Email Kedinasan *
                </label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => update('email', e.target.value)}
                  placeholder="nama@kemnaker.go.id"
                  className={inputCls('email', "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition")}
                />
                {fieldErrors.email && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Nomor WhatsApp / HP *
                </label>
                <input
                  type="tel"
                  required
                  value={form.no_hp}
                  onChange={(e) => update('no_hp', e.target.value)}
                  placeholder="08123456789"
                  className={inputCls('no_hp', "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition")}
                />
                {fieldErrors.no_hp && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.no_hp}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Unit Kerja / Bagian *
                </label>
                <select
                  required
                  value={form.unit_kerja}
                  onChange={(e) => update('unit_kerja', e.target.value)}
                  className={inputCls('unit_kerja', "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition cursor-pointer")}
                >
                  <option value="">Pilih Bagian...</option>
                  <option value="rt">Bagian Rumah Tangga</option>
                  <option value="perlengkapan">Bagian Perlengkapan &amp; Pengadaan</option>
                  <option value="kendaraan">Subbag Pengelolaan Kendaraan</option>
                  <option value="protokol">Subbag Persuratan &amp; Protokoler</option>
                  <option value="lainnya">Unit Kerja Lainnya</option>
                </select>
                {fieldErrors.unit_kerja && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.unit_kerja}</p>}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Peran / Hak Akses *
                </label>
                <select
                  required
                  value={form.role}
                  onChange={(e) => update('role', e.target.value)}
                  className={inputCls('role', "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition cursor-pointer")}
                >
                  <option value="" disabled>Pilih Peran</option>
                  <option value="karyawan">Karyawan</option>
                  {/* Role "PIC" SENGAJA tidak ditampilkan di sini.
                      PIC hanya bisa diberikan oleh admin lewat pgAdmin4. */}
                </select>
                {fieldErrors.role && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.role}</p>}
              </div>
            </div>

            <p className="text-[11px] text-slate-400 -mt-2">
              *Pendaftaran hanya untuk email kedinasan @kemnaker.go.id. Akun yang didaftarkan mandiri hanya memiliki role Karyawan. Role PIC dan Kabag diberikan manual melalui database.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Kata Sandi *
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  placeholder="Min. 8 karakter, huruf & angka"
                  className={inputCls('password', "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition")}
                />
                {fieldErrors.password && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Ulangi Kata Sandi *
                </label>
                <input
                  type="password"
                  required
                  value={form.confirm}
                  onChange={(e) => update('confirm', e.target.value)}
                  placeholder="Konfirmasi kata sandi"
                  className={inputCls('confirm', "w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] focus:bg-white transition")}
                />
                {fieldErrors.confirm && <p className="text-[11px] text-red-600 mt-1">{fieldErrors.confirm}</p>}
              </div>
            </div>

            <div className="pt-2">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={form.agree} onChange={(e) => update('agree', e.target.checked)} className="w-4 h-4 mt-0.5 rounded border-slate-300 text-[#1e3a5f] focus:ring-blue-500" />
                <span className="text-xs text-slate-600 leading-relaxed">
                  Saya menyatakan bahwa data yang diisikan adalah benar dan bersedia mematuhi ketentuan keamanan data operasional internal Biro Umum.
                </span>
              </label>
              {fieldErrors.agree && <p className="text-[11px] text-red-600 mt-1 ml-6">{fieldErrors.agree}</p>}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 bg-[#1e3a5f] hover:bg-[#152b47] disabled:opacity-60 text-white font-semibold rounded-lg text-sm flex items-center justify-center gap-2 transition"
            >
              {loading ? 'Memproses...' : 'Daftar Akun'}
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Sudah memiliki akun terdaftar?
              <Link to="/login" className="text-[#1e3a5f] hover:underline font-semibold ml-1">
                Masuk di sini
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
