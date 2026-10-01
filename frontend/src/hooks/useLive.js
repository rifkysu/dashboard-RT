import { useEffect, useRef } from 'react';
import { subscribeLive } from '../live';

// Panggil `onChange` setiap ada perubahan di salah satu `topics` (string atau array),
// dari tab/pengguna mana pun. Beberapa perubahan beruntun digabung jadi satu panggilan
// (jeda 400 ms) supaya tidak membanjiri server dengan refetch.
export default function useLive(topics, onChange) {
  const cbRef = useRef(onChange);
  cbRef.current = onChange;
  const key = [].concat(topics).join(',');

  useEffect(() => {
    const wanted = new Set(key.split(','));
    let timer = null;
    const unsubscribe = subscribeLive((topic) => {
      if (topic !== '*' && !wanted.has(topic)) return;
      clearTimeout(timer);
      timer = setTimeout(() => cbRef.current(), 400);
    });
    return () => { clearTimeout(timer); unsubscribe(); };
  }, [key]);
}
