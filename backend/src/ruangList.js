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

// Ruangan yang sedang maintenance (diblokir Admin/Kabag) tidak bisa dibooking. Selalu dibaca langsung dari DB
// (tanpa cache) dan dipanggil di dalam transaksi setelah lockRoom, supaya tidak bisa lolos bersamaan dengan
// admin yang baru saja mengaktifkan maintenance. -> pesan error, atau null bila ruangan bisa dibooking.
async function cekMaintenance(db, room) {
  const p = await db.ruangProfil.findUnique({ where: { room }, select: { maintenance: true, maintenance_ket: true } });
  if (!p?.maintenance) return null;
  return `Ruangan ${room} sedang maintenance${p.maintenance_ket ? ` (${p.maintenance_ket})` : ''} dan sementara tidak bisa dibooking.`;
}

module.exports = { daftarRuang, ruangValid, resetDaftarRuang, cekMaintenance };
