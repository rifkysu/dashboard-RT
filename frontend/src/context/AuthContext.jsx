import React, { createContext, useContext, useEffect, useState } from 'react';
import api from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    // Data localStorage yang rusak jangan sampai membuat seluruh app blank.
    try {
      const raw = localStorage.getItem('user');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const [maintenance, setMaintenance] = useState({});
  // Jumlah akun yang minta reset kata sandi (khusus admin) -> badge menu Akun & Akses.
  const [resetRequestCount, setResetRequestCount] = useState(0);

  function refreshResetRequests() {
    const current = (() => { try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; } })();
    if (!localStorage.getItem('token') || current?.role !== 'admin') { setResetRequestCount(0); return; }
    api.get('/users/reset-requests/count').then((res) => setResetRequestCount(res.data.count || 0)).catch(() => {});
  }

  function refreshMaintenance() {
    if (!localStorage.getItem('token')) return;
    api.get('/maintenance').then((res) => {
      const map = {};
      (res.data.data || []).forEach((row) => { map[row.menu_key] = row; });
      setMaintenance(map);
    }).catch(() => {});
  }

  // Refetch role/data user terkini dari server. Dipanggil saat mount dan
  // berkala, supaya perubahan role lewat pgAdmin4 (mis. dijadikan admin)
  // langsung kebaca di UI tanpa perlu logout/login ulang.
  function refreshUser({ onError } = {}) {
    if (!localStorage.getItem('token')) return Promise.resolve();
    return api.get('/auth/me').then((res) => {
      setUser(res.data.user);
      localStorage.setItem('user', JSON.stringify(res.data.user));
    }).catch((err) => { if (onError) onError(err); });
  }

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    refreshUser({
      onError: () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      },
    }).finally(() => setLoading(false));
    refreshMaintenance();
  }, []);

  // Sinkron berkala selama ada user login -- termasuk yang baru login tanpa
  // reload halaman (sebelumnya timer hanya dibuat kalau token sudah ada saat app dibuka).
  useEffect(() => {
    if (!user?.id) return undefined;
    const timer = setInterval(() => { refreshUser(); refreshMaintenance(); refreshResetRequests(); }, 30000);
    return () => clearInterval(timer);
  }, [user?.id]);

  useEffect(() => { refreshResetRequests(); }, [user?.id, user?.role]);

  // Live-reload lewat SSE: begitu admin toggle maintenance di menu mana pun,
  // semua user yang sedang buka web langsung ke-blokir/ke-buka real-time,
  // tanpa perlu refresh manual atau nunggu polling 30 detik.
  useEffect(() => {
    if (!user?.id) return;
    const streamUrl = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/maintenance/stream`;
    const es = new EventSource(streamUrl);
    es.onmessage = () => refreshMaintenance();
    return () => es.close();
  }, [user?.id]);

  function login(token, userData) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(userData));
    setUser(userData);
    refreshMaintenance();
  }

  function logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setMaintenance({});
    setResetRequestCount(0);
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

  // Menu sedang maintenance & user bukan admin -> akses diblokir di frontend
  // (backend juga menolak request-nya sebagai lapisan kedua).
  function isMenuDown(menuKey) {
    if (user?.role === 'admin') return false;
    return !!maintenance[menuKey]?.is_active;
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshAuth, refreshUser, canEdit, canEditRow, maintenance, refreshMaintenance, isMenuDown, resetRequestCount, refreshResetRequests }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
