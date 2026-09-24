const nodemailer = require('nodemailer');
const logger = require('./logger');

// Pengirim email lewat SMTP (Gmail, email kantor, Brevo, dll -- cukup ganti .env).
// Kalau SMTP_HOST/SMTP_USER/SMTP_PASS belum diisi, isMailConfigured() = false
// dan fitur Lupa Password kembali ke alur manual (notifikasi ke admin).
let transporter = null;

function isMailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 465;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return transporter;
}

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function sendResetPasswordEmail({ to, nama, resetUrl }) {
  const from = process.env.MAIL_FROM || `"Biro Umum" <${process.env.SMTP_USER}>`;
  const text = [
    `Halo ${nama},`,
    '',
    'Kami menerima permintaan untuk mengatur ulang kata sandi akun Aplikasi Biro Umum Anda.',
    'Buka link berikut untuk membuat kata sandi baru (berlaku 1 jam, hanya bisa dipakai sekali):',
    '',
    resetUrl,
    '',
    'Kalau Anda tidak merasa meminta reset kata sandi, abaikan email ini -- kata sandi Anda tidak berubah.',
    '',
    'Biro Umum dan Rumah Tangga',
  ].join('\n');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:520px;margin:auto;color:#0f172a">
      <h2 style="margin:0 0 12px">Reset Kata Sandi</h2>
      <p>Halo <b>${escapeHtml(nama)}</b>,</p>
      <p>Kami menerima permintaan untuk mengatur ulang kata sandi akun Aplikasi Biro Umum Anda.</p>
      <p style="margin:24px 0">
        <a href="${escapeHtml(resetUrl)}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Buat Kata Sandi Baru</a>
      </p>
      <p style="font-size:13px;color:#475569">Link berlaku 1 jam dan hanya bisa dipakai sekali. Kalau tombol tidak bisa diklik, salin link ini ke browser:<br><span style="word-break:break-all">${escapeHtml(resetUrl)}</span></p>
      <p style="font-size:13px;color:#475569">Kalau Anda tidak merasa meminta reset kata sandi, abaikan email ini &mdash; kata sandi Anda tidak berubah.</p>
      <p style="font-size:13px;color:#475569;margin-top:24px">Biro Umum dan Rumah Tangga</p>
    </div>`;

  await getTransporter().sendMail({ from, to, subject: 'Reset Kata Sandi Akun Biro Umum', text, html });
  logger.info('Email reset password terkirim', { to });
}

module.exports = { isMailConfigured, sendResetPasswordEmail };
