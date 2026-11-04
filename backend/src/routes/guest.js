const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const logger = require('../logger');
const { catat, ringkas } = require('../audit');
const live = require('../live');
const { requireAuth, requireRole, ADMIN_ROLES } = require('../middleware/auth');
const { requireNotInMaintenance } = require('../middleware/maintenance');
const { createRateLimiter } = require('../middleware/security');
const { saveDataUrl } = require('../fileStorage');
const { createCaptcha, verifyCaptcha } = require('../captcha');
const { booking: B } = require('./ruangRapat');
const { ruangValid, cekMaintenance } = require('../ruangList');
const { nowLocal } = require('../clock');

// =====================================================================
// Booking ruang rapat untuk TAMU lewat login Google (SSO) di halaman kiosk /jadwal-rapat.
// - Akun tamu disimpan di tabel guest_accounts (terpisah dari users), jadi
//   tidak bisa masuk ke aplikasi internal -- hanya bisa mengisi form booking.
// - Sesi tamu berlaku 7 hari, lalu harus login Google lagi.
// - Anti-spam: captcha (5 menit, sekali pakai), jeda antar pengajuan, batas
//   pengajuan per hari & booking aktif, rate limit per akun/IP, dan admin bisa
//   memblokir akun tamu dari Dashboard.
// =====================================================================

const GUEST_SESSION = '7d';
const GUEST_AUDIENCE = 'guest-booking';
const COOLDOWN_MS = 60 * 1000;     // jeda minimal antar pengajuan
const MAX_PER_DAY = 3;             // pengajuan per 24 jam per akun
const MAX_ACTIVE = 5;              // pengajuan aktif (belum lewat) per akun
const MAX_SPAN_DAYS = 7;           // mode rentang: maksimal 7 hari berturut-turut
const MAX_DATES = 7;               // mode pilih tanggal: maksimal 7 tanggal (boleh loncat-loncat) per pengajuan
const MAX_AHEAD_DAYS = 90;         // tanggal maksimal 90 hari ke depan
// Satu pengajuan bisa terdiri dari beberapa baris ruang_rapat (tanggal loncat-loncat dipecah per rentang
// berurutan, lihat B.dateRuns) yang diikat booking_group -> batas anti-spam dihitung per pengajuan.
const countGroups = async (tx, where) => (await tx.ruangRapat.groupBy({ by: ['booking_group'], where })).length;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const googleConfigured = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL);
const frontend = (hash) => `${String(process.env.FRONTEND_URL || '').replace(/\/+$/, '')}/jadwal-rapat${hash ? `#${hash}` : ''}`;

// Tanggal hari ini menurut WIB (APP_TIMEZONE), format YYYY-MM-DD -- tidak bergantung zona waktu server.
const todayIso = () => nowLocal().date;

// ---------------------------------------------------------------------
// Login Google (dipasang di /api/auth supaya cocok dengan GOOGLE_CALLBACK_URL di .env)
// ---------------------------------------------------------------------
const googleRouter = express.Router();

// state OAuth -> { verifier, expires }. Disimpan di memori, sekali pakai, berlaku 10 menit.
const pendingStates = new Map();
const STATE_TTL_MS = 10 * 60 * 1000;
const b64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const googleStartLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, message: 'Terlalu banyak percobaan login Google. Coba lagi beberapa menit lagi.' });

