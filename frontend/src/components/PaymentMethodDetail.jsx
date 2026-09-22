import React from 'react';

const GUP_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);
const TUP_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);

// Sub-field kontekstual untuk metode pembayaran Tahap 2:
// GUP -> pilih nomor GUP 1-20, TUP -> pilih nomor TUP 1-10, LS -> tanggal LS.
export default function PaymentMethodDetail({ method, numberValue, dateValue, onNumberChange, onDateChange, readOnly, inputClass, labelClass }) {
  if (method === 'GUP') {
    return (
      <div>
        <label className={labelClass}>Nomor GUP <span className="text-red-600">*</span></label>
        <select disabled={readOnly} value={numberValue ?? ''} onChange={(e) => onNumberChange(e.target.value)} className={inputClass}>
          <option value="">Pilih Nomor GUP</option>
          {GUP_OPTIONS.map((n) => <option key={n} value={n}>GUP {n}</option>)}
        </select>
      </div>
    );
  }
  if (method === 'TUP') {
    return (
      <div>
        <label className={labelClass}>Nomor TUP <span className="text-red-600">*</span></label>
        <select disabled={readOnly} value={numberValue ?? ''} onChange={(e) => onNumberChange(e.target.value)} className={inputClass}>
          <option value="">Pilih Nomor TUP</option>
          {TUP_OPTIONS.map((n) => <option key={n} value={n}>TUP {n}</option>)}
        </select>
      </div>
    );
  }
  if (method === 'LS') {
    return (
      <div>
        <label className={labelClass}>Tanggal LS <span className="text-red-600">*</span></label>
        <input disabled={readOnly} type="date" value={dateValue || ''} onChange={(e) => onDateChange(e.target.value)} className={inputClass} />
      </div>
    );
  }
  return null;
}
