import nodemailer from 'nodemailer';

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: String(process.env.SMTP_PORT || '587') === '465',
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  });
}

function getBaseUrl() {
  return String(process.env.ALLOWED_ORIGIN || process.env.APP_URL || '').replace(/\/$/, '');
}

export async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter();
  return transporter.sendMail({
    from: process.env.SMTP_FROM || '"Site Editor" <noreply@example.com>',
    to,
    subject,
    html,
  });
}

export async function sendWelcome(email, token, name = '') {
  const baseUrl = getBaseUrl();
  const verifyUrl = baseUrl
    ? `${baseUrl}/verify?token=${encodeURIComponent(token)}`
    : `Token: ${token}`;

  return sendEmail({
    to: email,
    subject: 'Willkommen beim Site Editor!',
    html: `<h1>Hallo ${name || 'there'}</h1><p>Bitte verifiziere deine E-Mail: <a href="${verifyUrl}">${verifyUrl}</a></p>`
  });
}

export async function sendPasswordReset(email, token, name = '') {
  const baseUrl = getBaseUrl();
  const resetUrl = baseUrl
    ? `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`
    : `Token: ${token}`;

  return sendEmail({
    to: email,
    subject: 'Passwort zurücksetzen',
    html: `<h1>Hallo ${name || 'there'}</h1><p>Klicke hier zum Zurücksetzen: <a href="${resetUrl}">${resetUrl}</a></p>`
  });
}

export async function sendShareLink(email, projectName, url, senderName = 'Jemand') {
  return sendEmail({
    to: email,
    subject: `Freigabe: Projekt "${projectName}"`,
    html: `<p>${senderName} hat ein Projekt mit dir geteilt: <a href="${url}">${url}</a></p>`
  });
}

export async function sendTeamInvite(email, orgName, senderName = 'Jemand') {
  const baseUrl = getBaseUrl();
  const inviteUrl = baseUrl ? `${baseUrl}/dashboard` : '#';

  return sendEmail({
    to: email,
    subject: `Einladung zum Team "${orgName}"`,
    html: `<p>${senderName} hat dich zum Team <strong>${orgName}</strong> eingeladen.</p><p><a href="${inviteUrl}">${inviteUrl}</a></p>`
  });
}
