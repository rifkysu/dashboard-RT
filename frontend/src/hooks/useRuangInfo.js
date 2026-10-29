import { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { subscribeLive } from '../live';
import { RUANG_AWAL, grupRuang } from '../utils/ruang';

// Daftar ruang rapat + foto & fasilitasnya dari backend (GET /ruang-info), dikelola Admin/Kabag di menu
// "Foto & Fasilitas Ruang". Ikut diperbarui live begitu admin mengubahnya (topik "ruang-info").
// info = { "SETJEN II": { satuan_kerja, kapasitas, link_foto, foto: [{ id, caption, src, ... }], fasilitas: [{ icon, label }] }, ... } | null (memuat).
// urutan = nama semua ruangan sesuai urutan tampil | null (memuat).
//
// Satu data bersama untuk seluruh tab: banyak komponen (thumbnail di tabel jadwal, landing, form
// booking, dll.) memakai hook ini sekaligus tanpa masing-masing mengambil ulang ke server.

export const fotoSrc = (id) => `${api.defaults.baseURL}/ruang-info/foto/${id}/file`;

// loaded: data pernah berhasil dimuat. Bila gagal sejak awal, info = {} (agar tampilan publik tidak
// "memuat" terus) -- jangan dianggap "semua ruangan belum punya foto" saat mengelola foto.
let shared = { info: null, urutan: null, error: false, loaded: false };
const listeners = new Set();
let inflight = null;
let lagi = null;
let unsubscribeLive = null;
let liveTimer = null;

function publish(next) {
  shared = next;
  listeners.forEach((fn) => fn(shared));
}

function reload() {
  if (!inflight) {
    inflight = api.get('/ruang-info')
      .then((r) => {
        const data = r.data.data || {};
        for (const room of Object.keys(data)) data[room].foto = data[room].foto.map((f) => ({ ...f, src: fotoSrc(f.id) }));
        publish({ info: data, urutan: r.data.urutan || Object.keys(data), error: false, loaded: true });
      })
      .catch(() => publish({ ...shared, info: shared.info || {}, error: true }))
      .finally(() => { inflight = null; });
    return inflight;
  }
  // Masih ada muat ulang yang berjalan, dimulai sebelum perubahan terakhir (mis. upload/urutan baru
  // saja disimpan) -> hasilnya bisa data lama. Muat sekali lagi setelahnya.
  if (!lagi) lagi = inflight.then(() => { lagi = null; return reload(); });
  return lagi;
}

// Status maintenance bergantung tanggal (periode blokir mulai/berakhir) tanpa ada perubahan data, jadi layar
// yang terbuka berhari-hari (kiosk, layar ruangan) memuat ulang sendiri sesaat setelah tengah malam.
let midnightTimer = null;
function jadwalTengahMalam() {
  clearTimeout(midnightTimer);
  const besok = new Date(); besok.setHours(24, 0, 30, 0);
  midnightTimer = setTimeout(() => { reload(); jadwalTengahMalam(); }, besok - Date.now());
}

export default function useRuangInfo() {
  const [state, setState] = useState(shared);
  useEffect(() => {
    listeners.add(setState);
    setState(shared);
    // Pemakai pertama (atau pertama lagi setelah semua sempat lepas): muat ulang, karena selama
    // tidak ada yang berlangganan perubahan live bisa terlewat.
    if (!unsubscribeLive) {
      reload();
      unsubscribeLive = subscribeLive((topic) => {
        if (topic !== 'ruang-info' && topic !== '*') return;
        clearTimeout(liveTimer);
        liveTimer = setTimeout(reload, 400);
      });
      jadwalTengahMalam();
    }
    return () => {
      listeners.delete(setState);
      if (!listeners.size && unsubscribeLive) { unsubscribeLive(); unsubscribeLive = null; clearTimeout(liveTimer); clearTimeout(midnightTimer); }
    };
  }, []);
  return { info: state.info, urutan: state.urutan, error: state.error, loaded: state.loaded, reload };
}

// Daftar ruangan yang bisa dibooking + pengelompokannya per satuan kerja (bagian).
// rooms = ['BIRO UMUM', ...]; grup = [{ bagian, rooms }]. Sebelum dimuat: daftar cadangan RUANG_AWAL.
export function useDaftarRuang() {
  const { info, urutan, loaded, error, reload } = useRuangInfo();
  const rooms = urutan?.length ? urutan : RUANG_AWAL;
  const grup = useMemo(() => grupRuang(rooms, info), [rooms, info]);
  return { rooms, grup, info, loaded, error, reload };
}

// Data slideshow satu ruangan, atau null bila ruangan itu belum punya foto.
export const fotoRuangDari = (info, room) => (info?.[room]?.foto?.length ? info[room] : null);
