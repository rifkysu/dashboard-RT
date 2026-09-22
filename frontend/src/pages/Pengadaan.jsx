import React, { useEffect, useState } from 'react';
import api from '../api';
import { useAuth } from '../context/AuthContext';
import BrandMark from '../components/BrandMark';
import PaymentMethodDetail from '../components/PaymentMethodDetail';

const statusPill = {
  pending: 'bg-red-50 text-red-700',
  on_progress: 'bg-amber-50 text-amber-700',
  selesai: 'bg-emerald-50 text-emerald-700',
};
const statusLabel = { pending: 'Pending', on_progress: 'On Progress', selesai: 'Selesai' };

const emptyForm = {
  nama_barang_jasa: '', kategori: 'barang', lokasi: '', titik_lokasi: '', metode_pengadaan: '', nilai_hps: '', tanggal: '', deskripsi: '', request_document_name: '', request_document_file_data: null,
};

const stages = [
  { no: 1, field: 'tahap1_status', icon: 'calculate', title: 'Analisa & HPS', short: 'Analisa Harga & HPS', desc: 'Rincian kebutuhan, metode pengadaan, estimasi HPS, dan dokumen analisa harga.' },
  { no: 2, field: 'tahap2_status', icon: 'payments', title: 'Invoice & Pembayaran', short: 'Invoice & Pembayaran', desc: 'Data vendor, invoice, nominal tagihan, dan informasi pembayaran.' },
  { no: 3, field: 'tahap3_status', icon: 'verified', title: 'Dokumentasi Finalisasi', short: 'BAST & Dokumentasi', desc: 'Dokumentasi pengadaan, catatan penyelesaian, dan finalisasi.' },
];

const inputClass = 'w-full h-11 px-3 rounded-lg border border-slate-300 bg-slate-50/70 text-sm text-slate-800 outline-none focus:bg-white focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10';
const labelClass = 'block text-sm font-semibold text-slate-800 mb-2';

function money(value) {
  if (value === null || value === undefined || value === '') return '';
  return new Intl.NumberFormat('id-ID').format(Number(value));
}

