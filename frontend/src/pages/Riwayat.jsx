import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../components/Feedback';
import useLive from '../hooks/useLive';
import MenuStats from '../components/MenuStats';

// Menu "Riwayat Aktivitas" (Admin/Kabag): siapa melakukan apa, kapan, di data mana, dan apa yang berubah
// di Pemeliharaan, Pengadaan, Kendaraan, Ruang Rapat, dan Akun. Baca-saja -- riwayat tidak bisa diubah/dihapus
// siapa pun (backend: routes/riwayat.js, src/audit.js). Filter tersimpan di URL supaya bisa dibagikan,
// mis. /riwayat?modul=pemeliharaan&ref=12 = seluruh riwayat satu data.
const MODUL = {
  pemeliharaan: { label: 'Pemeliharaan', icon: 'build' },
  pengadaan: { label: 'Pengadaan', icon: 'shopping_cart' },
  kendaraan: { label: 'Kendaraan', icon: 'directions_car' },
  'ruang-rapat': { label: 'Ruang Rapat', icon: 'calendar_month' },
  akun: { label: 'Akun', icon: 'group' },
};
const AKSI = {
  tambah: { label: 'Tambah', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'add_circle' },
  ubah: { label: 'Ubah', cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: 'edit' },
  hapus: { label: 'Hapus', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'delete' },
  batal: { label: 'Batal', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'event_busy' },
  'batal-sebagian': { label: 'Batal sebagian', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'event_busy' },
  'service-tambah': { label: 'Tambah service', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'home_repair_service' },
  'service-ubah': { label: 'Ubah service', cls: 'bg-sky-50 text-sky-700 border-sky-200', icon: 'home_repair_service' },
  'service-hapus': { label: 'Hapus service', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'home_repair_service' },
  daftar: { label: 'Daftar akun', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'person_add' },
  'daftar-ulang': { label: 'Daftar ulang', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'person_add' },
  'verifikasi-email': { label: 'Verifikasi email', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'mark_email_read' },
  role: { label: 'Ubah role', cls: 'bg-violet-50 text-violet-700 border-violet-200', icon: 'badge' },
  ban: { label: 'Ban akun', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'block' },
  aktifkan: { label: 'Aktifkan akun', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'check_circle' },
  'link-reset': { label: 'Link reset sandi', cls: 'bg-amber-50 text-amber-700 border-amber-200', icon: 'lock_reset' },
  'blokir-tamu': { label: 'Blokir tamu', cls: 'bg-red-50 text-red-700 border-red-200', icon: 'block' },
  'buka-blokir-tamu': { label: 'Buka blokir tamu', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: 'lock_open' },
};
// Pilihan filter aksi (beberapa aksi sejenis digabung).
const FILTER_AKSI = [
  { value: 'tambah,service-tambah,daftar,daftar-ulang', label: 'Tambah / daftar' },
  { value: 'ubah,service-ubah', label: 'Ubah' },
  { value: 'hapus,service-hapus', label: 'Hapus' },
  { value: 'batal,batal-sebagian', label: 'Batal booking' },
  { value: 'hapus,service-hapus,batal,batal-sebagian', label: 'Semua hapus & batal' },
  { value: 'role,ban,aktifkan,verifikasi-email,link-reset,blokir-tamu,buka-blokir-tamu', label: 'Pengelolaan akun' },
];
const ROLE = { karyawan: 'Karyawan', pic: 'PIC', kabag: 'Kabag', admin: 'Admin', tamu: 'Tamu Google' };
const FILTER_KEYS = ['modul', 'aksi', 'aktor', 'q', 'dari', 'sampai', 'ref'];

