// Daftar ruang rapat diambil dari backend (tabel ruang_profil, dikelola Admin/Kabag di menu
// "Foto & Fasilitas Ruang") lewat useDaftarRuang() di hooks/useRuangInfo.js. RUANG_AWAL hanya
// cadangan selama daftar dari server belum dimuat.
export const RUANG_AWAL = ['BIRO UMUM', 'SETJEN II', 'TRI DHARMA', 'SERBAGUNA', 'GRAHA KEMNAKER'];

// "SETJEN II" -> "Setjen II". Nama yang sudah ditulis dengan huruf kecil (mis. "Ruang Rapat Biro
// Perencanaan", "Ruang Rapat PTSA") dipakai apa adanya.
export const judulRuang = (r) => (/[a-z]/.test(r) ? r : r.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bIi\b/, 'II'));

// "SETJEN II" -> "setjen-ii" (dipakai di URL layar ruangan /ruang/:slug)
export const slugRuang = (r) => r.toLowerCase().trim().replace(/\s+/g, '-');

export const ruangDariSlug = (slug, rooms) => rooms.find((r) => slugRuang(r) === String(slug || '').toLowerCase()) || null;

// Ruangan dikelompokkan per satuan kerja (bagian), urutan grup = urutan ruangan pertamanya.
// -> [{ bagian: 'Biro Umum', rooms: ['BIRO UMUM', ...] }, ...]
export function grupRuang(rooms, info) {
  const out = [];
  for (const room of rooms) {
    const bagian = info?.[room]?.satuan_kerja || 'Lainnya';
    let g = out.find((x) => x.bagian === bagian);
    if (!g) { g = { bagian, rooms: [] }; out.push(g); }
    g.rooms.push(room);
  }
  return out;
}
