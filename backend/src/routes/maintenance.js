const express = require('express');
const { EventEmitter } = require('events');
const prisma = require('../prisma');
const { requireAuth, requireRole } = require('../middleware/auth');
const logger = require('../logger');

const router = express.Router();
const MENU_KEYS = ['dashboard', 'pemeliharaan', 'pengadaan', 'kendaraan', 'ruang-rapat', 'landing'];

// Bus internal untuk broadcast SSE tiap admin toggle maintenance, supaya
// semua user yang sedang buka web langsung ke-update real-time tanpa perlu
// refresh/polling.
const bus = new EventEmitter();
bus.setMaxListeners(0);
const broadcastChange = () => bus.emit('change');

// SSE stream: cuma sinyal "ada perubahan" (bukan data itu sendiri), jadi aman
// dibuat publik -- EventSource browser native tidak bisa kirim header
// Authorization. Data asli tetap lewat GET '/' yang ber-otentikasi.
router.get('/stream', (req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive' });
  res.write('retry: 3000\n\n');
  const send = () => { try { res.write(`data: ${Date.now()}\n\n`); } catch {} };
  bus.on('change', send);
  const heartbeat = setInterval(() => { try { res.write(': heartbeat\n\n'); } catch {} }, 25000);
  req.on('close', () => { clearInterval(heartbeat); bus.off('change', send); });
});

// Status maintenance landing page ('/') harus bisa dibaca pengunjung yang
// belum login, jadi endpoint ini sengaja publik (tanpa requireAuth) dan cuma
// mengembalikan baris 'landing' saja -- bukan status menu lain yang sensitif.
router.get('/landing-status', async (req, res) => {
  try {
    const row = await prisma.maintenanceMode.findUnique({ where: { menu_key: 'landing' } });
    res.json({ data: { is_active: !!row?.is_active, message: row?.message || null } });
  } catch (err) {
    logger.error('GET landing maintenance status gagal', { error: err });
    res.json({ data: { is_active: false, message: null } });
  }
});

router.use(requireAuth);

// Semua role login boleh baca status maintenance (dipakai untuk gating UI sendiri-sendiri).
router.get('/', async (req, res) => {
  try {
    const rows = await prisma.maintenanceMode.findMany({ orderBy: { menu_key: 'asc' } });
    res.json({ data: rows });
  } catch (err) {
    logger.error('GET maintenance gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil status maintenance.' });
  }
});

// Hanya admin yang boleh mengubah status maintenance.
router.put('/:menu_key', requireRole(['admin']), async (req, res) => {
  try {
    const { menu_key } = req.params;
    if (!MENU_KEYS.includes(menu_key)) return res.status(400).json({ message: 'Menu tidak dikenal.' });

    const { is_active, message } = req.body;
    if (is_active !== undefined && typeof is_active !== 'boolean') return res.status(400).json({ message: 'is_active harus boolean.' });
    if (message !== undefined && message !== null && (typeof message !== 'string' || message.length > 255)) return res.status(400).json({ message: 'Pesan maksimal 255 karakter.' });

    const data = { updated_by: req.user.id };
    if (is_active !== undefined) data.is_active = is_active;
    if (message !== undefined) data.message = message || null;

    const row = await prisma.maintenanceMode.upsert({
      where: { menu_key },
      update: data,
      create: { menu_key, is_active: is_active ?? false, message: message || null, updated_by: req.user.id },
    });
    broadcastChange();
    res.json({ data: row });
  } catch (err) {
    logger.error('PUT maintenance gagal', { error: err });
    res.status(500).json({ message: 'Gagal memperbarui status maintenance.' });
  }
});

module.exports = router;
