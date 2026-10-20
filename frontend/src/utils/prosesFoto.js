// Siapkan foto sebelum di-upload: potong bagian bawah (mis. watermark tanggal/alamat dari aplikasi
// kamera), kecilkan ke sisi terpanjang maks. 1920px, lalu simpan ulang sebagai JPEG.
// Simpan ulang lewat canvas juga membuang metadata EXIF (termasuk lokasi GPS) dari foto HP.
const MAX_SISI = 1920;
const KUALITAS = 0.85;

async function bukaGambar(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* lanjut cara lama */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

// potongBawah: 0..0.5 (bagian tinggi foto yang dibuang dari bawah). Hasil: data URL JPEG.
export async function prosesFoto(file, { potongBawah = 0 } = {}) {
  const img = await bukaGambar(file);
  const w0 = img.width;
  const h0 = Math.round(img.height * (1 - Math.min(0.5, Math.max(0, potongBawah))));
  const skala = Math.min(1, MAX_SISI / Math.max(w0, h0));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w0 * skala);
  canvas.height = Math.round(h0 * skala);
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  // JPEG tidak punya transparansi: tanpa latar putih, bagian transparan PNG/WEBP jadi hitam.
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, w0, h0, 0, 0, canvas.width, canvas.height);
  img.close?.();
  return canvas.toDataURL('image/jpeg', KUALITAS);
}
