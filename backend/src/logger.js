const fs = require('fs');
const path = require('path');

const logDir = path.join(__dirname, '../logs');
const logFile = path.join(logDir, 'app.log');
fs.mkdirSync(logDir, { recursive: true });

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
  fs.appendFileSync(logFile, line + '\n', 'utf8');
  const fn = console[level] || console.log;
  fn(`[${level.toUpperCase()}] ${message}`, meta || '');
}

module.exports = {
  info: (message, meta) => write('info', message, meta),
  warn: (message, meta) => write('warn', message, meta),
  error: (message, meta) => write('error', message, meta),
  file: logFile,
};
