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

function disconnect() {
  if (es) { es.close(); es = null; dropped = false; }
}

// Tutup koneksi saat halaman ditinggalkan (reload, pindah alamat, tab ditutup). Tanpa ini,
// koneksi lama bisa tetap terbuka (mis. halaman disimpan di back/forward cache browser) dan
// menumpuk; di HTTP/1.1 browser hanya mengizinkan ~6 koneksi per server, sehingga request
// berikutnya tertahan dan halaman terlihat macet. Saat halaman dipulihkan dari cache tombol
// Back, sambungkan lagi dan minta semua halaman refetch karena perubahan selama itu terlewat.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', disconnect);
  window.addEventListener('pageshow', (e) => {
    if (listeners.size && !es) { connect(); if (e.persisted) emit('*'); }
  });
}

export function subscribeLive(fn) {
  listeners.add(fn);
  connect();
  return () => {
    listeners.delete(fn);
    if (!listeners.size) disconnect();
  };
}