export default function Pengadaan() {
  const { user, canEditRow, refreshAuth } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [selectedStage, setSelectedStage] = useState(null);
  const [draft, setDraft] = useState({});
  const [saving, setSaving] = useState(false);
  const [viewer, setViewer] = useState({open:false,name:'',data:''});
  const [exportDateRange, setExportDateRange] = useState({ mulai: '', sampai: '' });
  const [filters, setFilters] = useState({ kategori: '', lokasi: '', titik_lokasi: '', status: '', id: '', nama: '', pic: '', vendor: '', nilai_invoice: '', tanggal_input: '', tanggal_selesai: '' });

  function load() {
    setLoading(true);
    api.get('/pengadaan').then((res) => setData(res.data.data || [])).catch((err) => { console.error('[LOAD PENGADAAN]', err); setError(err.response?.data?.message || 'Gagal memuat pengadaan.'); }).finally(() => setLoading(false));
  }
  useEffect(load, []);

  function openStage(row, stage) {
    setSelectedRow(row);
    setSelectedStage(stage);
    setDraft({ ...row, nilai_hps: row.nilai_hps ?? '', stage2_invoice_amount: row.stage2_invoice_amount ?? '' });
  }

  function closeStage() {
    if (!saving) { setSelectedRow(null); setSelectedStage(null); setDraft({}); }
  }

  async function saveStage(nextStageNo = null, finish = false) {
    if (!selectedRow || !selectedStage || !canEditRow(selectedRow)) return;
    setSaving(true);
    try {
      const payload = {};
      const fields = [
        'nama_barang_jasa', 'kategori', 'lokasi', 'titik_lokasi', 'metode_pengadaan', 'nilai_hps', 'deskripsi', 'request_document_name', 'request_document_file_data',
        'stage2_payment_method', 'stage2_payment_number', 'stage2_ls_date', 'stage2_vendor', 'stage2_invoice_number', 'stage2_invoice_amount', 'tanggal', 'status', 'stage2_invoice_document_name', 'stage2_invoice_file_data', 'stage2_payment_proof_name', 'stage2_payment_proof_file_data', 'stage3_final_document_name', 'stage3_final_document_file_data', 'tahap1_status', 'tahap2_status', 'tahap3_status', 'catatan',
      ];
      fields.forEach((field) => {
        if (draft[field] !== undefined) payload[field] = draft[field] === '' ? null : draft[field];
      });

      // Sama seperti Pemeliharaan: tombol lanjut menyelesaikan tahap aktif
      // terlebih dahulu, sehingga tahap berikutnya langsung tersedia.
      if (finish) {
        payload.tahap3_status = 'selesai';
        payload.status = 'selesai';
        // Jangan ambil tanggal_selesai dari draft lama. Finish Tahap 3 selalu meminta DB mengisinya.
        payload.tanggal_selesai = new Date().toISOString().slice(0, 10);
      } else if (nextStageNo) {
        payload[selectedStage.field] = 'selesai';
        payload.status = 'on_progress';
      } else if (payload[selectedStage.field] && payload[selectedStage.field] !== 'pending' && selectedRow.status === 'pending') {
        payload.status = 'on_progress';
      }

      const res = await api.put(`/pengadaan/${selectedRow.id}`, payload);
      const updated = res.data.data;
      setData((current) => current.map((item) => item.id === updated.id ? updated : item));
      if (nextStageNo) {
        const next = stages.find((s) => s.no === nextStageNo);
        openStage(updated, next);
      } else if (finish) {
        closeStage();
      } else {
        setSelectedRow(updated);
        setDraft(updated);
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Gagal menyimpan data tahap.');
    } finally { setSaving(false); }
  }

  async function handleAdd(e) {
    e.preventDefault(); setError('');
    try {
      const res = await api.post('/pengadaan', {
        nama_barang_jasa: form.nama_barang_jasa,
        kategori: form.kategori,
        lokasi: form.lokasi,
        titik_lokasi: form.titik_lokasi,
        metode_pengadaan: form.metode_pengadaan,
        tanggal: form.tanggal,
        deskripsi: form.deskripsi,
        request_document_name: form.request_document_name || null,
        request_document_file_data: form.request_document_file_data || null,
      });
      // Kalau backend mempromosikan role karyawan -> PIC, sinkronkan token & user di sesi ini.
      if (res.data.token) refreshAuth(res.data.token, res.data.user);
      setShowAddForm(false); setForm(emptyForm); load();
    } catch (err) { setError(err.response?.data?.message || 'Gagal menambahkan pengadaan.'); }
  }

  const visibleData = data.filter((row) => {
    const value = (v) => String(v || '').trim().toLowerCase();
    const categoryMatch = !filters.kategori || value(row.kategori) === value(filters.kategori);
    const locationMatch = !filters.lokasi || value(row.lokasi) === value(filters.lokasi);
    const pointMatch = !filters.titik_lokasi || value(row.titik_lokasi).includes(value(filters.titik_lokasi));
    const statusMatch = !filters.status || row.status === filters.status;
    const idMatch = !filters.id || value(row.kode).includes(value(filters.id));
    const nameMatch = !filters.nama || value(row.nama_barang_jasa).includes(value(filters.nama));
    const picMatch = !filters.pic || value(row.pic).includes(value(filters.pic));
    const vendorMatch = !filters.vendor || value(row.stage2_vendor).includes(value(filters.vendor));
    const invoiceMatch = !filters.nilai_invoice || value(row.stage2_invoice_amount).includes(value(filters.nilai_invoice));
    const tanggalInputMatch = !filters.tanggal_input || String(row.tanggal || '').slice(0, 10) === filters.tanggal_input;
    const tanggalSelesaiMatch = !filters.tanggal_selesai || String(row.tanggal_selesai || '').slice(0, 10) === filters.tanggal_selesai;
    return categoryMatch && locationMatch && pointMatch && statusMatch && idMatch && nameMatch && picMatch && vendorMatch && invoiceMatch && tanggalInputMatch && tanggalSelesaiMatch;
  });

  function exportExcel() {
    const exportData = visibleData.filter((row) => {
      const tanggal = String(row.tanggal || '').slice(0, 10);
      const mulaiMatch = !exportDateRange.mulai || tanggal >= exportDateRange.mulai;
      const sampaiMatch = !exportDateRange.sampai || tanggal <= exportDateRange.sampai;
      return mulaiMatch && sampaiMatch;
    });
    if (!exportData.length) return alert('Tidak ada data yang sesuai dengan filter dan rentang tanggal untuk diekspor.');
    const headers = ['ID Request','Nama Barang/Jasa','Lokasi','Titik Lokasi','Kategori','PIC RT','Nama Perusahaan','Nilai Invoice','Tanggal Input','Status','Tanggal Selesai'];
    const body = exportData.map(row => [row.kode,row.nama_barang_jasa,row.lokasi || '-',row.titik_lokasi || '-',row.kategori || '-',row.pic || '-',row.stage2_vendor || '-',row.stage2_invoice_amount ? `Rp ${money(row.stage2_invoice_amount)}` : '-',String(row.tanggal || '').slice(0,10),statusLabel[row.status] || row.status,row.status === 'selesai' ? (String(row.tanggal_selesai || '').slice(0,10) || '-') : '-']);
    const html = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${body.map(r => `<tr>${r.map(v => `<td>${String(v).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const blob = new Blob([`\ufeff${html}`], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `pengadaan_filtered_${new Date().toISOString().slice(0,10)}.xls`; a.click(); URL.revokeObjectURL(url);
  }

  const roleLabel = user?.role === 'kabag' ? 'Kabag' : user?.role === 'pic' ? 'PIC' : 'Karyawan';

  return (
    <div className="menu-page menu-pengadaan relative">
      <div className="menu-hero mb-6"><div><span className="menu-kicker">PENGADAAN • BARANG & JASA</span><h1 className="text-2xl font-bold text-slate-900">Pengadaan</h1><p className="text-sm text-slate-600 mt-1">Kelola dan pantau proses pengadaan barang dan jasa.</p></div><div className="menu-hero-icon"><span className="material-symbols-outlined">shopping_cart</span></div></div>
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Daftar Permintaan Pengadaan</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola dan pantau status pengadaan barang dan jasa.</p>
        </div>
        <button onClick={() => { setError(''); setShowAddForm(true); }} className="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white text-sm font-semibold rounded-xl hover:from-indigo-700 hover:to-blue-700 shadow-lg shadow-indigo-200">
          <span className="material-symbols-outlined text-[18px]">add</span>Tambah Pengadaan
        </button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end justify-end gap-3 mb-4">
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal mulai export</label>
          <input type="date" value={exportDateRange.mulai} onChange={e=>setExportDateRange(r=>({...r,mulai:e.target.value}))} className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1">Tanggal sampai export</label>
          <input type="date" value={exportDateRange.sampai} onChange={e=>setExportDateRange(r=>({...r,sampai:e.target.value}))} className="h-11 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-700" />
        </div>
        <button onClick={exportExcel} className="h-11 px-4 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700">
          <span className="material-symbols-outlined text-[18px] align-middle mr-1">download</span>
          Export Excel ({visibleData.length})
        </button>
      </div>

      <div className="bg-white/90 backdrop-blur rounded-2xl border border-white/80 overflow-hidden shadow-lg shadow-slate-200/40">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10"><tr>
            {['ID Request','Nama Barang/Jasa','Lokasi','Titik Lokasi','Kategori','PIC RT','Nama Perusahaan','Nilai Invoice','Tanggal Input','Status','Tanggal Selesai','Aksi (Tahapan Alur)'].map((h) => <th key={h} className="py-3 px-5 text-left text-xs font-semibold text-slate-500 uppercase whitespace-nowrap">{h}</th>)}
          </tr>
          <tr className="bg-white border-b border-slate-200">
            <th className="p-2"><input placeholder="Filter ID" value={filters.id} onChange={e=>setFilters(f=>({...f,id:e.target.value}))} className="w-full h-8 px-2 text-xs border rounded"/></th>
            <th className="p-2"><input placeholder="Filter nama" value={filters.nama} onChange={e=>setFilters(f=>({...f,nama:e.target.value}))} className="w-full h-8 px-2 text-xs border rounded"/></th>
            <th className="p-2"><select value={filters.lokasi} onChange={e=>setFilters(f=>({...f,lokasi:e.target.value}))} className="w-full h-8 text-xs border rounded"><option value="">Semua Lokasi</option><option>Graha Kemnaker</option><option>Gatsu 51</option><option>Wisma Ciloto</option><option>Rumah Dinas</option><option>RC Walang</option><option>RC Kranji</option></select></th>
            <th className="p-2"><input type="text" placeholder="Filter titik lokasi" value={filters.titik_lokasi} onChange={e=>setFilters(f=>({...f,titik_lokasi:e.target.value}))} className="w-full h-8 px-2 text-xs border rounded"/></th>
            <th className="p-2"><select value={filters.kategori} onChange={e=>setFilters(f=>({...f,kategori:e.target.value}))} className="w-full h-8 text-xs border rounded"><option value="">Semua</option><option value="barang">Barang</option><option value="jasa">Jasa</option></select></th>
            <th className="p-2"><input type="text" placeholder="Filter PIC RT" value={filters.pic} onChange={e=>setFilters(f=>({...f,pic:e.target.value}))} className="w-full h-8 px-2 text-xs border rounded"/></th>
            <th className="p-2"><input type="text" placeholder="Filter Nama Perusahaan" value={filters.vendor} onChange={e=>setFilters(f=>({...f,vendor:e.target.value}))} className="w-full h-8 px-2 text-xs border rounded"/></th>
            <th className="p-2"><input type="text" placeholder="Filter invoice" value={filters.nilai_invoice} onChange={e=>setFilters(f=>({...f,nilai_invoice:e.target.value}))} className="w-full h-8 px-2 text-xs border rounded"/></th>
            <th className="p-2"><input type="date" title="Filter tanggal input" value={filters.tanggal_input} onChange={e=>setFilters(f=>({...f,tanggal_input:e.target.value}))} className="w-full h-8 px-2 text-xs border rounded"/></th>
            <th className="p-2"><select value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))} className="w-full h-8 text-xs border rounded"><option value="">Semua</option><option value="pending">Pending</option><option value="on_progress">On Progress</option><option value="selesai">Selesai</option></select></th>
            <th className="p-2"><input type="date" title="Filter tanggal selesai" value={filters.tanggal_selesai} onChange={e=>setFilters(f=>({...f,tanggal_selesai:e.target.value}))} className="w-full h-8 px-2 text-xs border rounded"/></th>
            <th></th>
          </tr></thead>
          <tbody className="divide-y divide-slate-100">
            {loading && <tr><td colSpan={12} className="py-8 text-center text-slate-400">Memuat data...</td></tr>}
            {!loading && visibleData.length === 0 && <tr><td colSpan={12} className="py-8 text-center text-slate-400">Belum ada data.</td></tr>}
            {visibleData.map((row) => <tr key={row.id} className="hover:bg-slate-50/50">
              <td className="py-3 px-5 font-semibold text-slate-800">#{row.kode}</td>
              <td className="py-3 px-5 max-w-[220px] truncate font-semibold text-slate-800">{row.nama_barang_jasa}</td>
              <td className="py-3 px-5 text-slate-500">{row.lokasi || '-'}</td>
              <td className="py-3 px-5 text-slate-500">{row.titik_lokasi || '-'}</td>
              <td className="py-3 px-5"><span className="inline-flex px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold capitalize">{row.kategori || '-'}</span></td>
              <td className="py-3 px-5 text-slate-700 font-medium">{row.pic || '-'}</td>
              <td className="py-3 px-5 text-slate-500">{row.stage2_vendor || '-'}</td>
              <td className="py-3 px-5 text-slate-500">{row.stage2_invoice_amount ? `Rp ${money(row.stage2_invoice_amount)}` : '-'}</td>
              <td className="py-3 px-5 text-slate-500">{row.tanggal?.slice(0,10)}</td>
              <td className="py-3 px-5"><span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${statusPill[row.status]}`}>{statusLabel[row.status]}</span></td>
              <td className="py-3 px-5 text-slate-500 whitespace-nowrap">{row.status === 'selesai' && row.tanggal_selesai ? row.tanggal_selesai.slice(0,10) : '-'}</td>
              <td className="py-3 px-5"><div className="flex items-center justify-center gap-2">
                {stages.map((stage) => {
                  const value = row[stage.field]; const done = value === 'selesai'; const active = value === 'on_progress';
                  const rowEditable = canEditRow(row);
                  const previousStageDone = stage.no === 1 || row[stages[stage.no - 2].field] === 'selesai';
                  const visibleForRole = !rowEditable || previousStageDone;
                  if (!visibleForRole) return null;
                  return <button key={stage.field} type="button" onClick={() => openStage(row, stage)} title={`${stage.title} — ${rowEditable ? 'lihat/edit' : 'lihat'}`} className={`w-9 h-9 rounded-lg border flex items-center justify-center shadow-sm transition ${done ? 'bg-slate-900 text-white border-slate-900' : active ? 'bg-blue-100 text-blue-700 border-blue-200' : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}><span className="material-symbols-outlined text-[18px]">{stage.icon}</span></button>;
                })}
              </div></td>
            </tr>)}
          </tbody>
        </table></div>
      </div>
      <div className="flex justify-center py-4"><button onClick={()=>window.scrollTo({top:document.body.scrollHeight,behavior:'smooth'})} className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-semibold text-slate-600">Scroll ke bawah ↓</button></div>

      {selectedRow && selectedStage && <StageModal
        row={selectedRow} stage={selectedStage} draft={draft} setDraft={setDraft} canEdit={canEditRow(selectedRow)} roleLabel={roleLabel}
        saving={saving} onClose={closeStage} onSave={saveStage}
        onBack={() => selectedStage.no > 1 && openStage(selectedRow, stages[selectedStage.no - 2])}
        onNext={() => saveStage(selectedStage.no + 1)}
        onFinish={() => saveStage(null, true)}
        onView={(name,data)=>setViewer({open:true,name,data})}
      />}

      <DocumentViewer open={viewer.open} name={viewer.name} data={viewer.data} onClose={()=>setViewer({open:false,name:'',data:''})} />
      {showAddForm && <AddModal form={form} setForm={setForm} error={error} onClose={() => { setShowAddForm(false); setForm(emptyForm); }} onSubmit={handleAdd} />}
    </div>
  );
}

