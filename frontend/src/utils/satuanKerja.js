// Daftar satuan kerja (unit) Kemnaker untuk pilihan "Satuan kerja / bagian" saat menambah/mengubah ruang rapat
// di menu Foto & Fasilitas Ruang. Hanya bantuan isian: admin tetap boleh mengetik nama lain. Nama yang sudah
// dipakai data ruangan (mis. "Biro Perencanaan", "Biro Keuangan dan BMN", "PPSDM Ketenagakerjaan") ditulis sama
// persis supaya ruangan baru masuk ke menu bagian yang sama, bukan membuat bagian baru.
// Ubah/tambah nama di sini bila struktur organisasi berubah.
export const SATUAN_KERJA = [
  {
    grup: 'Sekretariat Jenderal',
    unit: [
      'Sekretariat Jenderal',
      'Biro Umum',
      'Biro Perencanaan',
      'Biro Keuangan dan BMN',
      'Biro Organisasi dan Sumber Daya Manusia Aparatur',
      'Biro Hukum',
      'Biro Hubungan Masyarakat',
      'Biro Kerja Sama',
      'Pusat Data dan Teknologi Informasi Ketenagakerjaan',
      'Pusat Perencanaan Ketenagakerjaan',
      'Pusat Pengembangan Kebijakan Ketenagakerjaan',
      'Pusat Pasar Kerja',
      'PPSDM Ketenagakerjaan',
      'Politeknik Ketenagakerjaan',
    ],
  },
  {
    grup: 'Inspektorat Jenderal',
    unit: ['Inspektorat Jenderal', 'Sekretariat Inspektorat Jenderal'],
  },
  {
    grup: 'Ditjen Binalavotas (Pembinaan Pelatihan Vokasi dan Produktivitas)',
    unit: [
      'Ditjen Binalavotas',
      'Sekretariat Ditjen Binalavotas',
      'Direktorat Bina Standardisasi Kompetensi dan Program Pelatihan',
      'Direktorat Bina Penyelenggaraan Pelatihan Vokasi dan Pemagangan',
      'Direktorat Bina Kelembagaan Pelatihan Vokasi',
      'Direktorat Bina Instruktur dan Tenaga Pelatihan',
      'Direktorat Bina Peningkatan Produktivitas',
    ],
  },
  {
    grup: 'Ditjen Binapenta dan PKK (Pembinaan Penempatan Tenaga Kerja dan Perluasan Kesempatan Kerja)',
    unit: [
      'Ditjen Binapenta dan PKK',
      'Sekretariat Ditjen Binapenta dan PKK',
      'Direktorat Bina Penempatan Tenaga Kerja Dalam Negeri',
      'Direktorat Bina Penempatan dan Pelindungan Pekerja Migran Indonesia',
      'Direktorat Pengendalian Penggunaan Tenaga Kerja Asing',
      'Direktorat Bina Perluasan Kesempatan Kerja',
    ],
  },
  {
    grup: 'Ditjen PHI dan Jamsos (Pembinaan Hubungan Industrial dan Jaminan Sosial Tenaga Kerja)',
    unit: [
      'Ditjen PHI dan Jamsos',
      'Sekretariat Ditjen PHI dan Jamsos',
      'Direktorat Kelembagaan dan Pencegahan Perselisihan Hubungan Industrial',
      'Direktorat Penyelesaian Perselisihan Hubungan Industrial',
      'Direktorat Persyaratan Kerja',
      'Direktorat Pengupahan',
      'Direktorat Jaminan Sosial Ketenagakerjaan',
    ],
  },
  {
    grup: 'Ditjen Binwasnaker dan K3 (Pembinaan Pengawasan Ketenagakerjaan dan K3)',
    unit: [
      'Ditjen Binwasnaker dan K3',
      'Sekretariat Ditjen Binwasnaker dan K3',
      'Direktorat Bina Pemeriksaan Norma Ketenagakerjaan',
      'Direktorat Bina Penegakan Hukum Ketenagakerjaan',
      'Direktorat Bina Keselamatan dan Kesehatan Kerja',
    ],
  },
];
