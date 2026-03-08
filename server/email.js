import { Resend } from 'resend'

const APP_URL = process.env.APP_URL || "https://edit-production-ca78.up.railway.app"
const resend = new Resend(process.env.RESEND_API_KEY)

async function send(to, subject, html) {
  try {
    const { data, error } = await resend.emails.send({
      from: 'Site Editor <onboarding@resend.dev>',
      to: [to],
      subject: subject,
      html: html
    })
    
    if (error) {
      console.error(`❌ Resend Fehler:`, error)
      return false
    }
    
    console.log(`✅ Email gesendet an ${to}`)
    return true
  } catch (e) {
    console.error(`❌ Email Fehler:`, e.message)
    return false
  }
}

export async function sendWelcome(email, name) {
  await send(email, "Willkommen bei Site Editor", `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Site Editor</h1>
      <p>Hallo ${name || ""},</p>
      <p>willkommen! Dein Account ist bereit.</p>
      <a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Jetzt starten</a>
    </div>
  `)
}

export async function sendTeamInvite(email, orgName, inviterName) {
  await send(email, `${inviterName} hat dich zu ${orgName} eingeladen`, `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Einladung</h1>
      <p><strong>${inviterName}</strong> hat dich zur Organisation <strong>${orgName}</strong> eingeladen.</p>
      <a href="${APP_URL}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Einladung annehmen</a>
    </div>
  `)
}

export async function sendPaymentConfirmation(email, name, amountEur, creditsEur) {
  await send(email, "Zahlung bestätigt – Site Editor", `
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

export async function sendPasswordReset(email, name, resetToken) {
  const resetUrl = `${APP_URL}/reset-password?token=${resetToken}`
  
  await send(email, "Passwort zurücksetzen – Site Editor", `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Passwort zurücksetzen</h1>
      <p>Hallo ${name || ""},</p>
      <p>du hast eine Anfrage zum Zurücksetzen deines Passworts erhalten.</p>
      <a href="${resetUrl}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#dc2626;color:white;border-radius:8px;text-decoration:none;font-weight:700">Passwort zurücksetzen</a>
      <p style="margin-top:24px;font-size:13px;color:#64748b">Dieser Link ist 1 Stunde gültig.</p>
    </div>
  `)
}
