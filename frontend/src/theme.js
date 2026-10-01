// Pilihan tampilan Terang/Gelap untuk menu dashboard (bukan landing & login).
// Disimpan per browser di localStorage; diterapkan lewat atribut data-theme di <html>
// (gaya gelapnya ada di src/dark-theme.css). index.html memasang atribut yang sama lebih
// awal untuk halaman dashboard, supaya tidak sempat berkedip terang saat halaman dimuat.
const KEY = 'tema';

export function readTheme() {
  try { return localStorage.getItem(KEY) === 'dark' ? 'dark' : 'light'; } catch { return 'light'; }
}

export function saveTheme(theme) {
  try { localStorage.setItem(KEY, theme); } catch {}
}

export function applyTheme(theme) {
  if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  else document.documentElement.removeAttribute('data-theme');
}