function StageModal({ row, stage, draft, setDraft, canEdit, roleLabel, saving, onClose, onSave, onBack, onNext, onFinish, onView }) {
  const update = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const readOnly = !canEdit;
  const stageStatus = draft[stage.field] || 'pending';

  return <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm overflow-y-auto p-4 md:p-8" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="min-h-full flex items-start justify-center">
      <div className="w-full max-w-6xl bg-[#f7f9fb] rounded-xl shadow-2xl overflow-hidden">
        <div className="bg-white border-b border-slate-200 px-5 md:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3"><BrandMark size="xs" /><div><div className="font-semibold text-slate-900">Biro Umum</div><div className="text-[10px] uppercase tracking-wider text-slate-500">Rumah Tangga</div></div></div>
          <button onClick={onClose} className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100"><span className="material-symbols-outlined">close</span></button>
        </div>

        <main className="p-5 md:p-8">
          <div className="flex flex-col gap-2 mb-6">
            <button onClick={onClose} className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm w-fit"><span className="material-symbols-outlined text-[18px]">arrow_back</span>Kembali ke Daftar Pengadaan <span className="text-slate-300">/</span><span className="font-semibold text-slate-900">Tahap {stage.no}</span></button>
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
              <div><h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900">Pengadaan - Tahap {stage.no}: {stage.title}</h1><p className="text-sm text-slate-500 mt-1">Langkah {stage.no} dari 3: {stage.desc}</p></div>
              <div className="flex items-center gap-2 text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full w-fit shrink-0"><span className="material-symbols-outlined text-[18px]">info</span><span className="text-[11px] uppercase tracking-wider font-semibold">ID Request: {row.kode}</span></div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 md:p-6 shadow-sm mb-8"><div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {stages.map((s) => { const active = s.no === stage.no; const done = (draft[s.field] || 'pending') === 'selesai'; const locked = s.no > 1 && (draft[stages[s.no - 2].field] || 'pending') !== 'selesai'; return <button type="button" key={s.no} disabled={locked && canEdit} onClick={() => { if (locked) return; if (s.no !== stage.no) s.no < stage.no ? onBack() : onNext(); }} className={`relative flex items-center gap-4 p-3 rounded-lg text-left ${locked ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}>
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center shrink-0 shadow-sm ${active ? 'bg-slate-200 text-slate-900' : done ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}><span className="material-symbols-outlined text-[24px]">{s.icon}</span></div>
              <div className="flex flex-col min-w-0"><div className="flex items-center gap-2"><span className="text-[10px] uppercase tracking-widest text-slate-500 font-bold">Langkah 0{s.no}</span>{active && <span className="px-2 py-0.5 rounded-full bg-slate-900 text-white text-[10px] font-bold">AKTIF</span>}</div><span className="text-sm font-semibold text-slate-900 truncate">{s.short}</span><span className="text-xs text-slate-500">{locked ? 'Menunggu tahap sebelumnya' : statusLabel[draft[s.field] || 'pending']}</span></div>
            </button>; })}
          </div></div>

          <div className="bg-slate-100 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 mb-8"><div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700"><span><b>Barang/Jasa:</b> {row.nama_barang_jasa}</span><span className="hidden sm:inline text-slate-300">•</span><span><b>Lokasi:</b> {row.lokasi || '-'}</span>{row.titik_lokasi && <><span className="hidden sm:inline text-slate-300">•</span><span><b>Titik Lokasi:</b> {row.titik_lokasi}</span></>}<span className="hidden sm:inline text-slate-300">•</span><span><b>Status:</b> {statusLabel[row.status]}</span></div><span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusPill[stageStatus]}`}>{statusLabel[stageStatus]}</span></div>

          {stage.no === 1 && <PengadaanStageOne draft={draft} update={update} readOnly={readOnly} />}
          {stage.no === 2 && <PengadaanStageTwo draft={draft} update={update} readOnly={readOnly} onView={onView} />}
          {stage.no === 3 && <PengadaanStageThree draft={draft} update={update} readOnly={readOnly} onView={onView} />}

          {!canEdit && <div className="mt-6 bg-slate-100 border border-slate-200 rounded-xl p-4 text-sm text-slate-600"><b>Mode lihat saja.</b> Role {roleLabel} dapat melihat data Tahap {stage.no}, tetapi tidak dapat mengubah atau menyimpan perubahan. Pengeditan hanya untuk Kabag, Admin, dan PIC yang menambahkan pengadaan ini.</div>}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <div>{stage.no > 1 && <button disabled={saving} onClick={onBack} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><span className="material-symbols-outlined text-[17px] align-middle mr-1">arrow_back</span>Kembali ke Tahap {stage.no - 1}</button>}</div>
            <div className="flex items-center gap-2"><button disabled={saving} onClick={onClose} className="px-4 py-2.5 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-100">Batal</button>{canEdit && <><button disabled={saving} onClick={() => onSave()} className="px-4 py-2.5 rounded-lg bg-slate-100 text-slate-900 text-sm font-semibold hover:bg-slate-200">{saving ? 'Menyimpan...' : 'Simpan Draf'}</button>{stage.no < 3 ? <button disabled={saving} onClick={onNext} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800">Lanjut ke Tahap {stage.no + 1}<span className="material-symbols-outlined text-[17px] align-middle ml-1">arrow_forward</span></button> : <button disabled={saving} onClick={onFinish} className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"><span className="material-symbols-outlined text-[17px] align-middle mr-1">check</span>Selesaikan Pengadaan</button>}</>}</div>
          </div>
        </main>
      </div>
    </div>
  </div>;
}

