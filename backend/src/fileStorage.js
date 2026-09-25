const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const UPLOAD_ROOT = path.resolve(__dirname, '..', 'uploads');

const MIME_EXT = {
  'application/pdf': '.pdf',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
};

function ensureUploadRoot() {
  fs.mkdirSync(UPLOAD_ROOT, { recursive: true });
}

function safeName(name = 'file') {
  return String(name).replace(/[^a-zA-Z0-9._-]/g, '_').replace(/\.{2,}/g, '.').slice(0, 120) || 'file';
}

async function saveDataUrl(dataUrl, originalName, menu) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const match = dataUrl.match(/^data:([^;,]+);base64,(.+)$/s);
  if (!match) return null;

  const mime = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length) return null;

  ensureUploadRoot();
  const now = new Date();
  const dir = path.join(UPLOAD_ROOT, safeName(menu), String(now.getFullYear()), String(now.getMonth() + 1).padStart(2, '0'));
  await fs.promises.mkdir(dir, { recursive: true });

  // Ekstensi selalu dari MIME yang sudah diverifikasi magic number-nya, bukan dari nama
  // file kiriman user -- supaya tidak ada file .html/.js/.exe yang tersimpan di server.
  const ext = MIME_EXT[mime] || '.bin';
  const base = path.basename(originalName || 'file', path.extname(originalName || 'file'));
  const filename = `${Date.now()}-${crypto.randomUUID()}-${safeName(base)}${ext}`;
  const absolutePath = path.join(dir, filename);
  await fs.promises.writeFile(absolutePath, buffer, { flag: 'wx' });

  return path.relative(path.resolve(__dirname, '..'), absolutePath).replace(/\\/g, '/');
}

// Lokasi file di disk server tidak perlu (dan tidak boleh) diketahui client.
function hideFilePaths(row) {
  if (!row || typeof row !== 'object') return row;
  const out = { ...row };
  for (const key of Object.keys(out)) if (/_file_paths?$/.test(key)) delete out[key];
  return out;
}

module.exports = { UPLOAD_ROOT, ensureUploadRoot, saveDataUrl, hideFilePaths };
