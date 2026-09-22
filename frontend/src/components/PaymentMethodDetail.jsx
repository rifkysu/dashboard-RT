import React from 'react';

const GUP_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);
const TUP_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const BUDGET_SOURCES = ['RM', 'PNBP'];

// Sub-field kontekstual untuk metode pembayaran Tahap 2:
// GUP -> pilih nomor GUP 1-20, TUP -> pilih nomor TUP 1-10, LS -> tanggal LS.
// Selalu dipasangkan dengan Asal Anggaran (RM / PNBP).
export default function PaymentMethodDetail({ method, numberValue, dateValue, budgetSource, onNumberChange, onDateChange, onBudgetSourceChange, readOnly, inputClass, labelClass }) {
  if (!method) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {method === 'GUP' && (
        <div>
          <label className={labelClass}>Nomor GUP <span className="text-red-600">*</span></label>
          <select disabled={readOnly} value={numberValue ?? ''} onChange={(e) => onNumberChange(e.target.value)} className={inputClass}>
            <option value="">Pilih Nomor GUP</option>
            {GUP_OPTIONS.map((n) => <option key={n} value={n}>GUP {n}</option>)}
          </select>
        </div>
      )}
      {method === 'TUP' && (
        <div>
          <label className={labelClass}>Nomor TUP <span className="text-red-600">*</span></label>
          <select disabled={readOnly} value={numberValue ?? ''} onChange={(e) => onNumberChange(e.target.value)} className={inputClass}>
            <option value="">Pilih Nomor TUP</option>
            {TUP_OPTIONS.map((n) => <option key={n} value={n}>TUP {n}</option>)}
          </select>
        </div>
      )}
      {method === 'LS' && (
        <div>
          <label className={labelClass}>Tanggal LS <span className="text-red-600">*</span></label>
          <input disabled={readOnly} type="date" value={dateValue || ''} onChange={(e) => onDateChange(e.target.value)} className={inputClass} />
        </div>
      )}
      <div>
        <label className={labelClass}>Asal Anggaran <span className="text-red-600">*</span></label>
        <select disabled={readOnly} value={budgetSource ?? ''} onChange={(e) => onBudgetSourceChange(e.target.value)} className={inputClass}>
          <option value="">Pilih Asal Anggaran</option>
          {BUDGET_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
    </div>
  );
}
