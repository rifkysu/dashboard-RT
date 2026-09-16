import React from 'react';

function getMime(data='') {
  const m = String(data).match(/^data:([^;]+);/);
  return m?.[1] || '';
}

export default function DocumentViewer({ open, onClose, name, data }) {
  if (!open || !data) return null;
  const mime = getMime(data);
  const isPdf = mime === 'application/pdf';
  const isImage = ['image/jpeg','image/png','image/webp'].includes(mime);
  const title = name || 'Dokumen';

  return <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-sm p-3 md:p-6 flex items-center justify-center" onMouseDown={(e)=>{if(e.target===e.currentTarget)onClose();}}>
    <div className="w-full h-full max-w-6xl max-h-[94vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
      <div className="h-16 shrink-0 px-4 md:px-6 border-b border-slate-200 flex items-center justify-between gap-4">
        <div className="min-w-0 flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center"><span className="material-symbols-outlined text-slate-700">picture_as_pdf</span></div><div className="min-w-0"><div className="font-bold text-slate-900 truncate">{title}</div><div className="text-xs text-slate-500">{isPdf ? 'Preview PDF' : isImage ? 'Preview gambar' : 'Preview dokumen'}</div></div></div>
        <div className="flex items-center gap-2 shrink-0"><a href={data} target="_blank" rel="noreferrer" className="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50"><span className="material-symbols-outlined text-[18px]">open_in_new</span>Tab Baru</a><button type="button" onClick={onClose} className="w-10 h-10 rounded-lg hover:bg-slate-100 text-slate-500 flex items-center justify-center"><span className="material-symbols-outlined">close</span></button></div>
      </div>
      <div className="flex-1 min-h-0 bg-slate-100 flex items-center justify-center">
        {isPdf && <iframe title={title} src={data} className="w-full h-full border-0 bg-white" />}
        {isImage && <div className="w-full h-full overflow-auto flex items-center justify-center p-6"><img src={data} alt={title} className="max-w-full max-h-full object-contain rounded-lg shadow" /></div>}
        {!isPdf && !isImage && <div className="text-center p-8"><span className="material-symbols-outlined text-5xl text-slate-400">description</span><p className="mt-3 font-semibold text-slate-800">Format ini belum bisa dipreview di browser.</p><p className="text-sm text-slate-500 mt-1">Gunakan tombol Tab Baru untuk membuka file jika browser mendukungnya.</p></div>}
      </div>
    </div>
  </div>;
}
