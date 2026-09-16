import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

// Halaman ini dituju oleh backend setelah login Google SSO berhasil:
// backend redirect ke  {FRONTEND_URL}/sso-callback?token=xxxx
export default function SsoCallback() {
  const [params] = useSearchParams();
  const { login } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      navigate('/login?sso=gagal');
      return;
    }
    localStorage.setItem('token', token);
    api
      .get('/auth/me')
      .then((res) => {
        login(token, res.data.user);
        navigate('/dashboard');
      })
      .catch(() => navigate('/login?sso=gagal'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-slate-500 text-sm">
      Memproses login SSO...
    </div>
  );
}
