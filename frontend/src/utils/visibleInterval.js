// Seperti setInterval, tapi dilewati selama tab tersembunyi (diminimize / tab lain aktif), supaya
// tab yang dibiarkan terbuka seharian tidak terus membebani server. Saat tab terlihat lagi dan
// jadwalnya sudah terlewat, `fn` langsung dipanggil sekali agar data tidak basi.
// Mengembalikan fungsi pembersih (pakai sebagai return di useEffect).
export default function visibleInterval(fn, ms) {
  let last = Date.now();
  const run = () => { last = Date.now(); fn(); };
  const timer = setInterval(() => { if (!document.hidden) run(); }, ms);
  const onVisible = () => { if (!document.hidden && Date.now() - last >= ms) run(); };
  document.addEventListener('visibilitychange', onVisible);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
}
