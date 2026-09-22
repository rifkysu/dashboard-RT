const prisma = require('../prisma');

// Middleware factory: blokir akses ke menu tertentu kalau lagi maintenance,
// KECUALI untuk role admin (admin selalu bisa akses semua menu).
// Harus dipasang SETELAH requireAuth (butuh req.user.role).
function requireNotInMaintenance(menuKey) {
  return async (req, res, next) => {
    if (req.user?.role === 'admin') return next();
    try {
      const row = await prisma.maintenanceMode.findUnique({ where: { menu_key: menuKey } });
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
