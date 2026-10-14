// Daftar ruang rapat (sama dengan ROOMS di backend/src/routes/ruangRapat.js) + helper nama & URL.
export const RUANG = ['SERBAGUNA', 'SETJEN II', 'TRI DHARMA', 'BIRO UMUM', 'GRAHA KEMNAKER'];

// "SETJEN II" -> "Setjen II"
export const judulRuang = (r) => r.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bIi\b/, 'II');

// "SETJEN II" -> "setjen-ii" (dipakai di URL layar ruangan /ruang/:slug)
export const slugRuang = (r) => r.toLowerCase().trim().replace(/\s+/g, '-');

export const ruangDariSlug = (slug) => RUANG.find((r) => slugRuang(r) === String(slug || '').toLowerCase()) || null;
