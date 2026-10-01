// Satu koneksi SSE bersama per tab untuk semua modul (backend: /api/live/stream).
// Browser membatasi ~6 koneksi terbuka per server di HTTP/1.1 dan jatah itu dipakai
// bersama semua tab -- jadi jangan buka EventSource sendiri-sendiri per halaman.
// Pesan yang datang hanya nama topik ("pemeliharaan", "ruang-rapat", ...); halaman
// yang berlangganan topik itu lalu refetch datanya sendiri.
const STREAM_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/live/stream`;

const listeners = new Set();
let es = null;
let dropped = false;

function emit(topic) {
  listeners.forEach((fn) => { try { fn(topic); } catch (e) { console.error('[LIVE]', e); } });
}

function connect() {
  if (es || typeof EventSource === 'undefined') return;
  es = new EventSource(STREAM_URL);
  es.onmessage = (e) => emit(e.data);
  es.onerror = () => { dropped = true; };
  // Setelah koneksi sempat putus (server restart, jaringan), perubahan selama putus
  // tidak terkirim -- minta semua halaman refetch sekali ("*").
  es.onopen = () => { if (dropped) { dropped = false; emit('*'); } };
}

export function subscribeLive(fn) {
  listeners.add(fn);
  connect();
  return () => {
    listeners.delete(fn);
    if (!listeners.size && es) { es.close(); es = null; dropped = false; }
  };
}
