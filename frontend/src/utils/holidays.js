// Cuti bersama TAMBAHAN (di luar hari raya-nya sendiri) -- murni kebijakan
// pemerintah lewat SKB 3 Menteri, diumumkan tahun per tahun, sama sekali
// tidak bisa dihitung otomatis. Tambahkan tahun berikutnya ke sini begitu
// SKB untuk tahun tsb terbit.
// Nyepi (Tahun Baru Saka) juga tetap manual di sini karena kalender Saka
// Bali tidak tersedia sebagai kalender bawaan untuk dihitung otomatis.
const CUTI_BERSAMA = {
  '2026-02-16': 'Cuti Bersama Tahun Baru Imlek',
  '2026-03-18': 'Hari Suci Nyepi (Tahun Baru Saka)',
  '2026-03-23': 'Cuti Bersama Idul Fitri',
  '2026-03-24': 'Cuti Bersama Idul Fitri',
  '2026-05-15': 'Cuti Bersama Kenaikan Isa Almasih',
  '2026-05-28': 'Cuti Bersama Idul Adha',
  '2026-12-24': 'Cuti Bersama Natal',
};

// Hari libur nasional bertanggal tetap -> berlaku untuk tahun berapa pun.
const FIXED_NATIONAL_HOLIDAYS = {
  '01-01': 'Tahun Baru Masehi',
  '05-01': 'Hari Buruh Internasional',
  '06-01': 'Hari Lahir Pancasila',
  '08-17': 'HUT Kemerdekaan RI',
  '12-25': 'Hari Raya Natal',
};

function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; }

// Paskah Masehi (algoritma Meeus/Jones/Butcher, standar & akurat untuk
// kalender Gregorian) -> dasar hitung Wafat Isa Almasih (Paskah - 2 hari)
// dan Kenaikan Isa Almasih (Paskah + 39 hari) untuk tahun berapa pun.
function easterUTC(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

// Konversi kalender Hijriah & Imlek pakai data ICU bawaan browser/Node
// (bukan rumus buatan sendiri) -> jauh lebih bisa diandalkan.
const islamicFmt = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura', { month: 'numeric', day: 'numeric' });
const chineseFmt = new Intl.DateTimeFormat('en-u-ca-chinese', { month: 'numeric', day: 'numeric' });
function calendarParts(fmt, date) {
  const parts = fmt.formatToParts(date);
  return { month: Number(parts.find(p => p.type === 'month').value), day: Number(parts.find(p => p.type === 'day').value) };
}

const movableCache = new Map();
// Menghitung hari libur "kalender lain" untuk satu tahun Masehi: Wafat &
// Kenaikan Isa Almasih (pasti, dari Paskah), Idul Fitri & Idul Adha
// (PERKIRAAN dari konversi kalender Hijriah -- bisa meleset 1 hari dari
// keputusan sidang isbat resmi pemerintah), dan Tahun Baru Imlek (dari
// kalender Tionghoa, cukup akurat). Hasilnya di-cache per tahun.
function computeMovableHolidays(year) {
  if (movableCache.has(year)) return movableCache.get(year);
  const map = {};

  const easter = easterUTC(year);
  const goodFriday = new Date(easter); goodFriday.setUTCDate(goodFriday.getUTCDate() - 2);
  const ascension = new Date(easter); ascension.setUTCDate(ascension.getUTCDate() + 39);
  map[toISO(goodFriday)] = 'Wafat Isa Almasih';
  map[toISO(ascension)] = 'Kenaikan Isa Almasih';

  for (let day = new Date(Date.UTC(year, 0, 1)); day.getUTCFullYear() === year; day.setUTCDate(day.getUTCDate() + 1)) {
    const dt = new Date(day);
    const hijri = calendarParts(islamicFmt, dt);
    if (hijri.month === 10 && hijri.day === 1) map[toISO(dt)] = 'Idul Fitri (perkiraan)';
    if (hijri.month === 12 && hijri.day === 10) map[toISO(dt)] = 'Idul Adha (perkiraan)';
    const chinese = calendarParts(chineseFmt, dt);
    if (chinese.month === 1 && chinese.day === 1) map[toISO(dt)] = 'Tahun Baru Imlek';
  }

  movableCache.set(year, map);
  return map;
}

// Mengembalikan label hari libur/cuti untuk tanggal "YYYY-MM-DD" tertentu,
// atau null kalau bukan hari libur. Berlaku untuk tahun berapa pun:
// - Hari libur bertanggal tetap & yang dihitung dari kalender lain
//   (Masehi/Hijriah/Imlek) otomatis terdeteksi, tanpa perlu update tahunan.
// - Cuti bersama tambahan & Nyepi hanya terdeteksi untuk tahun yang sudah
//   didaftar manual di atas (karena murni kebijakan/kalender yang tidak
//   bisa dihitung).
export function holidayLabel(dateString) {
  if (!dateString) return null;
  if (CUTI_BERSAMA[dateString]) return CUTI_BERSAMA[dateString];
  const monthDay = dateString.slice(5, 10);
  if (FIXED_NATIONAL_HOLIDAYS[monthDay]) return FIXED_NATIONAL_HOLIDAYS[monthDay];
  const year = Number(dateString.slice(0, 4));
  if (!Number.isInteger(year)) return null;
  return computeMovableHolidays(year)[dateString] || null;
}
