import { useEffect, useState } from 'react';
import api from '../api';
import { subscribeLive } from '../live';

// Foto & fasilitas semua ruang rapat dari backend (GET /ruang-info), dikelola Admin/Kabag di menu
// "Foto & Fasilitas Ruang". Ikut diperbarui live begitu admin mengubahnya (topik "ruang-info").
// info = { "SETJEN II": { foto: [{ id, caption, src, ... }], fasilitas: [{ icon, label }] }, ... } | null (memuat).
//
// Satu data bersama untuk seluruh tab: banyak komponen (thumbnail di tabel jadwal, landing, form
// booking, dll.) memakai hook ini sekaligus tanpa masing-masing mengambil ulang ke server.

export const fotoSrc = (id) => `${api.defaults.baseURL}/ruang-info/foto/${id}/file`;

// loaded: data pernah berhasil dimuat. Bila gagal sejak awal, info = {} (agar tampilan publik tidak
// "memuat" terus) -- jangan dianggap "semua ruangan belum punya foto" saat mengelola foto.
let shared = { info: null, error: false, loaded: false };
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
        publish({ info: data, error: false, loaded: true });
      })
      .catch(() => publish({ info: shared.info || {}, error: true, loaded: shared.loaded }))
      .finally(() => { inflight = null; });
    return inflight;
  }
  // Masih ada muat ulang yang berjalan, dimulai sebelum perubahan terakhir (mis. upload/urutan baru
  // saja disimpan) -> hasilnya bisa data lama. Muat sekali lagi setelahnya.
  if (!lagi) lagi = inflight.then(() => { lagi = null; return reload(); });
  return lagi;
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
    }
    return () => {
      listeners.delete(setState);
      if (!listeners.size && unsubscribeLive) { unsubscribeLive(); unsubscribeLive = null; clearTimeout(liveTimer); }
    };
  }, []);
  return { info: state.info, error: state.error, loaded: state.loaded, reload };
}

// Data slideshow satu ruangan, atau null bila ruangan itu belum punya foto.
export const fotoRuangDari = (info, room) => (info?.[room]?.foto?.length ? info[room] : null);
