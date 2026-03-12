import { Resend } from "resend"

const APP_BASE_URL = (
  process.env.APP_BASE_URL ||
  process.env.APP_URL ||
  "https://edit-production-ca78.up.railway.app"
).trim()
const EMAIL_FROM = (process.env.EMAIL_FROM || "Site Editor <onboarding@resend.dev>").trim()
const PASSWORD_RESET_EMAIL_OVERRIDE = (process.env.PASSWORD_RESET_EMAIL_OVERRIDE || process.env.RESET_MAIL_TO || "").trim()

let resend = null

function getResend() {
  const key = (process.env.RESEND_API_KEY || "").trim()
  if (!key) return null
  if (!resend) resend = new Resend(key)
  return resend
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function sendEmail({ to, subject, html }) {
  console.log(`EMAIL attempt -> to=${to} subject=${subject}`)
  const client = getResend()
  if (!client) {
    console.warn("EMAIL skipped: RESEND_API_KEY missing")
    return false
  }

  try {
    const { data, error } = await client.emails.send({
      from: EMAIL_FROM,
      to: [to],
      subject,
      html,
    })

    if (error) {
      console.error("RESEND ERROR:", JSON.stringify(error, null, 2))
      return false
    }

    console.log("EMAIL OK:", JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error("EMAIL EXCEPTION:", error?.message || error)
    return false
  }
}

export async function sendWelcome(email, token = "", name = "") {
  const safeName = escapeHtml(name)
  const verifyUrl = token
    ? `${APP_BASE_URL}/verify?token=${encodeURIComponent(token)}`
    : APP_BASE_URL

  return sendEmail({
    to: email,
    subject: token ? "Willkommen bei Site Editor – Email verifizieren" : "Willkommen bei Site Editor",
    html: `
      <div style="font-family:system-ui;max-width:520px;margin:0 auto;padding:32px;color:#111827">
        <h1 style="color:#6366f1;margin:0 0 18px">Site Editor</h1>
        <p>Hallo ${safeName || "there"},</p>
        <p>${token ? "dein Account ist erstellt. Bitte bestätige jetzt deine Email-Adresse." : "willkommen! Dein Account ist bereit."}</p>
        <a href="${verifyUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">
          ${token ? "Email verifizieren" : "Jetzt starten"}
        </a>
        ${token ? `<p style="margin-top:20px;font-size:13px;color:#64748b">Dieser Link ist 24 Stunden gültig.</p>` : ""}
      </div>
    `,
  })
}

export async function sendTeamInvite(email, orgName, inviterName) {
  return sendEmail({
    to: email,
    subject: `${inviterName} hat dich zu ${orgName} eingeladen`,
    html: `
      <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#6366f1">Einladung</h1>
        <p><strong>${escapeHtml(inviterName)}</strong> hat dich zur Organisation <strong>${escapeHtml(orgName)}</strong> eingeladen.</p>
        <a href="${APP_BASE_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Einladung annehmen</a>
      </div>
    `,
  })
}

export async function sendPaymentConfirmation(email, name = "", amountEur = 0, creditsEur = 0) {
  return sendEmail({
    to: email,
    subject: "Zahlung bestätigt – Site Editor",
    html: `
      <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#6366f1">Zahlung bestätigt</h1>
        <p>Hallo ${escapeHtml(name) || "there"},</p>
        <p>deine Zahlung von <strong>€ ${Number(amountEur || 0).toFixed(2)}</strong> wurde verarbeitet.</p>
        <div style="margin:24px 0;padding:16px;background:#f1f5f9;border-radius:8px">
          <div style="font-size:13px;color:#64748b">Guthaben aufgeladen</div>
          <div style="font-size:28px;font-weight:900;color:#22c55e">€ ${Number(creditsEur || 0).toFixed(2)}</div>
        </div>
        <a href="${APP_BASE_URL}" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Zum Dashboard</a>
      </div>
    `,
  })
}

export async function sendPaymentFailed(email, name = "", portalUrl = "") {
  const updateLink = portalUrl || `${APP_BASE_URL}/`
  return sendEmail({
    to: email,
    subject: "Zahlung fehlgeschlagen – Aktion erforderlich",
    html: `
      <div style="font-family:system-ui;max-width:520px;margin:0 auto;padding:32px;color:#111827">
        <h1 style="color:#ef4444;margin:0 0 18px">Zahlung fehlgeschlagen</h1>
        <p>Hallo ${escapeHtml(name) || "there"},</p>
        <p>deine letzte Abo-Zahlung konnte nicht verarbeitet werden. Bitte aktualisiere deine Zahlungsmethode, damit dein Zugang aktiv bleibt.</p>
        <a href="${updateLink}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#ef4444;color:white;border-radius:8px;text-decoration:none;font-weight:700">Zahlungsmethode aktualisieren</a>
      </div>
    `,
  })
}

export async function sendShareLink(email, projectName, shareUrl, inviterName = "") {
  return sendEmail({
    to: email,
    subject: `Preview: ${projectName} – Site Editor`,
    html: `
      <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#6366f1">Project Preview</h1>
        <p>${inviterName ? `<strong>${escapeHtml(inviterName)}</strong> shared a preview of ` : ""}<strong>${escapeHtml(projectName)}</strong> with you.</p>
        <a href="${shareUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">View Preview</a>
      </div>
    `,
  })
}

export async function sendPasswordReset(email, resetToken, name = "") {
  const resetUrl = `${APP_BASE_URL}/reset-password?token=${encodeURIComponent(resetToken)}`
  const recipient = PASSWORD_RESET_EMAIL_OVERRIDE || email
  const heading = PASSWORD_RESET_EMAIL_OVERRIDE ? `Passwort zurücksetzen – ${email}` : "Passwort zurücksetzen"

  return sendEmail({
    to: recipient,
    subject: heading,
    html: `
      <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
        <h1 style="color:#6366f1">Passwort zurücksetzen</h1>
        ${PASSWORD_RESET_EMAIL_OVERRIDE ? `<p>User: <strong>${escapeHtml(email)}</strong></p>` : ""}
        <p>Hallo ${escapeHtml(name) || "there"},</p>
        <p>du hast eine Anfrage zum Zurücksetzen deines Passworts erhalten.</p>
        <a href="${resetUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#dc2626;color:white;border-radius:8px;text-decoration:none;font-weight:700">Passwort zurücksetzen</a>
        <p style="margin-top:24px;font-size:13px;color:#64748b">Dieser Link ist 1 Stunde gültig.</p>
      </div>
    `,
  })
}
