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

module.exports = { daftarRuang, ruangValid, resetDaftarRuang };
