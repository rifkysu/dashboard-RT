const crypto = require('crypto');
const zlib = require('zlib');

// Captcha angka (6 digit) untuk form booking tamu. Gambarnya PNG yang digambar sendiri dari font
// bitmap 5x7 (tanpa dependency tambahan), jadi jawabannya tidak ada di kode sumber gambar seperti
// kalau pakai teks SVG. Satu captcha per akun tamu, berlaku 5 menit, dan hangus setelah sekali dicek
// (benar maupun salah) -- jadi tidak bisa ditebak berulang-ulang.
const TTL_MS = 5 * 60 * 1000;
const LENGTH = 6;
// Hanya angka 0-9 supaya mudah diketik (di HP keluar keyboard angka). Satu kali tebak per captcha
// (langsung hangus) + rate limit, jadi peluang tebak acak 1:1.000.000 per percobaan.
const CHARS = '0123456789';
const ANSWER_RE = /^\d{6}$/;

const GLYPHS = {
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '#.#..', '..#..', '..#..', '..#..', '#####'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  3: ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  6: ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
};

const W = 220, H = 70;
const rnd = (min, max) => min + crypto.randomInt(max - min + 1);

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(px) {
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0; // filter: none
    px.copy(raw, y * (W * 3 + 1) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

function render(text) {
  const px = Buffer.alloc(W * H * 3);
  const set = (x, y, [r, g, b]) => {
    if (x < 0 || y < 0 || x >= W || y >= H) return;
    const i = (y * W + x) * 3; px[i] = r; px[i + 1] = g; px[i + 2] = b;
  };
  // Latar terang dengan bintik acak.
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const v = rnd(225, 250); set(x, y, [v, v, rnd(228, 255)]); }
  for (let n = 0; n < 500; n++) set(rnd(0, W - 1), rnd(0, H - 1), [rnd(120, 200), rnd(120, 200), rnd(120, 200)]);
  const line = (color, thick) => {
    let x0 = rnd(0, W - 1), y0 = rnd(0, H - 1); const x1 = rnd(0, W - 1), y1 = rnd(0, H - 1);
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      for (let t = 0; t < thick; t++) set(x0, y0 + t, color);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) { err += dy; x0 += sx; }
      if (e2 <= dx) { err += dx; y0 += sy; }
    }
  };
  for (let n = 0; n < 3; n++) line([rnd(140, 190), rnd(140, 190), rnd(140, 190)], 1);
  // Huruf: tiap karakter beda warna, ukuran, posisi, dan kemiringan.
  const slot = (W - 20) / text.length;
  [...text].forEach((ch, i) => {
    const glyph = GLYPHS[ch];
    const scale = rnd(5, 6);
    const shear = (crypto.randomInt(41) - 20) / 40; // -0.5..0.5 px per baris skala
    const ox = Math.round(10 + i * slot + rnd(0, Math.max(0, Math.floor(slot - 5 * scale)))), oy = rnd(4, H - 7 * scale - 4);
    const color = [rnd(10, 90), rnd(20, 90), rnd(60, 140)];
    glyph.forEach((row, gy) => [...row].forEach((bit, gx) => {
      if (bit !== '#') return;
      for (let yy = 0; yy < scale; yy++) for (let xx = 0; xx < scale; xx++) {
        const y = gy * scale + yy;
        set(ox + gx * scale + xx + Math.round((y - 3.5 * scale) * shear), oy + y, color);
      }
    }));
  });
  // Garis pengganggu di atas huruf.
  for (let n = 0; n < 3; n++) line([rnd(40, 120), rnd(40, 120), rnd(80, 160)], 2);
  return encodePng(px);
}

// owner -> { hash, expires }. Satu captcha aktif per akun tamu; minta baru = yang lama hangus.
const store = new Map();
const hashAnswer = (owner, answer) => crypto.createHash('sha256').update(`${owner}|${answer}`).digest('hex');

function cleanup() {
  const now = Date.now();
  for (const [k, v] of store) if (v.expires <= now) store.delete(k);
}

function createCaptcha(owner) {
  cleanup();
  let text = '';
  for (let i = 0; i < LENGTH; i++) text += CHARS[crypto.randomInt(CHARS.length)];
  const expires = Date.now() + TTL_MS;
  store.set(owner, { hash: hashAnswer(owner, text), expires });
  return { image: `data:image/png;base64,${render(text).toString('base64')}`, expires_at: new Date(expires).toISOString(), ttl_seconds: TTL_MS / 1000 };
}

// Mengembalikan null kalau benar, atau pesan error. Captcha selalu dihapus setelah dicek.
function verifyCaptcha(owner, answer) {
  const item = store.get(owner);
  store.delete(owner);
  if (!item) return 'Captcha belum dimuat atau sudah dipakai. Muat captcha baru.';
  if (item.expires <= Date.now()) return 'Captcha sudah kedaluwarsa (lebih dari 5 menit). Muat captcha baru.';
  // Hanya string tepat 6 digit yang dicek; tipe/isi lain (objek, array, simbol, teks panjang) langsung dianggap salah.
  if (typeof answer !== 'string' || !ANSWER_RE.test(answer.trim())) return 'Kode captcha salah. Captcha baru sudah dimuat, silakan coba lagi.';
  answer = answer.trim();
  const a = Buffer.from(item.hash, 'hex'), b = Buffer.from(hashAnswer(owner, answer), 'hex');
  return crypto.timingSafeEqual(a, b) ? null : 'Kode captcha salah. Captcha baru sudah dimuat, silakan coba lagi.';
}

module.exports = { createCaptcha, verifyCaptcha, CAPTCHA_TTL_MS: TTL_MS };
