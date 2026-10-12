import React, { useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import { useFeedback } from '../components/Feedback';
import { NAME_RE, HP_RE, normalizePhone } from '../utils/validation';

const roleLabel = { karyawan: 'Karyawan', kabag: 'Kepala Bagian', pic: 'PIC', admin: 'Admin' };
const roleDesc = {
  karyawan: 'Dapat mengajukan permintaan dan memakai menu umum.',
  pic: 'Mengelola permintaan yang menjadi tanggung jawabnya.',
  kabag: 'Memantau dan memproses seluruh permintaan bagian.',
  admin: 'Akses penuh, termasuk Akun & Akses dan Settings.',
};
// Sama dengan pilihan di halaman Daftar Akun (pages/Register.jsx).
const unitLabel = {
  rt: 'Bagian Rumah Tangga',
  perlengkapan: 'Bagian Perlengkapan & Pengadaan',
  kendaraan: 'Subbag Pengelolaan Kendaraan',
  protokol: 'Subbag Persuratan & Protokoler',
  lainnya: 'Unit Kerja Lainnya',
};
const initials = (nama) => String(nama || 'U').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const fmtTanggal = (v) => (v ? new Date(v).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : '-');

function InfoField({ icon, label, value }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3.5">
      <span className="shrink-0 w-9 h-9 rounded-lg bg-dinas-soft text-dinas flex items-center justify-center">
        <span className="material-symbols-outlined text-[19px]">{icon}</span>
      </span>
      <div className="min-w-0">
        <div className="text-[11px] font-semibold text-slate-500">{label}</div>
        <div className="mt-0.5 text-sm font-semibold text-slate-800 break-words">{value || '-'}</div>
      </div>
    </div>
  );
}

function EditField({ icon, label, value, onChange, error, ...props }) {
  return (
    <label className="block rounded-xl border border-slate-200 bg-white p-3.5">
      <span className="flex items-center gap-2 text-[11px] font-semibold text-slate-500">
        <span className="material-symbols-outlined text-[16px] text-dinas">{icon}</span>{label}
      </span>
      <input value={value} onChange={(e) => onChange(e.target.value)} className={`mt-1.5 w-full rounded-lg border px-3 py-2 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-dinas/30 ${error ? 'border-red-400' : 'border-slate-300'}`} {...props} />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

function validateProfile({ nama_lengkap, no_hp }) {
  const errors = {};
  const nama = nama_lengkap.trim();
  if (nama.length < 3 || !NAME_RE.test(nama)) errors.nama_lengkap = 'Minimal 3 karakter; hanya huruf, spasi, titik, koma, apostrof, dan tanda hubung.';
  if (!HP_RE.test(normalizePhone(no_hp))) errors.no_hp = 'Contoh: 081234567890 atau +6281234567890.';
  return errors;
}

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const { toast } = useFeedback();
  const [form, setForm] = useState(null); // null = mode lihat
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setForm({ nama_lengkap: user?.nama_lengkap || '', no_hp: user?.no_hp || '' }); setErrors({}); };
  const set = (key) => (v) => { setForm((f) => ({ ...f, [key]: v })); setErrors((e) => ({ ...e, [key]: undefined })); };

  async function onSave(e) {
    e.preventDefault();
    const errs = validateProfile(form);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await api.put('/auth/me', { nama_lengkap: form.nama_lengkap.trim(), no_hp: normalizePhone(form.no_hp) });
      await refreshUser();
      setForm(null);
      toast('Profil berhasil disimpan.');
    } catch (err) {
      toast(err.response?.data?.message || 'Gagal menyimpan profil.', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="menu-page menu-profile max-w-4xl mx-auto">
      <div className="menu-hero mb-6"><div><span className="menu-kicker">Biro Umum / Profil</span><h1 className="text-3xl font-bold">Profil Saya</h1><p className="text-sm mt-1">Informasi akun kamu.</p></div></div>
      <div className="space-y-5">
        {/* Kartu identitas */}
        <section className="profile-card bg-white border border-slate-200 rounded-2xl overflow-hidden">
          <div className="profile-cover"></div>
          <div className="px-5 sm:px-6 pb-5 -mt-10 flex flex-col sm:flex-row sm:items-end gap-4">
            <span className="profile-avatar">{initials(user?.nama_lengkap)}</span>
            <div className="min-w-0 flex-1 sm:pb-1">
              <h2 className="text-xl font-extrabold text-slate-900 truncate">{user?.nama_lengkap || '-'}</h2>
              <p className="text-xs text-slate-500 truncate">{user?.email || '-'}</p>
            </div>
            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-dinas-soft text-dinas text-xs font-bold">
              <span className="material-symbols-outlined text-[16px]">verified_user</span>{roleLabel[user?.role] || user?.role || '-'}
            </span>
          </div>
          {roleDesc[user?.role] && <div className="mx-5 sm:mx-6 mb-5 rounded-lg bg-slate-50 border border-slate-200 px-3.5 py-2.5 text-xs text-slate-600">{roleDesc[user.role]}</div>}
        </section>

        <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="font-bold text-slate-900 flex items-center gap-2"><span className="material-symbols-outlined text-[20px] text-dinas">badge</span>Informasi Akun</h2>
            {!form && (
              <button type="button" onClick={startEdit} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-sm font-semibold text-dinas hover:border-dinas hover:bg-dinas hover:text-white transition">
                <span className="material-symbols-outlined text-[18px]">edit</span>Edit
              </button>
            )}
          </div>
          <form noValidate onSubmit={onSave}>
          <div className="grid sm:grid-cols-2 gap-3">
            {form
              ? <EditField icon="person" label="Nama Lengkap" value={form.nama_lengkap} onChange={set('nama_lengkap')} error={errors.nama_lengkap} maxLength={150} autoComplete="name" autoFocus />
              : <InfoField icon="person" label="Nama Lengkap" value={user?.nama_lengkap} />}
            <InfoField icon="mail" label="Email" value={user?.email} />
            {form
              ? <EditField icon="call" label="No. HP" value={form.no_hp} onChange={set('no_hp')} error={errors.no_hp} maxLength={20} type="tel" inputMode="tel" autoComplete="tel" />
              : <InfoField icon="call" label="No. HP" value={user?.no_hp} />}
            <InfoField icon="apartment" label="Unit Kerja" value={unitLabel[user?.unit_kerja] || user?.unit_kerja} />
            <InfoField icon="login" label="Metode Login" value={user?.sso_provider ? `SSO (${user.sso_provider})` : 'Email & kata sandi'} />
            <InfoField icon="event" label="Terdaftar Sejak" value={fmtTanggal(user?.created_at)} />
          </div>
          {form && (
            <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
              <button type="button" onClick={() => setForm(null)} disabled={saving} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Batal</button>
              <button type="submit" disabled={saving} className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-dinas text-white text-sm font-semibold hover:opacity-90 disabled:opacity-60">
                <span className="material-symbols-outlined text-[18px]">save</span>{saving ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          )}
          </form>
        </section>

      </div>
    </div>
  );
}
