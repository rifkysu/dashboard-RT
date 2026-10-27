import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api';
import { useFeedback } from '../components/Feedback';
import { useDaftarRuang } from '../hooks/useRuangInfo';
import BagianTabs, { useBagian } from '../components/BagianTabs';
import { LinkFotoRuang } from '../components/RuangFoto';
import { prosesFoto } from '../utils/prosesFoto';
import { judulRuang, slugRuang } from '../utils/ruang';
import { PALET, MOTIF, temaRuang } from '../utils/temaRuang';

// Menu Admin/Kabag: kelola daftar ruang rapat per bagian (satuan kerja) -- tambah, ubah detail, hapus --
// serta foto (slideshow) & fasilitas tiap ruangan. Ruangan baru langsung bisa dibooking dan tampil di
// jadwal, kiosk, & layar ruangan /ruang/:slug. Perubahan langsung terlihat di semua layar (live).
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
  { icon: 'video_call', label: 'Video Conference' },
  { icon: 'local_drink', label: 'Dispenser' },
  { icon: 'tune', label: 'Mixer' },
  { icon: 'computer', label: 'PC Operator' },
];
const IKON = ['check_circle', 'mic', 'mic_external_on', 'desktop_windows', 'videocam', 'video_call', 'tv', 'connected_tv', 'co_present', 'speaker', 'tune',
  'computer', 'cable', 'lan', 'ac_unit', 'wifi', 'power', 'table_restaurant', 'chair', 'theater_comedy', 'podium', 'edit_note', 'light', 'wb_sunny',
  'groups', 'local_cafe', 'local_drink', 'restaurant', 'kitchen', 'photo_camera', 'wc', 'accessible', 'local_parking'];

// Ikon otomatis untuk fasilitas yang diketik bebas (form tambah ruangan), sama dengan isi awal dari spreadsheet.
const IKON_OTOMATIS = [
  [/videotron/i, 'connected_tv'], [/video conference|zoom/i, 'video_call'], [/layar monitor|monitor/i, 'desktop_windows'], [/\btv\b|televisi/i, 'tv'],
  [/proyektor/i, 'co_present'], [/hdmi/i, 'cable'], [/wireless/i, 'mic_external_on'], [/microfon|mikrofon|mic/i, 'mic'], [/kamera/i, 'videocam'],
  [/tripod/i, 'photo_camera'], [/dispenser/i, 'local_drink'], [/kulkas/i, 'kitchen'], [/mixer/i, 'tune'], [/speaker|sound/i, 'speaker'],
  [/\bpc\b|komputer|laptop/i, 'computer'], [/\bac\b/i, 'ac_unit'], [/podium/i, 'podium'], [/wi-?fi/i, 'wifi'], [/toilet/i, 'wc'],
  [/papan tulis|whiteboard/i, 'edit_note'], [/gelas/i, 'local_cafe'], [/piring/i, 'restaurant'], [/kabel|colokan|stop kontak/i, 'power'],
  [/sofa|kursi/i, 'chair'], [/\blan\b/i, 'lan'], [/meja/i, 'table_restaurant'],
];
const ikonFasilitas = (label) => (IKON_OTOMATIS.find(([re]) => re.test(label)) || [null, 'check_circle'])[1];
// Teks fasilitas (satu per baris, boleh bernomor "1. TV") -> [{ icon, label }] tanpa duplikat.
function parseFasilitas(teks) {
  const out = [];
  for (const baris of teks.split(/\r?\n/)) {
    const label = baris.replace(/^\s*\d+\s*[.,)]\s*/, '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (label && !out.some((f) => f.label.toLowerCase() === label.toLowerCase())) out.push({ icon: ikonFasilitas(label), label });
  }
  return out.slice(0, MAX_FASILITAS);
}
const inputCls = 'w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-dinas focus:ring-2 focus:ring-dinas/15';

