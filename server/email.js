import nodemailer from 'nodemailer';

export async function sendEmail({ to, subject, html }) {
  // Diese Variablen musst du in Railway unter "Variables" setzen:
  // SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_PORT === '465',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const mailOptions = {
    from: process.env.SMTP_FROM || '"Site Editor" <noreply@example.com>',
    to,
    subject,
    html,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log('E-Mail gesendet:', info.messageId);
    return info;
  } catch (error) {
    console.error('E-Mail-Fehler:', error);
    throw new Error('E-Mail konnte nicht gesendet werden.');
  }
}
