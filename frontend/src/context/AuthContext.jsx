import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .get('/auth/me')
      .then((res) => {
        setUser(res.data.user);
        localStorage.setItem('user', JSON.stringify(res.data.user));
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function login(token, userData) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  }

  // Dipanggil setelah backend mempromosikan karyawan -> PIC (mis. saat menambah
  // permintaan pemeliharaan/pengadaan baru). Menyimpan token & role terbaru
  // tanpa perlu logout/login ulang.
  function refreshAuth(token, userData) {
    if (token) localStorage.setItem('token', token);
    if (userData) {
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    }
  }

  // Role yang boleh mengedit modul Pemeliharaan & Pengadaan.
  // karyawan sengaja TIDAK termasuk -> tombol edit disembunyikan / dinonaktifkan.
  const canEdit = user && ['kabag', 'pic'].includes(user.role);

  // Izin edit per-baris data: kabag & admin boleh mengedit semua data,
  // sedangkan PIC (termasuk karyawan yang otomatis dipromosikan jadi PIC
  // setelah menambahkan permintaan) hanya boleh mengedit data yang dia
  // tambahkan sendiri (created_by === user.id).
  function canEditRow(row) {
    if (!user) return false;
    if (user.role === 'kabag' || user.role === 'admin') return true;
    if (user.role === 'pic') return !!row && Number(row.created_by) === Number(user.id);
    return false;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshAuth, canEdit, canEditRow }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
