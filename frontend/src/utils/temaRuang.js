// Tema layar per ruangan (/ruang/:slug, popup foto ruangan): warna aksen + warna latar + motif latar.
// Disimpan di ruang_profil.tema sebagai "<palet>/<motif>" dan dipilih Admin/Kabag di menu Foto & Fasilitas
// Ruang. Daftar kunci harus sama dengan TEMA_PALET/TEMA_MOTIF di backend/src/routes/ruangInfo.js.
// Warna status (hijau/kuning/merah) tidak ikut tema supaya artinya sama di semua layar.
// 40 warna (aksen terang + latar gelap), dikelompokkan untuk daftar pilihan di menu admin.
export const PALET = [
  { key: 'marun', label: 'Marun', aksen: '#fda4af', latar: '#260a12', grup: 'Merah & merah muda' },
  { key: 'mawar', label: 'Mawar', aksen: '#f9a8d4', latar: '#260a1d', grup: 'Merah & merah muda' },
  { key: 'delima', label: 'Delima', aksen: '#f87171', latar: '#2a0b0b', grup: 'Merah & merah muda' },
  { key: 'ceri', label: 'Ceri', aksen: '#fb7185', latar: '#2b0816', grup: 'Merah & merah muda' },
  { key: 'koral', label: 'Koral', aksen: '#ff9f80', latar: '#2a110b', grup: 'Merah & merah muda' },
  { key: 'salem', label: 'Salem', aksen: '#fdb4a0', latar: '#22120e', grup: 'Merah & merah muda' },
  { key: 'magenta', label: 'Magenta', aksen: '#f0abfc', latar: '#260a27', grup: 'Merah & merah muda' },
  { key: 'cabai', label: 'Cabai', aksen: '#ef4444', latar: '#1f0707', grup: 'Merah & merah muda' },
  { key: 'jingga', label: 'Jingga', aksen: '#fdba74', latar: '#24120a', grup: 'Jingga, kuning & cokelat' },
  { key: 'tembaga', label: 'Tembaga', aksen: '#f0a875', latar: '#1d110b', grup: 'Jingga, kuning & cokelat' },
  { key: 'terakota', label: 'Terakota', aksen: '#e8956b', latar: '#24130c', grup: 'Jingga, kuning & cokelat' },
  { key: 'emas', label: 'Emas', aksen: '#e4c27f', latar: '#0b1626', grup: 'Jingga, kuning & cokelat' },
  { key: 'kuning', label: 'Kuning', aksen: '#fde047', latar: '#1a1806', grup: 'Jingga, kuning & cokelat' },
  { key: 'kunyit', label: 'Kunyit', aksen: '#fbbf24', latar: '#1d1405', grup: 'Jingga, kuning & cokelat' },
  { key: 'mustard', label: 'Mustard', aksen: '#d9b23f', latar: '#14130a', grup: 'Jingga, kuning & cokelat' },
  { key: 'sawo', label: 'Sawo', aksen: '#d6b38a', latar: '#1a120c', grup: 'Jingga, kuning & cokelat' },
  { key: 'kopi', label: 'Kopi', aksen: '#c8a27a', latar: '#120c08', grup: 'Jingga, kuning & cokelat' },
  { key: 'zamrud', label: 'Zamrud', aksen: '#5eead4', latar: '#04201d', grup: 'Hijau' },
  { key: 'limau', label: 'Limau', aksen: '#bef264', latar: '#0f1c08', grup: 'Hijau' },
  { key: 'hutan', label: 'Hutan', aksen: '#86efac', latar: '#081b12', grup: 'Hijau' },
  { key: 'mint', label: 'Mint', aksen: '#a7f3d0', latar: '#062019', grup: 'Hijau' },
  { key: 'pandan', label: 'Pandan', aksen: '#4ade80', latar: '#05200f', grup: 'Hijau' },
  { key: 'zaitun', label: 'Zaitun', aksen: '#c9d48a', latar: '#14170b', grup: 'Hijau' },
  { key: 'lumut', label: 'Lumut', aksen: '#a8c686', latar: '#10160c', grup: 'Hijau' },
  { key: 'giok', label: 'Giok', aksen: '#34d399', latar: '#03211a', grup: 'Hijau' },
  { key: 'pinus', label: 'Pinus', aksen: '#8fd3b8', latar: '#0a1a16', grup: 'Hijau' },
  { key: 'safir', label: 'Safir', aksen: '#93c5fd', latar: '#0a1636', grup: 'Biru & ungu' },
  { key: 'toska', label: 'Toska', aksen: '#67e8f9', latar: '#03202a', grup: 'Biru & ungu' },
  { key: 'nila', label: 'Nila', aksen: '#a5b4fc', latar: '#0c1032', grup: 'Biru & ungu' },
  { key: 'ungu', label: 'Ungu', aksen: '#c4b5fd', latar: '#150c2c', grup: 'Biru & ungu' },
  { key: 'langit', label: 'Langit', aksen: '#7dd3fc', latar: '#06192a', grup: 'Biru & ungu' },
  { key: 'samudra', label: 'Samudra', aksen: '#38bdf8', latar: '#03142a', grup: 'Biru & ungu' },
  { key: 'kobalt', label: 'Kobalt', aksen: '#60a5fa', latar: '#071433', grup: 'Biru & ungu' },
  { key: 'lavender', label: 'Lavender', aksen: '#ddd6fe', latar: '#16122a', grup: 'Biru & ungu' },
  { key: 'violet', label: 'Violet', aksen: '#a78bfa', latar: '#120a2e', grup: 'Biru & ungu' },
  { key: 'perak', label: 'Perak', aksen: '#e2e8f0', latar: '#101317', grup: 'Netral' },
  { key: 'arang', label: 'Arang', aksen: '#d4d4d8', latar: '#0b0b0c', grup: 'Netral' },
  { key: 'batu', label: 'Batu', aksen: '#cbd5e1', latar: '#141a22', grup: 'Netral' },
  { key: 'pasir', label: 'Pasir', aksen: '#ead7b0', latar: '#17140f', grup: 'Netral' },
  { key: 'mutiara', label: 'Mutiara', aksen: '#f8fafc', latar: '#1c1f26', grup: 'Netral' },
];
// 40 motif latar (kelas .motif-<key> di app-theme.css), dikelompokkan untuk daftar pilihan di menu admin.
export const MOTIF = [
  { key: 'kawung', label: 'Kawung', grup: 'Batik & tradisional' },
  { key: 'parang', label: 'Parang', grup: 'Batik & tradisional' },
  { key: 'truntum', label: 'Truntum', grup: 'Batik & tradisional' },
  { key: 'ceplok', label: 'Ceplok', grup: 'Batik & tradisional' },
  { key: 'megamendung', label: 'Mega Mendung', grup: 'Batik & tradisional' },
  { key: 'tumpal', label: 'Tumpal', grup: 'Batik & tradisional' },
  { key: 'sekar', label: 'Sekar', grup: 'Batik & tradisional' },
  { key: 'songket', label: 'Songket', grup: 'Batik & tradisional' },
  { key: 'sisik', label: 'Sisik', grup: 'Batik & tradisional' },
  { key: 'tenun', label: 'Tenun', grup: 'Batik & tradisional' },
  { key: 'garis', label: 'Garis miring', grup: 'Garis' },
  { key: 'garis-tegak', label: 'Garis tegak', grup: 'Garis' },
  { key: 'garis-datar', label: 'Garis datar', grup: 'Garis' },
  { key: 'garis-silang', label: 'Garis silang', grup: 'Garis' },
  { key: 'garis-tebal', label: 'Garis tebal', grup: 'Garis' },
  { key: 'garis-ganda', label: 'Garis ganda', grup: 'Garis' },
  { key: 'garis-halus', label: 'Garis halus', grup: 'Garis' },
  { key: 'zigzag', label: 'Zigzag', grup: 'Garis' },
  { key: 'gelombang', label: 'Gelombang', grup: 'Garis' },
  { key: 'chevron', label: 'Chevron', grup: 'Garis' },
  { key: 'titik', label: 'Titik', grup: 'Titik & lingkaran' },
  { key: 'titik-rapat', label: 'Titik rapat', grup: 'Titik & lingkaran' },
  { key: 'titik-besar', label: 'Titik besar', grup: 'Titik & lingkaran' },
  { key: 'titik-selang', label: 'Titik selang-seling', grup: 'Titik & lingkaran' },
  { key: 'lingkaran', label: 'Lingkaran', grup: 'Titik & lingkaran' },
  { key: 'gelembung', label: 'Gelembung', grup: 'Titik & lingkaran' },
  { key: 'konsentris', label: 'Konsentris', grup: 'Titik & lingkaran' },
  { key: 'riak', label: 'Riak', grup: 'Titik & lingkaran' },
  { key: 'bintang', label: 'Bintang', grup: 'Titik & lingkaran' },
  { key: 'plus', label: 'Plus', grup: 'Titik & lingkaran' },
  { key: 'kotak', label: 'Kotak', grup: 'Geometris & alam' },
  { key: 'kotak-kecil', label: 'Kotak kecil', grup: 'Geometris & alam' },
  { key: 'catur', label: 'Papan catur', grup: 'Geometris & alam' },
  { key: 'wajik', label: 'Wajik', grup: 'Geometris & alam' },
  { key: 'segitiga', label: 'Segitiga', grup: 'Geometris & alam' },
  { key: 'heksagon', label: 'Sarang lebah', grup: 'Geometris & alam' },
  { key: 'anyaman', label: 'Anyaman', grup: 'Geometris & alam' },
  { key: 'bata', label: 'Bata', grup: 'Geometris & alam' },
  { key: 'tangga', label: 'Tangga', grup: 'Geometris & alam' },
  { key: 'daun', label: 'Daun', grup: 'Geometris & alam' },
];

// Tema kosong/tidak dikenal -> dipilih tetap dari nama ruangan (selalu sama untuk ruangan yang sama).
// Hanya dari 14 warna & 4 motif awal supaya hasilnya tidak berubah ketika daftar warna/motif ditambah.
const PALET_OTOMATIS = ['emas', 'zamrud', 'safir', 'marun', 'ungu', 'jingga', 'limau', 'toska', 'mawar', 'perak', 'tembaga', 'nila', 'kuning', 'hutan'];
const MOTIF_OTOMATIS = ['kawung', 'garis', 'titik', 'kotak'];
function otomatis(room) {
  let h = 0;
  for (const c of String(room || '')) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `${PALET_OTOMATIS[h % PALET_OTOMATIS.length]}/${MOTIF_OTOMATIS[Math.floor(h / PALET_OTOMATIS.length) % MOTIF_OTOMATIS.length]}`;
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