const samaFasilitas = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export default function FotoRuang() {
  const { user, isAdmin } = useAuth();
  const { confirm, toast, alert } = useFeedback();
  const { rooms, grup, info, error, loaded, reload } = useDaftarRuang();
  const [bagian, setBagian, roomsBagian] = useBagian(grup);
  const [pilih, setPilih] = useState(null);
  const [tambah, setTambah] = useState(false);
  const [mencoba, setMencoba] = useState(false);
  // Ruangan terpilih: yang diklik (bila masih ada di bagian ini), atau ruangan pertama bagian ini.
  const room = roomsBagian.includes(pilih) ? pilih : roomsBagian[0] || rooms[0];
  // Belum pernah berhasil dimuat (gagal sejak awal): jangan tampilkan ruangan seolah kosong & bisa diisi.
  const gagalMuat = error && !loaded;
  const memuat = !loaded;

  if (user && !isAdmin) return <Navigate to="/dashboard" replace />;

  const data = info?.[room] || { foto: [], fasilitas: [] };
  const daftarSatker = grup.map((g) => g.bagian).filter((b) => b !== 'Lainnya');
  // Tema layar yang dipakai ruangan lain -> peringatan bila admin memilih tema yang sama.
  const temaLain = {};
  for (const r of rooms) if (r !== room) (temaLain[temaRuang(r, info).key] ||= []).push(r);

  async function hapusRuang() {
    const n = data.foto.length;
    if (!(await confirm({
      title: `Hapus ${judulRuang(room)}?`,
      message: `Ruangan hilang dari daftar booking, jadwal, kiosk, dan layar ruangan${n ? `, beserta ${n} fotonya` : ''}. Riwayat booking lama tetap tersimpan. Ruangan yang masih punya booking aktif tidak bisa dihapus.`,
      confirmText: 'Ya, Hapus Ruangan', tone: 'danger', icon: 'delete',
    }))) return;
    try {
      await api.delete('/ruang-info/ruangan', { data: { room } });
      await reload();
      setPilih(null);
      toast('Ruangan dihapus.');
    } catch (e) {
      alert({ title: 'Gagal menghapus ruangan', message: e.response?.data?.message || 'Coba lagi.', tone: 'error' });
    }
  }

  return (
    <div className="menu-page max-w-6xl mx-auto">
      <div className="menu-hero mb-6">
        <div>
          <span className="menu-kicker">Biro Umum / Foto & Fasilitas Ruang</span>
          <h1 className="text-3xl font-bold">Foto & Fasilitas Ruang</h1>
          <p className="text-sm mt-1">Kelola daftar ruang rapat per bagian (satuan kerja), foto slideshow, kapasitas, link dokumentasi, dan fasilitas. Perubahan langsung muncul di jadwal, kiosk, dan layar ruangan.</p>
        </div>
        <button type="button" onClick={() => setTambah(true)} disabled={!loaded}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50">
          <span className="material-symbols-outlined text-[18px]">add</span>Tambah Ruangan
        </button>
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

      {/* Pilih bagian, lalu ruangan */}
      <BagianTabs grup={grup} value={bagian} onChange={(b) => { setBagian(b); setPilih(null); }} className="mb-3" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3" role="tablist" aria-label="Pilih ruangan">
        {roomsBagian.map((r) => {
          const d = info?.[r];
          const aktif = r === room;
          const sampul = d?.foto?.[0];
          return (
            <button key={r} type="button" role="tab" aria-selected={aktif} onClick={() => setPilih(r)}
              className={`group text-left rounded-2xl border overflow-hidden transition ${aktif ? 'border-dinas ring-2 ring-dinas/20 bg-white shadow-md' : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'}`}>
              <div className="relative aspect-[16/9] bg-slate-100 overflow-hidden">
                {sampul
                  ? <img src={sampul.src} alt="" className="w-full h-full object-cover transition duration-500 group-hover:scale-105" />
                  : <span className="absolute inset-0 flex flex-col items-center justify-center text-slate-400"><span className="material-symbols-outlined text-[28px]">add_photo_alternate</span><span className="text-[11px] font-semibold mt-0.5">Belum ada foto</span></span>}
                {aktif && <span className="absolute top-2 right-2 w-6 h-6 rounded-full bg-dinas text-white flex items-center justify-center shadow"><span className="material-symbols-outlined text-[16px]">check</span></span>}
              </div>
              <div className="px-3 py-2.5">
                <div className="font-bold text-sm text-slate-900 truncate" title={judulRuang(r)}>{judulRuang(r)}</div>
                {!bagian && <div className="text-[11px] text-slate-500 truncate">{d?.satuan_kerja}</div>}
                <div className="text-[11px] text-slate-500">{loaded ? `${d?.foto?.length || 0} foto · ${d?.fasilitas?.length || 0} fasilitas` : gagalMuat ? 'Gagal dimuat' : 'Memuat…'}</div>
              </div>
            </button>
          );
        })}
      </div>

      {room && <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{judulRuang(room)}</h2>
          <div className="text-xs text-slate-500 mt-0.5">{[data.satuan_kerja, data.kapasitas && `${data.kapasitas} kursi`].filter(Boolean).join(' · ')}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href={`/ruang/${slugRuang(room)}`} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-dinas hover:border-dinas">
            <span className="material-symbols-outlined text-[18px]">open_in_new</span>Lihat layar ruangan
          </a>
          <button type="button" onClick={hapusRuang} disabled={!loaded}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-200 bg-white text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50">
            <span className="material-symbols-outlined text-[18px]">delete</span>Hapus ruangan
          </button>
        </div>
      </div>

      <DetailPanel key={`detail-${room}`} room={room} data={data} daftarSatker={daftarSatker} temaLain={temaLain} memuat={memuat}
        onSaved={async (baru, satker) => { await reload(); if (satker && bagian && satker !== bagian) setBagian(satker); setPilih(baru); }} />

      <div className="mt-5 grid lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5 items-start">
        <FotoPanel key={`foto-${room}`} room={room} foto={data.foto} memuat={memuat} gagalMuat={gagalMuat} reload={reload} />
        <FasilitasPanel key={`fas-${room}`} room={room} fasilitas={data.fasilitas} adaFoto={data.foto.length > 0} memuat={memuat} reload={reload} />
      </div>
      </>}

      {tambah && <TambahRuangDialog daftarSatker={daftarSatker} bagianAwal={bagian} onClose={() => setTambah(false)}
        onDone={async (baru, satker) => { setTambah(false); await reload(); setBagian(satker); setPilih(baru); toast(`${judulRuang(baru)} ditambahkan. Sekarang bisa dibooking; tambahkan foto bila ada.`); }} />}
    </div>
  );
}