function PengadaanStageOne({ draft, update, readOnly }) {
  return <section className="bg-white/90 backdrop-blur rounded-2xl shadow-lg shadow-slate-200/40 p-6 md:p-8 border border-white/80"><h2 className="text-xl font-semibold text-slate-900 mb-6">Data Analisa Harga Perkiraan Sendiri (HPS)</h2><div className="space-y-7">
    <div><label className={labelClass}>Metode Pengadaan <span className="text-red-600">*</span></label><select disabled={readOnly} value={draft.metode_pengadaan || ''} onChange={(e) => update('metode_pengadaan', e.target.value)} className={inputClass}><option value="">Pilih Metode Pengadaan</option><option>Lelang</option><option>E-Purchasing</option><option>Pengadaan Langsung (PL)</option></select></div>
    <div><label className={labelClass}>Nama Barang / Jasa <span className="text-red-600">*</span></label><input disabled={readOnly} value={draft.nama_barang_jasa || ''} onChange={(e) => update('nama_barang_jasa', e.target.value)} className={inputClass}/></div>
    <div><label className={labelClass}>Input Nilai HPS <span className="text-red-600">*</span></label><div className="flex"><span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-sm font-semibold text-slate-600">Rp</span><input disabled={readOnly} type="number" min="0" value={draft.nilai_hps ?? ''} onChange={(e) => update('nilai_hps', e.target.value)} className="w-full h-11 px-3 rounded-r-lg border border-slate-300 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-slate-900 disabled:opacity-70" /></div>{draft.nilai_hps && <p className="text-xs text-slate-500 mt-1">Rp {money(draft.nilai_hps)}</p>}</div>
    <div className="bg-slate-100 rounded-xl p-5"><h3 className="font-semibold text-slate-900 mb-2">Informasi Penting</h3><p className="text-sm text-slate-600 leading-6">Setelah data analisa dan HPS selesai disimpan, Tahap 2 akan muncul dan dapat dilanjutkan.</p></div>
  </div></section>;
}

