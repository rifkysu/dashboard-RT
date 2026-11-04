// Satu koneksi SSE bersama per tab untuk semua modul (backend: /api/live/stream).
// Browser membatasi ~6 koneksi terbuka per server di HTTP/1.1 dan jatah itu dipakai
// bersama semua tab -- jadi jangan buka EventSource sendiri-sendiri per halaman.
// Pesan yang datang hanya nama topik ("pemeliharaan", "ruang-rapat", ...); halaman
// yang berlangganan topik itu lalu refetch datanya sendiri.
const STREAM_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/live/stream`;

const listeners = new Set();
let es = null;
let dropped = false;

function emitNow(topic) {
  listeners.forEach((fn) => { try { fn(topic); } catch (e) { console.error('[LIVE]', e); } });
}

// Tab tersembunyi tidak langsung refetch: topik yang berubah dikumpulkan dan baru dikirim saat
// tab terlihat lagi. Tanpa ini, satu perubahan data memicu refetch dari SEMUA tab yang terbuka
// di semua komputer, padahal kebanyakan sedang tidak dilihat.
const pending = new Set();
function emit(topic) {
  if (typeof document !== 'undefined' && document.hidden) { pending.add(topic); return; }
  emitNow(topic);
}

// Sinyal dari server sampai ke SEMUA tab di milidetik yang sama; kalau semuanya langsung refetch,
// ribuan request menumpuk serentak di server. Tiap tab menunggu jeda acak 0-2 detik (beberapa topik
// selama jeda digabung) supaya bebannya tersebar. Tab yang menyimpan data sendiri sudah memuat
// ulang langsung setelah simpan, jadi jeda ini hanya terasa di layar pengguna lain.
const JITTER_MS = 2000;
const jittered = new Set();
let jitterTimer = null;
function emitJittered(topic) {
  jittered.add(topic);
  if (jitterTimer) return;
  jitterTimer = setTimeout(() => {
    jitterTimer = null;
    const topics = jittered.has('*') ? ['*'] : [...jittered];
    jittered.clear();
    topics.forEach(emit);
  }, Math.random() * JITTER_MS);
}
function flushPending() {
  if (document.hidden || !pending.size) return;
  const topics = pending.has('*') ? ['*'] : [...pending];
  pending.clear();
  topics.forEach(emitNow);
}

function connect() {
  if (es || typeof EventSource === 'undefined') return;
  es = new EventSource(STREAM_URL);
  es.onmessage = (e) => emitJittered(e.data);
  es.onerror = () => { dropped = true; };
  // Setelah koneksi sempat putus (server restart, jaringan), perubahan selama putus
  // tidak terkirim -- minta semua halaman refetch sekali ("*"). Ikut dijeda acak: setelah server
  // restart semua tab reconnect hampir bersamaan.
  es.onopen = () => { if (dropped) { dropped = false; emitJittered('*'); } };
}

function disconnect() {
  if (es) { es.close(); es = null; dropped = false; }
  clearTimeout(jitterTimer); jitterTimer = null; jittered.clear();
}

// Tutup koneksi saat halaman ditinggalkan (reload, pindah alamat, tab ditutup). Tanpa ini,
// koneksi lama bisa tetap terbuka (mis. halaman disimpan di back/forward cache browser) dan
// menumpuk; di HTTP/1.1 browser hanya mengizinkan ~6 koneksi per server, sehingga request
// berikutnya tertahan dan halaman terlihat macet. Saat halaman dipulihkan dari cache tombol
// Back, sambungkan lagi dan minta semua halaman refetch karena perubahan selama itu terlewat.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', flushPending);
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
