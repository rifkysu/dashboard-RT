// Tanggal & jam "sekarang" menurut zona waktu kantor (default WIB / Asia/Jakarta), TIDAK
// bergantung pada zona waktu server. VPS Linux biasanya ber-zona UTC: tanpa ini, "hari ini"
// & "jam sekarang" meleset 7 jam (mis. jam 14.00 WIB server mengira 07.00 UTC).
// Bisa diganti lewat APP_TIMEZONE (mis. Asia/Makassar) bila kantor di zona lain.
const DEFAULT_TZ = 'Asia/Jakarta';

function timeZone() {
  const tz = process.env.APP_TIMEZONE || DEFAULT_TZ;
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return tz; } catch { return DEFAULT_TZ; }
}

// -> { date: 'YYYY-MM-DD', hm: 'HH:MM' }
function nowLocal(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: timeZone(), year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).map((p) => [p.type, p.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, hm: `${parts.hour}:${parts.minute}` };
}

module.exports = { nowLocal, timeZone };
