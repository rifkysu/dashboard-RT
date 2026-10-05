// Dipisah dari index.html supaya Content-Security-Policy tidak perlu mengizinkan script inline.
// Tema gelap dipasang sebelum aplikasi dimuat (hanya di halaman dashboard), supaya tidak
// sempat berkedip terang. Logika lengkapnya ada di src/theme.js & ProtectedRoute.
(function () {
  try {
    var p = location.pathname;
    var dash = /^\/(dashboard|pemeliharaan|pengadaan|kendaraan|ruang-rapat|akun|profile|settings)(\/|$)/.test(p);
    if (dash && localStorage.getItem('tema') === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
  } catch (e) {}
})();
// Tampilkan ikon hanya setelah font-nya benar-benar siap. Kalau font gagal dimuat (jaringan
// putus), ikon tetap tersembunyi -- lebih rapi daripada potongan teks seperti "arr" / "cl".
(function () {
  var root = document.documentElement;
  var done = function () { root.classList.add('icons-ready'); };
  if (!document.fonts || !document.fonts.check) { done(); return; }
  // Font ikon dibundel bersama CSS aplikasi; cek berkala sampai benar-benar termuat (maks. 60 detik).
  // check() juga bernilai true kalau unduhan gagal, jadi pastikan status font-nya "loaded".
  var loaded = function () {
    var ok = false;
    document.fonts.forEach(function (f) { if (f.family.indexOf('Material Symbols') !== -1 && f.status === 'loaded') ok = true; });
    return ok;
  };
  var tries = 0;
  (function poll() { if (loaded()) done(); else if (++tries < 500) setTimeout(poll, 120); })();
})();