const jam = (v) => new Date(v).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
const kunciHari = (v) => new Date(v).toLocaleDateString('sv-SE'); // YYYY-MM-DD zona lokal
function judulHari(key) {
  const hari = kunciHari(new Date());
  const kemarin = kunciHari(new Date(Date.now() - 86400000));
  const teks = new Date(`${key}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  return key === hari ? `Hari ini · ${teks}` : key === kemarin ? `Kemarin · ${teks}` : teks;
}

export default function Riwayat() {
  const { user, isAdmin } = useAuth();
  const { toast } = useFeedback();
  const [params, setParams] = useSearchParams();
  const filter = useMemo(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])), [params]);
  const [cari, setCari] = useState(filter.q);
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [ringkasan, setRingkasan] = useState(null);
  const [aktor, setAktor] = useState([]);
  const [mengunduh, setMengunduh] = useState(false);
  const reqRef = useRef(0);

  const query = useMemo(() => Object.fromEntries(Object.entries(filter).filter(([, v]) => v)), [filter]);
  const setFilter = (patch) => setParams((prev) => {
    const next = new URLSearchParams(prev);
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    // Ganti modul -> filter satu data (ref) tidak berlaku lagi.
    if ('modul' in patch && !('ref' in patch)) next.delete('ref');
    return next;
  }, { replace: true });

  // silent = muat ulang diam-diam (sinyal live): halaman 1 digabung di atas daftar yang sudah ada.
  async function load({ silent = false } = {}) {
    const id = ++reqRef.current;
    if (!silent) { setLoading(true); setError(''); }
    try {
      const r = await api.get('/riwayat', { params: { ...query, page: 1 } });
      if (id !== reqRef.current) return;
      setTotal(r.data.total);
      if (silent) setItems((cur) => { const ada = new Set(r.data.data.map((x) => x.id)); return [...r.data.data, ...cur.filter((x) => !ada.has(x.id))]; });
      else { setItems(r.data.data); setPage(1); }
    } catch (err) {
      if (id === reqRef.current && !silent) setError(err.response?.data?.message || 'Gagal mengambil riwayat aktivitas.');
    } finally {
      if (id === reqRef.current && !silent) setLoading(false);
    }
  }
  async function loadMore() {
    setLoadingMore(true);
    try {
      const r = await api.get('/riwayat', { params: { ...query, page: page + 1 } });
      setItems((cur) => { const ada = new Set(cur.map((x) => x.id)); return [...cur, ...r.data.data.filter((x) => !ada.has(x.id))]; });
      setPage((p) => p + 1);
      setTotal(r.data.total);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal memuat riwayat berikutnya.');
    } finally {
      setLoadingMore(false);
    }
  }
  const loadSamping = () => {
    api.get('/riwayat/ringkasan').then((r) => setRingkasan(r.data.data)).catch(() => {});
    api.get('/riwayat/aktor').then((r) => setAktor(r.data.data)).catch(() => {});
  };

  useEffect(() => { if (isAdmin) load(); }, [JSON.stringify(query), isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (isAdmin) loadSamping(); }, [isAdmin]);
  useLive('riwayat', () => { load({ silent: true }); loadSamping(); });
  // Kotak cari: kirim ke URL setelah berhenti mengetik 350 ms.
  useEffect(() => { setCari(filter.q); }, [filter.q]);
  useEffect(() => {
    if (cari.trim() === filter.q) return undefined;
    const t = setTimeout(() => setFilter({ q: cari.trim() }), 350);
    return () => clearTimeout(t);
  }, [cari]); // eslint-disable-line react-hooks/exhaustive-deps

  async function unduh() {
    setMengunduh(true);
    try {
      const r = await api.get('/riwayat/export', { params: query, responseType: 'blob' });
      const url = URL.createObjectURL(r.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `riwayat_aktivitas_${new Date().toLocaleDateString('sv-SE')}.csv`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast(`${r.headers['x-total-rows'] || ''} baris riwayat diunduh (CSV, bisa dibuka di Excel).`.trim());
    } catch {
      setError('Gagal mengunduh riwayat aktivitas.');
    } finally {
      setMengunduh(false);
    }
  }

  const perHari = useMemo(() => {
    const out = [];
    for (const x of items) {
      const k = kunciHari(x.waktu);
      if (out[out.length - 1]?.key !== k) out.push({ key: k, list: [] });
      out[out.length - 1].list.push(x);
    }
    return out;
  }, [items]);
  const adaFilter = FILTER_KEYS.some((k) => filter[k]);
  const refAktif = filter.ref && items.find((x) => String(x.ref_id) === filter.ref && x.modul === filter.modul);
  const aksiHapus = FILTER_AKSI[4].value;

  if (user && !isAdmin) return <Navigate to="/dashboard" replace />;

  const inputCls = 'h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-dinas focus:ring-2 focus:ring-dinas/15';
  return (
    <div className="menu-page menu-riwayat relative">
      <div className="menu-hero mb-6">
        <div>
          <span className="menu-kicker">Biro Umum / Riwayat Aktivitas</span>
          <h1 className="text-2xl font-bold">Riwayat Aktivitas</h1>
          <p className="text-sm mt-1">Siapa menambah, mengubah, menghapus, atau membatalkan data di semua modul, kapan, dan apa yang berubah. Riwayat tidak bisa diubah atau dihapus.</p>
        </div>
        <div className="menu-hero-icon"><span className="material-symbols-outlined">history</span></div>
      </div>

      <MenuStats items={[
        { key: 'hari', icon: 'today', label: 'Aktivitas hari ini', value: ringkasan?.hari_ini ?? null, hint: 'Semua modul', tone: 'dinas' },
        { key: 'minggu', icon: 'date_range', label: '7 hari terakhir', value: ringkasan?.tujuh_hari ?? null, hint: `${ringkasan?.pelaku_7_hari ?? '–'} orang beraktivitas`, tone: 'emerald' },
        { key: 'hapus', icon: 'delete_sweep', label: 'Hapus & batal (30 hari)', value: ringkasan?.hapus_batal_30_hari ?? null, hint: 'Klik untuk melihat', tone: 'red',
          active: filter.aksi === aksiHapus, onClick: () => setFilter({ aksi: filter.aksi === aksiHapus ? '' : aksiHapus }) },
        { key: 'hasil', icon: 'filter_list', label: adaFilter ? 'Hasil filter' : 'Total riwayat', value: loading ? null : total, hint: adaFilter ? 'Sesuai filter di bawah' : 'Sejak fitur ini aktif', tone: 'amber' },
      ]} />

      {/* Filter */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-5 shadow-sm">
        <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="group" aria-label="Pilih modul">
          {[['', 'Semua modul', 'apps'], ...Object.entries(MODUL).map(([k, m]) => [k, m.label, m.icon])].map(([k, label, icon]) => (
            <button key={k || 'semua'} type="button" onClick={() => setFilter({ modul: k })} aria-pressed={filter.modul === k}
              className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${filter.modul === k ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}>
              <span className="material-symbols-outlined text-[16px]">{icon}</span>{label}
            </button>
          ))}
        </div>
        <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_auto_auto] gap-2.5 items-end">
          <label className="block"><span className="block text-[11px] font-semibold text-slate-500 mb-1">Cari</span>
            <span className="relative block">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-slate-400">search</span>
              <input type="search" value={cari} onChange={(e) => setCari(e.target.value)} maxLength={150} placeholder="Kode, nama data, nomor polisi, nama pelaku…" className={`${inputCls} w-full pl-9`} />
            </span>
          </label>
          <label className="block"><span className="block text-[11px] font-semibold text-slate-500 mb-1">Jenis aksi</span>
            <select value={filter.aksi} onChange={(e) => setFilter({ aksi: e.target.value })} className={`${inputCls} w-full`}>
              <option value="">Semua aksi</option>
              {FILTER_AKSI.map((a) => <option key={a.label} value={a.value}>{a.label}</option>)}
              {filter.aksi && !FILTER_AKSI.some((a) => a.value === filter.aksi) && <option value={filter.aksi}>{AKSI[filter.aksi]?.label || filter.aksi}</option>}
            </select>
          </label>
          <label className="block"><span className="block text-[11px] font-semibold text-slate-500 mb-1">Pelaku</span>
            <select value={filter.aktor} onChange={(e) => setFilter({ aktor: e.target.value })} className={`${inputCls} w-full`}>
              <option value="">Semua orang</option>
              <option value="tamu">Semua tamu Google</option>
              {aktor.map((a) => <option key={a.key} value={a.key}>{a.nama || a.email || 'Tanpa nama'}{a.tipe === 'tamu' ? ' (tamu)' : ''} · {a.jumlah}</option>)}
            </select>
          </label>
          <div className="flex items-end gap-2">
            <label className="block"><span className="block text-[11px] font-semibold text-slate-500 mb-1">Dari</span>
              <input type="date" value={filter.dari} max={filter.sampai || undefined} onChange={(e) => setFilter({ dari: e.target.value })} className={inputCls} /></label>
            <label className="block"><span className="block text-[11px] font-semibold text-slate-500 mb-1">Sampai</span>
              <input type="date" value={filter.sampai} min={filter.dari || undefined} onChange={(e) => setFilter({ sampai: e.target.value })} className={inputCls} /></label>
          </div>
          <div className="flex items-end gap-2">
            {adaFilter && (
              <button type="button" onClick={() => setParams({}, { replace: true })} className="h-10 px-3 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 inline-flex items-center gap-1">
                <span className="material-symbols-outlined text-[16px]">filter_alt_off</span>Reset
              </button>
            )}
            <button type="button" onClick={unduh} disabled={mengunduh || !total} title="Unduh riwayat sesuai filter (maks. 20.000 baris)"
              className="h-10 px-3 rounded-lg bg-dinas text-white text-xs font-semibold hover:bg-dinas-dark disabled:opacity-50 inline-flex items-center gap-1 whitespace-nowrap">
              <span className="material-symbols-outlined text-[16px]">download</span>{mengunduh ? 'Mengunduh…' : 'Unduh CSV'}
            </button>
          </div>
        </div>
        {filter.ref && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-dinas-soft text-dinas text-xs font-semibold">
            <span className="material-symbols-outlined text-[16px]">history</span>
            Riwayat satu data: {MODUL[filter.modul]?.label} {refAktif ? `· ${refAktif.ref_kode || ''} ${refAktif.ref_label || ''}` : `#${filter.ref}`}
            <button type="button" onClick={() => setFilter({ ref: '' })} aria-label="Hapus filter data" className="ml-1 hover:text-red-600"><span className="material-symbols-outlined text-[16px]">close</span></button>
          </div>
        )}
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

      {loading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-2xl bg-white border border-slate-200 animate-pulse"></div>)}</div>
      ) : !items.length ? (
        <div className="bg-white border border-slate-200 rounded-2xl py-14 text-center">
          <span className="material-symbols-outlined text-[40px] text-slate-300">history</span>
          <p className="mt-2 text-sm font-semibold text-slate-600">{adaFilter ? 'Tidak ada riwayat yang cocok dengan filter.' : 'Belum ada aktivitas tercatat.'}</p>
          <p className="text-xs text-slate-400 mt-1">Riwayat mulai tercatat sejak fitur ini dipasang.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {perHari.map((g) => (
            <section key={g.key}>
              <h2 className="sticky top-0 z-10 -mx-1 px-1 py-2 bg-[var(--kanvas,#f3f4f7)]/95 backdrop-blur text-xs font-bold uppercase tracking-wider text-slate-500">{judulHari(g.key)} <span className="font-semibold normal-case tracking-normal text-slate-400">· {g.list.length} aktivitas</span></h2>
              <ol className="relative ml-3 border-l-2 border-slate-200 space-y-3">
                {g.list.map((x) => <ItemRiwayat key={x.id} x={x} onRef={() => setFilter({ modul: x.modul, ref: String(x.ref_id) })} onAktor={() => setFilter({ aktor: `${x.aktor_tipe}${x.aktor_id ? `:${x.aktor_id}` : ''}` })} />)}
              </ol>
            </section>
          ))}
          <div className="text-center text-xs text-slate-500">
            {items.length < total ? (
              <button type="button" onClick={loadMore} disabled={loadingMore} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                {loadingMore ? 'Memuat…' : `Muat lebih banyak (${items.length} dari ${total})`}
              </button>
            ) : `Menampilkan semua ${total} aktivitas.`}
          </div>
        </div>
      )}
    </div>
  );
}

