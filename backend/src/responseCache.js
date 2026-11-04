const zlib = require('zlib');
const live = require('./live');

// Cache respons GET yang isinya SAMA untuk semua pengguna (daftar Pemeliharaan, jadwal ruang rapat,
// ringkasan dashboard, ...). Saat ramai, ratusan tab meminta URL yang sama dalam hitungan detik --
// tanpa cache, tiap request = query database + serialisasi JSON (bisa beberapa MB setelah datanya
// ribuan baris) di satu thread Node, dan inilah yang membuat server lag (load test 2026-11-04).
// Dengan cache:
//   - request yang sama dalam CACHE_MS dilayani dari memori;
//   - request yang datang saat query yang sama masih berjalan ikut menunggu hasil query itu
//     (bukan menembak database lagi);
//   - isi disimpan juga dalam bentuk gzip (dikompres SEKALI, di thread pool, bukan per request):
//     daftar 5 MB terkirim sebagai beberapa ratus KB, browser membukanya otomatis. Di belakang Nginx,
//     respons yang sudah gzip diteruskan apa adanya (Nginx tidak mengompres ulang);
//   - SETIAP perubahan data lewat aplikasi (sinyal live, lihat live.notifyOnWrite) langsung
//     mengosongkan cache, jadi data tidak basi setelah simpan. Yang bisa terlambat <= CACHE_MS hanya
//     perubahan langsung lewat pgAdmin4 dan hal yang bergantung jam (mis. "hari ini").
//
// HANYA pasang SETELAH requireAuth/requireRole/requireNotInMaintenance, dan HANYA di endpoint yang
// hasilnya tidak bergantung pada siapa yang login (kunci cache = URL saja).
const CACHE_MS = process.env.RESPONSE_CACHE_MS === undefined ? 5000 : Number(process.env.RESPONSE_CACHE_MS);
const MAX_ENTRIES = 500; // batas memori: query filter/pencarian acak tidak bisa membuat cache membengkak
const GZIP_MIN_BYTES = 1024;

let generation = 0;
const store = new Map(); // url -> { body, gz, at }
const inflight = new Map(); // url -> Promise<entry|null>

function invalidate() {
  generation += 1;
  store.clear();
}
live.onChange(invalidate);

const gzip = (body) => new Promise((resolve) => {
  if (Buffer.byteLength(body) < GZIP_MIN_BYTES) return resolve(null);
  zlib.gzip(body, { level: 4 }, (err, buf) => resolve(err ? null : buf));
});

function sendEntry(req, res, entry, status) {
  res.setHeader('X-Cache', status);
  res.setHeader('Vary', 'Accept-Encoding');
  res.type('application/json; charset=utf-8');
  if (entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.setHeader('Content-Encoding', 'gzip');
    return res.send(entry.gz);
  }
  return res.send(entry.body);
}

function cacheGet() {
  return async (req, res, next) => {
    if (req.method !== 'GET' || !(CACHE_MS > 0)) return next();
    const key = req.originalUrl;

    // Query yang sedang berjalan boleh ditunggu kalau dimulai SETELAH perubahan data terakhir yang
    // sudah terjadi saat request ini datang (generation-nya >= arrival): hasilnya pasti tidak lebih
    // basi dari kalau request ini query sendiri. Query yang lebih lama dari itu tidak ditunggu --
    // request ini jadi "pemimpin" baru, dan request berikutnya menunggu dia. Jadi untuk satu URL
    // paling banyak ada satu query per perubahan data, seramai apa pun (tanpa ini, saat ramai semua
    // penunggu sempat menembak database sendiri-sendiri -> pool koneksi habis -> timeout massal).
    const arrival = generation;
    for (let attempt = 0; ; attempt += 1) {
      const hit = store.get(key);
      if (hit && Date.now() - hit.at < CACHE_MS) return sendEntry(req, res, hit, 'HIT');
      const pending = inflight.get(key);
      if (!pending || pending.startGeneration < arrival) break; // jalankan query sendiri (jadi pemimpin)
      if (attempt >= 3) return next(); // pemimpin gagal berulang kali (error database) -> ambil sendiri
      const entry = await pending.promise;
      if (res.headersSent || req.destroyed) return undefined;
      if (entry) return sendEntry(req, res, entry, 'HIT');
    }

    const startGeneration = generation;
    let resolve;
    const leader = { startGeneration, promise: new Promise((r) => { resolve = r; }) };
    inflight.set(key, leader);
    let settled = false;
    const done = (entry) => {
      if (settled) return;
      settled = true;
      if (inflight.get(key) === leader) inflight.delete(key);
      resolve(entry);
    };

    const json = res.json.bind(res);
    res.json = (obj) => {
      res.json = json;
      if (res.statusCode !== 200) { done(null); return json(obj); }
      const body = JSON.stringify(obj);
      gzip(body).then((gz) => {
        const entry = { body, gz, at: Date.now() };
        // Penunggu query ini semuanya datang sebelum/sejak query dimulai -> hasilnya sah untuk mereka.
        // Tapi kalau data berubah selama query berjalan, hasil ini mungkin basi untuk request
        // berikutnya -> jangan disimpan di cache.
        if (generation === startGeneration) {
          if (store.size >= MAX_ENTRIES) store.clear();
          store.set(key, entry);
        }
        done(entry);
        if (!res.headersSent && !res.writableEnded) sendEntry(req, res, entry, 'MISS');
      });
      return res;
    };
    // Pengaman: handler tidak memanggil res.json (error, koneksi putus) -> penunggu tidak menggantung.
    res.on('close', () => done(null));
    next();
  };
}

module.exports = { cacheGet, invalidate };
