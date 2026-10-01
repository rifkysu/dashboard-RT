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

const TOPICS = ['pemeliharaan', 'pengadaan', 'kendaraan', 'ruang-rapat', 'maintenance', 'users'];

function broadcast(topic) {
  if (TOPICS.includes(topic)) bus.emit('change', topic);
}

// Dipasang di depan router modul: setiap POST/PUT/PATCH/DELETE yang berhasil (< 400)
// mengirim sinyal topik modul itu ke semua tab yang terhubung.
function notifyOnWrite(topic) {
  return (req, res, next) => {
    if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return next();
    res.on('finish', () => { if (res.statusCode < 400) broadcast(topic); });
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

module.exports = { broadcast, notifyOnWrite, streamHandler, TOPICS };
