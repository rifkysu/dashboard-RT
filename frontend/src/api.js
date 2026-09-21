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
      const publicPath = window.location.pathname === '/login' || window.location.pathname === '/jadwal-rapat';
      const isAuthMe = String(err.config?.url || '').includes('/auth/me');
      const isPublicSchedule = String(err.config?.url || '').includes('/ruang-rapat/public-schedule');
      if (!publicPath && !isAuthMe && !isPublicSchedule) {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
