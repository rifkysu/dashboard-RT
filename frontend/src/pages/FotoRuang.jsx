import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { useFeedback } from '../components/Feedback';
import useRuangInfo from '../hooks/useRuangInfo';
import { prosesFoto } from '../utils/prosesFoto';
import { RUANG, judulRuang, slugRuang } from '../utils/ruang';

// Menu Admin/Kabag: kelola foto (slideshow) & fasilitas tiap ruang rapat yang tampil di layar
// ruangan /ruang/:slug. Perubahan langsung terlihat di layar ruangan (live).
const MAX_FOTO = 12;               // sama dengan backend/src/routes/ruangInfo.js
const MAX_FASILITAS = 16;
const MAX_FILE_ASLI = 25 * 1024 * 1024;

const PRESET = [
  { icon: 'mic', label: 'Mikrofon konferensi' },
  { icon: 'desktop_windows', label: 'Monitor tiap kursi' },
  { icon: 'videocam', label: 'Kamera video conference' },
  { icon: 'tv', label: 'Layar TV presentasi' },
  { icon: 'co_present', label: 'Proyektor' },
  { icon: 'speaker', label: 'Sound system' },
  { icon: 'ac_unit', label: 'AC sentral' },
  { icon: 'wifi', label: 'Wi-Fi' },
  { icon: 'power', label: 'Stop kontak' },
  { icon: 'table_restaurant', label: 'Meja rapat panjang' },
  { icon: 'theater_comedy', label: 'Panggung & backdrop' },
  { icon: 'podium', label: 'Podium' },
  { icon: 'edit_note', label: 'Whiteboard' },
  { icon: 'wb_sunny', label: 'Cahaya alami' },
  { icon: 'groups', label: 'Kapasitas besar' },
  { icon: 'local_cafe', label: 'Area coffee break' },
];
const IKON = ['check_circle', 'mic', 'desktop_windows', 'videocam', 'tv', 'co_present', 'speaker', 'ac_unit', 'wifi', 'power',
  'table_restaurant', 'chair', 'theater_comedy', 'podium', 'edit_note', 'light', 'wb_sunny', 'groups', 'local_cafe', 'wc', 'accessible', 'local_parking'];

