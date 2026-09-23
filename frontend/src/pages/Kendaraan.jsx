import React, { useEffect, useMemo, useState } from 'react';
import api from '../api';
import { verifyFileIsGenuine } from '../utils/fileSignature';
import { compressImage } from '../utils/imageCompress';

const JENIS_OPTIONS = ['Roda 2', 'Roda 4', 'Roda 6'];
const STATUS_OPTIONS = ['Tersedia', 'Digunakan', 'Servis'];
const pill = { Tersedia: 'bg-blue-100 text-slate-700', Digunakan: 'bg-slate-200 text-slate-700', Servis: 'bg-red-100 text-red-700' };
const MAX_PHOTOS = 6;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const emptyForm = { nama_barang: '', merk: '', tipe: '', no_bpkb: '', plate: '', plat_khusus: '', jenis: 'Roda 4', sub: '', status: 'Tersedia', tanggal_perolehan: '', masa_berlaku_stnk: '', waktu_pajak: '', photos: [] };
const fmtDate = (v) => v ? new Date(`${v}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-';

export default function Kendaraan() {
  const [tab, setTab] = useState('Roda 4');
  const [show, setShow] = useState(false);
  const [detail, setDetail] = useState(null);
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');
  const [filterMerek, setFilterMerek] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTahun, setFilterTahun] = useState('');
  const [openFilter, setOpenFilter] = useState(null);

  async function load() {
    try {
      setLoading(true);
      const r = await api.get('/kendaraan');
      setData(r.data.data || []);
      setError('');
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal memuat data kendaraan.');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function save(e) {
    e.preventDefault();
    setError('');
    try {
      await api.post('/kendaraan', form);
      setShow(false);
      setForm(emptyForm);
      await load();
    } catch (e) {
      setError(e.response?.data?.message || 'Gagal menyimpan kendaraan.');
    }
  }

  async function addPhotos(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    const room = MAX_PHOTOS - form.photos.length;
    if (room <= 0) { setError(`Maksimal ${MAX_PHOTOS} foto per kendaraan.`); return; }
    const toProcess = files.slice(0, room);
    if (files.length > room) setError(`Hanya ${room} foto pertama yang ditambahkan (maksimal ${MAX_PHOTOS} foto).`);
    for (const file of toProcess) {
      if (!ALLOWED_TYPES.includes(file.type)) { setError('Foto harus JPG, PNG, atau WebP.'); continue; }
      if (!(await verifyFileIsGenuine(file))) { setError(`File "${file.name}" bukan gambar asli, ditolak.`); continue; }
      try {
        const compressed = await compressImage(file);
        setForm((f) => (f.photos.length >= MAX_PHOTOS ? f : { ...f, photos: [...f.photos, { name: file.name, data: compressed }] }));
      } catch {
        setError(`Gagal memproses foto "${file.name}".`);
      }
    }
  }
  function removePhoto(idx) {
    setForm((f) => ({ ...f, photos: f.photos.filter((_, i) => i !== idx) }));
  }

  function selectTab(x) {
    setTab(x);
    setFilterMerek('');
    setFilterStatus('');
    setFilterTahun('');
    setOpenFilter(null);
  }
  function resetFilters() {
    setSearch('');
    setFilterMerek('');
    setFilterStatus('');
    setFilterTahun('');
  }

  const byJenis = useMemo(() => data.filter((x) => x.jenis === tab), [data, tab]);

  const merekOptions = useMemo(() => {
    const counts = {};
    byJenis.forEach((x) => { const m = x.merk || 'Lainnya'; counts[m] = (counts[m] || 0) + 1; });
    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [byJenis]);

  const statusCounts = useMemo(() => {
    const counts = {};
    byJenis.forEach((x) => { counts[x.status] = (counts[x.status] || 0) + 1; });
    return counts;
  }, [byJenis]);

  const tahunOptions = useMemo(() => {
    const counts = {};
    byJenis.forEach((x) => { if (x.tanggal_perolehan) { const y = x.tanggal_perolehan.slice(0, 4); counts[y] = (counts[y] || 0) + 1; } });
    return Object.entries(counts).sort((a, b) => b[0].localeCompare(a[0]));
  }, [byJenis]);

  const filtered = useMemo(() => byJenis.filter((x) => {
    const q = search.trim().toLowerCase();
    const searchMatch = !q || [x.nama_barang, x.merk, x.tipe, x.plate, x.plat_khusus, x.no_bpkb].some((v) => String(v || '').toLowerCase().includes(q));
    const merekMatch = !filterMerek || (x.merk || 'Lainnya') === filterMerek;
    const statusMatch = !filterStatus || x.status === filterStatus;
    const tahunMatch = !filterTahun || (x.tanggal_perolehan || '').slice(0, 4) === filterTahun;
    return searchMatch && merekMatch && statusMatch && tahunMatch;
  }), [byJenis, search, filterMerek, filterStatus, filterTahun]);

  const activeFilterCount = [filterMerek, filterStatus, filterTahun, search].filter(Boolean).length;

  return (
    <div className="menu-page menu-kendaraan relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="menu-hero mb-6"><div><span className="menu-kicker">ARMADA • ASSET</span><h1 className="text-3xl font-bold">Kendaraan Dinas</h1><p className="text-sm mt-1">Kelola asset kendaraan, status operasional, dan dokumentasi foto kendaraan.</p></div><div className="menu-hero-icon"><span className="material-symbols-outlined">directions_car</span></div></div>
      <div className="flex items-end justify-between gap-4 mb-5"><div></div>
        <button onClick={() => { setError(''); setForm(emptyForm); setShow(true); }} className="bg-slate-900 text-white rounded-lg px-4 py-2.5 text-xs font-semibold shadow-sm">＋ Tambah Kendaraan</button>
      </div>
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

      {/* Search bar */}
      <div className="relative mb-3">
        <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-[20px]">search</span>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari kendaraan menurut merek, tipe, nama barang, atau nomor polisi..." className="w-full h-12 pl-11 pr-4 rounded-xl border border-slate-300 bg-white text-sm outline-none focus:border-slate-900 shadow-sm" />
      </div>

      {/* Filter pills */}
      {openFilter && <div className="fixed inset-0 z-10" onClick={() => setOpenFilter(null)}></div>}
      <div className="relative z-20 flex flex-wrap items-center gap-2 mb-5">
        <FilterPill label="Merek" selectedLabel={filterMerek} open={openFilter === 'merek'} onToggle={() => setOpenFilter((o) => (o === 'merek' ? null : 'merek'))}>
          {merekOptions.length ? merekOptions.map(([m, c]) => (
            <FilterOption key={m} label={m} count={c} selected={filterMerek === m} onClick={() => { setFilterMerek(filterMerek === m ? '' : m); setOpenFilter(null); }} />
          )) : <div className="px-3 py-2 text-xs text-slate-400">Belum ada data merek</div>}
        </FilterPill>
        <FilterPill label="Status" selectedLabel={filterStatus} open={openFilter === 'status'} onToggle={() => setOpenFilter((o) => (o === 'status' ? null : 'status'))}>
          {STATUS_OPTIONS.map((s) => (
            <FilterOption key={s} label={s} count={statusCounts[s] || 0} selected={filterStatus === s} onClick={() => { setFilterStatus(filterStatus === s ? '' : s); setOpenFilter(null); }} />
          ))}
        </FilterPill>
        <FilterPill label="Tahun Perolehan" selectedLabel={filterTahun} open={openFilter === 'tahun'} onToggle={() => setOpenFilter((o) => (o === 'tahun' ? null : 'tahun'))}>
          {tahunOptions.length ? tahunOptions.map(([y, c]) => (
            <FilterOption key={y} label={y} count={c} selected={filterTahun === y} onClick={() => { setFilterTahun(filterTahun === y ? '' : y); setOpenFilter(null); }} />
          )) : <div className="px-3 py-2 text-xs text-slate-400">Belum ada data tanggal perolehan</div>}
        </FilterPill>
        {activeFilterCount > 0 && <button type="button" onClick={resetFilters} className="text-xs font-semibold text-red-600 hover:underline px-2">Reset Filter</button>}
      </div>

      <section className="bg-white border border-slate-300 rounded-xl overflow-hidden shadow-sm">
        <div className="p-4 border-b flex justify-between">
          <div className="flex border rounded-lg overflow-hidden">
            {JENIS_OPTIONS.map((x) => <button key={x} onClick={() => selectTab(x)} className={`px-4 py-2 text-xs ${tab === x ? 'bg-slate-900 text-white font-semibold' : ''}`}>{x}</button>)}
          </div>
          <div className="text-xs text-slate-500 self-center">{filtered.length} kendaraan</div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr className="divide-x divide-slate-200">
                {['Foto', 'Nama Barang', 'Merk', 'Tipe', 'No BPKB', 'No Polisi / Khusus', 'Status', 'Tanggal Perolehan', 'Masa Berlaku STNK', 'Waktu Pajak', 'Aksi'].map((h) => <th key={h} className="text-left px-4 py-3 font-medium uppercase text-slate-600 whitespace-nowrap">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Memuat kendaraan...</td></tr>
                : filtered.length === 0 ? <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Belum ada kendaraan pada kategori ini.</td></tr>
                : filtered.map((x) => (
                  <tr key={x.id} className="divide-x divide-slate-100 hover:bg-slate-50/50">
                    <td className="px-4 py-3">
                      {x.photos?.[0]?.data
                        ? <img src={x.photos[0].data} alt={x.nama_barang} className="h-14 w-20 rounded-lg object-cover border" />
                        : <div className="h-14 w-20 rounded-lg border bg-slate-100 flex items-center justify-center text-[9px] text-slate-400">No Foto</div>}
                    </td>
                    <td className="px-4 py-4 font-semibold">{x.nama_barang}{x.sub && <div className="font-normal text-[10px] text-slate-500">{x.sub}</div>}</td>
                    <td className="px-4">{x.merk}</td>
                    <td className="px-4">{x.tipe}</td>
                    <td className="px-4">{x.no_bpkb || '-'}</td>
                    <td className="px-4 font-semibold">
                      <div>{x.plate}</div>
                      {x.plat_khusus && (
                        <div className="font-normal mt-0.5">
                          {x.plat_khusus}
                          <span className="ml-1.5 inline-flex px-1.5 py-0.5 rounded-full bg-fuchsia-100 text-fuchsia-700 text-[9px] font-bold align-middle">KHUSUS</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4"><span className={`px-3 py-1 rounded-full ${pill[x.status] || 'bg-slate-100'}`}>{x.status}</span></td>
                    <td className="px-4 whitespace-nowrap">{fmtDate(x.tanggal_perolehan)}</td>
                    <td className="px-4 whitespace-nowrap">{fmtDate(x.masa_berlaku_stnk)}</td>
                    <td className="px-4 whitespace-nowrap">{fmtDate(x.waktu_pajak)}</td>
                    <td className="px-4"><button type="button" onClick={() => setDetail(x)} className="detail-btn"><span className="material-symbols-outlined text-[16px]">visibility</span>Detail</button></td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>

      {show && <VehicleModal form={form} setForm={setForm} onClose={() => setShow(false)} onSubmit={save} onAddPhotos={addPhotos} onRemovePhoto={removePhoto} />}
      {detail && <VehicleDetail vehicle={detail} onClose={() => setDetail(null)} />}
    </div>
  );
}

function Field({ label, children, required }) {
  return <div><label className="block text-xs font-bold text-slate-700 mb-1.5">{label}{required && <span className="text-red-600"> *</span>}</label>{children}</div>;
}

// Filter pill ala "Merek & Model" Carsome: tombol yang buka panel dropdown
// berisi daftar pilihan lengkap dengan jumlah datanya.
function FilterPill({ label, selectedLabel, open, onToggle, children }) {
  const active = !!selectedLabel;
  return (
    <div className="relative">
      <button type="button" onClick={onToggle} className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border text-xs font-semibold transition whitespace-nowrap ${active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>
        {active ? `${label}: ${selectedLabel}` : label}
        <span className="material-symbols-outlined text-[16px]">{open ? 'expand_less' : 'expand_more'}</span>
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-2 w-60 max-h-72 overflow-y-auto bg-white border border-slate-200 rounded-xl shadow-xl p-2">
          {children}
        </div>
      )}
    </div>
  );
}
function FilterOption({ label, count, selected, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-left hover:bg-slate-50 ${selected ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700'}`}>
      <span>{label}</span>
      {count != null && <span className="text-xs text-slate-400 shrink-0">({count})</span>}
    </button>
  );
}

