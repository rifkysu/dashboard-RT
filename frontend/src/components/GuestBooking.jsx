import React, { useCallback, useEffect, useRef, useState } from 'react';
import api from '../api';
import guestApi, { getGuestToken, setGuestToken, googleLoginUrl } from '../guestApi';
import { useFeedback } from './Feedback';
import useRuangRapatLive from '../hooks/useRuangRapatLive';
import { iso } from '../hooks/useMonthSchedule';
import { requireFields, HP_RE, normalizePhone } from '../utils/validation';
import { detectFileMime, readFileAsDataUrl } from '../utils/fileSignature';
import { judulRuang } from '../utils/ruang';
import { useDaftarRuang } from '../hooks/useRuangInfo';
import { RuangOptions } from './BagianTabs';
import { RuangPilihanInfo } from './RuangFoto';

// Booking ruang rapat dari halaman kiosk /jadwal-rapat untuk TAMU (tanpa akun pegawai) lewat login Google.
// Aturan yang sama dicek ulang di backend (backend/src/routes/guest.js).
const MAX_FILE = 8 * 1024 * 1024;
const ALLOWED = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_SPAN_DAYS = 7;
const emptyForm = { title: '', nomor_surat: '', pic: '', pic_phone: '', room: '', date: '', end_date: '', start: '', end: '', surat_name: '', surat_file_data: '' };

const LOGIN_ERRORS = {
  not_configured: 'Login Google belum dikonfigurasi di server. Hubungi admin Biro Umum.',
  cancelled: 'Login Google dibatalkan.',
  invalid_state: 'Sesi login Google kedaluwarsa. Silakan coba login lagi.',
  google_failed: 'Login Google gagal. Silakan coba lagi.',
  email_unverified: 'Email akun Google Anda belum terverifikasi.',
  blocked: 'Akun Google ini diblokir admin Biro Umum dan tidak bisa mengajukan booking.',
  busy: 'Server sedang sibuk. Coba login lagi sebentar lagi.',
};