const samaFasilitas = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function FotoRuang() {
  const { user, isAdmin } = useAuth();
  const { info, error, loaded, reload } = useRuangInfo();
  const [room, setRoom] = useState(RUANG[0]);
  const [mencoba, setMencoba] = useState(false);
  // Belum pernah berhasil dimuat (gagal sejak awal): jangan tampilkan ruangan seolah kosong & bisa diisi.
  const gagalMuat = error && !loaded;
  const memuat = !loaded;

  if (user && !isAdmin) return <Navigate to="/dashboard" replace />;

  const data = info?.[room] || { foto: [], fasilitas: [] };

  return (
    <div className="menu-page max-w-6xl mx-auto">
      <div className="menu-hero mb-6">
        <div>
          <span className="menu-kicker">Biro Umum / Foto & Fasilitas Ruang</span>
          <h1 className="text-3xl font-bold">Foto & Fasilitas Ruang</h1>
          <p className="text-sm mt-1">Atur foto slideshow dan daftar fasilitas yang tampil di layar depan tiap ruang rapat. Perubahan langsung muncul di layar ruangan.</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex flex-wrap items-center justify-between gap-3">
          <span>{gagalMuat
            ? 'Gagal memuat data foto ruangan, jadi foto & fasilitas belum bisa diubah. Periksa koneksi lalu coba lagi.'
            : 'Gagal memperbarui data foto ruangan. Yang tampil mungkin bukan data terbaru.'}</span>
          <button type="button" disabled={mencoba} onClick={async () => { setMencoba(true); await reload(); setMencoba(false); }}
            className="px-3 py-1.5 rounded-lg border border-red-300 bg-white text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50">
            {mencoba ? 'Memuat…' : 'Coba lagi'}
          </button>
        </div>
      )}

      {/* Pilih ruangan */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="tablist" aria-label="Pilih ruangan">
        {RUANG.map((r) => {
          const d = info?.[r];
          const aktif = r === room;
          const sampul = d?.foto?.[0];
          return (
            <button key={r} type="button" role="tab" aria-selected={aktif} onClick={() => setRoom(r)}
              className={`group text-left rounded-2xl border overflow-hidden transition ${aktif ? 'border-dinas ring-2 ring-dinas/20 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
              <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
                {sampul
                  ? <img src={sampul.src} alt="" className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
                  : <span className="absolute inset-0 flex flex-col items-center justify-center text-slate-400"><span className="material-symbols-outlined text-[28px]">add_photo_alternate</span><span className="text-[11px] font-semibold mt-0.5">Belum ada foto</span></span>}
                {aktif && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-dinas text-white flex items-center justify-center shadow"><span className="material-symbols-outlined text-[16px]">check</span></span>}
              </div>
              <div className="px-3 py-2.5">
                <div className="font-bold text-sm text-slate-900 truncate">{judulRuang(r)}</div>
                <div className="text-[11px] text-slate-500">{loaded ? `${d?.foto?.length || 0} foto · ${d?.fasilitas?.length || 0} fasilitas` : gagalMuat ? 'Gagal dimuat' : 'Memuat…'}</div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold">{judulRuang(room)}</h2>
        <a href={`/ruang/${slugRuang(room)}`} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-dinas hover:border-dinas">
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>Lihat layar ruangan
        </a>
      </div>

      <div className="mt-3 grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
        <FotoPanel key={`foto-${room}`} room={room} foto={data.foto} memuat={memuat} gagalMuat={gagalMuat} reload={reload} />
        <FasilitasPanel key={`fas-${room}`} room={room} fasilitas={data.fasilitas} adaFoto={data.foto.length > 0} memuat={memuat} reload={reload} />
      </div>
    </div>
  );
}

function FotoPanel({ room, foto, memuat, gagalMuat, reload }) {
  const { confirm, toast, alert } = useFeedback();
  const [urutan, setUrutan] = useState(null); // urutan sementara saat menyimpan (optimistis)
  const [captions, setCaptions] = useState({});
  const [busy, setBusy] = useState(null);
  const [pilihan, setPilihan] = useState(null); // file yang dipilih -> dialog upload
  const inputRef = useRef(null);
  const [seret, setSeret] = useState(false);

  const list = useMemo(() => {
    if (!urutan) return foto;
    const byId = new Map(foto.map((f) => [f.id, f]));
    const ok = urutan.length === foto.length && urutan.every((id) => byId.has(id));
    return ok ? urutan.map((id) => byId.get(id)) : foto;
  }, [foto, urutan]);
  const sisa = MAX_FOTO - foto.length;

  function pilihFile(files) {
    const arr = [...(files || [])].filter((f) => f.type.startsWith('image/'));
    if (!arr.length) { if (files?.length) alert({ title: 'Bukan foto', message: 'Pilih file gambar (JPG, PNG, atau WEBP).', tone: 'warning' }); return; }
    if (sisa <= 0) { alert({ title: 'Foto sudah penuh', message: `Maksimal ${MAX_FOTO} foto per ruangan. Hapus foto lama dulu.`, tone: 'warning' }); return; }
    const besar = arr.filter((f) => f.size > MAX_FILE_ASLI);
    const ok = arr.filter((f) => f.size <= MAX_FILE_ASLI);
    if (besar.length) alert({ title: 'Sebagian file dilewati', message: `${besar.length} file lebih dari 25 MB.`, tone: 'warning' });
    if (ok.length > sisa) alert({ title: 'Sebagian foto tidak dipakai', message: `Ruangan ini hanya bisa menampung ${sisa} foto lagi (maks. ${MAX_FOTO}).`, tone: 'warning' });
    if (ok.length) setPilihan(ok.slice(0, sisa));
  }

  async function simpanUrutan(ids) {
    setUrutan(ids);
    try {
      await api.put('/ruang-info/urutan', { room, ids });
      await reload();
    } catch (e) {
      alert({ title: 'Gagal menyimpan urutan', message: e.response?.data?.message || 'Coba lagi.', tone: 'error' });
      reload();
    } finally { setUrutan(null); }
  }
  const geser = (i, d) => {
    const ids = list.map((f) => f.id);
    const j = i + d;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    simpanUrutan(ids);
  };
  const jadikanSampul = (i) => { const ids = list.map((f) => f.id); ids.unshift(ids.splice(i, 1)[0]); simpanUrutan(ids); };

  async function simpanCaption(f) {
    const v = (captions[f.id] ?? f.caption).trim();
    if (v === f.caption) return;
    setBusy(f.id);
    try {
      await api.put(`/ruang-info/foto/${f.id}`, { caption: v });
      await reload();
      setCaptions((c) => { const n = { ...c }; delete n[f.id]; return n; });
      toast('Keterangan foto disimpan.');
    } catch (e) {
      alert({ title: 'Gagal menyimpan', message: e.response?.data?.message || 'Coba lagi.', tone: 'error' });
    } finally { setBusy(null); }
  }

  async function hapus(f) {
    if (!(await confirm({ title: 'Hapus foto ini?', message: 'Foto langsung hilang dari slideshow layar ruangan dan tidak bisa dikembalikan.', confirmText: 'Ya, Hapus', tone: 'danger', icon: 'delete' }))) return;
    setBusy(f.id);
    try {
      await api.delete(`/ruang-info/foto/${f.id}`);
      await reload();
      toast('Foto dihapus.');
    } catch (e) {
      alert({ title: 'Gagal menghapus', message: e.response?.data?.message || 'Coba lagi.', tone: 'error' });
    } finally { setBusy(null); }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-xl bg-dinas-soft text-dinas flex items-center justify-center"><span className="material-symbols-outlined text-[22px]">photo_library</span></span>
          <div>
            <h3 className="font-bold leading-tight">Foto slideshow</h3>
            <p className="text-[11px] text-slate-500">{foto.length} dari {MAX_FOTO} foto · foto pertama jadi sampul</p>
          </div>
        </div>
        <button type="button" onClick={() => inputRef.current?.click()} disabled={sisa <= 0 || memuat}
          className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-dinas text-white text-sm font-bold hover:bg-dinas-dark disabled:opacity-50">
          <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>Tambah foto
        </button>
        <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => { pilihFile(e.target.files); e.target.value = ''; }} />
      </div>

      {memuat ? <div className="py-10 text-center text-sm text-slate-500">{gagalMuat ? 'Foto belum bisa dimuat.' : 'Memuat foto…'}</div> : (
        <div className="mt-4 grid sm:grid-cols-2 gap-4">
          {list.map((f, i) => {
            const draft = captions[f.id] ?? f.caption;
            return (
              <div key={f.id} className={`rounded-xl border overflow-hidden bg-slate-50 transition ${busy === f.id ? 'opacity-60' : ''} ${i === 0 ? 'border-kuningan/60 ring-1 ring-kuningan/30' : 'border-slate-200'}`}>
                <div className="relative aspect-[16/10] bg-slate-200 overflow-hidden group">
                  <img src={f.src} alt={f.caption} className="w-full h-full object-cover" />
                  <span className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/55 text-white text-[11px] font-bold tabular-nums">{i + 1}</span>
                  {i === 0 && <span className="absolute top-2 right-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-kuningan text-white text-[11px] font-bold"><span className="material-symbols-outlined text-[14px]">star</span>Sampul</span>}
                </div>
                <div className="p-3">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1" htmlFor={`cap-${f.id}`}>Keterangan foto</label>
                  <input id={`cap-${f.id}`} value={draft} maxLength={200} placeholder="mis. Meja rapat dengan mikrofon di tiap kursi"
                    onChange={(e) => setCaptions((c) => ({ ...c, [f.id]: e.target.value }))}
                    onBlur={() => simpanCaption(f)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-dinas focus:ring-2 focus:ring-dinas/15" />
                  <div className="mt-2.5 flex items-center gap-1.5">
                    <IconBtn icon="chevron_left" label="Geser ke kiri" onClick={() => geser(i, -1)} disabled={i === 0 || !!urutan} />
                    <IconBtn icon="chevron_right" label="Geser ke kanan" onClick={() => geser(i, 1)} disabled={i === list.length - 1 || !!urutan} />
                    {i > 0 && <button type="button" onClick={() => jadikanSampul(i)} disabled={!!urutan} className="h-8 px-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:border-kuningan hover:text-kuningan disabled:opacity-50 inline-flex items-center gap-1"><span className="material-symbols-outlined text-[15px]">star</span>Jadikan sampul</button>}
                    <button type="button" onMouseDown={(e) => e.preventDefault() /* jangan blur keterangan: simpan keterangan membuat tombol ini disabled sebelum klik terjadi */} onClick={() => hapus(f)} disabled={busy === f.id} className="ml-auto h-8 px-2.5 rounded-lg border border-red-200 bg-white text-xs font-semibold text-red-700 hover:bg-red-50 inline-flex items-center gap-1 disabled:opacity-50"><span className="material-symbols-outlined text-[15px]">delete</span>Hapus</button>
                  </div>
                </div>
              </div>
            );
          })}

          {sisa > 0 && (
            <button type="button" onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setSeret(true); }} onDragLeave={() => setSeret(false)}
              onDrop={(e) => { e.preventDefault(); setSeret(false); pilihFile(e.dataTransfer.files); }}
              className={`min-h-[14rem] rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center px-4 transition ${seret ? 'border-dinas bg-dinas-soft' : 'border-slate-300 hover:border-dinas hover:bg-slate-50'}`}>
              <span className="material-symbols-outlined text-[36px] text-dinas">cloud_upload</span>
              <span className="mt-1 font-bold text-sm text-slate-800">Klik atau seret foto ke sini</span>
              <span className="text-[11px] text-slate-500 mt-1 leading-relaxed">Bisa pilih beberapa sekaligus · JPG/PNG/WEBP<br />Foto mendatar (landscape) paling bagus di layar</span>
            </button>
          )}
        </div>
      )}
      {!memuat && !foto.length && <p className="mt-3 text-xs text-slate-500">Belum ada foto: layar ruangan tampil tanpa slideshow dan tanpa daftar fasilitas.</p>}

      {pilihan && <UploadDialog room={room} files={pilihan} reload={reload} onClose={() => setPilihan(null)} onDone={async (n) => { setPilihan(null); await reload(); toast(`${n} foto ditambahkan.`); }} />}
    </section>
  );
}

function IconBtn({ icon, label, ...rest }) {
  return (
    <button type="button" aria-label={label} title={label} {...rest}
      className="w-8 h-8 rounded-lg border border-slate-300 bg-white text-slate-700 inline-flex items-center justify-center hover:border-dinas hover:text-dinas disabled:opacity-40 disabled:hover:border-slate-300 disabled:hover:text-slate-700">
      <span className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>
  );
}

// Dialog sebelum upload: pratinjau, keterangan, dan potong bawah (watermark) per foto.
function UploadDialog({ room, files, reload, onClose, onDone }) {
  const { alert } = useFeedback();
  const [items, setItems] = useState(() => files.map((file, i) => ({ key: `${i}-${file.name}`, file, caption: '', potong: 0 })));
  const [proses, setProses] = useState(null); // { ke, total }
  // URL pratinjau dibuat & dilepas di effect yang sama (aman untuk StrictMode yang menjalankan effect dua kali).
  const [urls, setUrls] = useState({});
  useEffect(() => {
    const m = Object.fromEntries(files.map((file, i) => [`${i}-${file.name}`, URL.createObjectURL(file)]));
    setUrls(m);
    return () => Object.values(m).forEach((u) => URL.revokeObjectURL(u));
  }, [files]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !proses && !document.querySelector('[role="alertdialog"]')) onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [proses, onClose]);

  const ubah = (key, patch) => setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  const buang = (key) => { const n = items.filter((i) => i.key !== key); if (!n.length) onClose(); else setItems(n); };

  async function upload() {
    let berhasil = 0;
    for (const [i, it] of items.entries()) {
      setProses({ ke: i + 1, total: items.length });
      try {
        const file_data = await prosesFoto(it.file, { potongBawah: it.potong / 100 });
        await api.post('/ruang-info/foto', { room, caption: it.caption.trim(), file_data });
        berhasil += 1;
      } catch (e) {
        // Foto yang sudah terunggah dikeluarkan dari daftar; sisanya tetap di dialog agar bisa dicoba lagi
        // (sebelumnya semua foto setelah foto yang gagal ikut terbuang dan harus dipilih ulang).
        setProses(null);
        setItems(items.slice(i));
        if (berhasil) reload();
        alert({
          title: `Gagal mengunggah "${it.file.name}"`,
          message: `${e.response?.data?.message || 'Foto tidak bisa dibaca. Coba foto lain.'}${berhasil ? ` ${berhasil} foto sebelumnya sudah terunggah.` : ''} Foto yang belum terunggah masih ada di daftar: klik "Batal pilih" pada foto ini lalu upload lagi.`,
          tone: 'error',
        });
        return;
      }
    }
    onDone(berhasil);
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="upload-foto-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !proses) onClose(); }}>
      <div className="m-auto w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 id="upload-foto-title" className="font-bold text-lg">Tambah foto · {judulRuang(room)}</h3>
            <p className="text-xs text-slate-500">Isi keterangan, dan potong bagian bawah bila ada tulisan tanggal/alamat dari kamera.</p>
          </div>
          <button type="button" onClick={onClose} disabled={!!proses} aria-label="Tutup" className="w-9 h-9 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center disabled:opacity-50"><span className="material-symbols-outlined">close</span></button>
        </div>

        <div className="max-h-[65vh] overflow-y-auto p-5 space-y-4">
          {items.map((it) => (
            <div key={it.key} className="grid sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] gap-4 rounded-xl border border-slate-200 p-3">
              {/* Pratinjau: area merah = bagian yang dibuang */}
              <div className="relative rounded-lg overflow-hidden bg-slate-100 self-start">
                {urls[it.key] ? <img src={urls[it.key]} alt="" className="w-full h-auto block" /> : <div className="aspect-[4/3]" />}
                {it.potong > 0 && (
                  <div className="absolute inset-x-0 bottom-0 bg-red-600/45 border-t-2 border-dashed border-white flex items-center justify-center text-white text-[11px] font-bold [background-image:repeating-linear-gradient(45deg,transparent_0_6px,rgba(255,255,255,.18)_6px_12px)]" style={{ height: `${it.potong}%` }}>
                    Dipotong
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="text-xs text-slate-500 truncate" title={it.file.name}>{it.file.name}</div>
                  <button type="button" onClick={() => buang(it.key)} disabled={!!proses} className="shrink-0 text-xs font-semibold text-red-700 hover:underline disabled:opacity-50">Batal pilih</button>
                </div>
                <label className="block text-xs font-semibold text-slate-700 mt-2 mb-1" htmlFor={`up-cap-${it.key}`}>Keterangan foto</label>
                <input id={`up-cap-${it.key}`} value={it.caption} maxLength={200} onChange={(e) => ubah(it.key, { caption: e.target.value })} placeholder="mis. Layar presentasi & sound system"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-dinas focus:ring-2 focus:ring-dinas/15" />
                <div className="mt-3">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                    <label htmlFor={`up-pot-${it.key}`}>Potong bagian bawah</label>
                    <span className="tabular-nums text-slate-500">{it.potong ? `${it.potong}%` : 'Tidak dipotong'}</span>
                  </div>
                  <input id={`up-pot-${it.key}`} type="range" min="0" max="40" step="1" value={it.potong} onChange={(e) => ubah(it.key, { potong: Number(e.target.value) })} className="w-full mt-1 accent-[#1e3a5f]" />
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {[0, 22, 27].map((v) => (
                      <button key={v} type="button" onClick={() => ubah(it.key, { potong: v })}
                        className={`px-2 py-1 rounded-md border text-[11px] font-semibold ${it.potong === v ? 'border-dinas bg-dinas-soft text-dinas' : 'border-slate-300 text-slate-600 hover:border-dinas'}`}>
                        {v === 0 ? 'Tanpa potong' : v === 22 ? 'Watermark (foto tegak)' : 'Watermark (foto mendatar)'}
                      </button>
                    ))}
                    {items.length > 1 && <button type="button" onClick={() => setItems((xs) => xs.map((x) => ({ ...x, potong: it.potong })))} className="px-2 py-1 rounded-md border border-slate-300 text-[11px] font-semibold text-slate-600 hover:border-dinas">Samakan untuk semua</button>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50">
          <span className="text-xs text-slate-500">Foto otomatis dikecilkan (maks. 1920px) dan data lokasi GPS di foto dibuang.</span>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} disabled={!!proses} className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
            <button type="button" onClick={upload} disabled={!!proses || !items.length} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dinas text-white text-sm font-bold hover:bg-dinas-dark disabled:opacity-60">
              <span className="material-symbols-outlined text-[18px]">{proses ? 'progress_activity' : 'cloud_upload'}</span>
              {proses ? `Mengunggah ${proses.ke}/${proses.total}…` : `Upload ${items.length} foto`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FasilitasPanel({ room, fasilitas, adaFoto, memuat, reload }) {
  const { toast, alert } = useFeedback();
  const [draft, setDraft] = useState(fasilitas);
  const [label, setLabel] = useState('');
  const [ikon, setIkon] = useState('check_circle');
  const [saving, setSaving] = useState(false);
  const dirty = !samaFasilitas(draft, fasilitas);

  // Data dari server berubah (selesai dimuat, atau admin lain menyimpan) -> ikut, kecuali admin
  // sedang punya perubahan yang belum disimpan (draft beda dari data server sebelumnya).
  const serverRef = useRef(fasilitas);
  useEffect(() => {
    setDraft((d) => (samaFasilitas(d, serverRef.current) ? fasilitas : d));
    serverRef.current = fasilitas;
  }, [fasilitas]);

  const ada = (l) => draft.some((f) => f.label.toLowerCase() === l.toLowerCase());
  const togglePreset = (p) => setDraft((d) => (ada(p.label) ? d.filter((f) => f.label.toLowerCase() !== p.label.toLowerCase()) : d.length >= MAX_FASILITAS ? d : [...d, p]));
  const geser = (i, d) => setDraft((xs) => { const n = [...xs]; const j = i + d; if (j < 0 || j >= n.length) return xs; [n[i], n[j]] = [n[j], n[i]]; return n; });
  function tambah(e) {
    e.preventDefault();
    const l = label.trim();
    if (!l) return;
    if (ada(l)) { alert({ title: 'Sudah ada', message: `"${l}" sudah ada di daftar.`, tone: 'info' }); return; }
    if (draft.length >= MAX_FASILITAS) { alert({ title: 'Daftar penuh', message: `Maksimal ${MAX_FASILITAS} fasilitas.`, tone: 'warning' }); return; }
    setDraft((d) => [...d, { icon: ikon, label: l }]);
    setLabel('');
  }
  async function simpan() {
    setSaving(true);
    try {
      await api.put('/ruang-info/fasilitas', { room, fasilitas: draft });
      await reload();
      toast('Fasilitas disimpan.');
    } catch (e) {
      alert({ title: 'Gagal menyimpan fasilitas', message: e.response?.data?.message || 'Coba lagi.', tone: 'error' });
    } finally { setSaving(false); }
  }

  return (
    <section className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center"><span className="material-symbols-outlined text-[22px]">checklist</span></span>
        <div>
          <h3 className="font-bold leading-tight">Fasilitas ruangan</h3>
          <p className="text-[11px] text-slate-500">{draft.length} dari {MAX_FASILITAS} · tampil di bawah slideshow</p>
        </div>
      </div>
      {!memuat && !adaFoto && <p className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">Fasilitas baru tampil di layar ruangan setelah ruangan ini punya minimal 1 foto.</p>}

      {/* Daftar terpilih */}
      <div className="mt-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Tampil di layar</div>
        {draft.length ? (
          <ul className="space-y-1.5">
            {draft.map((f, i) => (
              <li key={f.label} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50">
                <span className="material-symbols-outlined text-[18px] text-kuningan">{f.icon}</span>
                <span className="flex-1 min-w-0 text-sm font-semibold text-slate-800 truncate">{f.label}</span>
                <button type="button" onClick={() => geser(i, -1)} disabled={i === 0} aria-label="Naikkan" className="w-7 h-7 rounded-md text-slate-500 hover:bg-white disabled:opacity-30 inline-flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">arrow_upward</span></button>
                <button type="button" onClick={() => geser(i, 1)} disabled={i === draft.length - 1} aria-label="Turunkan" className="w-7 h-7 rounded-md text-slate-500 hover:bg-white disabled:opacity-30 inline-flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">arrow_downward</span></button>
                <button type="button" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} aria-label={`Hapus ${f.label}`} className="w-7 h-7 rounded-md text-red-600 hover:bg-red-50 inline-flex items-center justify-center"><span className="material-symbols-outlined text-[18px]">close</span></button>
              </li>
            ))}
          </ul>
        ) : <p className="text-xs text-slate-500">Belum ada fasilitas. Pilih dari daftar di bawah.</p>}
      </div>

      {/* Pilihan cepat */}
      <div className="mt-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Pilihan cepat (klik untuk tambah/hapus)</div>
        <div className="flex flex-wrap gap-1.5">
          {PRESET.map((p) => {
            const on = ada(p.label);
            return (
              <button key={p.label} type="button" onClick={() => togglePreset(p)} aria-pressed={on}
                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition ${on ? 'border-dinas bg-dinas text-white' : 'border-slate-300 bg-white text-slate-700 hover:border-dinas'}`}>
                <span className="material-symbols-outlined text-[16px]">{on ? 'check' : p.icon}</span>{p.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Fasilitas lain */}
      <form onSubmit={tambah} className="mt-5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">Fasilitas lain</div>
        <div className="flex gap-2">
          <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={60} placeholder="mis. Kapasitas 40 orang"
            className="flex-1 min-w-0 h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-dinas focus:ring-2 focus:ring-dinas/15" />
          <button type="submit" disabled={!label.trim()} className="px-3.5 h-10 rounded-lg border border-dinas text-dinas text-sm font-semibold hover:bg-dinas hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-dinas">Tambah</button>
        </div>
        <div className="mt-2 flex flex-wrap gap-1" role="radiogroup" aria-label="Ikon fasilitas">
          {IKON.map((i) => (
            <button key={i} type="button" role="radio" aria-checked={ikon === i} aria-label={`Ikon ${i}`} onClick={() => setIkon(i)}
              className={`w-8 h-8 rounded-lg inline-flex items-center justify-center border transition ${ikon === i ? 'border-dinas bg-dinas-soft text-dinas' : 'border-transparent text-slate-500 hover:bg-slate-100'}`}>
              <span className="material-symbols-outlined text-[18px]">{i}</span>
            </button>
          ))}
        </div>
      </form>

      <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between gap-3">
        <span className={`text-xs ${dirty ? 'text-amber-700 font-semibold' : 'text-slate-500'}`}>{dirty ? 'Ada perubahan belum disimpan' : 'Semua perubahan tersimpan'}</span>
        <div className="flex gap-2">
          {dirty && <button type="button" onClick={() => setDraft(fasilitas)} disabled={saving} className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>}
          <button type="button" onClick={simpan} disabled={!dirty || saving || memuat} className="px-4 py-2 rounded-lg bg-dinas text-white text-sm font-bold hover:bg-dinas-dark disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan fasilitas'}</button>
        </div>
      </div>
    </section>
  );
}
