const crypto = require('crypto');

// Simple in-process rate limiter. For multi-server deployments, move this to Redis.
// keyFn opsional: default per IP; login memakai IP + email supaya satu kantor yang keluar lewat
// IP yang sama (NAT/proxy) tidak saling mengunci saat banyak pegawai login bersamaan.
// ignoreIp: kunci hanya dari keyFn (mis. per akun/email, tidak peduli IP) -- untuk menahan tebak
// kata sandi yang disebar dari banyak IP. Batas memori: bila tabel melewati MAX_KEYS (banjir kunci
// acak), entri kedaluwarsa dibuang dulu; bila masih penuh, kunci baru ditolak 429 (fail-closed).
const MAX_KEYS = 50000;
function createRateLimiter({ windowMs, max, message, keyFn, ignoreIp = false }) {
  const hits = new Map();
  let lastCleanup = Date.now();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = keyFn ? (ignoreIp ? `k|${keyFn(req)}` : `${ip}|${keyFn(req)}`) : ip;
    let item = hits.get(key);
    if (!item && hits.size >= MAX_KEYS) {
      for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
      if (hits.size >= MAX_KEYS) {
        res.setHeader('Retry-After', String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({ message });
      }
    }

    if (!item || now - item.start >= windowMs) {
      item = { start: now, count: 0 };
    }
    item.count += 1;
    hits.set(key, item);

    if (now - lastCleanup > windowMs) {
      for (const [k, v] of hits) {
        if (now - v.start >= windowMs) hits.delete(k);
      }
      lastCleanup = now;
    }

    res.setHeader('X-RateLimit-Limit', String(max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, max - item.count)));

    if (item.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((windowMs - (now - item.start)) / 1000)));
      return res.status(429).json({ message });
    }
    next();
  };
}

// Endpoint SSE (/stream) publik dan koneksinya terbuka lama -> batasi jumlah
// koneksi bersamaan per IP & total, supaya tidak bisa dipakai menghabiskan resource server.
// Batas per IP dibuat longgar karena satu kantor biasanya berbagi satu IP (tiap tab = 1 koneksi).
// Load test 2026-11-04: batas lama 1000 total -> tab ke-1001 ditolak 429 dan tidak dapat update live.
// Koneksi SSE yang diam hanya makan beberapa KB memori, jadi batas dinaikkan; bisa diatur lewat .env.
// Di belakang Nginx, worker_connections juga harus cukup (tiap koneksi SSE = 2 koneksi di Nginx).
function createSseLimiter({
  maxPerIp = Number(process.env.SSE_MAX_PER_IP) || 3000,
  maxTotal = Number(process.env.SSE_MAX_TOTAL) || 5000,
} = {}) {
  const perIp = new Map();
  let total = 0;
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const count = perIp.get(ip) || 0;
    if (count >= maxPerIp || total >= maxTotal) {
      return res
        .status(429)
        .json({ message: 'Terlalu banyak koneksi live. Tutup beberapa tab lalu coba lagi.' });
    }
    perIp.set(ip, count + 1);
    total += 1;
    let released = false;
    req.on('close', () => {
      if (released) return;
      released = true;
      total -= 1;
      const left = (perIp.get(ip) || 1) - 1;
      if (left > 0) perIp.set(ip, left);
      else perIp.delete(ip);
    });
    next();
  };
}

function requestHardening(req, res, next) {
  // Security headers without an additional dependency.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  // Respons API berisi data pribadi/sesi: jangan disimpan cache browser/proxy (mis. komputer bersama).
  // Endpoint yang memang publik & aman di-cache (foto ruang) menimpa header ini sendiri.
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
  // Di belakang Nginx HTTPS (TRUST_PROXY=true) req.secure benar -> paksa HTTPS di browser.
  if (req.secure) res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'",
  );
  next();
}

// Lapisan pengaman global untuk semua input (body JSON & query string), sebelum sampai ke route:
// - Semua query database lewat Prisma (ter-parameter), jadi teks berisi ' OR 1=1 -- dsb. tidak pernah
//   dieksekusi sebagai SQL. Celah yang tersisa untuk ORM adalah "operator injection": nilai yang
//   seharusnya teks dikirim sebagai objek (mis. {"email": {"not": ""}}) lalu ikut masuk ke `where`.
//   Route sudah mengecek tipe per field; di sini ditambah batas umum supaya route baru juga terlindungi.
// - Kunci berbahaya (__proto__/constructor/prototype) ditolak -> mencegah prototype pollution.
// - Karakter NUL (\u0000) ditolak -> PostgreSQL tidak bisa menyimpannya (dulu jadi error 500).
// - Kedalaman objek dibatasi -> payload bersarang ribuan level tidak menghabiskan CPU/stack.
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;

function inputIssue(value, depth = 0) {
  if (typeof value === 'string') return value.includes('\u0000') ? 'karakter tidak valid' : null;
  if (value === null || typeof value !== 'object') return null;
  if (depth >= MAX_DEPTH) return 'struktur data terlalu dalam';
  if (Array.isArray(value)) {
    for (const v of value) {
      const issue = inputIssue(v, depth + 1);
      if (issue) return issue;
    }
    return null;
  }
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEYS.has(key) || key.includes('\u0000')) return 'nama field tidak valid';
    const issue = inputIssue(value[key], depth + 1);
    if (issue) return issue;
  }
  return null;
}

function validateCommonInput(req, res, next) {
  if (req.body !== undefined && (typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({ message: 'Format data tidak valid.' });
  }
  // Query string (parser 'simple' di index.js) hanya berisi teks atau daftar teks -- bukan objek bersarang.
  for (const v of Object.values(req.query || {})) {
    const list = Array.isArray(v) ? v : [v];
    if (!list.every((x) => typeof x === 'string')) {
      return res.status(400).json({ message: 'Parameter tidak valid.' });
    }
  }
  const issue = inputIssue(req.body) || inputIssue(req.query);
  if (issue) return res.status(400).json({ message: `Format data tidak valid (${issue}).` });
  next();
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function isSafeText(value, max = 5000) {
  return typeof value === 'string' && value.length <= max && !/[\u0000]/.test(value);
}

// Hanya email instansi yang boleh membuat akun baru (Daftar Akun).
// Akun lama dengan domain lain tetap bisa login dengan email + kata sandi.
// Sama dengan ALLOWED_EMAIL_DOMAIN di frontend/src/utils/validation.js -- ubah keduanya bila berubah.
const ALLOWED_EMAIL_DOMAIN = 'kemnaker.go.id';
function isAllowedEmailDomain(email) {
  return typeof email === 'string' && email.toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

function randomRequestId() {
  return crypto.randomBytes(12).toString('hex');
}

module.exports = {
  createRateLimiter,
  createSseLimiter,
  requestHardening,
  validateCommonInput,
  normalizeEmail,
  isSafeText,
  randomRequestId,
  ALLOWED_EMAIL_DOMAIN,
  isAllowedEmailDomain,
};