// Detail ruangan: nama, satuan kerja (bagian), kapasitas, link dokumentasi foto, dan tema layar ruangan.
function DetailPanel({ room, data, daftarSatker, temaLain, memuat, onSaved }) {
  const { toast, alert, confirm } = useFeedback();
  const awal = { nama: room, satuan_kerja: data.satuan_kerja || '', kapasitas: data.kapasitas ?? '', link_foto: data.link_foto || '', tema: temaRuang(room, { [room]: data }).key };
  const [form, setForm] = useState(awal);
  const [saving, setSaving] = useState(false);
  // Data server berubah (mis. admin lain menyimpan) -> ikut, kecuali sedang ada perubahan belum disimpan.
  const serverRef = useRef(awal);
  useEffect(() => {
    setForm((f) => (JSON.stringify(f) === JSON.stringify(serverRef.current) ? awal : f));
    serverRef.current = awal;
  }, [JSON.stringify(awal)]); // eslint-disable-line react-hooks/exhaustive-deps
  const dirty = JSON.stringify(form) !== JSON.stringify(awal);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function simpan(e) {
    e.preventDefault();
    const nama = form.nama.trim();
    if (!nama || !form.satuan_kerja.trim()) { alert({ title: 'Data belum lengkap', message: 'Nama ruangan dan satuan kerja wajib diisi.', tone: 'warning' }); return; }
    if (nama !== room && !(await confirm({ title: 'Ganti nama ruangan?', message: `"${judulRuang(room)}" menjadi "${nama}". Semua booking & foto ruangan ini ikut pindah ke nama baru, dan link layar ruangan berubah.`, confirmText: 'Ya, Ganti Nama', icon: 'edit' }))) return;
    setSaving(true);
    try {
      const r = await api.put('/ruang-info/ruangan', { room, nama_baru: nama, satuan_kerja: form.satuan_kerja, kapasitas: form.kapasitas === '' ? null : Number(form.kapasitas), link_foto: form.link_foto, tema: form.tema });
      toast('Detail ruangan disimpan.');
      await onSaved(r.data?.data?.room || room, form.satuan_kerja.trim().replace(/\s+/g, ' '));
    } catch (err) {
      alert({ title: 'Gagal menyimpan', message: err.response?.data?.message || 'Coba lagi.', tone: 'error' });
    } finally { setSaving(false); }
  }

  return (
    <form onSubmit={simpan} className="mt-3 bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <span className="w-10 h-10 rounded-xl bg-sky-50 text-sky-700 flex items-center justify-center"><span className="material-symbols-outlined text-[22px]">info</span></span>
        <div>
          <h3 className="font-bold leading-tight">Detail ruangan</h3>
          <p className="text-[11px] text-slate-500">Satuan kerja menentukan menu bagian tempat ruangan ini tampil.</p>
        </div>
      </div>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Nama ruangan</span>
          <input value={form.nama} onChange={set('nama')} maxLength={150} className={inputCls} /></label>
        <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Satuan kerja / bagian</span>
          <input value={form.satuan_kerja} onChange={set('satuan_kerja')} maxLength={150} list="daftar-satker" className={inputCls} /></label>
        <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Kapasitas (kursi)</span>
          <input type="number" min="1" max="10000" value={form.kapasitas} onChange={set('kapasitas')} placeholder="mis. 30" className={inputCls} /></label>
        <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Link dokumentasi foto</span>
          <input type="url" value={form.link_foto} onChange={set('link_foto')} maxLength={500} placeholder="https://drive.google.com/..." className={inputCls} /></label>
      </div>
      <datalist id="daftar-satker">{daftarSatker.map((b) => <option key={b} value={b} />)}</datalist>
      <PilihTema room={form.nama.trim() || room} satker={form.satuan_kerja} tema={form.tema} temaLain={temaLain} onChange={(tema) => setForm((f) => ({ ...f, tema }))} />
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <LinkFotoRuang href={data.link_foto} className="text-xs font-semibold text-dinas hover:underline">Buka link dokumentasi foto</LinkFotoRuang>
        <div className="ml-auto flex gap-2">
          {dirty && <button type="button" onClick={() => setForm(awal)} disabled={saving} className="px-3 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Batal</button>}
          <button type="submit" disabled={!dirty || saving || memuat} className="px-4 py-2 rounded-lg bg-dinas text-white text-sm font-bold hover:bg-dinas-dark disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan detail'}</button>
        </div>
      </div>
    </form>
  );
}

// Pilih warna & motif layar ruangan (/ruang/:slug) + pratinjau. Tema yang sudah dipakai ruangan lain diberi tanda.
function PilihTema({ room, satker, tema, temaLain, onChange }) {
  const t = temaRuang(room, { [room]: { tema } });
  const sama = temaLain[t.key] || [];
  const penuhPalet = (p) => MOTIF.every((m) => temaLain[`${p}/${m.key}`]);
  return (
    <div className="mt-5 pt-4 border-t border-slate-200 grid lg:grid-cols-[minmax(0,1fr)_20rem] gap-5">
      <div>
        <div className="text-xs font-semibold text-slate-700">Tema layar ruangan</div>
        <p className="text-[11px] text-slate-500">Warna & motif layar depan ruangan dan popup fotonya. Buat beda tiap ruangan supaya mudah dikenali.</p>
        <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Warna</div>
        <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Warna tema">
          {PALET.map((p) => {
            const on = p.key === t.palet.key;
            return (
              <button key={p.key} type="button" role="radio" aria-checked={on} title={p.label} onClick={() => onChange(`${p.key}/${t.motif.key}`)}
                className={`relative w-9 h-9 rounded-full ring-2 ring-offset-2 transition ${on ? 'ring-dinas scale-110' : 'ring-transparent hover:ring-slate-300'} ${penuhPalet(p.key) && !on ? 'opacity-50' : ''}`}
                style={{ background: `linear-gradient(135deg, ${p.latar} 50%, ${p.aksen} 50%)` }}>
                <span className="sr-only">{p.label}</span>
                {on && <span className="absolute inset-0 flex items-center justify-center material-symbols-outlined text-[16px] text-white drop-shadow">check</span>}
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Motif latar</div>
        <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Motif latar">
          {MOTIF.map((m) => {
            const on = m.key === t.motif.key;
            const key = `${t.palet.key}/${m.key}`;
            return (
              <button key={m.key} type="button" role="radio" aria-checked={on} onClick={() => onChange(key)} style={t.style}
                className={`relative w-20 h-12 rounded-lg overflow-hidden bg-latar ring-2 ring-offset-2 transition ${on ? 'ring-dinas' : 'ring-transparent hover:ring-slate-300'}`}>
                <span className={`absolute inset-0 motif-${m.key}`} aria-hidden="true"></span>
                <span className="relative text-[11px] font-bold text-white">{m.label}</span>
                {temaLain[key] && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-400" title={`Dipakai: ${temaLain[key].map(judulRuang).join(', ')}`}></span>}
              </button>
            );
          })}
        </div>
        {sama.length > 0
          ? <p className="mt-3 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-800">Tema {t.palet.label} · {t.motif.label} juga dipakai {sama.map(judulRuang).join(', ')}. Pilih kombinasi lain supaya layarnya beda.</p>
          : <p className="mt-3 text-[11px] text-emerald-700 inline-flex items-center gap-1"><span className="material-symbols-outlined text-[15px]">check_circle</span>Tema ini hanya dipakai ruangan ini. Titik kuning = motif sudah dipakai ruangan lain.</p>}
      </div>
      {/* Pratinjau layar ruangan */}
      <div style={t.style} className="relative self-start rounded-2xl overflow-hidden bg-latar text-white p-4 min-h-[11rem]" aria-label="Pratinjau layar ruangan">
        <div className={`absolute inset-0 motif-${t.motif.key} opacity-60`} aria-hidden="true"></div>
        <div className="absolute inset-0" style={{ background: 'radial-gradient(60% 70% at 100% 100%, color-mix(in srgb, var(--aksen) 25%, transparent), transparent 70%)' }} aria-hidden="true"></div>
        <div className="relative">
          <div className="flex items-center justify-between text-[10px] text-white/50"><span>Pratinjau layar</span><span className="font-bold tabular-nums text-white/80">09:30</span></div>
          <div className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-aksen truncate">{satker || 'Ruang rapat'}</div>
          <div className="font-display text-xl font-extrabold leading-tight line-clamp-2">{judulRuang(room)}</div>
          <span className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ring-1 ring-emerald-400/40 bg-emerald-400/15 text-emerald-300 text-[10px] font-bold uppercase tracking-wider"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>Tersedia</span>
          <div className="mt-3 flex gap-1">{[0, 1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 rounded-full ${i === 0 ? 'w-6 bg-aksen' : 'w-1.5 bg-white/25'}`}></span>)}</div>
        </div>
      </div>
    </div>
  );
}

// Dialog tambah ruangan baru: langsung bisa dibooking setelah disimpan.
function TambahRuangDialog({ daftarSatker, bagianAwal, onClose, onDone }) {
  const { alert } = useFeedback();
  const [form, setForm] = useState({ nama: '', satuan_kerja: bagianAwal || '', kapasitas: '', link_foto: '', fasilitas: '' });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const fasilitas = parseFasilitas(form.fasilitas);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !saving && !document.querySelector('[role="alertdialog"]')) onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [saving, onClose]);

  async function simpan(e) {
    e.preventDefault();
    const kurang = [!form.nama.trim() && 'Nama ruangan', !form.satuan_kerja.trim() && 'Satuan kerja / bagian'].filter(Boolean);
    if (kurang.length) { alert({ title: 'Data belum lengkap', intro: 'Wajib diisi:', message: kurang, tone: 'warning' }); return; }
    setSaving(true);
    try {
      const r = await api.post('/ruang-info/ruangan', { room: form.nama, satuan_kerja: form.satuan_kerja, kapasitas: form.kapasitas === '' ? null : Number(form.kapasitas), link_foto: form.link_foto, fasilitas });
      await onDone(r.data.data.room, r.data.data.satuan_kerja);
    } catch (err) {
      alert({ title: 'Gagal menambah ruangan', message: err.response?.data?.message || 'Coba lagi.', tone: 'error' });
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex overflow-y-auto p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="tambah-ruang-title"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <form onSubmit={simpan} noValidate className="m-auto w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div>
            <h3 id="tambah-ruang-title" className="font-bold text-lg">Tambah ruang rapat</h3>
            <p className="text-xs text-slate-500">Ruangan langsung muncul di menu bagiannya dan bisa dibooking, dengan tema layar yang belum dipakai ruangan lain. Foto & tema bisa diubah setelah disimpan.</p>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup" className="w-9 h-9 rounded-lg hover:bg-slate-100 inline-flex items-center justify-center disabled:opacity-50"><span className="material-symbols-outlined">close</span></button>
        </div>
        <div className="p-5 grid sm:grid-cols-2 gap-4">
          <label className="block sm:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-1">Nama ruangan <span className="text-red-600">*</span></span>
            <input value={form.nama} onChange={set('nama')} maxLength={150} autoFocus placeholder="mis. Ruang Rapat Biro Perencanaan" className={inputCls} /></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Satuan kerja / bagian <span className="text-red-600">*</span></span>
            <input value={form.satuan_kerja} onChange={set('satuan_kerja')} maxLength={150} list="tambah-satker" placeholder="Pilih atau ketik satuan kerja baru" className={inputCls} />
            <datalist id="tambah-satker">{daftarSatker.map((b) => <option key={b} value={b} />)}</datalist></label>
          <label className="block"><span className="block text-xs font-semibold text-slate-700 mb-1">Kapasitas (kursi)</span>
            <input type="number" min="1" max="10000" value={form.kapasitas} onChange={set('kapasitas')} placeholder="mis. 30" className={inputCls} /></label>
          <label className="block sm:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-1">Link dokumentasi foto</span>
            <input type="url" value={form.link_foto} onChange={set('link_foto')} maxLength={500} placeholder="https://drive.google.com/drive/folders/..." className={inputCls} /></label>
          <label className="block sm:col-span-2"><span className="block text-xs font-semibold text-slate-700 mb-1">Fasilitas <span className="font-normal text-slate-500">(satu per baris, maks. {MAX_FASILITAS})</span></span>
            <textarea value={form.fasilitas} onChange={set('fasilitas')} rows={5} placeholder={'1. TV\n2. AC\n3. WiFi\n4. Microfon meja'}
              className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm outline-none focus:border-dinas focus:ring-2 focus:ring-dinas/15" /></label>
          {fasilitas.length > 0 && (
            <ul className="sm:col-span-2 -mt-2 flex flex-wrap gap-1.5" aria-label="Pratinjau fasilitas">
              {fasilitas.map((f) => (
                <li key={f.label} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-700">
                  <span className="material-symbols-outlined text-[16px] text-kuningan">{f.icon}</span>{f.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Batal</button>
          <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-dinas text-white text-sm font-bold hover:bg-dinas-dark disabled:opacity-60">
            <span className="material-symbols-outlined text-[18px]">{saving ? 'progress_activity' : 'add'}</span>{saving ? 'Menyimpan…' : 'Simpan ruangan'}
          </button>
        </div>
      </form>
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
