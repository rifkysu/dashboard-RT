import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:4000/api',
});

// Selipkan token JWT ke setiap request kalau ada
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Kalau backend balas 401 (token expired/invalid), otomatis logout
api.interceptors.response.use(
  (res) => res,
  (err) => {
    console.error('[API ERROR]', { method: err.config?.method, url: err.config?.url, status: err.response?.status, response: err.response?.data, message: err.message });
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // '/' (landing page) sengaja ditambahkan: halaman ini dirancang tampil
      // untuk siapa saja (login atau tidak), jadi token basi yang gagal saat
      // background-check (mis. /auth/me, /maintenance) tidak boleh memaksa
      // redirect ke /login dan membajak pengalaman landing page.
      const publicPath = ['/login', '/jadwal-rapat', '/'].includes(window.location.pathname);
      const url = String(err.config?.url || '');
      const isBackgroundCheck = url.includes('/auth/me') || url.includes('/ruang-rapat/public-schedule') || url.includes('/maintenance');
      if (!publicPath && !isBackgroundCheck) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
