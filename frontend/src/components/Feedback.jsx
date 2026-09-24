import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Popup & notifikasi seragam untuk semua menu, pengganti alert()/confirm()
// bawaan browser:
//   const { confirm, alert, toast } = useFeedback();
//   if (!(await confirm({ title, message, confirmText, tone: 'danger' }))) return;
//   await alert({ title, message, tone: 'error' });          // message boleh array -> daftar
//   toast('Data berhasil disimpan.');                        // tone: 'success' | 'error' | 'info'
// Popup yang dipanggil bersamaan ditampilkan bergiliran (antrian), jadi tidak
// ada Promise yang menggantung.

const FeedbackContext = createContext(null);

const TONES = {
  danger: { icon: 'delete_forever', iconBox: 'bg-red-100 text-red-600', button: 'bg-red-600 hover:bg-red-700' },
  warning: { icon: 'warning', iconBox: 'bg-amber-100 text-amber-600', button: 'bg-amber-600 hover:bg-amber-700' },
  error: { icon: 'error', iconBox: 'bg-red-100 text-red-600', button: 'bg-slate-900 hover:bg-slate-800' },
  success: { icon: 'check_circle', iconBox: 'bg-emerald-100 text-emerald-600', button: 'bg-emerald-600 hover:bg-emerald-700' },
  info: { icon: 'info', iconBox: 'bg-blue-100 text-blue-600', button: 'bg-slate-900 hover:bg-slate-800' },
};
const TOAST_TONES = {
  success: { icon: 'check_circle', box: 'border-emerald-200 bg-white', iconColor: 'text-emerald-600' },
  error: { icon: 'error', box: 'border-red-200 bg-white', iconColor: 'text-red-600' },
  info: { icon: 'info', box: 'border-blue-200 bg-white', iconColor: 'text-blue-600' },
};

let nextId = 1;

export function FeedbackProvider({ children }) {
  const [queue, setQueue] = useState([]);
  const [toasts, setToasts] = useState([]);

  const open = useCallback((kind, opts) => new Promise((resolve) => {
    const o = typeof opts === 'string' ? { message: opts } : (opts || {});
    setQueue((q) => [...q, { id: nextId++, kind, resolve, ...o }]);
  }), []);

  const confirm = useCallback((opts) => open('confirm', opts), [open]);
  const alert = useCallback((opts) => open('alert', opts), [open]);

  const dismissToast = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const toast = useCallback((message, tone = 'success') => {
    const id = nextId++;
    setToasts((t) => [...t.slice(-3), { id, message, tone }]);
    setTimeout(() => dismissToast(id), tone === 'error' ? 6000 : 3500);
  }, [dismissToast]);

  const current = queue[0];
  const close = (result) => {
    if (!current) return;
    current.resolve(result);
    setQueue((q) => q.slice(1));
  };

  return (
    <FeedbackContext.Provider value={{ confirm, alert, toast }}>
      {children}
      {current && <Dialog key={current.id} dialog={current} onClose={close} />}
      <div className="fixed top-4 right-4 z-[210] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm pointer-events-none" aria-live="polite">
        {toasts.map((t) => {
          const tone = TOAST_TONES[t.tone] || TOAST_TONES.info;
          return (
            <div key={t.id} role="status" className={`pointer-events-auto flex items-start gap-3 rounded-xl border shadow-lg shadow-slate-900/10 px-4 py-3 feedback-toast ${tone.box}`}>
              <span className={`material-symbols-outlined text-[20px] shrink-0 ${tone.iconColor}`}>{tone.icon}</span>
              <p className="text-sm text-slate-700 flex-1 leading-5">{t.message}</p>
              <button type="button" onClick={() => dismissToast(t.id)} aria-label="Tutup notifikasi" className="text-slate-400 hover:text-slate-700"><span className="material-symbols-outlined text-[18px]">close</span></button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}

function Dialog({ dialog, onClose }) {
  const isConfirm = dialog.kind === 'confirm';
  const tone = TONES[dialog.tone] || (isConfirm ? TONES.warning : TONES.info);
  const confirmRef = useRef(null);
  const cancelValue = isConfirm ? false : undefined;
  const okValue = isConfirm ? true : undefined;

  useEffect(() => {
    confirmRef.current?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(cancelValue); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = Array.isArray(dialog.message) ? dialog.message : null;

  return (
    <div className="fixed inset-0 z-[200] bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 feedback-fade" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(cancelValue); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby={`fb-title-${dialog.id}`} className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 feedback-pop">
        <div className="flex items-start gap-4">
          <span className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${tone.iconBox}`}>
            <span className="material-symbols-outlined text-[26px]">{dialog.icon || tone.icon}</span>
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={`fb-title-${dialog.id}`} className="text-lg font-bold text-slate-900">{dialog.title || (isConfirm ? 'Konfirmasi' : 'Informasi')}</h2>
            {lines ? (
              <>
                {dialog.intro && <p className="text-sm text-slate-600 mt-1.5">{dialog.intro}</p>}
                <ul className="mt-2 space-y-1">
                  {lines.map((l, i) => <li key={i} className="text-sm text-slate-700 flex gap-2"><span className="text-red-500">•</span><span>{l}</span></li>)}
                </ul>
              </>
            ) : (
              dialog.message && <p className="text-sm text-slate-600 mt-1.5 leading-6 whitespace-pre-line break-words">{dialog.message}</p>
            )}
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          {isConfirm && (
            <button type="button" onClick={() => onClose(false)} className="px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">
              {dialog.cancelText || 'Batal'}
            </button>
          )}
          <button ref={confirmRef} type="button" onClick={() => onClose(okValue)} className={`px-5 py-2.5 rounded-lg text-white text-sm font-semibold ${tone.button}`}>
            {dialog.confirmText || (isConfirm ? 'Ya, Lanjutkan' : 'Mengerti')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function useFeedback() {
  const ctx = useContext(FeedbackContext);
  if (!ctx) throw new Error('useFeedback harus dipakai di dalam <FeedbackProvider>.');
  return ctx;
}
