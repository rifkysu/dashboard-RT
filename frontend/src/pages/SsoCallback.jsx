import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// Halaman ini dituju oleh backend setelah login Google SSO berhasil:
// backend redirect ke  {FRONTEND_URL}/sso-callback#token=xxxx
export default function SsoCallback() {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();
  // StrictMode (npm run dev) menjalankan efek dua kali: run kedua sudah tidak menemukan token
  // (URL sudah dibersihkan run pertama) dan salah mengarahkan ke "SSO gagal". Jalankan sekali saja.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('token') || params.get('token');
    // Hapus token dari address bar/riwayat browser secepatnya.
    window.history.replaceState(null, '', '/sso-callback');
    if (!token) {
      navigate('/login?sso=gagal', { replace: true });
      return;
    }
    localStorage.setItem('token', token);
    api
      .get('/auth/me')
      .then((res) => {
        login(token, res.data.user);
        navigate('/dashboard', { replace: true });
      })
      .catch(() => { localStorage.removeItem('token'); navigate('/login?sso=gagal', { replace: true }); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
      Memproses login SSO...
    </div>
  );
}
