const logger = require('./logger');
const { isMailConfigured, sendBookingEmail } = require('./mailer');

// Helper email booking tamu, dipakai routes/guest.js, routes/ruangRapat.js, dan reminders.js.
// Dipisah dari ruangRapat.js supaya tidak ada require melingkar (guest.js sudah memakai ruangRapat.js).

const fmtHari = (d) => d.toISOString().slice(0, 10);
const jam = (d) => d.toISOString().slice(11, 16);
// Satu atau beberapa baris booking -> "2026-11-06, 2026-11-08 s/d 2026-11-10".
const teksTanggal = (rows) =>
  rows
    .map((r) =>
      +r.end_date !== +r.booking_date
        ? `${fmtHari(r.booking_date)} s/d ${fmtHari(r.end_date)}`
        : fmtHari(r.booking_date),
    )
    .join(', ');

// Email ke tamu pengaju. Dikirim di latar belakang (tidak ditunggu): simpan/batal booking tidak boleh
// lambat atau gagal hanya karena SMTP bermasalah -- kegagalan cukup dicatat di log.
// Tanpa SMTP di .env fungsi ini tidak melakukan apa-apa. Mengembalikan Promise<boolean> (true = terkirim)
// untuk pemanggil yang perlu tahu hasilnya (pengingat); pemanggil lain boleh mengabaikannya.
function emailBooking(guest, jenis, { rincian, sebelumnya, catatan }) {
  if (!isMailConfigured() || !guest?.email) return Promise.resolve(false);
  return sendBookingEmail({
    to: guest.email,
    nama: guest.nama,
    jenis,
    rincian,
    sebelumnya,
    catatan,
  })
    .then(() => true)
    .catch((err) => {
      logger.warn('Email booking tamu gagal dikirim', { jenis, guest_id: guest.id, error: err });
      return false;
    });
}

const rincianBooking = (rows, extra = []) => [
  ['Agenda', rows[0].agenda],
  ['Ruangan', rows[0].room],
  ['Tanggal', teksTanggal(rows)],
  ['Jam', `${jam(rows[0].start_time)}–${jam(rows[0].end_time)}`],
  ...extra,
];

module.exports = { emailBooking, rincianBooking, teksTanggal, fmtHari, jam };