googleRouter.get('/google', googleStartLimiter, (req, res) => {
  if (!googleConfigured()) return res.redirect(frontend('guest_error=not_configured'));
  const now = Date.now();
  for (const [k, v] of pendingStates) if (v.expires <= now) pendingStates.delete(k);
  if (pendingStates.size > 5000) return res.redirect(frontend('guest_error=busy'));
  const state = b64url(crypto.randomBytes(24));
  const verifier = b64url(crypto.randomBytes(32));
  pendingStates.set(state, { verifier, expires: now + STATE_TTL_MS });
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: process.env.GOOGLE_CALLBACK_URL,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: b64url(crypto.createHash('sha256').update(verifier).digest()),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

function decodeIdToken(idToken) {
  const part = String(idToken || '').split('.')[1];
  if (!part) return null;
  try { return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')); } catch { return null; }
}

const googleCallbackLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30, message: 'Terlalu banyak percobaan login Google. Coba lagi beberapa menit lagi.' });
googleRouter.get('/google/callback', googleCallbackLimiter, async (req, res) => {
  const { code, state, error } = req.query;
  const pending = typeof state === 'string' ? pendingStates.get(state) : null;
  if (typeof state === 'string') pendingStates.delete(state);
  if (error) return res.redirect(frontend('guest_error=cancelled'));
  if (!pending || pending.expires <= Date.now() || typeof code !== 'string' || code.length > 2048) {
    return res.redirect(frontend('guest_error=invalid_state'));
  }
  try {
    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: process.env.GOOGLE_CALLBACK_URL,
        grant_type: 'authorization_code',
        code_verifier: pending.verifier,
      }),
      signal: AbortSignal.timeout(10000),
    });
    const tokens = await tokenRes.json().catch(() => ({}));
    if (!tokenRes.ok || !tokens.id_token) {
      logger.warn('Tukar kode Google gagal', { status: tokenRes.status, error: tokens.error });
      return res.redirect(frontend('guest_error=google_failed'));
    }
    // id_token diterima langsung dari Google lewat HTTPS (bukan dari browser), jadi cukup cek isi klaimnya.
    const claims = decodeIdToken(tokens.id_token);
    const validIss = ['accounts.google.com', 'https://accounts.google.com'];
    if (!claims || claims.aud !== process.env.GOOGLE_CLIENT_ID || !validIss.includes(claims.iss) || !claims.sub || Number(claims.exp) * 1000 < Date.now()) {
      return res.redirect(frontend('guest_error=google_failed'));
    }
    if (!claims.email || claims.email_verified !== true) return res.redirect(frontend('guest_error=email_unverified'));

    const email = String(claims.email).toLowerCase().slice(0, 254);
    const nama = String(claims.name || email.split('@')[0]).trim().slice(0, 150) || email;
    const foto = typeof claims.picture === 'string' && claims.picture.startsWith('https://') && claims.picture.length <= 500 ? claims.picture : null;
    const guest = await prisma.guestAccount.upsert({
      where: { google_sub: String(claims.sub).slice(0, 255) },
      create: { google_sub: String(claims.sub).slice(0, 255), email, nama, foto, last_login_at: new Date() },
      update: { email, nama, foto, last_login_at: new Date() },
    });
    if (guest.is_blocked) return res.redirect(frontend('guest_error=blocked'));

    const token = jwt.sign({ gid: guest.id, tv: guest.token_version }, process.env.JWT_SECRET, { expiresIn: GUEST_SESSION, algorithm: 'HS256', audience: GUEST_AUDIENCE });
    logger.info('Login tamu Google', { guest_id: guest.id });
    // Panel akun tamu di Dashboard & Akun & Akses langsung menampilkan login baru.
    live.broadcast('guest-accounts');
    // Token lewat fragment (#) -> tidak terkirim ke server mana pun & tidak masuk log akses.
    res.redirect(frontend(`guest_token=${encodeURIComponent(token)}`));
  } catch (err) {
    logger.error('Callback Google gagal', { error: err });
    res.redirect(frontend('guest_error=google_failed'));
  }
});

// ---------------------------------------------------------------------
// API tamu (/api/guest)
// ---------------------------------------------------------------------
const router = express.Router();

async function requireGuest(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  if (!token || token.length > 4096) return res.status(401).json({ message: 'Silakan login dengan Google terlebih dahulu.' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], audience: GUEST_AUDIENCE });
    const guest = await prisma.guestAccount.findUnique({ where: { id: Number(payload.gid) } });
    // Cek blokir lebih dulu: blokir juga menaikkan token_version, jadi tamu tetap dapat pesan yang benar.
    if (guest?.is_blocked) return res.status(403).json({ code: 'GUEST_BLOCKED', message: 'Akun Google ini diblokir admin Biro Umum dan tidak bisa mengajukan booking.' });
    if (!guest || payload.tv !== guest.token_version) return res.status(401).json({ message: 'Sesi login Google sudah berakhir. Silakan login lagi.' });
    req.guest = guest;
    req.guestExp = payload.exp;
    next();
  } catch {
    return res.status(401).json({ message: 'Sesi login Google sudah berakhir (berlaku 7 hari). Silakan login lagi.' });
  }
}

