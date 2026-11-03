// Sel CSV aman untuk dibuka di Excel/LibreOffice.
// Nilai yang diawali = + - @ (atau tab/enter) dibaca Excel sebagai RUMUS, mis. agenda booking dari tamu
// "=HYPERLINK(...)" atau nama akun Google yang sengaja diisi rumus. Diberi awalan ' supaya tampil sebagai
// teks biasa (rekomendasi OWASP "CSV Injection"). Tanda "-" saja (kosong) dibiarkan apa adanya.
const RUMUS = /^[=+@\t\r]|^-./;
const csvCell = (v) => {
  let s = String(v ?? '');
  if (RUMUS.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

module.exports = { csvCell };
