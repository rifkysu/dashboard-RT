// Foto & fasilitas per ruang rapat untuk slideshow di layar ruangan (/ruang/:slug).
// Tambah ruangan baru: taruh foto di src/assets/ruang/, import di sini, lalu isi entri dengan kunci nama
// ruangan persis seperti di RUANG (utils/ruang.js). Ruangan tanpa entri tidak menampilkan slideshow.
// `pos` (opsional) = object-position foto saat dipotong di kartu; default 'center 30%'.
// Watermark tanggal/alamat kamera di bawah foto sudah dipotong dari file di assets (foto asli tetap
// di folder "foto ruang rapat/"), jadi foto baru bertanda waktu sebaiknya dipotong dulu juga.
import biroUmum1 from '../assets/ruang/biro-umum-1.jpeg';
import biroUmum2 from '../assets/ruang/biro-umum-2.jpeg';
import biroUmum3 from '../assets/ruang/biro-umum-3.jpeg';
import serbaguna1 from '../assets/ruang/serbaguna-1.jpeg';
import serbaguna2 from '../assets/ruang/serbaguna-2.jpeg';
import setjenII1 from '../assets/ruang/setjen-ii-1.jpeg';
import setjenII2 from '../assets/ruang/setjen-ii-2.jpeg';
import setjenII3 from '../assets/ruang/setjen-ii-3.jpeg';

export const FOTO_RUANG = {
  'BIRO UMUM': {
    foto: [
      { src: biroUmum1, caption: 'Meja rapat panjang menghadap layar presentasi', pos: 'center 70%' },
      { src: biroUmum2, caption: 'Layar TV besar untuk paparan, dinding kaca yang terang', pos: 'center 70%' },
      { src: biroUmum3, caption: 'Jendela besar dengan cahaya alami & kamera konferensi di meja', pos: 'center 70%' },
    ],
    fasilitas: [
      { icon: 'tv', label: 'Layar TV presentasi' },
      { icon: 'videocam', label: 'Kamera konferensi' },
      { icon: 'table_restaurant', label: 'Meja rapat panjang' },
      { icon: 'wb_sunny', label: 'Cahaya alami' },
      { icon: 'ac_unit', label: 'AC sentral' },
    ],
  },
  SERBAGUNA: {
    foto: [
      { src: serbaguna1, caption: 'Aula luas berkarpet dengan panggung & backdrop acara', pos: 'center' },
      { src: serbaguna2, caption: 'Area lesehan dengan karpet & bantal duduk, jalur tamu berpembatas', pos: 'center' },
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
      { src: setjenII1, caption: 'Meja rapat memanjang dengan mikrofon & monitor di tiap kursi' },
      { src: setjenII2, caption: 'Meja konferensi berbentuk U dengan kamera video conference' },
      { src: setjenII3, caption: 'Layar presentasi besar & sistem audio ruangan' },
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
};

export const fotoRuang = (room) => FOTO_RUANG[room] || null;
