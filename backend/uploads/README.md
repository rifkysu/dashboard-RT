# Penyimpanan File Lokal

Folder ini digunakan backend untuk menyimpan file upload dari 4 menu:
- `pemeliharaan/`
- `pengadaan/`
- `kendaraan/`
- `ruang-rapat/`

File disimpan berdasarkan tahun/bulan dan nama file dibuat unik. Endpoint `/uploads` tidak diekspos sebagai static publik; aplikasi tetap menggunakan endpoint API yang membutuhkan autentikasi untuk data sensitif.
