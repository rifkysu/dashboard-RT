// Tema layar per ruangan (/ruang/:slug, popup foto ruangan): warna aksen + warna latar + motif latar.
// Disimpan di ruang_profil.tema sebagai "<palet>/<motif>" dan dipilih Admin/Kabag di menu Foto & Fasilitas
// Ruang. Daftar kunci harus sama dengan TEMA_PALET/TEMA_MOTIF di backend/src/routes/ruangInfo.js.
// Warna status (hijau/kuning/merah) tidak ikut tema supaya artinya sama di semua layar.
export const PALET = [
  { key: 'emas', label: 'Emas', aksen: '#e4c27f', latar: '#0b1626' },
  { key: 'zamrud', label: 'Zamrud', aksen: '#5eead4', latar: '#04201d' },
  { key: 'safir', label: 'Safir', aksen: '#93c5fd', latar: '#0a1636' },
  { key: 'marun', label: 'Marun', aksen: '#fda4af', latar: '#260a12' },
  { key: 'ungu', label: 'Ungu', aksen: '#c4b5fd', latar: '#150c2c' },
  { key: 'jingga', label: 'Jingga', aksen: '#fdba74', latar: '#24120a' },
  { key: 'limau', label: 'Limau', aksen: '#bef264', latar: '#0f1c08' },
  { key: 'toska', label: 'Toska', aksen: '#67e8f9', latar: '#03202a' },
  { key: 'mawar', label: 'Mawar', aksen: '#f9a8d4', latar: '#260a1d' },
  { key: 'perak', label: 'Perak', aksen: '#e2e8f0', latar: '#101317' },
  { key: 'tembaga', label: 'Tembaga', aksen: '#f0a875', latar: '#1d110b' },
  { key: 'nila', label: 'Nila', aksen: '#a5b4fc', latar: '#0c1032' },
  { key: 'kuning', label: 'Kuning', aksen: '#fde047', latar: '#1a1806' },
  { key: 'hutan', label: 'Hutan', aksen: '#86efac', latar: '#081b12' },
];
export const MOTIF = [
  { key: 'kawung', label: 'Kawung' },
  { key: 'garis', label: 'Garis' },
  { key: 'titik', label: 'Titik' },
  { key: 'kotak', label: 'Kotak' },
];

// Tema kosong/tidak dikenal -> dipilih tetap dari nama ruangan (selalu sama untuk ruangan yang sama).
function otomatis(room) {
  let h = 0;
  for (const c of String(room || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${PALET[h % PALET.length].key}/${MOTIF[Math.floor(h / PALET.length) % MOTIF.length].key}`;
}

// -> { key, palet, motif, style } ; style dipasang di elemen pembungkus (CSS variable --aksen & --latar).
export function temaRuang(room, info) {
  const simpan = info?.[room]?.tema;
  const [p, m] = String(simpan || '').split('/');
  const sah = PALET.some((x) => x.key === p) && MOTIF.some((x) => x.key === m);
  const key = sah ? simpan : otomatis(room);
  const [pk, mk] = key.split('/');
  const palet = PALET.find((x) => x.key === pk);
  const motif = MOTIF.find((x) => x.key === mk);
  return { key, palet, motif, style: { '--aksen': palet.aksen, '--latar': palet.latar } };
}
