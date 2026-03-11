import { Resend } from 'resend'

const APP_URL = process.env.APP_URL || "https://edit-production-ca78.up.railway.app"
const PASSWORD_RESET_EMAIL_OVERRIDE = (process.env.PASSWORD_RESET_EMAIL_OVERRIDE || process.env.RESET_MAIL_TO || "").trim()
let resend = null

function getResend() {
  const key = (process.env.RESEND_API_KEY || "").trim()
  if (!key) return null
  if (!resend) resend = new Resend(key)
  return resend
}

async function send(to, subject, html) {
  console.log(`EMAIL attempt -> to=${to} subject=${subject}`)
  const client = getResend()

  if (!client) {
    console.warn("EMAIL skipped: RESEND_API_KEY missing")
    return false
  }

  try {
    const { data, error } = await client.emails.send({
      from: "Site Editor <onboarding@resend.dev>",
      to: [to],
      subject,
      html
    })

    if (error) {
      console.error("RESEND ERROR:", JSON.stringify(error, null, 2))
      return false
    }

    console.log("EMAIL OK:", JSON.stringify(data, null, 2))
    return true
  } catch (e) {
    console.error("EMAIL EXCEPTION:", e?.message || e)
    return false
  }
}

export async function sendWelcome(email, name) {
  return send(email, "Willkommen bei Site Editor", `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Site Editor</h1>
      <p>Hallo ${name || ""},</p>
      <p>willkommen! Dein Account ist bereit.</p>
      <a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Jetzt starten</a>
    </div>
  `)
}

export async function sendTeamInvite(email, orgName, inviterName) {
  return send(email, `${inviterName} hat dich zu ${orgName} eingeladen`, `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Einladung</h1>
      <p><strong>${inviterName}</strong> hat dich zur Organisation <strong>${orgName}</strong> eingeladen.</p>
      <a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Einladung annehmen</a>
    </div>
  `)
}

export async function sendPaymentConfirmation(email, name, amountEur, creditsEur) {
  return send(email, "Zahlung bestätigt – Site Editor", `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Zahlung bestätigt</h1>
      <p>Hallo ${name || ""},</p>
      <p>deine Zahlung von <strong>€ ${amountEur.toFixed(2)}</strong> wurde verarbeitet.</p>
      <div style="margin:24px 0;padding:16px;background:#f1f5f9;border-radius:8px">
        <div style="font-size:13px;color:#64748b">Guthaben aufgeladen</div>
        <div style="font-size:28px;font-weight:900;color:#22c55e">€ ${creditsEur.toFixed(2)}</div>
      </div>
      <a href="${APP_URL}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Zum Dashboard</a>
    </div>
  `)
}

export async function sendShareLink(email, projectName, shareUrl, inviterName = "") {
  return send(email, `Preview: ${projectName} – Site Editor`, `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Project Preview</h1>
      <p>${inviterName ? `<strong>${inviterName}</strong> shared a preview of ` : ""}<strong>${projectName}</strong> with you.</p>
      <a href="${shareUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">View Preview</a>
    </div>
  `)
}

export async function sendPasswordReset(email, resetToken, name = "") {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`
  const recipient = PASSWORD_RESET_EMAIL_OVERRIDE || email
  const heading = PASSWORD_RESET_EMAIL_OVERRIDE ? `Passwort zurücksetzen – ${email}` : "Passwort zurücksetzen"

  return send(recipient, heading, `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Passwort zurücksetzen</h1>
      ${PASSWORD_RESET_EMAIL_OVERRIDE ? `<p>User: <strong>${email}</strong></p>` : ""}
      <p>Hallo ${name || ""},</p>
      <p>du hast eine Anfrage zum Zurücksetzen deines Passworts erhalten.</p>
      <a href="${resetUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#dc2626;color:white;border-radius:8px;text-decoration:none;font-weight:700">Passwort zurücksetzen</a>
      <p style="margin-top:24px;font-size:13px;color:#64748b">Dieser Link ist 1 Stunde gültig.</p>
    </div>
  `)
}