const guestOut = (g, exp) => ({ id: g.id, nama: g.nama, email: g.email, foto: g.foto, session_expires_at: exp ? new Date(exp * 1000).toISOString() : null });

router.get('/me', requireGuest, (req, res) => res.json({ guest: guestOut(req.guest, req.guestExp) }));

// Keluar: token_version naik -> token tamu di semua perangkat langsung tidak berlaku.
router.post('/logout', requireGuest, async (req, res) => {
  try {
    await prisma.guestAccount.update({ where: { id: req.guest.id }, data: { token_version: { increment: 1 } } });
    res.json({ message: 'Berhasil keluar.' });
  } catch (err) {
    logger.error('Logout tamu gagal', { error: err });
    res.status(500).json({ message: 'Gagal keluar.' });
  }
});

const captchaLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10, message: 'Terlalu sering memuat captcha. Tunggu 1 menit.', keyFn: (req) => `g${req.guest.id}` });
router.get('/captcha', requireGuest, captchaLimiter, (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  res.json(createCaptcha(`guest:${req.guest.id}`));
});

// Booking milik tamu yang sedang login (yang belum lewat), untuk daftar "Booking Anda".
router.get('/bookings', requireGuest, async (req, res) => {
  try {
    const rows = await prisma.ruangRapat.findMany({
      where: { guest_id: req.guest.id, end_date: { gte: B.date(todayIso()) } },
      select: { id: true, agenda: true, room: true, pic: true, booking_date: true, end_date: true, start_time: true, end_time: true, surat_status: true, cancelled_at: true, cancel_reason: true, cancelled_by_guest_id: true, created_at: true },
      orderBy: [{ booking_date: 'asc' }, { start_time: 'asc' }],
      take: 100,
    });
    // Satu pengajuan (booking_group) = satu kartu, walau tanggalnya loncat-loncat (beberapa baris).
    // `segments` = rentang tanggal berurutan di dalamnya; date/end_date = tanggal pertama & terakhir.
    const day = (d) => d.toISOString().slice(0, 10);
    const groups = new Map();
    for (const r of rows) {
      const key = r.booking_group || `id:${r.id}`;
      let g = groups.get(key);
      if (!g) {
        g = { id: r.id, title: r.agenda, room: r.room, pic: r.pic, date: day(r.booking_date), end_date: day(r.end_date), start: r.start_time.toISOString().slice(11, 16), end: r.end_time.toISOString().slice(11, 16), status: r.surat_status, segments: [], cancelledAll: true, cancelled_by_self: false, cancel_reason: null };
        groups.set(key, g);
      }
      g.segments.push({ from: day(r.booking_date), to: day(r.end_date), cancelled: !!r.cancelled_at });
      if (day(r.end_date) > g.end_date) g.end_date = day(r.end_date);
      if (!r.cancelled_at) { g.cancelledAll = false; if (g.id_aktif === undefined) g.id_aktif = r.id; } else {
        g.cancelled_by_self = g.cancelled_by_self || r.cancelled_by_guest_id === req.guest.id;
        g.cancel_reason = g.cancel_reason || r.cancel_reason;
      }
    }
    const data = [...groups.values()].slice(0, 50).map(({ cancelledAll, id_aktif, ...g }) => ({
      ...g,
      id: id_aktif ?? g.id, // tombol Batalkan memakai baris yang masih aktif (membatalkan seluruh pengajuan)
      cancelled: cancelledAll,
      tanggal_count: g.segments.filter((s) => !s.cancelled).reduce((n, s) => n + (Date.parse(s.to) - Date.parse(s.from)) / B.DAY + 1, 0),
    }));
    res.json({ data });
  } catch (err) {
    logger.error('GET booking tamu gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil booking Anda.' });
  }
});

const submitIpLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 20, message: 'Terlalu banyak pengajuan dari jaringan ini. Coba lagi nanti.' });
const submitGuestLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 6, message: 'Terlalu banyak percobaan pengajuan. Tunggu 10 menit.', keyFn: (req) => `g${req.guest.id}` });

// Semua kolom WAJIB diisi (termasuk nomor surat & file surat), lalu captcha dicek.
router.post('/bookings', submitIpLimiter, requireGuest, submitGuestLimiter, requireNotInMaintenance('ruang-rapat'), requireNotInMaintenance('kiosk'), async (req, res) => {
  try {
    const { title, nomor_surat, room, pic, pic_phone, date: startDate, end_date, dates, start, end, surat_name, surat_file_data, captcha } = req.body || {};
    // Dua cara memilih tanggal: rentang (date s/d end_date, berturut-turut) atau `dates` = daftar tanggal
    // pilihan yang boleh loncat-loncat (mis. Senin, Rabu, Jumat) supaya ruangan tidak terkunci seminggu penuh.
    const picked = dates !== undefined;

    // Captcha dicek paling awal & selalu hangus setelah dicek (benar/salah).
    const captchaError = verifyCaptcha(`guest:${req.guest.id}`, captcha);
    if (captchaError) return res.status(400).json({ code: 'CAPTCHA', message: captchaError });

    const missing = [
      ['Topik / agenda', title], ['Nomor surat', nomor_surat], ['Nama PIC', pic], ['No. HP PIC', pic_phone], ['Ruangan', room],
      ...(picked ? [] : [['Tanggal mulai', startDate], ['Sampai tanggal', end_date]]),
      ['Jam mulai', start], ['Jam selesai', end], ['File surat permohonan', surat_file_data],
    ].filter(([, v]) => typeof v !== 'string' || !v.trim()).map(([label]) => `${label} wajib diisi.`);
    if (missing.length) return res.status(400).json({ message: missing.join(' ') });
    if (picked && (!Array.isArray(dates) || !dates.length || dates.length > MAX_DATES || !dates.every(B.validDate))) {
      return res.status(400).json({ message: `Pilih 1-${MAX_DATES} tanggal yang valid.` });
    }

    if (!B.validText(title, 255)) return res.status(400).json({ message: 'Topik / agenda maksimal 255 karakter.' });
    if (!B.validNomorSurat(nomor_surat)) return res.status(400).json({ message: 'Nomor surat maksimal 100 karakter.' });
    if (!B.validText(pic, 150)) return res.status(400).json({ message: 'Nama PIC maksimal 150 karakter.' });
    if (!B.validPhone(pic_phone)) return res.status(400).json({ message: 'No. HP PIC tidak valid (contoh: 081234567890 atau +6281234567890).' });
    if (!(await ruangValid(room))) return res.status(400).json({ message: 'Ruangan tidak valid.' });
    if (!picked && (!B.validDate(startDate) || !B.validDate(end_date))) return res.status(400).json({ message: 'Tanggal tidak valid.' });
    if (!B.validTime(start) || !B.validTime(end)) return res.status(400).json({ message: 'Jam tidak valid.' });
    if (start >= end) return res.status(400).json({ message: 'Jam selesai harus lebih besar dari jam mulai.' });
    if (!B.validFile(surat_file_data) || !B.validSuratName(surat_name) || !surat_name) return res.status(400).json({ message: 'File surat harus PDF/JPG/PNG asli, maksimal 8 MB.' });

    const today = todayIso();
    let ranges;
    let firstDate;
    if (picked) {
      const sorted = [...new Set(dates)].sort();
      firstDate = sorted[0];
      if (firstDate < today) return res.status(400).json({ message: 'Tanggal tidak boleh sebelum hari ini.' });
      if ((B.date(sorted[sorted.length - 1]) - B.date(today)) / B.DAY > MAX_AHEAD_DAYS) return res.status(400).json({ message: `Booking paling jauh ${MAX_AHEAD_DAYS} hari ke depan.` });
      ranges = B.dateRuns(sorted); // tanggal berurutan digabung jadi satu rentang
    } else {
      const bd = B.date(startDate), ed = B.date(end_date);
      firstDate = startDate;
      if (startDate < today) return res.status(400).json({ message: 'Tanggal mulai tidak boleh sebelum hari ini.' });
      if ((bd - B.date(today)) / B.DAY > MAX_AHEAD_DAYS) return res.status(400).json({ message: `Booking paling jauh ${MAX_AHEAD_DAYS} hari ke depan.` });
      if (ed < bd) return res.status(400).json({ message: 'Sampai tanggal tidak boleh sebelum tanggal mulai.' });
      if ((ed - bd) / B.DAY + 1 > MAX_SPAN_DAYS) return res.status(400).json({ message: `Booking tamu maksimal ${MAX_SPAN_DAYS} hari berturut-turut.` });
      ranges = [[bd, ed]];
    }
    if (firstDate === today) {
      if (start < nowLocal().hm) return res.status(400).json({ message: 'Jam mulai hari ini sudah lewat.' });
    }

    const guestId = req.guest.id;
    const group = crypto.randomUUID(); // semua tanggal pengajuan ini = satu booking
    const rows = await prisma.$transaction(async (tx) => {
      // Kunci per akun tamu -> dua submit bersamaan tidak bisa sama-sama lolos batas anti-spam.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'guest_booking:' + guestId}))`;
      const last = await tx.ruangRapat.findFirst({ where: { guest_id: guestId }, orderBy: { created_at: 'desc' }, select: { created_at: true } });
      if (last && Date.now() - last.created_at.getTime() < COOLDOWN_MS) {
        throw new B.HttpError(429, `Tunggu ${Math.ceil((COOLDOWN_MS - (Date.now() - last.created_at.getTime())) / 1000)} detik sebelum mengajukan booking lagi.`);
      }
      const perDay = await countGroups(tx, { guest_id: guestId, created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } });
      if (perDay >= MAX_PER_DAY) throw new B.HttpError(429, `Batas ${MAX_PER_DAY} pengajuan per 24 jam tercapai. Coba lagi besok atau hubungi Biro Umum.`);
      const active = await countGroups(tx, { guest_id: guestId, cancelled_at: null, end_date: { gte: B.date(today) } });
      if (active >= MAX_ACTIVE) throw new B.HttpError(429, `Anda sudah punya ${MAX_ACTIVE} booking aktif. Tunggu sampai ada yang selesai/dibatalkan.`);

      await B.lockRoom(tx, room);
      const mt = await cekMaintenance(tx, room, ranges);
      if (mt) throw new B.HttpError(409, mt);
      // Semua tanggal dicek dulu; kalau ada satu saja yang bentrok, tidak ada yang disimpan.
      const conflicts = [];
      for (const [bd, ed] of ranges) {
        const c = await tx.ruangRapat.findFirst({ where: B.conflictWhere(room, bd, ed, B.time(start), B.time(end)), orderBy: [{ booking_date: 'asc' }, { start_time: 'asc' }] });
        if (c) conflicts.push(c);
      }
      if (conflicts.length) throw new B.HttpError(409, B.conflictMessage(conflicts[0]) + (conflicts.length > 1 ? ` (dan ${conflicts.length - 1} tanggal lain juga bentrok)` : ''));

      const path = await saveDataUrl(surat_file_data, surat_name, 'ruang-rapat');
      const created = [];
      for (const [bd, ed] of ranges) {
        created.push(await tx.ruangRapat.create({
          data: {
            agenda: title.trim(), nomor_surat: nomor_surat.trim(), room, pic: pic.trim(), pic_phone: B.normPhone(pic_phone),
            booking_date: bd, end_date: ed, start_time: B.time(start), end_time: B.time(end),
            surat_status: B.suratStatus(surat_file_data), surat_name, surat_file_data, surat_file_path: path,
            booking_group: group, guest_id: guestId,
          },
        }));
      }
      return created;
    }, { timeout: 20000 });

    const row = rows[0];
    const day = (d) => d.toISOString().slice(0, 10);
    const teks = rows.map((r) => (+r.end_date !== +r.booking_date ? `${day(r.booking_date)} s/d ${day(r.end_date)}` : day(r.booking_date))).join(', ');
    const jumlahHari = ranges.reduce((n, [bd, ed]) => n + (ed - bd) / B.DAY + 1, 0);
    logger.info('Booking ruang rapat oleh tamu', { guest_id: guestId, booking_ids: rows.map((r) => r.id) });
    await catat(req, { modul: 'ruang-rapat', aksi: 'tambah', ref: { id: row.id, kode: row.room, label: row.agenda, grup: row.booking_group }, perubahan: ringkas('ruang-rapat', row), keterangan: `Diajukan tamu lewat kiosk (login Google).${rows.length > 1 ? ` ${jumlahHari} tanggal: ${teks}.` : ''}` });
    B.broadcastChange();
    res.status(201).json({
      message: jumlahHari > 1 ? `Ruangan ${row.room} berhasil dibooking untuk ${jumlahHari} tanggal.` : `Ruangan ${row.room} berhasil dibooking.`,
      data: { id: row.id, title: row.agenda, room: row.room, date: day(row.booking_date), end_date: day(rows[rows.length - 1].end_date), dates: rows.map((r) => ({ from: day(r.booking_date), to: day(r.end_date) })), start, end },
    });
  } catch (err) {
    if (err instanceof B.HttpError) return res.status(err.status).json({ message: err.message });
    logger.error('POST booking tamu gagal', { error: err });
    res.status(500).json({ message: 'Gagal menyimpan booking.' });
  }
});

