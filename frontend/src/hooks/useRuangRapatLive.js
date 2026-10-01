import useLive from './useLive';

// Live-reload jadwal ruang rapat: begitu ada booking berubah (tambah/edit/batal) dari
// pengguna mana pun, `onUpdate` dipanggil untuk refetch -- tanpa nunggu polling.
// Memakai koneksi live bersama (src/live.js), bukan EventSource sendiri.
export default function useRuangRapatLive(onUpdate) {
  useLive('ruang-rapat', onUpdate);
}
