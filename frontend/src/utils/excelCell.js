// Isi sel tabel HTML untuk file export .xls (dibuka Excel). Dua pengaman:
// 1. Karakter HTML di-escape, supaya teks seperti "<b>" tidak mengubah tabel.
// 2. Nilai diawali = + - @ diberi awalan ' supaya Excel tidak menjalankannya sebagai RUMUS
//    (mis. agenda booking dari tamu "=HYPERLINK(...)"). Tanda "-" saja (data kosong) dibiarkan.
// Sama dengan backend/src/csv.js untuk export CSV.
const RUMUS = /^[=+@\t\r]|^-./;
export function excelCell(v) {
  let s = String(v ?? '');
  if (RUMUS.test(s)) s = `'${s}`;
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