// Tamu membatalkan booking MILIKNYA SENDIRI (seluruh booking). Data tidak dihapus: sama seperti
// pembatalan oleh pegawai, cancelled_at + alasan diisi, dan pembatalnya dicatat di cancelled_by_guest_id.
// Booking yang sudah lewat tidak bisa dibatalkan.
const cancelGuestLimiter = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 10, message: 'Terlalu banyak pembatalan. Tunggu 10 menit.', keyFn: (req) => `g${req.guest.id}` });
router.post('/bookings/:id/cancel', submitIpLimiter, requireGuest, cancelGuestLimiter, requireNotInMaintenance('ruang-rapat'), requireNotInMaintenance('kiosk'), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID booking tidak valid.' });
    const reason = req.body?.reason;
    if (reason != null && (typeof reason !== 'string' || reason.length > 500)) return res.status(400).json({ message: 'Alasan pembatalan maksimal 500 karakter.' });
    // Pengajuan tanggal loncat-loncat terdiri dari beberapa baris (satu booking_group) -> batalkan semuanya
    // yang masih aktif & belum lewat. Baris milik tamu lain tidak mungkin ikut (guest_id tetap dicek).
    const target = await prisma.ruangRapat.findFirst({ where: { id, guest_id: req.guest.id }, select: { booking_group: true } });
    const { count } = await prisma.ruangRapat.updateMany({
      where: { ...(target?.booking_group ? { booking_group: target.booking_group } : { id }), guest_id: req.guest.id, cancelled_at: null, end_date: { gte: B.date(todayIso()) } },
      data: { cancelled_at: new Date(), cancelled_by_guest_id: req.guest.id, cancel_reason: reason?.trim() || 'Dibatalkan sendiri oleh tamu pengaju.' },
    });
    if (!count) return res.status(404).json({ message: 'Booking tidak ditemukan, bukan milik Anda, sudah lewat, atau sudah dibatalkan.' });
    logger.info('Booking ruang rapat dibatalkan tamu', { guest_id: req.guest.id, booking_id: id });
    const info = await prisma.ruangRapat.findUnique({ where: { id }, select: { room: true, agenda: true, cancel_reason: true, booking_group: true } });
    if (info) await catat(req, { modul: 'ruang-rapat', aksi: 'batal', ref: { id, kode: info.room, label: info.agenda, grup: info.booking_group }, keterangan: `Dibatalkan sendiri oleh tamu pengaju. Alasan: ${info.cancel_reason}` });
    B.broadcastChange();
    res.json({ message: 'Booking berhasil dibatalkan.' });
  } catch (err) {
    logger.error('Cancel booking tamu gagal', { error: err });
    res.status(500).json({ message: 'Gagal membatalkan booking.' });
  }
});

