// Verifikasi magic number (byte pertama file) supaya isi dokumen benar-benar
// cocok dengan MIME type yang diklaim di data URL -- klaim MIME itu sendiri
// dikirim oleh client jadi bisa dipalsukan (mis. script diganti namanya jadi
// "dokumen.pdf"). Pengecekan ini jadi lapisan validasi utama di server,
// terpisah dari pengecekan sisi client yang cuma untuk UX cepat.
const CHECKERS = {
  'application/pdf': (buf) => buf.slice(0, 5).toString('latin1') === '%PDF-',
  'image/jpeg': (buf) => buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  'image/png': (buf) => buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  'image/webp': (buf) => buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP',
  'application/msword': (buf) => buf.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  'application/vnd.ms-excel': (buf) => buf.slice(0, 8).equals(Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])),
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (buf) => buf.slice(0, 4).toString('latin1') === 'PK\x03\x04',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (buf) => buf.slice(0, 4).toString('latin1') === 'PK\x03\x04',
};

// Terima "data:<mime>;base64,<payload>" dan pastikan payload-nya benar-benar
// berupa file dengan magic number yang cocok untuk <mime> tsb.
function isGenuineDocumentDataUrl(dataUrl, maxLength) {
  if (typeof dataUrl !== 'string' || dataUrl.length > maxLength) return false;
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) return false;
  const checker = CHECKERS[match[1].toLowerCase()];
  if (!checker) return false;
  let buffer;
  try {
    buffer = Buffer.from(match[2].slice(0, 64), 'base64');
  } catch {
    return false;
  }
  return checker(buffer);
}

module.exports = { isGenuineDocumentDataUrl };