function VehicleModal({ form, setForm, onClose, onSubmit, onAddPhotos, onRemovePhoto }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-[#f7f9fb] rounded-2xl shadow-2xl">
        <div className="bg-white border-b px-6 py-5 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center"><span className="material-symbols-outlined">directions_car</span></div>
            <div><div className="font-bold text-slate-900">Tambah Kendaraan</div><div className="text-[11px] text-slate-500">Data asset kendaraan mengikuti format BMN</div></div>
          </div>
          <button onClick={onClose} className="w-9 h-9 rounded-lg hover:bg-slate-100 text-slate-500"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={onSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Nama Barang" required><input required value={form.nama_barang} onChange={(e) => setForm({ ...form, nama_barang: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Contoh: Kendaraan Roda Empat" /></Field>
            <Field label="Merk" required><input required value={form.merk} onChange={(e) => setForm({ ...form, merk: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Toyota" /></Field>
            <Field label="Tipe" required><input required value={form.tipe} onChange={(e) => setForm({ ...form, tipe: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Innova / Avanza / Pick Up" /></Field>
            <Field label="No BPKB"><input value={form.no_bpkb} onChange={(e) => setForm({ ...form, no_bpkb: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Nomor BPKB (opsional)" /></Field>
            <Field label="No Polisi" required><input required value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="B 1234 XYZ" /></Field>
            <Field label="Plat Khusus"><input value={form.plat_khusus} onChange={(e) => setForm({ ...form, plat_khusus: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="Opsional -- kalau kendaraan juga punya plat khusus" /></Field>
            <Field label="Jenis Kendaraan" required><select value={form.jenis} onChange={(e) => setForm({ ...form, jenis: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900">{JENIS_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Status"><select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900">{STATUS_OPTIONS.map((x) => <option key={x}>{x}</option>)}</select></Field>
            <Field label="Keterangan"><input value={form.sub} onChange={(e) => setForm({ ...form, sub: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" placeholder="VIP / Operasional / Lapangan" /></Field>
            <Field label="Tanggal Perolehan"><input type="date" value={form.tanggal_perolehan} onChange={(e) => setForm({ ...form, tanggal_perolehan: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" /></Field>
            <Field label="Masa Berlaku STNK"><input type="date" value={form.masa_berlaku_stnk} onChange={(e) => setForm({ ...form, masa_berlaku_stnk: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" /></Field>
            <Field label="Waktu Pajak"><input type="date" value={form.waktu_pajak} onChange={(e) => setForm({ ...form, waktu_pajak: e.target.value })} className="w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-slate-900" /></Field>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3 mb-2">
              <label className="block text-xs font-bold text-slate-700">Foto Kendaraan</label>
              <span className="text-[11px] text-slate-500">{form.photos.length}/{MAX_PHOTOS} foto · otomatis dikompres</span>
            </div>
            {form.photos.length < MAX_PHOTOS && (
              <label className="relative flex items-center gap-4 p-5 rounded-xl border border-dashed border-slate-300 bg-white cursor-pointer hover:bg-slate-50">
                <span className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center"><span className="material-symbols-outlined text-slate-600">add_a_photo</span></span>
                <div className="min-w-0 flex-1"><div className="text-sm font-semibold">Pilih hingga {MAX_PHOTOS - form.photos.length} foto lagi</div><div className="text-xs text-slate-500 mt-1">JPG, PNG, WebP · dikompres otomatis sebelum diupload</div></div>
                <input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer" accept="image/jpeg,image/png,image/webp" onChange={(e) => { onAddPhotos(e.target.files); e.target.value = ''; }} />
              </label>
            )}
            {form.photos.length > 0 && (
              <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
                {form.photos.map((p, i) => (
                  <div key={`${p.name}-${i}`} className="relative group">
                    <img src={p.data} alt={p.name} className="h-20 w-full object-cover rounded-lg border" />
                    <button type="button" onClick={() => onRemovePhoto(i)} className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-red-600 text-white text-xs flex items-center justify-center shadow">✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2.5 rounded-lg border bg-white text-sm font-semibold">Batal</button>
            <button className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold">Simpan Kendaraan</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VehicleDetail({ vehicle, onClose }) {
  const rows = [
    ['ID Kendaraan', vehicle.id ? `#${vehicle.id}` : '-'],
    ['Nama Barang', vehicle.nama_barang || '-'],
    ['Merk', vehicle.merk || '-'],
    ['Tipe', vehicle.tipe || '-'],
    ['No BPKB', vehicle.no_bpkb || '-'],
    ['No Polisi', vehicle.plate || '-'],
    ['Plat Khusus', vehicle.plat_khusus || '-'],
    ['Jenis', vehicle.jenis || '-'],
    ['Keterangan', vehicle.sub || '-'],
    ['Status', vehicle.status || '-'],
    ['Tanggal Perolehan', fmtDate(vehicle.tanggal_perolehan)],
    ['Masa Berlaku STNK', fmtDate(vehicle.masa_berlaku_stnk)],
    ['Waktu Pajak', fmtDate(vehicle.waktu_pajak)],
    ['Dibuat Pada', vehicle.created_at ? new Date(vehicle.created_at).toLocaleString('id-ID') : '-'],
    ['Diperbarui Pada', vehicle.updated_at ? new Date(vehicle.updated_at).toLocaleString('id-ID') : '-'],
  ];
  const photos = vehicle.photos || [];
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vehicle-detail-modal w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-3xl shadow-2xl">
        <div className="vehicle-detail-head">
          <div className="flex items-center gap-4">
            <div className="vehicle-detail-icon"><span className="material-symbols-outlined">directions_car</span></div>
            <div>
              <div className="text-xs font-bold uppercase tracking-[.16em] opacity-80">Detail Asset Kendaraan</div>
              <h2 className="text-2xl font-bold mt-1">{vehicle.nama_barang || 'Kendaraan'}</h2>
              <p className="text-sm opacity-80 mt-1">{vehicle.plate || '-'}{vehicle.plat_khusus && ` / ${vehicle.plat_khusus}`} · {vehicle.merk} {vehicle.tipe}</p>
            </div>
          </div>
          <button onClick={onClose} className="vehicle-close"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Foto Kendaraan ({photos.length})</div>
            {photos.length ? (
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {photos.map((p, i) => <img key={`${p.name}-${i}`} src={p.data} alt={p.name} className="h-24 w-full object-cover rounded-xl border border-slate-200" />)}
              </div>
            ) : (
              <div className="w-full h-40 rounded-2xl bg-slate-100 border border-slate-200 flex flex-col items-center justify-center text-slate-400">
                <span className="material-symbols-outlined text-5xl">directions_car</span>
                <span className="text-xs mt-2">Belum ada foto</span>
              </div>
            )}
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {rows.map(([label, value]) => <div key={label} className="detail-field"><div className="detail-label">{label}</div><div className="detail-value">{value}</div></div>)}
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-200 flex justify-end"><button onClick={onClose} className="px-5 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold">Tutup</button></div>
      </div>
    </div>
  );
}
