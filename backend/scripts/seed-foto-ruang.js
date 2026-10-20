// Isi awal foto & fasilitas ruang rapat (Serbaguna, Setjen II, Biro Umum) dari backend/seed/ruang-foto/
// ke database + uploads/ruang-foto/. Jalankan SEKALI setelah migration 0031 (lokal & server):
//
//   npm run ruang:seed-foto
//
// Aman diulang: ruangan yang sudah punya foto atau fasilitas di database dilewati, jadi
// perubahan yang dibuat admin lewat menu "Foto & Fasilitas Ruang" tidak tertimpa.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/prisma');
const { ensureUploadRoot, saveDataUrl } = require('../src/fileStorage');

const SEED_DIR = path.resolve(__dirname, '..', 'seed', 'ruang-foto');

const DATA = {
  SERBAGUNA: {
    foto: [
      ['serbaguna-1.jpeg', 'Aula luas berkarpet dengan panggung & backdrop acara'],
      ['serbaguna-2.jpeg', 'Area lesehan dengan karpet & bantal duduk, jalur tamu berpembatas'],
    ],
    fasilitas: [
      { icon: 'theater_comedy', label: 'Panggung & backdrop' },
      { icon: 'tv', label: 'Layar TV portabel' },
      { icon: 'speaker', label: 'Sound system' },
      { icon: 'ac_unit', label: 'AC standing' },
      { icon: 'light', label: 'Lampu kristal' },
      { icon: 'groups', label: 'Kapasitas besar' },
    ],
  },
  'SETJEN II': {
    foto: [
      ['setjen-ii-1.jpeg', 'Meja rapat memanjang dengan mikrofon & monitor di tiap kursi'],
      ['setjen-ii-2.jpeg', 'Meja konferensi berbentuk U dengan kamera video conference'],
      ['setjen-ii-3.jpeg', 'Layar presentasi besar & sistem audio ruangan'],
    ],
    fasilitas: [
      { icon: 'mic', label: 'Mikrofon konferensi' },
      { icon: 'desktop_windows', label: 'Monitor tiap kursi' },
      { icon: 'videocam', label: 'Kamera video conference' },
      { icon: 'tv', label: 'Layar presentasi' },
      { icon: 'speaker', label: 'Sound system' },
      { icon: 'ac_unit', label: 'AC sentral' },
    ],
  },
  'BIRO UMUM': {
    foto: [
      ['biro-umum-1.jpeg', 'Meja rapat panjang menghadap layar presentasi'],
      ['biro-umum-2.jpeg', 'Layar TV besar untuk paparan, dinding kaca yang terang'],
      ['biro-umum-3.jpeg', 'Jendela besar dengan cahaya alami & kamera konferensi di meja'],
    ],
    fasilitas: [
      { icon: 'tv', label: 'Layar TV presentasi' },
      { icon: 'videocam', label: 'Kamera konferensi' },
      { icon: 'table_restaurant', label: 'Meja rapat panjang' },
      { icon: 'wb_sunny', label: 'Cahaya alami' },
      { icon: 'ac_unit', label: 'AC sentral' },
    ],
  },
};

(async () => {
  try {
    ensureUploadRoot();
    for (const [room, { foto, fasilitas }] of Object.entries(DATA)) {
      const [nFoto, profil] = await Promise.all([
        prisma.ruangFoto.count({ where: { room } }),
        prisma.ruangProfil.findUnique({ where: { room } }),
      ]);
      if (nFoto || profil) { console.log(`- ${room}: sudah ada data, dilewati.`); continue; }
      for (const [i, [file, caption]] of foto.entries()) {
        const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(path.join(SEED_DIR, file)).toString('base64')}`;
        const file_path = await saveDataUrl(dataUrl, file, 'ruang-foto');
        await prisma.ruangFoto.create({ data: { room, caption, file_path, file_mime: 'image/jpeg', sort_order: i } });
      }
      await prisma.ruangProfil.create({ data: { room, fasilitas } });
      console.log(`+ ${room}: ${foto.length} foto & ${fasilitas.length} fasilitas ditambahkan.`);
    }
  } catch (err) {
    console.error('Gagal mengisi foto ruang:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
