import nodemailer from "nodemailer"

// Gmail SMTP – App Password nötig (nicht dein normales Passwort)
// Einrichten: Google Account → Sicherheit → 2FA → App-Passwörter → "Mail" → Code kopieren
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  }
})

const FROM = `Site Editor <${process.env.GMAIL_USER}>`

async function send(to, subject, html) {
  try {
    await transporter.sendMail({ from: FROM, to, subject, html })
    console.log(`✅ Mail gesendet an ${to}`)
  } catch (e) {
    console.error(`❌ Mail Fehler:`, e.message)
  }
}

export async function sendWelcome(email, name) {
  await send(email, "Willkommen bei Site Editor", `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Site Editor</h1>
      <p>Hallo ${name || ""},</p>
      <p>willkommen! Dein Account ist bereit.</p>
      <a href="http://localhost:8788" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Jetzt starten</a>
    </div>
  `)
}

export async function sendPasswordReset(email, token) {
  const link = `http://localhost:8788/reset-password?token=${token}`
  await send(email, "Passwort zurücksetzen – Site Editor", `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Passwort zurücksetzen</h1>
      <p>Klicke auf den Link um ein neues Passwort zu setzen.</p>
      <a href="${link}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Passwort zurücksetzen</a>
      <p style="margin-top:24px;font-size:12px;color:#94a3b8">Gültig für 1 Stunde.</p>
    </div>
  `)
}

export async function sendTeamInvite(email, orgName, inviterName) {
  await send(email, `${inviterName} hat dich zu ${orgName} eingeladen`, `
    <div style="font-family:system-ui;max-width:480px;margin:0 auto;padding:32px">
      <h1 style="color:#6366f1">Einladung</h1>
      <p><strong>${inviterName}</strong> hat dich zur Organisation <strong>${orgName}</strong> eingeladen.</p>
      <a href="http://localhost:8788" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Einladung annehmen</a>
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
      <a href="http://localhost:8788" style="display:inline-block;padding:12px 24px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:700">Zum Dashboard</a>
    </div>
  `)
}