function PengadaanStageTwo({ draft, update, readOnly, onView }) {
  const handleFile = (nameField, dataField, file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran file maksimal 8MB.');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      alert('Format file hanya PDF, JPG, atau PNG.');
      return;
    }
    update(nameField, file.name);
    const reader = new FileReader();
    reader.onload = () => update(dataField, reader.result);
    reader.readAsDataURL(file);
  };

  const fileCard = (title, hint, nameField, dataField, icon) => (
    <div>
      <div className="flex items-center justify-between gap-3 mb-2">
        <label className={labelClass}>{title}</label>
        <span className="text-xs text-slate-500">PDF, JPG, PNG · Maks. 8MB</span>
      </div>
      <label className={`relative flex items-center gap-4 p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 ${readOnly ? 'cursor-default opacity-70' : 'cursor-pointer hover:bg-slate-100'}`}>
        <span className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-sm"><span className="material-symbols-outlined text-[24px] text-slate-600">{icon}</span></span>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-800 truncate">{draft[nameField] || hint}</div>
          <div className="text-xs text-slate-500 mt-1">{readOnly ? 'Mode lihat saja' : 'Klik untuk memilih berkas'}</div>
        </div>
        {draft[dataField] && <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(draft[nameField], draft[dataField]); }} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100">Lihat</button>}
        {!readOnly && <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(e) => handleFile(nameField, dataField, e.target.files?.[0])} />}
      </label>
    </div>
  );

  const methods = [['GUP','payments','Ganti Uang Persediaan','Untuk pengadaan operasional rutin menggunakan uang persediaan yang ada di bendahara.'],['TUP','price_change','Tambahan Uang Persediaan','Kebutuhan mendesak melebihi pagu UP reguler.'],['LS','account_balance','Pembayaran Langsung','Pembayaran langsung melalui KPPN / rekening kas umum ke penyedia.']];
  return <section className="bg-white/90 backdrop-blur rounded-2xl shadow-lg shadow-slate-200/40 p-6 md:p-8 border border-white/80"><h2 className="text-xl font-semibold text-slate-900 mb-6">Invoice & Pembayaran</h2><div className="space-y-7">
    <div><label className={labelClass}>1. METODE PEMBAYARAN <span className="text-red-600">*</span></label><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{methods.map(([v,icon,title,desc]) => <label key={v} className={`flex gap-3 p-4 rounded-xl border cursor-pointer ${draft.stage2_payment_method === v ? 'border-slate-900 bg-slate-50' : 'border-slate-200 bg-white'} ${readOnly ? 'cursor-default opacity-75' : ''}`}><input disabled={readOnly} type="radio" name="payment" checked={draft.stage2_payment_method === v} onChange={() => { update('stage2_payment_method', v); update('stage2_payment_number', null); update('stage2_ls_date', null); }} className="mt-1"/><span className="material-symbols-outlined text-slate-700">{icon}</span><span><b className="block text-sm text-slate-800">{v} — {title}</b><span className="text-xs text-slate-500 leading-5">{desc}</span></span></label>)}</div>
      {draft.stage2_payment_method && <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200 max-w-sm"><PaymentMethodDetail method={draft.stage2_payment_method} numberValue={draft.stage2_payment_number} dateValue={draft.stage2_ls_date} onNumberChange={(v) => update('stage2_payment_number', v)} onDateChange={(v) => update('stage2_ls_date', v)} readOnly={readOnly} inputClass={inputClass} labelClass="block text-xs font-semibold text-slate-600 mb-1.5" /></div>}
    </div>
    <div><label className={labelClass}>2. NAMA PERUSAHAAN <span className="text-red-600">*</span></label><input disabled={readOnly} value={draft.stage2_vendor || ''} onChange={(e) => update('stage2_vendor', e.target.value)} className={inputClass}/></div>
    <div><label className={labelClass}>3. NOMOR INVOICE / KUITANSI</label><input disabled={readOnly} value={draft.stage2_invoice_number || ''} onChange={(e) => update('stage2_invoice_number', e.target.value)} className={inputClass}/></div>
    <div><label className={labelClass}>4. NOMINAL TAGIHAN INVOICE</label><div className="flex"><span className="inline-flex items-center px-3 rounded-l-lg border border-r-0 border-slate-300 bg-slate-100 text-sm font-semibold text-slate-600">Rp</span><input disabled={readOnly} type="number" min="0" value={draft.stage2_invoice_amount ?? ''} onChange={(e) => update('stage2_invoice_amount', e.target.value)} className="w-full h-11 px-3 rounded-r-lg border border-slate-300 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-slate-900 disabled:opacity-70" /></div>{draft.stage2_invoice_amount && <p className="text-xs text-slate-500 mt-1">Rp {money(draft.stage2_invoice_amount)}</p>}</div>
    <div><label className={labelClass}>5. TANGGAL PENGADAAN / INVOICE</label><input disabled={readOnly} type="date" value={draft.tanggal || ''} onChange={(e) => update('tanggal', e.target.value)} className={inputClass}/></div>
    <div className="pt-1"><div className="mb-4"><h3 className="text-base font-semibold text-slate-900">6. DOKUMEN PENDUKUNG PEMBAYARAN</h3><p className="text-xs text-slate-500 mt-1">Unggah dokumen yang relevan dengan transaksi pengadaan agar proses verifikasi lebih lengkap.</p></div><div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {fileCard('Invoice / Kuitansi Sah', 'Pilih dokumen invoice / kuitansi', 'stage2_invoice_document_name', 'stage2_invoice_file_data', 'description')}
      {fileCard('Bukti Pembayaran', 'Pilih bukti pembayaran / transfer', 'stage2_payment_proof_name', 'stage2_payment_proof_file_data', 'receipt_long')}
    </div></div>
  </div></section>;
}

