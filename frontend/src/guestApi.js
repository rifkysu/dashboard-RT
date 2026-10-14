import axios from 'axios';

// Klien API khusus akun TAMU (login Google dari landing page untuk booking ruang rapat).
// Sengaja terpisah dari api.js: token tamu disimpan di kunci sendiri ('guestToken') dan
// error 401 di sini tidak boleh ikut menghapus sesi / mengarahkan pegawai ke halaman login.
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';
export const GUEST_TOKEN_KEY = 'guestToken';

export const getGuestToken = () => { try { return localStorage.getItem(GUEST_TOKEN_KEY); } catch { return null; } };
export const setGuestToken = (t) => { try { if (t) localStorage.setItem(GUEST_TOKEN_KEY, t); else localStorage.removeItem(GUEST_TOKEN_KEY); } catch {} };

// Tombol "Login dengan Google" cukup membuka alamat ini (redirect penuh ke Google, lalu kembali ke landing page).
export const googleLoginUrl = `${API_URL}/auth/google`;

const guestApi = axios.create({ baseURL: API_URL });
guestApi.interceptors.request.use((config) => {
  const token = getGuestToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export default guestApi;
