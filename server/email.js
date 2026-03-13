import nodemailer from "nodemailer"

function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_PORT || "587") === "465",
    auth: process.env.SMTP_USER && process.env.SMTP_PASS
      ? {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        }
      : undefined,
  })
}

export async function sendEmail({ to, subject, html }) {
  const transporter = createTransporter()
  return transporter.sendMail({
    from: process.env.SMTP_FROM || '"Site Editor" <noreply@example.com>',
    to,
    subject,
    html,
  })
}

export async function sendWelcome(to, verifyToken, name = "") {
  const appName = process.env.APP_NAME || "Site Editor"
  const baseUrl = (process.env.APP_URL || "").replace(/\/$/, "")
  const verifyUrl = baseUrl
    ? `${baseUrl}/verify-email?token=${encodeURIComponent(verifyToken)}`
    : `Verify token: ${verifyToken}`

  const safeName = name || "there"

  return sendEmail({
    to,
    subject: `Willkommen bei ${appName}`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>Willkommen bei ${appName}</h2>
        <p>Hi ${safeName},</p>
        <p>bitte bestätige deine E-Mail-Adresse.</p>
        <p><a href="${verifyUrl}">E-Mail bestätigen</a></p>
        <p>Falls der Button nicht funktioniert, nutze diesen Link:</p>
        <p>${verifyUrl}</p>
      </div>
    `,
  })
}

export async function sendPasswordReset(to, resetToken, name = "") {
  const appName = process.env.APP_NAME || "Site Editor"
  const baseUrl = (process.env.APP_URL || "").replace(/\/$/, "")
  const resetUrl = baseUrl
    ? `${baseUrl}/reset-password?token=${encodeURIComponent(resetToken)}`
    : `Reset token: ${resetToken}`

  const safeName = name || "there"

  return sendEmail({
    to,
    subject: `${appName} Passwort zurücksetzen`,
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
        <h2>Passwort zurücksetzen</h2>
        <p>Hi ${safeName},</p>
        <p>du hast ein neues Passwort angefordert.</p>
        <p><a href="${resetUrl}">Passwort zurücksetzen</a></p>
        <p>Falls der Button nicht funktioniert, nutze diesen Link:</p>
        <p>${resetUrl}</p>
      </div>
    `,
  })
}
