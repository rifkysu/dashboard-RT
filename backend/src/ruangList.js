const prisma = require('./prisma');

// Daftar ruang rapat yang bisa dibooking = isi tabel ruang_profil (dikelola Admin/Kabag di menu
// "Foto & Fasilitas Ruang"). Disimpan sementara di memori supaya validasi booking tidak query tiap
// request; dibuang saat admin mengubah daftar ruangan, dan kedaluwarsa sendiri (perubahan via pgAdmin).
const TTL_MS = 60 * 1000;
let cache = null;
let cacheAt = 0;

function daftarRuang() {
  if (!cache || Date.now() - cacheAt > TTL_MS) {
    cacheAt = Date.now();
    cache = prisma.ruangProfil.findMany({ orderBy: [{ sort_order: 'asc' }, { room: 'asc' }], select: { room: true } })
      .then((rows) => rows.map((r) => r.room))
      .catch((err) => { cache = null; throw err; });
  }
  return cache;
}

const ruangValid = async (room) => typeof room === 'string' && (await daftarRuang()).includes(room);
const resetDaftarRuang = () => { cache = null; };

// Periode maintenance ruangan (opsional): maintenance_mulai/sampai NULL = diblokir sampai dibuka lagi.
const isoTgl = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
const tglId = (s) => new Date(`${s}T00:00:00Z`).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
// 'YYYY-MM-DD' -> "3 Nov 2026" / "3 Nov 2026 – 5 Nov 2026"; '' bila tanpa periode.
function teksPeriode(mulai, sampai) {
  if (!mulai && !sampai) return '';
  if (mulai === sampai) return tglId(mulai);
  return mulai ? `${tglId(mulai)} – ${sampai ? tglId(sampai) : 'dibuka lagi'}` : `s/d ${tglId(sampai)}`;
}
// Apakah blokir ruangan `p` mengenai rentang tanggal dari..sampai ('YYYY-MM-DD', inklusif)?
function blokirKena(p, dari, sampai) {
  if (!p?.maintenance) return false;
  const m = isoTgl(p.maintenance_mulai), s = isoTgl(p.maintenance_sampai);
  return (!m || sampai >= m) && (!s || dari <= s);
}

// Ruangan yang sedang maintenance (diblokir Admin/Kabag) tidak bisa dibooking pada periode blokirnya. Selalu
// dibaca langsung dari DB (tanpa cache) dan dipanggil di dalam transaksi setelah lockRoom, supaya tidak bisa
// lolos bersamaan dengan admin yang baru saja mengaktifkan maintenance. ranges = [[Date, Date], ...] tanggal
// booking. -> pesan error, atau null bila ruangan bisa dibooking pada tanggal itu.
async function cekMaintenance(db, room, ranges) {
  const p = await db.ruangProfil.findUnique({ where: { room }, select: { maintenance: true, maintenance_ket: true, maintenance_mulai: true, maintenance_sampai: true } });
  if (!ranges.some(([bd, ed]) => blokirKena(p, isoTgl(bd), isoTgl(ed)))) return null;
  const periode = teksPeriode(isoTgl(p.maintenance_mulai), isoTgl(p.maintenance_sampai));
  return periode
    ? `Ruangan ${room} sedang maintenance tanggal ${periode}${p.maintenance_ket ? ` (${p.maintenance_ket})` : ''} dan tidak bisa dibooking pada tanggal tersebut.`
    : `Ruangan ${room} sedang maintenance${p.maintenance_ket ? ` (${p.maintenance_ket})` : ''} dan sementara tidak bisa dibooking.`;
}

module.exports = { daftarRuang, ruangValid, resetDaftarRuang, cekMaintenance, blokirKena, isoTgl, teksPeriode };
