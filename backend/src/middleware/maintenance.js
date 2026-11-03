const prisma = require('../prisma');
const { isAdminRole } = require('./auth');
const live = require('../live');

// Status maintenance dicek di hampir setiap request, padahal jarang berubah -> simpan sebentar di
// memori. Diubah lewat menu Settings -> cache langsung dikosongkan (live.onChange).
const CACHE_MS = 10000;
let cache = null;
live.onChange(() => { cache = null; });

async function maintenanceRow(menuKey) {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const rows = await prisma.maintenanceMode.findMany();
    cache = { at: Date.now(), map: new Map(rows.map((r) => [r.menu_key, r])) };
  }
  return cache.map.get(menuKey);
}

// Middleware factory: blokir akses ke menu tertentu kalau lagi maintenance,
// KECUALI untuk admin & kabag (selalu bisa akses semua menu).
// Harus dipasang SETELAH requireAuth (butuh req.user.role).
function requireNotInMaintenance(menuKey) {
  return async (req, res, next) => {
    if (isAdminRole(req.user?.role)) return next();
    try {
      const row = await maintenanceRow(menuKey);
      if (row?.is_active) {
        return res.status(503).json({
          message: row.message || 'Menu ini sedang dalam mode maintenance. Silakan coba lagi nanti.',
          maintenance: true,
        });
      }
      next();
    } catch (err) {
      // Gagal cek status maintenance -> jangan sampai melumpuhkan seluruh app, biarkan lewat.
      next();
    }
  };
}

module.exports = { requireNotInMaintenance };
