import { useEffect, useRef, useState } from 'react';
import api from '../api';
import useRuangRapatLive from './useRuangRapatLive';

// Maks. bulan yang dimuat lewat infinite scroll (batas backend 400 hari per request).
export const MAX_MONTHS = 12;

function pad(n) { return String(n).padStart(2, '0'); }
export function iso(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
export function monthKey(d = new Date()) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
export function addMonth(key, n) { const [y, m] = key.split('-').map(Number); return monthKey(new Date(y, m - 1 + n, 1)); }
export function monthDays(key) {
  const [y, m] = key.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return Array.from({ length: last }, (_, i) => `${key}-${pad(i + 1)}`);
}
export function monthRange(months) {
  const days = monthDays(months[months.length - 1]);
  return { from: `${months[0]}-01`, to: days[days.length - 1] };
}

// Jadwal ruang rapat per bulan + infinite scroll: mulai dari satu bulan (quick filter),
// bulan berikutnya ditambahkan saat digulir ke bawah. Seluruh rentang yang sudah tampil
// diambil ulang saat ada perubahan (SSE) atau tiap 60 detik.
// extraParams: parameter query tambahan (mis. { include_cancelled: '1' }); panggil reload() setelah berubah.
export default function useMonthSchedule(endpoint, extraParams) {
  const [months, setMonthsState] = useState(() => [monthKey()]);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const monthsRef = useRef(months);
  // Hanya respons request terakhir yang dipakai, supaya respons lama tidak menimpa data terbaru.
  const reqRef = useRef(0);
  const paramsRef = useRef(extraParams);
  // Jeda setelah gagal memuat bulan berikutnya, supaya sentinel yang tetap terlihat tidak memicu request beruntun.
  const moreFailedAt = useRef(0);
  paramsRef.current = extraParams;

  const load = async () => {
    const id = ++reqRef.current;
    const { from, to } = monthRange(monthsRef.current);
    try {
      const r = await api.get(endpoint, { params: { ...paramsRef.current, from, to } });
      if (id !== reqRef.current) return true;
      setItems(r.data.data || []);
      setError('');
      return true;
    } catch (e) {
      if (id === reqRef.current) setError(e.response?.data?.message || 'Jadwal belum dapat dimuat.');
      return false;
    } finally {
      if (id === reqRef.current) { setLoading(false); setLoadingMore(false); }
    }
  };

  const setMonths = (next) => { monthsRef.current = next; setMonthsState(next); };

  const selectMonth = (key) => { setMonths([key]); setLoading(true); load(); };

  const loadMore = () => {
    const cur = monthsRef.current;
    if (cur.length >= MAX_MONTHS || Date.now() - moreFailedAt.current < 10000) return;
    const next = [...cur, addMonth(cur[cur.length - 1], 1)];
    setMonths(next);
    setLoadingMore(true);
    // Gagal memuat -> bulan baru ditarik lagi, supaya tidak tampil kosong seolah tidak ada booking.
    load().then((ok) => { if (!ok && monthsRef.current === next) { moreFailedAt.current = Date.now(); setMonths(cur); } });
  };

  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useRuangRapatLive(load);

  return { months, items, setItems, loading, loadingMore, error, setError, selectMonth, loadMore, reload: load, hasMore: months.length < MAX_MONTHS };
}
