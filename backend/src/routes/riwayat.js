const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireRole, ADMIN_ROLES } = require('../middleware/auth');
const logger = require('../logger');

// Menu "Riwayat Aktivitas" (Admin/Kabag): baca-saja. Tidak ada endpoint ubah/hapus -- tabelnya pun
// menolak UPDATE/DELETE (migration 0037). Data ditulis lewat src/audit.js oleh tiap modul.
const router = express.Router();
router.use(requireAuth);
router.use(requireRole(ADMIN_ROLES));

const MODUL = ['pemeliharaan', 'pengadaan', 'kendaraan', 'ruang-rapat', 'akun'];
const AKSI_RE = /^[a-z-]{2,30}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PER_HALAMAN = 50;
const MAX_EXPORT = 20000;
// Tanggal filter dibaca sebagai tanggal WIB (UTC+7), sama dengan jam yang dilihat pengguna.
const awalHari = (d) => new Date(`${d}T00:00:00+07:00`);

// Query filter -> { where } atau { error }.
function filterDari(q) {
  const where = {};
  for (const [k, v] of Object.entries(q)) {
    if (!['modul', 'aksi', 'aktor', 'q', 'dari', 'sampai', 'ref', 'page'].includes(k) || typeof v !== 'string' || v.length > 150) return { error: 'Parameter filter tidak valid.' };
  }
  if (q.modul) { if (!MODUL.includes(q.modul)) return { error: 'Modul tidak valid.' }; where.modul = q.modul; }
  if (q.aksi) {
    const list = q.aksi.split(',');
    if (!list.every((a) => AKSI_RE.test(a))) return { error: 'Aksi tidak valid.' };
    where.aksi = { in: list };
  }
  // aktor = "pegawai:12" | "tamu:3" | "tamu" (semua tamu)
  if (q.aktor) {
    const m = /^(pegawai|tamu|sistem)(?::(\d{1,10}))?$/.exec(q.aktor);
    if (!m) return { error: 'Filter pelaku tidak valid.' };
    where.aktor_tipe = m[1];
    if (m[2]) where.aktor_id = Number(m[2]);
  }
  // ref = id data tertentu (dipakai bersama modul) -> riwayat lengkap satu data.
  if (q.ref) { if (!/^\d{1,10}$/.test(q.ref) || !q.modul) return { error: 'Filter data tidak valid.' }; where.ref_id = Number(q.ref); }
  if (q.dari || q.sampai) {
    if ((q.dari && !DATE_RE.test(q.dari)) || (q.sampai && !DATE_RE.test(q.sampai))) return { error: 'Format tanggal tidak valid.' };
    where.waktu = {};
    if (q.dari) where.waktu.gte = awalHari(q.dari);
    if (q.sampai) where.waktu.lt = new Date(+awalHari(q.sampai) + 86400000);
  }
  const cari = q.q?.trim();
  if (cari) {
    where.OR = ['ref_kode', 'ref_label', 'aktor_nama', 'aktor_email', 'keterangan'].map((f) => ({ [f]: { contains: cari, mode: 'insensitive' } }));
  }
  return { where };
}

router.get('/', async (req, res) => {
  try {
    const { where, error } = filterDari(req.query);
    if (error) return res.status(400).json({ message: error });
    const page = Math.max(1, Math.min(10000, Number(req.query.page) || 1));
    const [total, rows] = await Promise.all([
      prisma.riwayatAktivitas.count({ where }),
      prisma.riwayatAktivitas.findMany({ where, orderBy: [{ waktu: 'desc' }, { id: 'desc' }], skip: (page - 1) * PER_HALAMAN, take: PER_HALAMAN }),
    ]);
    res.json({ data: rows, total, page, per_page: PER_HALAMAN });
  } catch (err) {
    logger.error('GET riwayat gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil riwayat aktivitas.' });
  }
});

