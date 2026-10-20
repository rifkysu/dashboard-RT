import React from 'react';
import RuangRapatSchedule from '../components/RuangRapatSchedule';
import GuestBooking from '../components/GuestBooking';

export default function PublicRuangRapat() {
  return (
    <div className="min-h-screen bg-[#f2f4f7] p-4 md:p-6">
      <div className="max-w-[1500px] mx-auto">
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
