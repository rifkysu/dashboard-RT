Dashboard : 
di bagian ini pada aktivitas terbaru mengambil apda pemeliharan dan pengadaan ambil dari database di urutan pertama menurut pemeliharaan dan pengadaan jadi setiap update di bagian menu lain masuk ke aktivitas terbaru 

Pemeliharan :
ada update di bagian tahap 1 yaitu bagian input boq itu berupa upload file word,excel dan pdf
di tabah metode pengadaan dibuat 3 pilihan yaitu : Lelang, E-Purchasing dan pengadaan langsung (PL) 

lalu di tampilan pemeliharaan berikan 2 button semua,sarana,prasarana dan bakal filter sesuai dengan 3 itu di kolom dan di bagian kolom terdapat filter di lokasi dan status dan tombol search dan jangan dibuat panigation tapi kolom kebawah berikan tombol untuk scroll ke bawah saja

pengadaan : 
samakan dengan pemeliharann tampilan dan fungsinya semua ya

role :
karyawan bisa masukan permintaan nanti update di database menjadi pic agar bisa masukin tahap2 itu kalau pic terbuka tiap aksi nya bertahap pada menu pemeliharaan dan pengadaan jadi terbuka nya satu2 ketika sudah terisi semua 
lalu untuk role kabag langsung bagian aksi terbuka semua dan bisa di edit 

update role admin

UPDATE users SET role = 'admin', updated_at = NOW()
WHERE email = 'email-kamu@contoh.com';

Semua sudah aktif — backend murni perubahan kode (nodemon auto-restart, sudah saya buktikan lewat test barusan), frontend juga auto hot-reload.

Ringkasan perbaikan akar masalah:

1. Backend (middleware/auth.js) — sebelumnya role user "dibekukan" di dalam token JWT sejak login, jadi walau data di database sudah diubah lewat pgAdmin4, backend tetap percaya klaim role lama di token. Sekarang requireAuth selalu mengambil role & status aktif terbaru langsung dari database di setiap request, bukan dari token. Saya sudah buktikan lewat test: token yang masih mengklaim role: pic tetap berhasil melakukan aksi khusus admin, karena backend cek DB dan ketemu role-nya sudah admin. Bonus: akun yang di-nonaktifkan (is_active = false) via pgAdmin4 sekarang juga langsung ke-logout paksa di request berikutnya.
2. Frontend (AuthContext.jsx) — sebelumnya data user cuma di-fetch sekali saat halaman pertama dimuat. Sekarang ditambahkan refresh otomatis tiap 30 detik (bareng dengan pengecekan maintenance mode yang sudah ada), jadi tampilan role di UI (termasuk munculnya panel Mode Maintenance di Settings) ikut ter-update sendiri tanpa perlu refresh manual atau logout.

Jadi sekarang: perubahan role lewat pgAdmin4 berlaku maksimal dalam ~30 detik secara otomatis di seluruh sisi (backend enforcement maupun tampilan frontend) — tidak perlu logout sama sekali. Kalau mau instan, tinggal refresh browser (F5) aja, tanpa perlu logout-login.