const fmtTanggal = (v) => new Date(`${v}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const dayDiff = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
const nowHm = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function Field({ label, children, hint }) {
  return (
    <label className="block">
      <span className="block text-xs font-semibold text-slate-700 mb-1.5">{label} <span className="text-red-600">*</span></span>
      {children}
      {hint && <span className="block text-[11px] text-slate-500 mt-1">{hint}</span>}
    </label>
  );
}
const inputCls = 'w-full h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-800 outline-none focus:border-dinas focus:ring-2 focus:ring-dinas/15';

// Captcha 6 angka dari server, berlaku 5 menit (hitung mundur ditampilkan).
function Captcha({ captcha, loading, onReload, value, onChange }) {
  const [left, setLeft] = useState(0);
  useEffect(() => {
    if (!captcha) { setLeft(0); return undefined; }
    const tick = () => setLeft(Math.max(0, Math.round((new Date(captcha.expires_at) - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [captcha]);
  const expired = !!captcha && left <= 0;
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-slate-700">Captcha <span className="text-red-600">*</span></span>
        {captcha && <span className={`text-[11px] font-semibold tabular-nums ${expired ? 'text-red-600' : left < 60 ? 'text-amber-600' : 'text-slate-500'}`}>{expired ? 'Kedaluwarsa' : `Berlaku ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`}</span>}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div className={`relative w-[220px] h-[70px] rounded-lg overflow-hidden border border-slate-200 bg-slate-100 ${expired ? 'opacity-40' : ''}`}>
          {captcha && <img src={captcha.image} alt="Kode captcha 6 angka" width="220" height="70" className="block select-none" draggable="false" />}
          {loading && <span className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">Memuat…</span>}
        </div>
        <button type="button" onClick={onReload} disabled={loading} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-dinas hover:bg-slate-50 disabled:opacity-60">
          <span className={`material-symbols-outlined text-[16px] ${loading ? 'animate-spin' : ''}`}>refresh</span>Ganti captcha
        </button>
      </div>
      <input value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))} disabled={expired || !captcha}
        autoComplete="off" spellCheck="false" inputMode="numeric" pattern="[0-9]*" maxLength={6} placeholder="Ketik 6 angka di gambar"
        className={`${inputCls} mt-3 font-mono tracking-[0.3em] disabled:bg-slate-100`} aria-label="Jawaban captcha" />
      {expired && <p className="text-[11px] text-red-600 mt-1.5">Captcha berlaku 5 menit. Klik "Ganti captcha" untuk memuat yang baru.</p>}
    </div>
  );
}

// Cek ketersediaan langsung di form: jadwal publik ruangan terpilih pada rentang tanggal terpilih.
// Bentrok ditampilkan sebelum kirim & tombol Kirim dikunci. Ikut sinyal live, jadi booking orang lain
// yang baru masuk langsung terlihat. Backend tetap memeriksa ulang di dalam transaksi (sumber kebenaran).
function useKetersediaan(room, from, to) {
  const [state, setState] = useState({ items: null, gagal: false, memuat: false });
  const reqRef = useRef(0);
  const load = useCallback(() => {
    const id = ++reqRef.current;
    if (!room || !from || !to || to < from || dayDiff(from, to) + 1 > MAX_SPAN_DAYS) { setState({ items: null, gagal: false, memuat: false }); return; }
    setState((s) => ({ ...s, memuat: true }));
    api.get('/ruang-rapat/public-schedule', { params: { from, to } })
      .then((r) => {
        if (id !== reqRef.current) return;
        const items = (r.data.data || []).filter((x) => x.room === room && !x.cancelled).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
        setState({ items, gagal: false, memuat: false });
      })
      .catch(() => { if (id === reqRef.current) setState({ items: null, gagal: true, memuat: false }); });
  }, [room, from, to]);
  useEffect(() => { load(); }, [load]);
  useRuangRapatLive(load);
  return { ...state, reload: load };
}

// Sama dengan conflictWhere di backend: rentang tanggal beririsan DAN jam beririsan (jam sama tiap hari).
const bentrokDengan = (items, form) => (items && form.start && form.end && form.start < form.end
  ? items.filter((x) => x.date <= form.end_date && (x.end_date || x.date) >= form.date && x.start < form.end && x.end > form.start)
  : []);
const rentangTgl = (x) => ((x.end_date || x.date) !== x.date ? `${fmtTanggal(x.date)} s/d ${fmtTanggal(x.end_date)}` : fmtTanggal(x.date));

function PanelKetersediaan({ form, cek, bentrok }) {
  if (!form.room || !form.date || !form.end_date) {
    return <p className="md:col-span-2 -mt-1 text-[11px] text-slate-500 inline-flex items-center gap-1.5"><span className="material-symbols-outlined text-[16px]">info</span>Pilih ruangan & tanggal untuk melihat jam yang sudah terisi.</p>;
  }
  if (cek.gagal) {
    return (
      <div className="md:col-span-2 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        <span className="material-symbols-outlined text-[18px]">cloud_off</span>
        <span>Ketersediaan ruangan belum dapat diperiksa (koneksi bermasalah). Booking tetap dicek ulang oleh server saat dikirim. <button type="button" onClick={cek.reload} className="font-semibold underline">Coba lagi</button></span>
      </div>
    );
  }
  if (!cek.items) return <p className="md:col-span-2 -mt-1 text-[11px] text-slate-500">Memeriksa ketersediaan ruangan…</p>;
  const ids = new Set(bentrok.map((x) => x.id));
  const jamLengkap = form.start && form.end && form.start < form.end;
  return (
    <div className="md:col-span-2 space-y-2.5" aria-live="polite">
      {bentrok.length > 0 ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3">
          <span className="material-symbols-outlined text-red-600">event_busy</span>
          <div className="min-w-0 text-sm text-red-800">
            <div className="font-bold">Jam yang dipilih bentrok dengan booking lain</div>
            <div className="text-xs mt-0.5">{judulRuang(form.room)} sudah terpakai pada waktu tersebut. Pilih jam lain, tanggal lain, atau ruangan lain.</div>
          </div>
        </div>
      ) : jamLengkap && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <span className="material-symbols-outlined text-emerald-600">event_available</span>
          <span><b>Ruangan tersedia</b> pada jam {form.start}–{form.end}{cek.memuat ? ' · memperbarui…' : ''}</span>
        </div>
      )}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="text-xs font-semibold text-slate-700">Jam terisi di {judulRuang(form.room)} · {form.date === form.end_date ? fmtTanggal(form.date) : `${fmtTanggal(form.date)} s/d ${fmtTanggal(form.end_date)}`}</div>
        {cek.items.length ? (
          <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {cek.items.map((x) => (
              <li key={x.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-1.5 text-xs ${ids.has(x.id) ? 'border-red-300 bg-red-50 text-red-800' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
                <span className="font-mono font-bold tabular-nums shrink-0">{x.start}–{x.end}</span>
                <span className="min-w-0"><span className="block font-semibold truncate">{x.title}</span>{(form.date !== form.end_date || (x.end_date || x.date) !== x.date) && <span className="block text-[10px] opacity-75">{rentangTgl(x)}</span>}</span>
              </li>
            ))}
          </ul>
        ) : <div className="mt-1 text-xs text-emerald-700">Belum ada booking pada tanggal ini — semua jam tersedia.</div>}
      </div>
    </div>
  );
}

function BookingForm({ guest, onClose, onBooked, onSessionEnd }) {
  const { grup } = useDaftarRuang();
  const { alert } = useFeedback();
  const [form, setForm] = useState({ ...emptyForm, pic: guest.nama || '' });
  const [captcha, setCaptcha] = useState(null);
  const [captchaLoading, setCaptchaLoading] = useState(false);
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const today = iso();
  const cek = useKetersediaan(form.room, form.date, form.end_date);
  const bentrok = bentrokDengan(cek.items, form);

  const loadCaptcha = useCallback(async () => {
    setCaptchaLoading(true);
    setAnswer('');
    try {
      const r = await guestApi.get('/guest/captcha');
      setCaptcha(r.data);
    } catch (e) {
      if (e.response?.status === 401 || e.response?.status === 403) { onSessionEnd(e.response?.data?.message); return; }
      setCaptcha(null);
      alert({ title: 'Gagal memuat captcha', message: e.response?.data?.message || 'Periksa koneksi lalu coba lagi.', tone: 'error' });
    } finally { setCaptchaLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadCaptcha(); }, [loadCaptcha]);
  useEffect(() => {
    // Esc menutup form, kecuali sedang ada popup peringatan terbuka (Esc itu untuk menutup popupnya).
    const onKey = (e) => { if (e.key === 'Escape' && !saving && !document.querySelector('[role="alertdialog"]')) onClose(); };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [saving, onClose]);

  async function pickFile(e) {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > MAX_FILE) { alert({ title: 'File terlalu besar', message: 'Ukuran surat maksimal 8 MB.', tone: 'warning' }); return; }
    const mime = await detectFileMime(f);
    if (!mime || !ALLOWED.includes(mime)) { alert({ title: 'File ditolak', message: 'Surat harus file PDF, JPG, atau PNG asli.', tone: 'warning' }); return; }
    const data = await readFileAsDataUrl(f);
    setForm((x) => ({ ...x, surat_name: f.name, surat_file_data: data }));
  }

  // Render ulang tepat saat captcha kedaluwarsa, supaya tombol Kirim langsung nonaktif.
  const [, setExpiredTick] = useState(0);
  useEffect(() => {
    if (!captcha) return undefined;
    const t = setTimeout(() => setExpiredTick((n) => n + 1), Math.max(0, new Date(captcha.expires_at) - Date.now()) + 50);
    return () => clearTimeout(t);
  }, [captcha]);
  const isCaptchaExpired = () => !captcha || new Date(captcha.expires_at) <= new Date();
  const captchaExpired = isCaptchaExpired();
  // Tombol Kirim baru aktif kalau SEMUA kolom (termasuk surat & captcha) sudah diisi.
  const complete = Object.keys(emptyForm).every((k) => String(form[k] || '').trim()) && answer.length === 6;

  function validate() {
    const errors = requireFields([
      ['Topik / agenda', form.title], ['Nomor surat', form.nomor_surat], ['Nama PIC', form.pic], ['No. HP PIC', form.pic_phone], ['Ruangan', form.room],
      ['Tanggal mulai', form.date], ['Sampai tanggal', form.end_date], ['Jam mulai', form.start], ['Jam selesai', form.end], ['File surat permohonan', form.surat_file_data],
    ]);
    if (!/^\d{6}$/.test(answer)) errors.push('Captcha wajib diisi (6 angka).');
    if (form.pic_phone && !HP_RE.test(normalizePhone(form.pic_phone))) errors.push('No. HP PIC tidak valid (contoh: 081234567890 atau +6281234567890).');
    if (form.date && form.date < today) errors.push('Tanggal mulai tidak boleh sebelum hari ini.');
    if (form.date && form.end_date && form.end_date < form.date) errors.push('Sampai tanggal tidak boleh sebelum tanggal mulai.');
    if (form.date && form.end_date && dayDiff(form.date, form.end_date) + 1 > MAX_SPAN_DAYS) errors.push(`Booking tamu maksimal ${MAX_SPAN_DAYS} hari berturut-turut.`);
    if (form.start && form.end && form.start >= form.end) errors.push('Jam selesai harus lebih besar dari jam mulai.');
    if (form.date === today && form.start && form.start < nowHm()) errors.push('Jam mulai hari ini sudah lewat.');
    if (isCaptchaExpired()) errors.push('Captcha sudah kedaluwarsa. Klik "Ganti captcha".');
    if (bentrok.length) errors.push(`Jam yang dipilih bentrok dengan booking lain di ${judulRuang(form.room)}: ${bentrok.map((x) => `"${x.title}" ${x.start}–${x.end}`).join(', ')}.`);
    return errors;
  }

  async function submit(e) {
    e.preventDefault();
    if (saving) return;
    const errors = validate();
    if (errors.length) { await alert({ title: 'Form belum lengkap', intro: 'Periksa data berikut:', message: errors, tone: 'warning' }); return; }
    setSaving(true);
    try {
      const r = await guestApi.post('/guest/bookings', { ...form, pic_phone: normalizePhone(form.pic_phone), captcha: answer });
      onBooked(r.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 401 || status === 403) { onSessionEnd(err.response?.data?.message); return; }
      await alert({
        title: err.response?.data?.code === 'CAPTCHA' ? 'Captcha salah' : status === 409 ? 'Jadwal bentrok' : status === 429 ? 'Tunggu sebentar' : 'Gagal mengirim booking',
        message: err.response?.data?.message || 'Gagal mengirim booking. Periksa koneksi lalu coba lagi.',
        tone: status === 409 || status === 429 || err.response?.data?.code === 'CAPTCHA' ? 'warning' : 'error',
      });
      // Captcha selalu hangus setelah dicek server -> muat yang baru.
      loadCaptcha();
      // Bentrok dari server (mis. keduluan orang lain) -> segarkan daftar jam terisi supaya terlihat di form.
      if (status === 409) cek.reload();
    } finally { setSaving(false); }
  }

  const span = form.date && form.end_date && form.end_date >= form.date ? dayDiff(form.date, form.end_date) + 1 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex overflow-y-auto overscroll-contain p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="guest-booking-title">
      {/* Klik di luar form sengaja tidak menutup form, supaya isian & file surat tidak hilang tak sengaja. */}
      <div className="m-auto w-full max-w-3xl bg-[#f7f9fb] rounded-2xl shadow-2xl overflow-hidden">
        <div className="bg-white border-b px-5 sm:px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-10 h-10 shrink-0 rounded-xl bg-dinas text-white flex items-center justify-center"><span className="material-symbols-outlined">event_available</span></span>
            <div className="min-w-0">
              <div id="guest-booking-title" className="font-display font-bold text-dinas-ink">Form Booking Ruang Rapat</div>
              <div className="text-[11px] text-slate-500 truncate">Diajukan sebagai {guest.nama} · {guest.email}</div>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Tutup" className="w-9 h-9 shrink-0 rounded-lg hover:bg-slate-100 text-slate-500"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form noValidate onSubmit={submit} className="p-5 sm:p-6 space-y-5">
          <p className="text-xs text-slate-600">Semua kolom bertanda <span className="text-red-600 font-bold">*</span> wajib diisi. Tombol <b>Kirim Booking</b> aktif setelah semua kolom dan captcha terisi.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Topik / Agenda"><input value={form.title} onChange={set('title')} maxLength={255} className={inputCls} placeholder="Contoh: Rapat Koordinasi" /></Field>
            <Field label="Nomor Surat"><input value={form.nomor_surat} onChange={set('nomor_surat')} maxLength={100} className={inputCls} placeholder="Contoh: B-123/BU/IX/2026" /></Field>
            <Field label="Nama PIC"><input value={form.pic} onChange={set('pic')} maxLength={150} className={inputCls} placeholder="Nama penanggung jawab" /></Field>
            <Field label="No. HP PIC"><input value={form.pic_phone} onChange={(e) => setForm((f) => ({ ...f, pic_phone: e.target.value.replace(/[^0-9+ -]/g, '') }))} maxLength={30} inputMode="tel" className={inputCls} placeholder="Contoh: 081234567890" /></Field>
            <Field label="Ruangan">
              <select value={form.room} onChange={set('room')} className={inputCls}>
                <option value="">Pilih ruangan…</option>
                <RuangOptions grup={grup} value={form.room} />
              </select>
            </Field>
            <RuangPilihanInfo room={form.room} />
            <Field label="Tanggal Mulai" hint={form.date ? fmtTanggal(form.date) : null}>
              <input type="date" value={form.date} min={today} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, date: v, end_date: !f.end_date || f.end_date < v ? v : f.end_date })); }} className={inputCls} />
            </Field>
            <Field label="Sampai Tanggal" hint={span ? `${span} hari · jam yang sama setiap hari (maks. ${MAX_SPAN_DAYS} hari)` : `Isi sama dengan tanggal mulai untuk booking 1 hari (maks. ${MAX_SPAN_DAYS} hari)`}>
              <input type="date" value={form.end_date} min={form.date || today} onChange={set('end_date')} className={inputCls} />
            </Field>
            <Field label="Jam Mulai"><input type="time" value={form.start} onChange={set('start')} aria-invalid={bentrok.length > 0} className={`${inputCls} ${bentrok.length ? '!border-red-400 bg-red-50/50' : ''}`} /></Field>
            <Field label="Jam Selesai"><input type="time" value={form.end} onChange={set('end')} aria-invalid={bentrok.length > 0} className={`${inputCls} ${bentrok.length ? '!border-red-400 bg-red-50/50' : ''}`} /></Field>
            <PanelKetersediaan form={form} cek={cek} bentrok={bentrok} />
            <div className="md:col-span-2">
              <span className="block text-xs font-semibold text-slate-700 mb-1.5">Surat Permohonan <span className="text-red-600">*</span></span>
              <label className="relative flex items-center gap-4 p-4 rounded-xl border border-dashed border-slate-300 bg-white cursor-pointer hover:border-dinas">
                <span className={`w-11 h-11 shrink-0 rounded-xl flex items-center justify-center ${form.surat_file_data ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}><span className="material-symbols-outlined">{form.surat_file_data ? 'task' : 'upload_file'}</span></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-800 truncate">{form.surat_name || 'Pilih file surat permohonan'}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">PDF, JPG, atau PNG · maks. 8 MB</span>
                </span>
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={pickFile} aria-label="File surat permohonan" />
              </label>
            </div>
          </div>
          <Captcha captcha={captcha} loading={captchaLoading} onReload={loadCaptcha} value={answer} onChange={setAnswer} />
          <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 border-t pt-4">
            {bentrok.length > 0 ? <span className="sm:mr-auto text-[11px] font-semibold text-red-600">Jadwal bentrok — ganti jam, tanggal, atau ruangan dulu.</span>
              : !complete && <span className="sm:mr-auto text-[11px] text-slate-500">Lengkapi semua kolom & captcha untuk mengaktifkan tombol kirim.</span>}
            <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-lg border bg-white text-sm font-semibold text-slate-700">Batal</button>
            <button type="submit" disabled={!complete || saving || captchaExpired || bentrok.length > 0} className="px-5 py-2.5 rounded-lg bg-dinas text-white text-sm font-semibold hover:bg-dinas-dark disabled:opacity-50 disabled:cursor-not-allowed">{saving ? 'Mengirim…' : 'Kirim Booking'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Popup batalkan booking milik tamu sendiri; alasan opsional (maks. 500 karakter).
function CancelDialog({ booking, onClose, onDone, onSessionEnd }) {
  const { alert } = useFeedback();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  async function submit() {
    if (saving) return;
    setSaving(true);
    try {
      const r = await guestApi.post(`/guest/bookings/${booking.id}/cancel`, { reason: reason.trim() || null });
      onDone(r.data.message);
    } catch (e) {
      const status = e.response?.status;
      if (status === 401 || status === 403) { onSessionEnd(e.response?.data?.message); return; }
      alert({ title: 'Gagal membatalkan', message: e.response?.data?.message || 'Gagal membatalkan booking.', tone: 'error' });
    } finally { setSaving(false); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex overflow-y-auto p-4" onMouseDown={(e) => { if (e.target === e.currentTarget && !saving) onClose(); }} role="dialog" aria-modal="true" aria-labelledby="guest-cancel-title">
      <div className="m-auto w-full max-w-md bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-start gap-3">
          <span className="w-11 h-11 shrink-0 rounded-xl bg-red-100 text-red-600 flex items-center justify-center"><span className="material-symbols-outlined">event_busy</span></span>
          <div className="min-w-0">
            <div id="guest-cancel-title" className="font-display font-bold text-dinas-ink">Batalkan booking?</div>
            <div className="text-sm text-slate-600 mt-1"><b>{booking.title}</b><br />{judulRuang(booking.room)} · {fmtTanggal(booking.date)}{booking.end_date !== booking.date ? ` s/d ${fmtTanggal(booking.end_date)}` : ''} · {booking.start}–{booking.end}</div>
          </div>
        </div>
        <label className="block mt-4">
          <span className="block text-xs font-semibold text-slate-700 mb-1.5">Alasan pembatalan (opsional)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value.slice(0, 500))} rows={3} className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm outline-none focus:border-dinas" placeholder="Contoh: rapat diundur" />
        </label>
        <p className="text-[11px] text-slate-500 mt-1">Ruangan langsung tersedia lagi untuk orang lain. Pembatalan tidak bisa diurungkan.</p>
        <div className="flex justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={saving} className="px-4 py-2.5 rounded-lg border bg-white text-sm font-semibold text-slate-700">Tidak</button>
          <button type="button" onClick={submit} disabled={saving} className="px-5 py-2.5 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 disabled:opacity-60">{saving ? 'Membatalkan…' : 'Ya, batalkan'}</button>
        </div>
      </div>
    </div>
  );
}

export default function GuestBooking() {
  const { alert, toast } = useFeedback();
  const [guest, setGuest] = useState(null);
  const [checking, setChecking] = useState(() => !!getGuestToken());
  const [showForm, setShowForm] = useState(false);
  const [mine, setMine] = useState([]);
  const [cancelling, setCancelling] = useState(null);
  const panelRef = useRef(null);

  const loadMine = useCallback(() => {
    if (!getGuestToken()) return;
    guestApi.get('/guest/bookings').then((r) => setMine(r.data.data || [])).catch(() => {});
  }, []);

  const endSession = useCallback((message) => {
    setGuestToken(null);
    setGuest(null);
    setMine([]);
    setShowForm(false);
    if (message) alert({ title: 'Sesi berakhir', message, tone: 'warning' });
  }, [alert]);

  useEffect(() => {
    // Kembali dari login Google: token/error dikirim lewat fragment URL (#guest_token=... / #guest_error=...).
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const token = hash.get('guest_token');
    const error = hash.get('guest_error');
    if (token || error) {
      window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
      if (token) setGuestToken(token);
      if (error) alert({ title: 'Login Google', message: LOGIN_ERRORS[error] || 'Login Google gagal.', tone: error === 'cancelled' ? 'info' : 'error' });
      setTimeout(() => panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
    }
    if (!getGuestToken()) { setChecking(false); return; }
    setChecking(true);
    guestApi.get('/guest/me')
      .then((r) => { setGuest(r.data.guest); if (token) toast(`Masuk sebagai ${r.data.guest.nama}.`); loadMine(); })
      .catch((e) => { if (e.response?.status === 401 || e.response?.status === 403) endSession(token ? e.response?.data?.message : null); })
      .finally(() => setChecking(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useRuangRapatLive(loadMine);

  async function logout() {
    try { await guestApi.post('/guest/logout'); } catch {}
    endSession();
    toast('Anda sudah keluar dari akun Google.');
  }

  function booked(res) {
    setShowForm(false);
    toast(res.message || 'Booking berhasil dikirim.');
    loadMine();
  }

  const expires = guest?.session_expires_at ? new Date(guest.session_expires_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div id="booking-tamu" ref={panelRef} className="scroll-mt-24 relative overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-[#f7efe0] via-white to-white p-5 md:p-6 shadow-[0_16px_40px_-28px_rgba(14,30,51,.5)]">
      <div className="flex flex-col lg:flex-row lg:items-center gap-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 font-display font-bold text-dinas-ink">
            <span className="material-symbols-outlined text-[22px] text-kuningan">event_available</span>Booking ruang rapat dengan akun Google
          </div>
          <p className="text-sm text-slate-600 mt-1 leading-relaxed">Belum punya akun pegawai? Login dengan Google, lalu isi form booking lengkap dengan surat permohonan. Sesi login berlaku 7 hari.</p>
          {guest && (
            <div className="mt-3 flex items-center gap-3">
              {guest.foto ? <img src={guest.foto} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full border border-slate-200" />
                : <span className="w-9 h-9 rounded-full bg-dinas text-white flex items-center justify-center font-bold">{(guest.nama || '?')[0].toUpperCase()}</span>}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-dinas-ink truncate">{guest.nama}</div>
                <div className="text-[11px] text-slate-500 truncate">{guest.email}{expires ? ` · sesi berlaku s/d ${expires}` : ''}</div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {checking ? <span className="text-sm text-slate-500">Memeriksa sesi…</span> : guest ? (
            <>
              <button type="button" onClick={() => setShowForm(true)} className="btn-shine inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-dinas text-white text-sm font-bold transition hover:bg-dinas-dark">
                <span className="material-symbols-outlined text-[18px]">edit_calendar</span>Isi form booking
              </button>
              <button type="button" onClick={logout} className="px-4 py-3 rounded-xl border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">Keluar</button>
            </>
          ) : (
            <a href={googleLoginUrl} className="inline-flex items-center gap-2.5 px-5 py-3 rounded-xl bg-white border border-slate-300 text-sm font-bold text-slate-800 shadow-sm transition hover:border-dinas hover:shadow-[0_0_0_4px_rgba(30,58,95,.08)]">
              <GoogleIcon />Login dengan Google untuk booking
            </a>
          )}
        </div>
      </div>
      {guest && mine.length > 0 && (
        <div className="mt-5 border-t border-slate-200 pt-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-500">Booking Anda</div>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {mine.map((b) => (
              <li key={b.id} className={`rounded-xl border px-3 py-2.5 text-sm ${b.cancelled ? 'border-red-200 bg-red-50/60' : 'border-slate-200 bg-white'}`}>
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-dinas-ink truncate">{b.title}</span>
                  {b.cancelled
                    ? <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">{b.cancelled_by_self ? 'Dibatalkan oleh Anda' : 'Dibatalkan Biro Umum'}</span>
                    : <button type="button" onClick={() => setCancelling(b)} className="shrink-0 inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md border border-red-200 text-red-700 hover:bg-red-50"><span className="material-symbols-outlined text-[14px]">event_busy</span>Batalkan</button>}
                </div>
                <div className="text-xs text-slate-500 mt-0.5">{judulRuang(b.room)} · {fmtTanggal(b.date)}{b.end_date !== b.date ? ` s/d ${fmtTanggal(b.end_date)}` : ''} · {b.start}–{b.end}</div>
                {b.cancelled && b.cancel_reason && <div className="text-[11px] text-red-700 mt-0.5">Alasan: {b.cancel_reason}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
      {cancelling && <CancelDialog booking={cancelling} onClose={() => setCancelling(null)} onSessionEnd={(m) => { setCancelling(null); endSession(m); }} onDone={(m) => { setCancelling(null); toast(m); loadMine(); }} />}
      {showForm && guest && <BookingForm guest={guest} onClose={() => setShowForm(false)} onBooked={booked} onSessionEnd={endSession} />}
    </div>
  );
}
