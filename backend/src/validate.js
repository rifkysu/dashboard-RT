// Validasi input bersama untuk route Pemeliharaan & Pengadaan. Tujuannya supaya input yang
// salah tipe/terlalu panjang/tanggal ngawur dijawab 400 dengan pesan jelas, bukan crash 500
// dari database (mis. VARCHAR terlalu panjang, CHECK constraint, Decimal/Date tidak valid).

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_AMOUNT = 1e16; // DECIMAL(18,2)
const STATUS_TAHAP = ['pending', 'on_progress', 'selesai'];

// Tanggal YYYY-MM-DD yang benar-benar ada di kalender (tolak 2026-02-31 dsb).
function realDate(v) {
  if (typeof v !== 'string' || !DATE_RE.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(+d) && d.toISOString().slice(0, 10) === v;
}

const blank = (v) => v === null || v === undefined || v === '';

// spec: { field: { label, type: 'text'|'date'|'amount'|'enum', max?, values?, required? } }
// partial=true (untuk PUT): field yang tidak dikirim dilewati, tapi field wajib yang dikirim kosong tetap ditolak.
function checkFields(body, spec, { partial = false } = {}) {
  for (const [field, rule] of Object.entries(spec)) {
    const v = body[field];
    if (v === undefined && partial) continue;
    if (blank(v) || (typeof v === 'string' && !v.trim() && rule.required)) {
      if (rule.required) return `${rule.label} wajib diisi.`;
      continue;
    }
    switch (rule.type) {
      case 'text':
        if (typeof v !== 'string') return `${rule.label} harus berupa teks.`;
        if (v.length > rule.max) return `${rule.label} maksimal ${rule.max} karakter.`;
        break;
      case 'enum':
        if (!rule.values.includes(v)) return `${rule.label} tidak valid.`;
        break;
      case 'date':
        // Terima juga format ISO lengkap (YYYY-MM-DDTHH:mm...) -- yang dipakai hanya bagian tanggalnya.
        if (typeof v !== 'string' || !realDate(v.slice(0, 10))) return `${rule.label} bukan tanggal yang valid.`;
        break;
      case 'amount': {
        const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN;
        if (!Number.isFinite(n) || n < 0 || n >= MAX_AMOUNT) return `${rule.label} harus berupa angka yang valid.`;
        break;
      }
      default:
        break;
    }
  }
  return null;
}

// Filter ?status= di daftar: harus salah satu status tahapan.
const validStatusFilter = (v) => v === undefined || v === '' || STATUS_TAHAP.includes(v);

module.exports = { realDate, checkFields, validStatusFilter, STATUS_TAHAP };
