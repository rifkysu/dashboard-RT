const { EventEmitter } = require('events');

// Satu jalur live (SSE) untuk semua modul. Isi pesannya hanya nama topik yang berubah
// (mis. "pemeliharaan"), bukan datanya -- frontend lalu refetch lewat endpoint biasa yang
// tetap memeriksa token & hak akses. Karena itu stream aman dibuat publik
// (EventSource browser tidak bisa mengirim header Authorization).
//
// Catatan deploy: bus ini ada di memori proses, jadi backend harus jalan sebagai satu
// proses (bukan pm2 cluster / beberapa instance), dan reverse proxy tidak boleh mem-buffer
// respons /api/live/stream.
const bus = new EventEmitter();
bus.setMaxListeners(0);

const TOPICS = ['pemeliharaan', 'pengadaan', 'kendaraan', 'ruang-rapat', 'maintenance', 'users', 'guest-accounts', 'ruang-info', 'riwayat'];

function broadcast(topic) {
  if (TOPICS.includes(topic)) bus.emit('change', topic);
}

// Dipasang di depan router modul: setiap POST/PUT/PATCH/DELETE yang berhasil (< 400)
// mengirim sinyal topik modul itu ke semua tab yang terhubung.
// `except`: path (relatif terhadap mount) yang tidak mengubah data yang dilihat orang lain, mis.
// /login & /logout -- tanpa ini SETIAP login memicu refetch di SEMUA tab yang terbuka (saat jam masuk
// kantor: ribuan login x ribuan tab) dan mengosongkan semua cache server.
// Sinyal dikirim tepat sebelum respons dikirim (bukan setelah 'finish'): cache server (responseCache,
// user, maintenance) sudah kosong sebelum tab yang menyimpan sempat memuat ulang datanya.
function notifyOnWrite(topic, { except = [] } = {}) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    if (except.includes(req.path)) return next();
    const end = res.end;
    res.end = function endWithBroadcast(...args) {
      res.end = end;
      if (res.statusCode < 400) broadcast(topic);
      return end.apply(this, args);
    };
    next();
  };
}

function streamHandler(req, res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    // Nginx: jangan buffer stream ini, supaya sinyal langsung sampai.
    'X-Accel-Buffering': 'no',
  });
  res.write('retry: 3000\n\n');
  const send = (topic) => { try { res.write(`data: ${topic}\n\n`); } catch {} };
  bus.on('change', send);
  const heartbeat = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch {} }, 25000);
  req.on('close', () => { clearInterval(heartbeat); bus.off('change', send); });
}

// Untuk cache di memori (mis. middleware/auth.js): dipanggil setiap ada perubahan data apa pun.
function onChange(fn) { bus.on('change', fn); }

module.exports = { broadcast, notifyOnWrite, streamHandler, onChange, TOPICS };
