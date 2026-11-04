import React, { useEffect, useRef, useState } from 'react';

// Tabel dengan ribuan baris (Pemeliharaan, Pengadaan, Akun) membuat browser lag kalau semua baris
// dirender sekaligus -- apalagi tiap baris punya banyak tombol. Hook ini merender `step` baris dulu,
// lalu menambah `step` baris lagi otomatis saat pengguna menggulir mendekati akhir tabel.
// Filter, angka ringkasan, dan Export tetap memakai SEMUA data (hanya tampilan yang bertahap).
export default function useIncrementalRows(rows, step = 50) {
  const [limit, setLimit] = useState(step);
  const sentinelRef = useRef(null);
  const total = rows.length;
  const hasMore = total > limit;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!hasMore || !el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => l + step);
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, limit, step]);

  const showMore = () => setLimit((l) => l + step);
  const shown = hasMore ? rows.slice(0, limit) : rows;

  // Baris penutup tabel: memicu muat berikutnya saat terlihat; tombol sebagai cadangan.
  const moreRow = (colSpan) =>
    hasMore ? (
      <tr ref={sentinelRef}>
        <td colSpan={colSpan} className="py-3 text-center text-xs text-slate-500">
          Menampilkan {limit} dari {total} baris.{' '}
          <button
            type="button"
            onClick={showMore}
            className="ml-1 px-3 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 font-semibold text-slate-700"
          >
            Tampilkan {Math.min(step, total - limit)} lagi
          </button>
        </td>
      </tr>
    ) : null;

  return { shown, moreRow };
}
