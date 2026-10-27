// Isi awal foto ruang rapat dari backend/seed/ruang-foto/ (Serbaguna, Setjen II, Biro Umum, dan ruangan
// satuan kerja lain dari link dokumentasi di spreadsheet data ruang rapat)
// ke database + uploads/ruang-foto/. Jalankan SEKALI setelah migration 0033 (lokal & server):
//
//   npm run ruang:seed-foto
//
// Aman diulang: ruangan yang sudah punya foto di database dilewati, jadi perubahan yang dibuat admin
// lewat menu "Foto & Fasilitas Ruang" tidak tertimpa. Fasilitas diisi migration 0033 (spreadsheet).
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
  },
  'SETJEN II': {
    foto: [
      ['setjen-ii-1.jpeg', 'Meja rapat memanjang dengan mikrofon & monitor di tiap kursi'],
      ['setjen-ii-2.jpeg', 'Meja konferensi berbentuk U dengan kamera video conference'],
      ['setjen-ii-3.jpeg', 'Layar presentasi besar & sistem audio ruangan'],
    ],
  },
  'BIRO UMUM': {
    foto: [
      ['biro-umum-1.jpeg', 'Meja rapat panjang menghadap layar presentasi'],
      ['biro-umum-2.jpeg', 'Layar TV besar untuk paparan, dinding kaca yang terang'],
      ['biro-umum-3.jpeg', 'Jendela besar dengan cahaya alami & kamera konferensi di meja'],
    ],
  },
  // Dari link dokumentasi di spreadsheet data ruang rapat (Google Drive tiap satuan kerja).
  'Ruang Rapat Biro Perencanaan': {
    foto: [
      ['biro-perencanaan-1.jpeg', 'Meja rapat panjang dengan kursi biru & mikrofon meja, layar TV di ujung ruangan'],
      ['biro-perencanaan-2.jpeg', 'Ruangan memanjang berdinding kaca dengan deretan kursi tamu merah'],
      ['biro-perencanaan-3.jpeg', 'Meja rapat utama menghadap layar presentasi'],
    ],
  },
  'Ruang Rapat Biro Humas': {
    foto: [
      ['biro-humas-1.jpeg', 'Meja rapat dengan papan tulis kaca & speaker di depan ruangan'],
      ['biro-humas-2.jpeg', 'Layar TV besar & tripod untuk video conference'],
      ['biro-humas-3.jpeg', 'Meja rapat panjang menghadap layar TV'],
    ],
  },
  'Ruang Rapat PTSA': {
    foto: [
      ['ptsa-1.jpeg', 'Meja rapat oval dengan kursi merah'],
      ['ptsa-2.jpeg', 'Meja oval dengan stop kontak di tengah meja'],
      ['ptsa-3.jpeg', 'Ruang rapat kecil ber-AC dengan dinding kayu'],
    ],
  },
  'Ruang Rapat Dalam Biro Kerja Sama': {
    foto: [['kerja-sama-dalam-1.jpeg', 'Meja rapat putih dengan mikrofon & layar video conference']],
  },
  'Ruang Rapat Luar Biro Kerja Sama': {
    foto: [['kerja-sama-luar-1.jpeg', 'Meja rapat memanjang dengan mikrofon & layar di ujung ruangan']],
  },
  'Ruang Rapat Pimpinan PPSDM Ketenagakerjaan': {
    foto: [['ppsdm-pimpinan-1.jpeg', 'Meja rapat panjang dengan kursi oranye, layar TV & papan tulis']],
  },
  'Ruang Rapat Kolaborasi PPSDM Ketenagakerjaan': {
    foto: [['ppsdm-kolaborasi-1.jpeg', 'Meja tata letak U berlapis kain hitam menghadap layar TV']],
  },
  'Ruang Rapat Ujikom 1 PPSDM Ketenagakerjaan': {
    foto: [['ppsdm-ujikom-1-1.jpeg', 'Meja kayu panjang dengan kursi kayu & layar TV']],
  },
  'Ruang Rapat Ujikom 2 PPSDM Ketenagakerjaan': {
    foto: [['ppsdm-ujikom-2-1.jpeg', 'Meja rapat berkelompok di ruangan terbuka yang terang']],
  },
  'Ruang Rapat Sinergi 2 PPSDM Ketenagakerjaan': {
    foto: [['ppsdm-sinergi-2-1.jpeg', 'Meja kayu memanjang dengan kursi kayu & layar TV']],
  },
  'Ruang Rapat Sinergi 3 PPSDM Ketenagakerjaan': {
    foto: [['ppsdm-sinergi-3-1.jpeg', 'Meja tata letak U menghadap layar TV']],
  },
};

(async () => {
  try {
    ensureUploadRoot();
    for (const [room, { foto }] of Object.entries(DATA)) {
      if (await prisma.ruangFoto.count({ where: { room } })) { console.log(`- ${room}: sudah ada foto, dilewati.`); continue; }
      for (const [i, [file, caption]] of foto.entries()) {
        const dataUrl = `data:image/jpeg;base64,${fs.readFileSync(path.join(SEED_DIR, file)).toString('base64')}`;
        const file_path = await saveDataUrl(dataUrl, file, 'ruang-foto');
        await prisma.ruangFoto.create({ data: { room, caption, file_path, file_mime: 'image/jpeg', sort_order: i } });
      }
      console.log(`+ ${room}: ${foto.length} foto ditambahkan.`);
    }
  } catch (err) {
    console.error('Gagal mengisi foto ruang:', err.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
})();