// ---------------------------------------------------------------------
// Dashboard admin: semua akun Google tamu yang pernah login di landing page
// (beserta booking terakhirnya, kalau sudah pernah mengisi form).
// ---------------------------------------------------------------------
router.get('/admin/accounts', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const rows = await prisma.guestAccount.findMany({
      take: 500,
      orderBy: { updated_at: 'desc' },
      select: {
        id: true, nama: true, email: true, foto: true, is_blocked: true, last_login_at: true, created_at: true,
        _count: { select: { bookings: true } },
        cancelledBookings: { where: { cancelled_at: { not: null } }, select: { id: true } },
        bookings: { orderBy: { created_at: 'desc' }, take: 1, select: { id: true, agenda: true, room: true, booking_date: true, end_date: true, start_time: true, end_time: true, cancelled_at: true, created_at: true } },
      },
    });
    const data = rows.map((g) => {
      const b = g.bookings[0];
      return {
        id: g.id, nama: g.nama, email: g.email, foto: g.foto, is_blocked: g.is_blocked, last_login_at: g.last_login_at, created_at: g.created_at,
        total_booking: g._count.bookings,
        dibatalkan_sendiri: g.cancelledBookings.length,
        last_booking: b ? { id: b.id, title: b.agenda, room: b.room, date: b.booking_date.toISOString().slice(0, 10), end_date: b.end_date.toISOString().slice(0, 10), start: b.start_time.toISOString().slice(11, 16), end: b.end_time.toISOString().slice(11, 16), cancelled: !!b.cancelled_at, created_at: b.created_at } : null,
      };
    }).sort((a, b) => Math.max(new Date(b.last_booking?.created_at || 0), new Date(b.last_login_at || 0)) - Math.max(new Date(a.last_booking?.created_at || 0), new Date(a.last_login_at || 0)));
    res.json({ data });
  } catch (err) {
    logger.error('GET akun tamu gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil daftar akun tamu.' });
  }
});

