const crypto = require('crypto');

// Simple in-process rate limiter. For multi-server deployments, move this to Redis.
function createRateLimiter({ windowMs, max, message }) {
  const hits = new Map();
  let lastCleanup = Date.now();

  return (req, res, next) => {
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const key = ip;
    let item = hits.get(key);

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

function requestHardening(req, res, next) {
  // Security headers without an additional dependency.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  next();
}

function validateCommonInput(req, res, next) {
  if (req.body !== undefined && (typeof req.body !== 'object' || Array.isArray(req.body))) {
    return res.status(400).json({ message: 'Format data tidak valid.' });
  }
  next();
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : value;
}

function isSafeText(value, max = 5000) {
  return typeof value === 'string' && value.length <= max && !/[\u0000]/.test(value);
}

function randomRequestId() {
  return crypto.randomBytes(12).toString('hex');
}

module.exports = {
  createRateLimiter,
  requestHardening,
  validateCommonInput,
  normalizeEmail,
  isSafeText,
  randomRequestId,
};
