// Helper validasi form bersama. Tiap fungsi mengembalikan daftar pesan kesalahan
// (array kosong = valid) untuk ditampilkan di popup (lihat components/Feedback.jsx).

export const isBlank = (v) => v === null || v === undefined || String(v).trim() === '';

// Kumpulkan pesan "X wajib diisi." untuk setiap [label, nilai] yang kosong.
export function requireFields(pairs) {
  return pairs.filter(([, value]) => isBlank(value)).map(([label]) => `${label} wajib diisi.`);
}

export function positiveAmount(label, value) {
  if (isBlank(value)) return [`${label} wajib diisi.`];
  return Number(value) > 0 ? [] : [`${label} harus lebih dari 0.`];
}

// Metode pembayaran Tahap 2 (GUP 1-20 / TUP 1-10 / LS + tanggal) + asal anggaran.
export function validatePayment(draft) {
  const errors = [];
  const method = draft.stage2_payment_method;
  if (isBlank(method)) return ['Metode pembayaran wajib dipilih.', 'Asal anggaran wajib dipilih.'];
  if (method === 'GUP' || method === 'TUP') {
    const max = method === 'TUP' ? 10 : 20;
    const n = Number(draft.stage2_payment_number);
    if (isBlank(draft.stage2_payment_number)) errors.push(`Nomor ${method} wajib dipilih.`);
    else if (!Number.isInteger(n) || n < 1 || n > max) errors.push(`Nomor ${method} harus 1–${max}.`);
  }
  if (method === 'LS' && isBlank(draft.stage2_ls_date)) errors.push('Tanggal LS wajib diisi.');
  if (isBlank(draft.stage2_budget_source)) errors.push('Asal anggaran wajib dipilih.');
  return errors;
}

export const PHONE_RE = /^[0-9+()\- .]{6,30}$/;