function PengadaanStageThree({ draft, update, readOnly, onView }) {
  const handleFile = (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      alert('Ukuran file maksimal 8MB.');
      return;
    }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowed.includes(file.type)) {
      alert('Format file hanya PDF, JPG, atau PNG.');
      return;
    }
    update('stage3_final_document_name', file.name);
    const reader = new FileReader();
    reader.onload = () => update('stage3_final_document_file_data', reader.result);
    reader.readAsDataURL(file);
  };

  return <section className="bg-white/90 backdrop-blur rounded-2xl shadow-lg shadow-slate-200/40 p-6 md:p-8 border border-white/80"><h2 className="text-xl font-semibold text-slate-900 mb-6">Dokumentasi & Finalisasi Pengadaan</h2><div className="space-y-7">
    <div>
      <div className="flex items-center justify-between gap-3 mb-2"><label className={labelClass}>Dokumen Final Pengadaan <span className="text-red-600">*</span></label><span className="text-xs text-slate-500">PDF, JPG, PNG · Maks. 8MB</span></div>
      <label className={`relative flex items-center gap-4 p-5 rounded-xl border border-dashed border-slate-300 bg-slate-50 ${readOnly ? 'cursor-default opacity-70' : 'cursor-pointer hover:bg-slate-100'}`}>
        <span className="w-12 h-12 rounded-lg bg-white flex items-center justify-center shadow-sm"><span className="material-symbols-outlined text-[24px] text-slate-600">verified_document</span></span>
        <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-800 truncate">{draft.stage3_final_document_name || 'Pilih BAST / Berita Acara / dokumen serah terima'}</div><div className="text-xs text-slate-500 mt-1">{readOnly ? 'Mode lihat saja' : 'Dokumen final sebagai bukti penyelesaian pengadaan'}</div></div>
        {draft.stage3_final_document_file_data && <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); onView(draft.stage3_final_document_name, draft.stage3_final_document_file_data); }} className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100">Lihat</button>}
        {!readOnly && <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept="application/pdf,image/jpeg,image/png,.pdf,.jpg,.jpeg,.png" onChange={(e) => handleFile(e.target.files?.[0])} />}
      </label>
      <p className="text-xs text-slate-500 mt-2">Contoh: BAST, berita acara penerimaan barang/jasa, surat serah terima, atau dokumen final lain yang membuktikan pengadaan telah selesai.</p>
    </div>
    <div><label className={labelClass}>Catatan Penyelesaian / Berita Acara <span className="text-slate-400 font-normal">(Opsional)</span></label><textarea disabled={readOnly} value={draft.catatan || ''} onChange={(e) => update('catatan', e.target.value)} rows={6} placeholder="Tuliskan catatan hasil pengadaan, penyelesaian, atau informasi penting lainnya..." className="w-full px-3 py-3 rounded-lg border border-slate-300 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-slate-900 disabled:opacity-70" /></div>
    <div className="bg-slate-100 rounded-xl p-5"><h3 className="font-semibold text-slate-900 mb-2">Finalisasi</h3><p className="text-sm text-slate-600 leading-6">Pastikan dokumen final sudah terunggah sebelum klik “Selesaikan Pengadaan”.</p></div>
  </div></section>;
}


