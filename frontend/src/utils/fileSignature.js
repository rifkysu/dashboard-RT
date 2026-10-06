// Deteksi tipe file dari beberapa byte pertamanya (magic number), bukan dari
// ekstensi nama file atau Content-Type yang dikirim browser -- keduanya gampang
// dipalsukan (mis. script/HTML diganti namanya jadi "dokumen.pdf"). Dipakai
// untuk menolak upload di Pemeliharaan & Pengadaan yang bukan dokumen/gambar
// asli sebelum dikirim ke server.
const SIGNATURES = [
  { bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] }, // %PDF-
  { bytes: [0xff, 0xd8, 0xff] }, // JPEG
  { bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] }, // PNG
  { bytes: [0x52, 0x49, 0x46, 0x46], extra: { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] } }, // RIFF....WEBP
  { bytes: [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1] }, // DOC/XLS lama (OLE2)
  { bytes: [0x50, 0x4b, 0x03, 0x04] }, // DOCX/XLSX (ZIP)
];

function matchesSignature(arr, sig) {
  if (!sig.bytes.every((b, i) => arr[i] === b)) return false;
  if (!sig.extra) return true;
  return sig.extra.bytes.every((b, i) => arr[sig.extra.offset + i] === b);
}

// Resolve true kalau beberapa byte pertama file cocok dengan salah satu magic
// number dokumen/gambar yang didukung (PDF, JPG, PNG, WEBP, DOC/XLS, DOCX/XLSX).
export function verifyFileIsGenuine(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      const arr = new Uint8Array(reader.result);
      resolve(SIGNATURES.some((sig) => matchesSignature(arr, sig)));
    };
    reader.onerror = () => resolve(false);
    reader.readAsArrayBuffer(file.slice(0, 16));
  });
}

const OFFICE_MIME = {
  doc: 'application/msword',
  xls: 'application/vnd.ms-excel',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

// MIME asli file dari magic number-nya ('' kalau bukan dokumen/gambar yang didukung).
// Browser di Windows sering memberi file.type kosong (mis. .docx/.xlsx di komputer tanpa
// Office), sehingga data URL-nya jadi "application/octet-stream" dan ditolak backend.
// Word & Excel punya magic number yang sama (OLE2 / ZIP), jadi jenisnya diambil dari ekstensi.
export async function detectFileMime(file) {
  let arr;
  try { arr = new Uint8Array(await file.slice(0, 16).arrayBuffer()); } catch { return ''; }
  const [pdf, jpeg, png, webp, ole, zip] = SIGNATURES.map((sig) => matchesSignature(arr, sig));
  if (pdf) return 'application/pdf';
  if (jpeg) return 'image/jpeg';
  if (png) return 'image/png';
  if (webp) return 'image/webp';
  const ext = String(file.name || '').split('.').pop().toLowerCase();
  if (ole) return ext === 'xls' ? OFFICE_MIME.xls : ext === 'doc' ? OFFICE_MIME.doc : file.type === OFFICE_MIME.xls || file.type === OFFICE_MIME.doc ? file.type : '';
  if (zip) return ext === 'xlsx' ? OFFICE_MIME.xlsx : ext === 'docx' ? OFFICE_MIME.docx : file.type === OFFICE_MIME.xlsx || file.type === OFFICE_MIME.docx ? file.type : '';
  return '';
}

// Baca file jadi data URL dengan MIME hasil deteksi magic number (bukan file.type dari browser).
export async function readFileAsDataUrl(file) {
  const mime = await detectFileMime(file);
  const raw = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
  return mime ? raw.replace(/^data:[^;,]*;base64,/, `data:${mime};base64,`) : raw;
}
