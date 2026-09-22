import { useEffect, useRef } from 'react';

const STREAM_URL = `${import.meta.env.VITE_API_URL || 'http://localhost:4000/api'}/ruang-rapat/stream`;

// Live-reload lewat Server-Sent Events: begitu ada booking ruang rapat
// berubah (tambah/edit/batal) di server manapun, `onUpdate` dipanggil untuk
// refetch data -- tanpa nunggu polling. EventSource otomatis reconnect
// sendiri kalau koneksi sempat putus (browser native behavior).
export default function useRuangRapatLive(onUpdate) {
  const cbRef = useRef(onUpdate);
  cbRef.current = onUpdate;

  useEffect(() => {
    const es = new EventSource(STREAM_URL);
    es.onmessage = () => cbRef.current();
    return () => es.close();
  }, []);
}
