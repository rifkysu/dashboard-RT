const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
const logFile = path.join(logDir, 'app.log');
fs.mkdirSync(logDir, { recursive: true });

// Log info/warn (termasuk 1 baris per request HTTP) ditulis lewat stream async: appendFileSync di
// setiap request memblokir event loop dan memangkas kapasitas server ~40% saat ramai (load test
// 2026-11-04). Log error tetap ditulis sinkron supaya pesan terakhir sebelum crash tidak hilang.
const stream = fs.createWriteStream(logFile, { flags: 'a', encoding: 'utf8' });
stream.on('error', (err) => console.error('[LOGGER] Gagal menulis log:', err.message));

function serialize(value) {
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack, code: value.code, detail: value.detail, hint: value.hint, position: value.position };
  if (Array.isArray(value)) return value.map(serialize);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = serialize(v);
    return out;
  }
  return value;
}

function write(level, message, meta) {
  const line = JSON.stringify({
    time: new Date().toISOString(),
    level,
    message,
    ...(meta ? { meta: serialize(meta) } : {})
  });
  if (level === 'error') {
    try { fs.appendFileSync(logFile, line + '\n', 'utf8'); } catch (err) { console.error('[LOGGER] Gagal menulis log:', err.message); }
  } else {
    stream.write(line + '\n');
  }
  const fn = console[level] || console.log;
  fn(`[${level.toUpperCase()}] ${message}`, meta || '');
}

// Satu baris per request HTTP: selalu ke logs/app.log. Di console hanya kalau LOG_HTTP_CONSOLE tidak
// "false" -- di production matikan (lihat .env.production.example): mencetak objek ke stdout di setiap
// request itu sinkron di pm2/systemd dan memakan CPU yang sama dengan melayani request.
const httpToConsole = process.env.LOG_HTTP_CONSOLE !== 'false';
function http(meta) {
  if (httpToConsole) return write('info', 'HTTP request', meta);
  stream.write(JSON.stringify({ time: new Date().toISOString(), level: 'info', message: 'HTTP request', meta }) + '\n');
}

module.exports = {
  http,
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  file: logFile,
};
