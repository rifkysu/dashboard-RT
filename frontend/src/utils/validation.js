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

// ---- Login & Daftar Akun (aturan yang sama dicek ulang di backend/src/routes/auth.js) ----
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Nama boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung (untuk gelar, mis. "Ahmad Fauzi, S.E.").
export const NAME_RE = /^[\p{L}][\p{L} .,'-]*$/u;
// Nomor HP Indonesia: 08xx / 628xx / +628xx, total 10-15 digit. Spasi & tanda hubung diabaikan.
export const HP_RE = /^(\+?62|0)8\d{7,12}$/;
export const normalizePhone = (v) => String(v || '').replace(/[\s-]/g, '');
export const UNIT_KERJA = ['rt', 'perlengkapan', 'kendaraan', 'protokol', 'lainnya'];

// Kata sandi: 8-128 karakter, minimal satu huruf dan satu angka. Mengembalikan pesan error atau ''.
export function passwordIssue(pw) {
  if (!pw) return 'Kata sandi wajib diisi.';
  if (pw.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (pw.length > 128) return 'Kata sandi maksimal 128 karakter.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Kata sandi harus berisi huruf dan angka.';
  return '';
}

// Validasi form Daftar Akun -> { field: pesan } (objek kosong = valid).
export function validateRegister(f) {
  const e = {};
  const nama = f.nama_lengkap.trim();
  if (!nama) e.nama_lengkap = 'Nama lengkap wajib diisi.';
  else if (nama.length < 3) e.nama_lengkap = 'Nama lengkap minimal 3 karakter.';
  else if (nama.length > 150) e.nama_lengkap = 'Nama lengkap maksimal 150 karakter.';
  else if (!NAME_RE.test(nama)) e.nama_lengkap = 'Nama hanya boleh berisi huruf, spasi, titik, koma, apostrof, dan tanda hubung.';
  const email = f.email.trim();
  if (!email) e.email = 'Email wajib diisi.';
  else if (email.length > 254 || !EMAIL_RE.test(email)) e.email = 'Format email tidak valid (contoh: nama@kemnaker.go.id).';
  const hp = normalizePhone(f.no_hp);
  if (!hp) e.no_hp = 'Nomor WhatsApp / HP wajib diisi.';
  else if (!HP_RE.test(hp)) e.no_hp = 'Nomor HP tidak valid (contoh: 081234567890 atau +6281234567890).';
  if (!UNIT_KERJA.includes(f.unit_kerja)) e.unit_kerja = 'Pilih unit kerja / bagian.';
  if (f.role !== 'karyawan') e.role = 'Pilih peran.';
  const pw = passwordIssue(f.password);
  if (pw) e.password = pw;
  if (!f.confirm) e.confirm = 'Ulangi kata sandi.';
  else if (f.password !== f.confirm) e.confirm = 'Konfirmasi kata sandi tidak cocok.';
  if (!f.agree) e.agree = 'Centang pernyataan ini untuk melanjutkan.';
  return e;
}

// Validasi form Login -> { field: pesan }.
export function validateLogin({ email, password }) {
  const e = {};
  const em = String(email || '').trim();
  if (!em) e.email = 'Email wajib diisi.';
  else if (!EMAIL_RE.test(em)) e.email = 'Format email tidak valid.';
  if (!password) e.password = 'Kata sandi wajib diisi.';
  return e;
}
