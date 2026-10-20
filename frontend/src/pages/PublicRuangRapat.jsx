import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api';
import { subscribeLive } from '../live';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import RuangRapatSchedule from '../components/RuangRapatSchedule';
import GuestBooking from '../components/GuestBooking';

// Kiosk /jadwal-rapat bisa dinonaktifkan admin lewat Settings > Mode Maintenance ("Kiosk Jadwal Rapat").
// Admin & Kabag yang sedang login tetap bisa membuka halaman ini (dengan banner pemberitahuan).
function useKioskMaintenance() {
  const [status, setStatus] = useState(null); // null = memuat; false = aktif normal; { message } = maintenance
  useEffect(() => {
    const refresh = () => api.get('/maintenance/public-status/kiosk')
      .then((r) => setStatus(r.data?.data?.is_active ? r.data.data : false))
      .catch(() => setStatus(false));
    refresh();
    return subscribeLive((topic) => { if (topic === 'maintenance' || topic === '*') refresh(); });
  }, []);
  return status;
}

function KioskMaintenanceNotice({ message }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-dinas-dark bg-kawung-gelap">
      <div className="max-w-lg w-full bg-white rounded-2xl p-8 shadow-xl text-center">
        <BrandMark size="sm" className="mx-auto" />
        <div className="mt-5 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-sm font-semibold">
          <span className="material-symbols-outlined text-[20px]">build</span>Sedang dalam pemeliharaan sistem
        </div>
        <h2 className="font-display text-xl font-extrabold text-dinas-ink mt-4">Kiosk jadwal ruang rapat sementara tidak tersedia</h2>
        <p className="text-sm text-slate-600 mt-2">{message || 'Silakan coba lagi nanti. Halaman ini akan kembali otomatis begitu pemeliharaan selesai.'}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link to="/" className="px-5 py-2.5 rounded-lg border border-slate-300 text-sm font-semibold text-slate-700 hover:bg-slate-50">Ke beranda</Link>
          <Link to="/login" className="px-5 py-2.5 rounded-lg bg-dinas text-white text-sm font-semibold hover:bg-dinas-dark">Masuk ke aplikasi</Link>
        </div>
      </div>
    </div>
  );
}

export default function PublicRuangRapat() {
  const { isAdmin, loading } = useAuth();
  const down = useKioskMaintenance();

  if (down === null || loading) return <div className="min-h-screen flex items-center justify-center bg-[#f2f4f7] text-slate-400 text-sm">Memuat…</div>;
  if (down && !isAdmin) return <KioskMaintenanceNotice message={down.message} />;

  return (
    <div className="min-h-screen bg-[#f2f4f7] p-4 md:p-6">
      <div className="max-w-[1500px] mx-auto">
        {down && (
          <div className="mb-4 flex flex-wrap items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-sm text-amber-800">
            <span className="material-symbols-outlined text-[20px]">build</span>
            <b>Mode maintenance kiosk aktif.</b> Pengunjung melihat halaman pemeliharaan; Anda melihat halaman ini karena login sebagai Admin/Kabag.
            <Link to="/settings" className="ml-auto font-semibold underline">Atur di Settings</Link>
          </div>
        )}
        <div className="border-b border-slate-300 pb-4 mb-5">
          <div className="text-xs font-semibold text-slate-500">Biro Umum dan Rumah Tangga · Kementerian Ketenagakerjaan</div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mt-1">Jadwal Ruang Rapat</h1>
          <p className="text-sm text-slate-500 mt-1">Tanggal dan minggu otomatis mengikuti waktu perangkat. Ruangan berganti sendiri tiap 30 detik dan tabel selalu kembali ke hari ini. Data diperbarui real-time.</p>
        </div>
        <div className="mb-5"><GuestBooking /></div>
        <RuangRapatSchedule autoRotate />
        <div className="mt-4 text-xs text-slate-500">Jadwal di halaman ini hanya untuk dilihat (tanpa edit, cancel, atau upload surat). Tamu tanpa akun pegawai bisa booking lewat tombol Login dengan Google di atas.</div>
      </div>
    </div>
  );
}