// Kartu ringkasan di atas tabel.
router.get('/ringkasan', async (req, res) => {
  try {
    const now = Date.now();
    const hariIni = awalHari(new Date(now + 7 * 3600000).toISOString().slice(0, 10));
    const tujuhHari = new Date(now - 7 * 86400000);
    const tigaPuluhHari = new Date(now - 30 * 86400000);
    const [hari, minggu, hapus, pelaku] = await Promise.all([
      prisma.riwayatAktivitas.count({ where: { waktu: { gte: hariIni } } }),
      prisma.riwayatAktivitas.count({ where: { waktu: { gte: tujuhHari } } }),
      prisma.riwayatAktivitas.count({ where: { waktu: { gte: tigaPuluhHari }, aksi: { in: ['hapus', 'batal', 'batal-sebagian', 'service-hapus'] } } }),
      prisma.riwayatAktivitas.groupBy({ by: ['aktor_tipe', 'aktor_id'], where: { waktu: { gte: tujuhHari } } }),
    ]);
    res.json({ data: { hari_ini: hari, tujuh_hari: minggu, hapus_batal_30_hari: hapus, pelaku_7_hari: pelaku.length } });
  } catch (err) {
    logger.error('GET ringkasan riwayat gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil ringkasan riwayat.' });
  }
});

// Daftar pelaku untuk pilihan filter (yang paling sering beraktivitas di atas).
router.get('/aktor', async (req, res) => {
  try {
    const rows = await prisma.riwayatAktivitas.groupBy({
      by: ['aktor_tipe', 'aktor_id', 'aktor_nama', 'aktor_email'],
      _count: { _all: true },
      _max: { waktu: true },
      orderBy: { _count: { id: 'desc' } },
      take: 500,
    });
    // Satu akun bisa tercatat dengan beberapa nama (ganti nama) -> gabung per tipe+id, pakai nama terbaru.
    const map = new Map();
    for (const r of rows) {
      const key = `${r.aktor_tipe}:${r.aktor_id ?? ''}`;
      const cur = map.get(key);
      if (!cur) map.set(key, { key, tipe: r.aktor_tipe, id: r.aktor_id, nama: r.aktor_nama, email: r.aktor_email, jumlah: r._count._all, terakhir: r._max.waktu });
      else {
        cur.jumlah += r._count._all;
        if (r._max.waktu > cur.terakhir) Object.assign(cur, { nama: r.aktor_nama, email: r.aktor_email, terakhir: r._max.waktu });
      }
    }
    res.json({ data: [...map.values()].sort((a, b) => b.jumlah - a.jumlah) });
  } catch (err) {
    logger.error('GET aktor riwayat gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengambil daftar pelaku.' });
  }
});

// Unduh CSV (bisa dibuka di Excel) sesuai filter yang sedang dipakai.
const MODUL_LABEL = { pemeliharaan: 'Pemeliharaan', pengadaan: 'Pengadaan', kendaraan: 'Kendaraan', 'ruang-rapat': 'Ruang Rapat', akun: 'Akun' };
const fmtWaktu = (d) => {
  const w = new Date(+d + 7 * 3600000).toISOString();
  return `${w.slice(8, 10)}/${w.slice(5, 7)}/${w.slice(0, 4)} ${w.slice(11, 19)}`;
};
router.get('/export', async (req, res) => {
  try {
    const { where, error } = filterDari(req.query);
    if (error) return res.status(400).json({ message: error });
    const rows = await prisma.riwayatAktivitas.findMany({ where, orderBy: [{ waktu: 'desc' }, { id: 'desc' }], take: MAX_EXPORT });
    const csv = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const detail = (p) => (Array.isArray(p) ? p.map((x) => ('dari' in x && 'ke' in x ? `${x.label}: ${x.dari ?? '(kosong)'} -> ${x.ke ?? '(kosong)'}` : `${x.label}: ${x.ke ?? x.dari ?? '(kosong)'}`)).join('; ') : '');
    const lines = [
      ['Waktu (WIB)', 'Modul', 'Aksi', 'Kode / Ref', 'Data', 'Pelaku', 'Tipe Pelaku', 'Role', 'Email Pelaku', 'Detail', 'Keterangan', 'IP'],
      ...rows.map((r) => [fmtWaktu(r.waktu), MODUL_LABEL[r.modul] || r.modul, r.aksi, r.ref_kode, r.ref_label, r.aktor_nama, r.aktor_tipe, r.aktor_role, r.aktor_email, detail(r.perubahan), r.keterangan, r.ip]),
    ].map((r) => r.map(csv).join(',')).join('\r\n');
    const tgl = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="riwayat_aktivitas_${tgl}.csv"`);
    res.setHeader('X-Total-Rows', String(rows.length));
    res.send('﻿' + lines);
  } catch (err) {
    logger.error('Export riwayat gagal', { error: err });
    res.status(500).json({ message: 'Gagal mengunduh riwayat aktivitas.' });
  }
});

module.exports = router;