// Satu kejadian di garis waktu.
function ItemRiwayat({ x, onRef, onAktor }) {
  const [buka, setBuka] = useState(false);
  const aksi = AKSI[x.aksi] || { label: x.aksi, cls: 'bg-slate-50 text-slate-700 border-slate-200', icon: 'info' };
  const modul = MODUL[x.modul] || { label: x.modul, icon: 'apps' };
  const list = Array.isArray(x.perubahan) ? x.perubahan : [];
  const diff = list.filter((p) => 'dari' in p && 'ke' in p);
  const isi = list.filter((p) => !('dari' in p && 'ke' in p));
  const tamu = x.aktor_tipe === 'tamu';
  return (
    <li className="relative pl-6">
      <span className={`absolute -left-[11px] top-4 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow ${aksi.cls.split(' ')[0]}`} aria-hidden="true">
        <span className={`material-symbols-outlined text-[12px] ${aksi.cls.split(' ')[1]}`}>{aksi.icon}</span>
      </span>
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <span className="font-mono text-xs font-semibold text-slate-500 tabular-nums">{jam(x.waktu)}</span>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${aksi.cls}`}>{aksi.label}</span>
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold"><span className="material-symbols-outlined text-[14px]">{modul.icon}</span>{modul.label}</span>
          <span className="min-w-0 text-sm font-semibold text-slate-800">
            {x.ref_kode && <span className="font-mono text-dinas">{x.ref_kode}</span>}{x.ref_kode && x.ref_label && ' · '}{x.ref_label}
          </span>
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-500">
          <span className="material-symbols-outlined text-[15px]">{tamu ? 'travel_explore' : 'person'}</span>
          <button type="button" onClick={onAktor} className="font-semibold text-slate-700 hover:text-dinas hover:underline" title="Tampilkan semua aktivitas orang ini">{x.aktor_nama || x.aktor_email || 'Tanpa nama'}</button>
          {x.aktor_role && <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${tamu ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'}`}>{ROLE[x.aktor_role] || x.aktor_role}</span>}
          {x.aktor_email && <span className="text-slate-400">· {x.aktor_email}</span>}
        </div>

        {diff.length > 0 && (
          <ul className="mt-3 space-y-1">
            {diff.map((p, i) => (
              <li key={i} className="text-xs flex flex-wrap items-baseline gap-x-1.5">
                <span className="font-semibold text-slate-600">{p.label}:</span>
                <span className={p.dari == null ? 'italic text-slate-400' : 'text-red-700 line-through decoration-red-300'}>{p.dari ?? '(kosong)'}</span>
                <span className="material-symbols-outlined text-[14px] text-slate-400 self-center" aria-label="menjadi">arrow_forward</span>
                <span className={p.ke == null ? 'italic text-slate-400' : 'font-semibold text-emerald-700'}>{p.ke ?? '(kosong)'}</span>
              </li>
            ))}
          </ul>
        )}
        {x.keterangan && <p className="mt-2 text-xs text-slate-600 bg-slate-50 rounded-lg px-3 py-2">{x.keterangan}</p>}
        {isi.length > 0 && (
          <div className="mt-2">
            <button type="button" onClick={() => setBuka((b) => !b)} aria-expanded={buka} className="inline-flex items-center gap-1 text-xs font-semibold text-dinas hover:underline">
              <span className={`material-symbols-outlined text-[16px] transition ${buka ? 'rotate-90' : ''}`}>chevron_right</span>
              {buka ? 'Sembunyikan' : 'Lihat'} isi data {x.aksi.includes('hapus') ? 'yang dihapus' : 'saat dibuat'} ({isi.length} kolom)
            </button>
            {buka && (
              <dl className="mt-2 grid sm:grid-cols-2 gap-x-6 gap-y-1 text-xs bg-slate-50 rounded-lg px-3 py-2">
                {isi.map((p, i) => (
                  <div key={i} className="flex gap-2 min-w-0"><dt className="shrink-0 text-slate-500">{p.label}</dt><dd className="min-w-0 font-semibold text-slate-700 break-words">{p.ke ?? p.dari}</dd></div>
                ))}
              </dl>
            )}
          </div>
        )}

        <div className="mt-3 pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>{new Date(x.waktu).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'medium' })}{x.ip && ` · IP ${x.ip}`}</span>
          {x.ref_id != null && <button type="button" onClick={onRef} className="font-semibold text-dinas hover:underline inline-flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">history</span>Riwayat data ini</button>}
        </div>
      </div>
    </li>
  );
}