// Blokir / buka blokir akun tamu. Blokir juga memutus sesi tamu tsb (token_version naik).
router.put('/admin/accounts/:id/block', requireAuth, requireRole(ADMIN_ROLES), async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: 'ID akun tamu tidak valid.' });
    if (typeof req.body?.blocked !== 'boolean') return res.status(400).json({ message: 'Status blokir tidak valid.' });
    const blocked = req.body.blocked;
    const g = await prisma.guestAccount.update({ where: { id }, data: { is_blocked: blocked, ...(blocked ? { token_version: { increment: 1 } } : {}) }, select: { id: true, is_blocked: true } });
    logger.info(blocked ? 'Akun tamu diblokir' : 'Blokir akun tamu dibuka', { guest_id: id, by: req.user.id });
    const tamu = await prisma.guestAccount.findUnique({ where: { id }, select: { nama: true, email: true } });
    await catat(req, { modul: 'akun', aksi: blocked ? 'blokir-tamu' : 'buka-blokir-tamu', ref: { id, kode: tamu?.email, label: tamu?.nama ? `${tamu.nama} (tamu Google)` : 'Tamu Google' } });
    live.broadcast('guest-accounts');
    res.json({ message: blocked ? 'Akun tamu diblokir.' : 'Blokir akun tamu dibuka.', data: g });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ message: 'Akun tamu tidak ditemukan.' });
    logger.error('Blokir akun tamu gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengubah status akun tamu.' });
  }
});

module.exports = router;
module.exports.googleRouter = googleRouter;