function DocumentViewer({ open, name, data, onClose }) {
  if (!open || !data) return null;
  const isPdf = String(data).startsWith('data:application/pdf');
  return <div className="fixed inset-0 z-[80] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
        <div className="min-w-0"><h3 className="font-bold text-slate-900">Preview Dokumen</h3><p className="text-xs text-slate-500 truncate mt-1">{name || 'Dokumen'}</p></div>
        <div className="flex items-center gap-2">
          <a href={data} target="_blank" rel="noreferrer" className="px-3 py-2 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200">Buka di Tab Baru</a>
          <button type="button" onClick={onClose} className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100"><span className="material-symbols-outlined">close</span></button>
        </div>
      </div>
      <div className="flex-1 bg-slate-100 p-3 overflow-auto flex items-center justify-center">
        {isPdf ? <iframe title={name || 'Preview PDF'} src={data} className="w-full h-full rounded-lg bg-white border border-slate-200" /> : <img src={data} alt={name || 'Preview dokumen'} className="max-w-full max-h-full object-contain rounded-lg shadow-sm bg-white" />}
      </div>
    </div>
  </div>;
}

function AddModal({ form, setForm, error, onClose, onSubmit }) {
  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="w-full max-w-2xl max-h-[92vh] overflow-y-auto bg-white rounded-xl shadow-2xl"><form onSubmit={onSubmit}>
      <div className="px-6 pt-6 pb-4 border-b border-slate-100 flex items-start justify-between"><div><h2 className="text-xl font-bold text-slate-900">Tambah Pengadaan</h2><p className="text-sm text-slate-500 mt-1">Isi formulir untuk membuat permintaan pengadaan barang atau jasa.</p></div><button type="button" onClick={onClose} className="w-9 h-9 rounded-lg text-slate-500 hover:bg-slate-100"><span className="material-symbols-outlined">close</span></button></div>
      <div className="px-6 py-5 space-y-4">
        {error && <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</div>}
        <div><label className="block text-xs font-semibold text-slate-700 mb-2">Kategori</label><div className="flex gap-6">{[['barang','Barang'],['jasa','Jasa']].map(([v,l])=><label key={v} className="flex items-center gap-2 text-sm text-slate-600"><input type="radio" name="kategori_pengadaan" checked={form.kategori===v} onChange={()=>setForm({...form,kategori:v})}/>{l}</label>)}</div></div>
        <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Nama Barang / Jasa *</label><input required value={form.nama_barang_jasa} onChange={e=>setForm({...form,nama_barang_jasa:e.target.value})} className={inputClass}/></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Metode Pengadaan</label><select value={form.metode_pengadaan} onChange={e=>setForm({...form,metode_pengadaan:e.target.value})} className={inputClass}><option value="">Pilih Metode Pengadaan</option><option>Lelang</option><option>E-Purchasing</option><option>Pengadaan Langsung (PL)</option></select></div><div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Lokasi *</label><select required value={form.lokasi} onChange={e=>setForm({...form,lokasi:e.target.value})} className={inputClass}><option value="">Pilih Lokasi</option><option>Graha Kemnaker</option><option>Gatsu 51</option><option>Wisma Ciloto</option><option>Rumah Dinas</option><option>RC Walang</option><option>RC Kranji</option></select></div></div>
        <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Titik Lokasi</label><input value={form.titik_lokasi} onChange={e=>setForm({...form,titik_lokasi:e.target.value})} placeholder="Contoh: link Google Maps atau keterangan titik lokasi" className={inputClass}/></div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Tanggal</label><input type="date" value={form.tanggal} onChange={e=>setForm({...form,tanggal:e.target.value})} className={inputClass}/></div></div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800"><b>Nilai HPS</b> tidak diinput saat membuat pengadaan. Nilai HPS diisi pada <b>Aksi Tahap 1 (Analisa & HPS)</b>.</div>
        <div><label className="block text-xs font-semibold text-slate-700 mb-1.5">Deskripsi Detail</label><textarea maxLength={500} value={form.deskripsi} onChange={e=>setForm({...form,deskripsi:e.target.value})} rows={4} className="w-full px-3 py-3 rounded-lg border border-slate-300 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-slate-900"/><div className="text-right text-[11px] text-slate-500 mt-1">{form.deskripsi.length}/500 karakter</div></div>
        <div><div className="flex items-center justify-between gap-3 mb-1.5"><label className="block text-xs font-semibold text-slate-700">Upload Dokumen Pendukung</label><span className="text-[11px] text-slate-500">PDF, JPG, PNG, WebP · Maks. 8MB</span></div><label className="relative flex items-center gap-3 p-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 cursor-pointer hover:bg-slate-100"><span className="w-10 h-10 rounded-lg bg-white flex items-center justify-center shadow-sm"><span className="material-symbols-outlined text-slate-600">upload_file</span></span><div className="min-w-0 flex-1"><div className="text-sm font-semibold text-slate-800 truncate">{form.request_document_name || 'Pilih dokumen pendukung'}</div><div className="text-xs text-slate-500 mt-1">Lampiran permintaan awal (opsional)</div></div><span className="px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700">Pilih Berkas</span><input type="file" className="absolute inset-0 opacity-0 cursor-pointer" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>8*1024*1024){alert('Ukuran dokumen maksimal 8MB.');e.target.value='';return;}const r=new FileReader();r.onload=()=>setForm({...form,request_document_name:f.name,request_document_file_data:r.result});r.readAsDataURL(f);}}/></label></div>
      </div>
      <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-3"><button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-700">Batal</button><button type="submit" className="px-5 py-2.5 bg-slate-900 text-white text-sm font-semibold rounded-lg">Simpan Pengadaan</button></div>
    </form></div></div>;
}
