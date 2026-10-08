import React, { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import { validateLogin } from '../utils/validation';
import LoginSplash from '../components/LoginSplash';

const BANNED_MESSAGE =
  'Akun Anda telah diblokir oleh admin karena terdeteksi melanggar ketentuan penggunaan atau melakukan spam berlebihan. Hubungi admin Biro Umum jika menurut Anda ini sebuah kesalahan.';

export default function Login() {
  const location = useLocation();
  // Datang dari halaman Daftar Akun -> tampilkan pesan sukses & isi email otomatis.
  const registered = location.state?.registered === true;
  const [email, setEmail] = useState(() => (registered && typeof location.state?.email === 'string' ? location.state.email : ''));
  const [fieldErrors, setFieldErrors] = useState({});
  const [success, setSuccess] = useState(registered ? 'Akun berhasil dibuat. Silakan masuk menggunakan email dan kata sandi Anda.' : '');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [searchParams] = useSearchParams();
  const [error, setError] = useState('');
  // Popup "akun di-ban": dari respons login (kode ACCOUNT_BANNED) atau karena
  // di-ban saat sedang login (?banned=1, lihat api.js).
  const [banned, setBanned] = useState(() => {
    let flagged = false;
    try { flagged = sessionStorage.getItem('accountBanned') === '1'; sessionStorage.removeItem('accountBanned'); } catch {}
    return flagged || searchParams.get('banned') === '1' ? BANNED_MESSAGE : '';
  });
  const [loading, setLoading] = useState(false);
  // Popup animasi logo ~3 detik setelah login berhasil, sebelum pindah ke Dashboard.
  const [splash, setSplash] = useState(null);
  // Anti-spam: kalau backend balas 429 (terlalu banyak percobaan login),
  // tombol dikunci sampai waktu tunggunya habis (biasanya 1 menit).
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const { user, login } = useAuth();
  const navigate = useNavigate();
  // Bersihkan state navigasi supaya pesan sukses tidak muncul lagi saat halaman di-refresh.
  useEffect(() => { if (registered) navigate(location.pathname + location.search, { replace: true, state: null }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    if (isLocked || loading || splash) return;
    setError('');
    const errors = validateLogin({ email, password });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setSuccess('');
    setLoading(true);
    try {
      const res = await api.post('/auth/login', { email: email.trim().toLowerCase(), password });
      login(res.data.token, res.data.user);
      setSplash({ name: res.data.user?.nama_lengkap || '' });
    } catch (err) {
      if (err.response?.status === 429) {
        const retrySeconds = Number(err.response.headers?.['retry-after']) || 60;
        setLockedUntil(Date.now() + retrySeconds * 1000);
        setNow(Date.now());
        setError(err.response?.data?.message || `Terlalu banyak percobaan login. Coba lagi dalam ${retrySeconds} detik.`);
      } else if (err.response?.data?.code === 'ACCOUNT_BANNED') {
        setBanned(err.response.data.message || BANNED_MESSAGE);
      } else if (!err.response) {
        // Backend mati / alamat API salah (mis. VITE_API_URL masih localhost saat dibuka dari PC lain).
        setError('Tidak dapat terhubung ke server. Periksa koneksi jaringan Anda atau hubungi admin Biro Umum.');
      } else {
        setError(err.response?.data?.message || 'Gagal login. Periksa email/kata sandi Anda.');
      }
    } finally {
      setLoading(false);
    }
  }

  // Sudah login lalu membuka /login -> langsung ke Dashboard (kecuali sedang menampilkan popup selamat datang).
  if (user && !splash) return <Navigate to="/dashboard" replace />;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2f4f7] p-4 sm:p-6">
      <div className="w-full max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900 font-semibold mb-4">
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Kembali ke beranda
        </Link>

        <div className="grid md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-[0_1px_2px_rgba(14,30,51,.04),0_20px_50px_-24px_rgba(14,30,51,.35)]">
          {/* Kiri: form login */}
          <div className="p-8 sm:p-12 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-8">
              <BrandMark size="sm" />
              <div>
                <h1 className="font-display text-sm font-extrabold text-dinas-ink leading-tight">Biro Umum dan Rumah Tangga</h1>
                <p className="text-[11px] text-slate-500 mt-0.5">Kementerian Ketenagakerjaan</p>
              </div>
            </div>

            <h2 className="font-display text-[28px] font-extrabold text-dinas-ink tracking-tight">Masuk</h2>
            <p className="text-sm text-slate-500 mt-1.5 mb-7">
              Akses layanan pemeliharaan, pengadaan, kendaraan, dan jadwal ruang rapat.
            </p>

            {success && !error && (
              <div className="mb-4 px-4 py-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-md flex items-start gap-2">
                <span className="material-symbols-outlined text-[18px]">check_circle</span>
                <span>{success}</span>
              </div>
            )}

            {error && (
              <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md">
                {error}
              </div>
            )}

            <form noValidate className="space-y-4" onSubmit={handleSubmit}>
              <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  mail
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setFieldErrors((f) => ({ ...f, email: undefined })); }}
                  placeholder="Email"
                  autoComplete="email"
                  aria-invalid={!!fieldErrors.email}
                  className={`w-full pl-12 pr-4 py-3 bg-white border rounded-md ${fieldErrors.email ? 'border-red-400' : 'border-slate-300'} text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] transition`}
                />
              </div>
                {fieldErrors.email && <p className="text-[11px] text-red-600 mt-1 ml-1">{fieldErrors.email}</p>}
              </div>

              <div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">
                  key
                </span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((f) => ({ ...f, password: undefined })); }}
                  placeholder="Kata Sandi"
                  autoComplete="current-password"
                  aria-invalid={!!fieldErrors.password}
                  className={`w-full pl-12 pr-11 py-3 bg-white border rounded-md ${fieldErrors.password ? 'border-red-400' : 'border-slate-300'} text-sm focus:outline-none focus:ring-2 focus:ring-[#1e3a5f]/15 focus:border-[#1e3a5f] transition`}
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
                {fieldErrors.password && <p className="text-[11px] text-red-600 mt-1 ml-1">{fieldErrors.password}</p>}
              </div>

              <div className="text-right">
                <Link to="/forgot-password" className="text-xs font-semibold text-[#1e3a5f] hover:underline">
                  Lupa kata sandi?
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading || isLocked || !!splash}
                className="w-full py-3 px-4 bg-[#1e3a5f] hover:bg-[#152b47] disabled:opacity-60 text-white font-semibold rounded-md text-sm flex items-center justify-center gap-2 transition"
              >
                {isLocked ? (
                  <>
                    <span className="material-symbols-outlined text-[18px]">lock_clock</span>
                    Coba lagi dalam {secondsLeft} detik
                  </>
                ) : (
                  <>
                    {loading ? 'Memproses...' : 'Masuk'}
                  </>
                )}
              </button>

            </form>

            <p className="mt-7 text-center text-xs text-slate-500 md:hidden">
              Belum memiliki akun pegawai?
              <Link to="/register" className="text-[#1e3a5f] hover:underline font-semibold ml-1">
                Daftar Akun Baru
              </Link>
            </p>

          </div>

          {/* Kanan: info daftar akun, disembunyikan di mobile */}
          <div className="hidden md:flex flex-col justify-between p-10 bg-dinas bg-kawung-gelap text-white">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#e4c27f]"><span className="w-6 h-[2px] rounded bg-kuningan"></span>Akun pegawai</div>
              <h3 className="font-display text-2xl font-extrabold mt-3 tracking-tight">Belum punya akun?</h3>
              <p className="text-sm text-white/80 mt-3 leading-relaxed">
                Akun pegawai dipakai untuk mengajukan pemeliharaan, pengadaan, dan booking ruang rapat, serta memantau statusnya.
              </p>
              <Link to="/register" className="inline-block mt-6 px-5 py-2.5 rounded-lg bg-white text-dinas text-sm font-bold hover:bg-[#f7efe0] transition">
                Daftar akun pegawai
              </Link>
            </div>
            <div className="text-xs text-white/60 leading-relaxed mt-10">
              Lupa kata sandi atau akun terkunci? Ajukan reset dari halaman ini, atau hubungi admin Biro Umum di <span className="select-all text-white/80">biroumum@kemnaker.go.id</span>.
            </div>
          </div>
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} Biro Umum dan Rumah Tangga
        </p>
      </div>
      {banned && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm" role="alertdialog" aria-modal="true" aria-labelledby="banned-title">
          <div className="w-full max-w-sm bg-white rounded-lg shadow-xl p-7 text-center">
            <span className="inline-flex w-16 h-16 rounded-full bg-red-100 text-red-600 items-center justify-center mb-4">
              <span className="material-symbols-outlined text-[34px]">block</span>
            </span>
            <h3 id="banned-title" className="text-xl font-extrabold text-slate-900">Akun Anda Diblokir</h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{banned}</p>
            <button
              type="button"
              autoFocus
              onClick={() => { setBanned(''); if (searchParams.has('banned')) navigate('/login', { replace: true }); }}
              className="mt-6 w-full py-3 rounded-md bg-red-600 hover:bg-red-700 text-white text-sm font-semibold transition"
            >
              Saya Mengerti
            </button>
          </div>
        </div>
      )}
      {splash && <LoginSplash name={splash.name} onDone={() => navigate('/dashboard', { replace: true })} />}
    </div>
  );
}
