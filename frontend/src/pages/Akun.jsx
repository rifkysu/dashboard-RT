import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import api from '../api';
import { useAuth } from '../context/AuthContext';

const roleLabel = { karyawan: 'Karyawan', kabag: 'Kepala Bagian', pic: 'PIC', admin: 'Admin' };
const roleBadge = {
  karyawan: 'bg-slate-100 text-slate-700 border border-slate-300',
  pic: 'bg-blue-50 text-blue-700 border border-blue-200',
  kabag: 'bg-violet-50 text-violet-700 border border-violet-200',
  admin: 'bg-amber-50 text-amber-700 border border-amber-200',
};

function fmt(v) {
  return v ? new Date(v).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
}

export default function Akun() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  function load() {
    setLoading(true);
    api.get('/users').then((res) => { setData(res.data.data || []); setError(''); })
      .catch((err) => setError(err.response?.data?.message || 'Gagal memuat daftar akun.'))
      .finally(() => setLoading(false));
  }
  useEffect(load, []);

  if (user && user.role !== 'admin') return <Navigate to="/dashboard" replace />;

  return (
    <div className="menu-page menu-akun relative" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <div className="menu-hero mb-6">
        <div>
          <span className="menu-kicker">ADMIN • MANAJEMEN AKUN</span>
          <h1 className="text-2xl font-bold">Akun & Akses Pengguna</h1>
          <p className="text-sm mt-1">Pantau siapa saja yang punya akses ke sistem, role, dan kapan terakhir login.</p>
        </div>
        <div className="menu-hero-icon"><span className="material-symbols-outlined">group</span></div>
      </div>

      <div className="flex items-center justify-between gap-4 mb-5">
        <div className="text-sm text-slate-600">{data.length} akun terdaftar</div>
        <button onClick={load} className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <span className="material-symbols-outlined text-[16px]">refresh</span>Refresh
        </button>
      </div>

      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-xs text-red-700">{error}</div>}

      <div className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-lg shadow-slate-200/40">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b-2 border-slate-200">
              <tr className="divide-x divide-slate-200">
                {['Nama Lengkap', 'Email', 'Role', 'No. HP', 'Unit Kerja', 'Login Via', 'Status', 'Tanggal Daftar', 'Terakhir Login'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && <tr><td colSpan={9} className="py-8 text-center text-slate-400">Memuat data...</td></tr>}
              {!loading && data.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-slate-400">Belum ada akun.</td></tr>}
              {data.map((u) => (
                <tr key={u.id} className="divide-x divide-slate-100 hover:bg-slate-50/50">
                  <td className="px-4 py-3 font-semibold text-slate-800">{u.nama_lengkap}</td>
                  <td className="px-4 py-3 text-slate-600">{u.email}</td>
                  <td className="px-4 py-3"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${roleBadge[u.role] || roleBadge.karyawan}`}>{roleLabel[u.role] || u.role}</span></td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{u.no_hp || '-'}</td>
                  <td className="px-4 py-3 text-slate-600">{u.unit_kerja || '-'}</td>
                  <td className="px-4 py-3 text-slate-600 capitalize whitespace-nowrap">{u.sso_provider ? `SSO (${u.sso_provider})` : 'Email/Password'}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmt(u.created_at)}</td>
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{u.last_login_at ? fmt(u.last_login_at) : <span className="text-slate-400 italic">Belum pernah login</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
