// Cari file di backend/uploads yang tidak lagi direferensikan database
// (mis. salinan dobel dari bug lama "Simpan Draf" yang menyimpan ulang semua
// dokumen). Default hanya menampilkan laporan (dry-run). Dengan --apply, file
// yatim DIPINDAHKAN ke uploads/_orphaned/<tanggal>/ -- tidak dihapus -- jadi
// masih bisa dikembalikan. Hapus folder _orphaned manual kalau sudah yakin.
//
//   npm run uploads:cleanup            -> laporan saja
//   npm run uploads:cleanup -- --apply -> pindahkan file yatim
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/prisma');
const { UPLOAD_ROOT } = require('../src/fileStorage');

const BACKEND_ROOT = path.resolve(__dirname, '..');
const ORPHAN_DIR = '_orphaned';

const PATH_COLUMNS = {
  pemeliharaan: ['request_document_file_path', 'stage1_boq_file_path', 'stage1_document_file_path', 'stage2_invoice_document_file_path'],
  pengadaan: ['request_document_file_path', 'stage2_invoice_document_file_path', 'stage2_invoice_file_path', 'stage2_payment_proof_file_path', 'stage3_final_document_file_path'],
  kendaraan: ['bpkb_document_file_path', 'stnk_document_file_path'],
  ruangRapat: ['surat_file_path'],
};
// Kolom berisi JSON array [{ name, path }]
const JSON_PATH_COLUMNS = {
  pemeliharaan: ['stage3_documentation_file_paths'],
  kendaraan: ['photo_file_paths'],
};

const normalize = (p) => path.resolve(BACKEND_ROOT, p);

async function referencedFiles() {
  const refs = new Set();
  for (const model of new Set([...Object.keys(PATH_COLUMNS), ...Object.keys(JSON_PATH_COLUMNS)])) {
    const cols = [...(PATH_COLUMNS[model] || []), ...(JSON_PATH_COLUMNS[model] || [])];
    const select = Object.fromEntries(cols.map((c) => [c, true]));
    const rows = await prisma[model].findMany({ select });
    for (const row of rows) {
      for (const c of PATH_COLUMNS[model] || []) if (row[c]) refs.add(normalize(row[c]));
      for (const c of JSON_PATH_COLUMNS[model] || []) {
        if (!row[c]) continue;
        try {
          for (const item of JSON.parse(row[c])) if (item?.path) refs.add(normalize(item.path));
        } catch { /* JSON rusak -> abaikan baris ini */ }
      }
    }
  }
  return refs;
}

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (dir === UPLOAD_ROOT && entry.name === ORPHAN_DIR) continue;
      walk(full, out);
    } else if (!entry.name.startsWith('.') && entry.name !== 'README.md') {
      // .gitkeep / README bawaan repo bukan file upload.
      out.push(full);
    }
  }
  return out;
}

async function main() {
  const apply = process.argv.includes('--apply');
  const refs = await referencedFiles();
  const files = walk(UPLOAD_ROOT);
  const orphans = files.filter((f) => !refs.has(path.resolve(f)));
  const bytes = orphans.reduce((sum, f) => sum + fs.statSync(f).size, 0);

  console.log(`File di uploads        : ${files.length}`);
  console.log(`Direferensikan database: ${files.length - orphans.length}`);
  console.log(`File yatim             : ${orphans.length} (${(bytes / 1024 / 1024).toFixed(1)} MB)`);

  if (!orphans.length) return;
  if (!apply) {
    console.log('\nMode laporan (dry-run). Jalankan dengan "-- --apply" untuk memindahkan file yatim ke uploads/_orphaned/.');
    return;
  }

  const target = path.join(UPLOAD_ROOT, ORPHAN_DIR, new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-'));
  for (const f of orphans) {
    const dest = path.join(target, path.relative(UPLOAD_ROOT, f));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.renameSync(f, dest);
  }
  console.log(`\n${orphans.length} file dipindahkan ke ${path.relative(BACKEND_ROOT, target)}`);
}

main()
  .catch((err) => { console.error(err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
