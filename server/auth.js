
function getFingerprint(req) {
  return Buffer.from(req.headers['user-agent'] || 'unknown').toString('base64').substring(0, 32);
}
import crypto from "crypto"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import multer from "multer"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import db from "./db.js"
import { sendWelcome, sendPasswordReset } from "./email.js"
import { logAudit } from "./auditLog.js"
import { createRateLimit } from "./rateLimit.js"
import {
  isValidationError,
  readEmail,
  readPassword,
  readRequiredString,
  readOptionalString,
} from "./validation.js"

const DEFAULT_SECRET = "site-editor-secret-change-in-prod"
const SECRET = process.env.JWT_SECRET || DEFAULT_SECRET
const COOKIE = "se_token"
const REFRESH_COOKIE = "se_refresh"
const OAUTH_STATE_COOKIE = "se_oauth_state"
const IS_PROD = process.env.NODE_ENV === "production"
const AUTH_IDLE_TIMEOUT_MIN = Number(process.env.AUTH_IDLE_TIMEOUT_MIN) || 120
const AUTH_IDLE_TIMEOUT_MS = AUTH_IDLE_TIMEOUT_MIN * 60 * 1000
const AUTH_ACTIVITY_RENEW_SECONDS = Math.max(30, Math.min(10 * 60, Number(process.env.AUTH_ACTIVITY_RENEW_SECONDS || 90) || 90))
const AVATAR_UPLOAD_MAX_BYTES = Math.max(128_000, Math.min(8_000_000, Number(process.env.AVATAR_UPLOAD_MAX_BYTES || 4_000_000) || 4_000_000))
const OAUTH_STATE_MAX_AGE_MS = 10 * 60 * 1000
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const THUMBNAILS_DIR = path.join(__dirname, "thumbnails")
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: IS_PROD,
  sameSite: "lax",
}

if (IS_PROD) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET) {
    throw new Error("FATAL: In production, JWT_SECRET must be set in .env and must not be the default")
  }
}

function authIdentifier(req) {
  return `${req.ip || req.socket?.remoteAddress || "unknown"}:${String(req.body?.email || "").toLowerCase()}`
}

const authRateMessage = "Too many attempts. Try again in 15 minutes."
const registerRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth-register",
  message: authRateMessage,
  keyFn: authIdentifier,
})
const loginRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth-login",
  message: authRateMessage,
  keyFn: authIdentifier,
})
const forgotPasswordRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  keyPrefix: "auth-forgot-password",
  message: authRateMessage,
  keyFn: authIdentifier,
})
const resetPasswordRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth-reset-password",
  message: authRateMessage,
  keyFn: authIdentifier,
})
const login2faRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyPrefix: "auth-login-2fa",
  message: authRateMessage,
  keyFn: (req) => {
    const ip = req.ip || req.socket?.remoteAddress || "unknown"
    const sessionToken = String(req.body?.session_token || "").trim().slice(0, 64) || "missing"
    return `${ip}:${sessionToken}`
  },
})

function normalizeNotificationPrefs(raw) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return {
      email_updates: raw.email_updates !== false,
      team_mentions: raw.team_mentions !== false,
    }
  }
  return { email_updates: true, team_mentions: true }
}

function parseStoredNotificationPrefs(value) {
  try {
    return normalizeNotificationPrefs(JSON.parse(value || "{}"))
  } catch {
    return normalizeNotificationPrefs(null)
  }
}

function syncUserSettingsPlan(userId, planId = "basis") {
  const normalized = ["basis", "starter", "pro", "scale"].includes(String(planId || ""))
    ? String(planId)
    : "basis"
  db.prepare(`
    INSERT INTO user_settings (user_id, plan)
    VALUES (?, ?)
    ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan
  `).run(userId, normalized)
}

function signAccessToken(userId, email) {
  return jwt.sign({ id: userId, email, act: Date.now() }, SECRET, { expiresIn: "15m" })
}

function setAuthCookies(res, userId, email) {
  const token = signAccessToken(userId, email)
  const refreshToken = crypto.randomBytes(40).toString("hex")
  const csrfToken = crypto.randomBytes(32).toString("hex")
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

  db.prepare("DELETE FROM refresh_tokens WHERE user_id = ? OR expires_at <= datetime('now')").run(userId)
  db.prepare("INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)").run(userId, refreshToken, expiresAt)

  res.cookie(COOKIE, token, { ...AUTH_COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
  res.cookie(REFRESH_COOKIE, refreshToken, { ...AUTH_COOKIE_OPTIONS, maxAge: 7 * 24 * 60 * 60 * 1000, path: "/api/auth" })
  res.cookie("csrf_token", csrfToken, { ...AUTH_COOKIE_OPTIONS, httpOnly: false, maxAge: 15 * 60 * 1000 })
}

function clearAuthCookies(res) {
  res.clearCookie(COOKIE)
  res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" })
}

function createOAuthStateToken() {
  return crypto.randomBytes(32).toString("hex")
}

function setOAuthStateCookie(res, stateToken) {
  res.cookie(OAUTH_STATE_COOKIE, stateToken, {
    ...AUTH_COOKIE_OPTIONS,
    maxAge: OAUTH_STATE_MAX_AGE_MS,
    path: "/api/auth",
  })
}

function clearOAuthStateCookie(res) {
  res.clearCookie(OAUTH_STATE_COOKIE, { path: "/api/auth" })
}

function tokensMatch(left, right) {
  const a = Buffer.from(String(left || ""), "utf8")
  const b = Buffer.from(String(right || ""), "utf8")
  if (!a.length || !b.length || a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

function isHttpsRequest(req) {
  if (req.secure) return true
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "")
    .split(",")[0]
    .trim()
    .toLowerCase()
  if (forwardedProto === "https") return true
  const host = String(req.headers.host || "").toLowerCase()
  if (host.startsWith("localhost") || host.startsWith("127.0.0.1")) return true
  return false
}

function requireHttpsInProd(req, res, next) {
  if (!IS_PROD || isHttpsRequest(req)) return next()
  return res.status(400).json({ ok: false, error: "HTTPS is required for authentication endpoints in production." })
}

function parseAvatarDataUrl(raw) {
  const value = String(raw || "").trim()
  const match = value.match(/^data:(image\/(?:png|jpeg|jpg|webp|gif));base64,([a-z0-9+/=\s]+)$/i)
  if (!match) return null
  const mime = match[1].toLowerCase() === "image/jpg" ? "image/jpeg" : match[1].toLowerCase()
  const payload = match[2].replace(/\s+/g, "")
  const buffer = Buffer.from(payload, "base64")
  if (!buffer.length || buffer.length > AVATAR_UPLOAD_MAX_BYTES) return null
  const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg"
  return { mime, buffer, extension }
}

function generateBase32Secret(byteLength = 20) {
  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const bytes = crypto.randomBytes(byteLength)
  let output = ""
  for (let i = 0; i < bytes.length; i += 5) {
    const chunk = [bytes[i], bytes[i + 1] || 0, bytes[i + 2] || 0, bytes[i + 3] || 0, bytes[i + 4] || 0]
    output += BASE32[(chunk[0] >> 3) & 31]
    output += BASE32[((chunk[0] << 2) | (chunk[1] >> 6)) & 31]
    output += BASE32[(chunk[1] >> 1) & 31]
    output += BASE32[((chunk[1] << 4) | (chunk[2] >> 4)) & 31]
    output += BASE32[((chunk[2] << 1) | (chunk[3] >> 7)) & 31]
    output += BASE32[(chunk[3] >> 2) & 31]
    output += BASE32[((chunk[3] << 3) | (chunk[4] >> 5)) & 31]
    output += BASE32[chunk[4] & 31]
  }
  return output
}

function decodeBase32(secret) {
  const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
  const upper = String(secret || "").toUpperCase().replace(/=+$/g, "")
  let bits = 0
  let value = 0
  const bytes = []
  for (const char of upper) {
    const idx = BASE32.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >> bits) & 0xff)
    }
  }
  return Buffer.from(bytes)
}

function verifyTotp(secret, code) {
  if (!secret || !code) return false
  const normalizedCode = String(code).replace(/\s/g, "")
  if (!/^\d{6}$/.test(normalizedCode)) return false

  const key = decodeBase32(secret)
  const counter = Math.floor(Date.now() / 1000 / 30)
  for (const step of [counter - 1, counter, counter + 1]) {
    const msg = Buffer.alloc(8)
    msg.writeUInt32BE(Math.floor(step / 0x100000000), 0)
    msg.writeUInt32BE(step >>> 0, 4)
    const hmac = crypto.createHmac("sha1", key).update(msg).digest()
    const offset = hmac[19] & 0xf
    const otp = (
      ((hmac[offset] & 0x7f) << 24) |
      (hmac[offset + 1] << 16) |
      (hmac[offset + 2] << 8) |
      hmac[offset + 3]
    ) % 1_000_000
    if (String(otp).padStart(6, "0") === normalizedCode) return true
  }
  return false
}

function readUserProfile(userId) {
  const row = db.prepare(`
    SELECT
      id,
      email,
      name,
      created_at,
      avatar_url,
      email_verified,
      totp_enabled,
      plan_id,
      plan_status,
      notification_prefs
    FROM users
    WHERE id = ?
  `).get(userId)
  if (!row) return null
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    created_at: row.created_at,
    avatar_url: row.avatar_url || "",
    email_verified: Boolean(row.email_verified),
    totp_enabled: Boolean(row.totp_enabled),
    plan_id: row.plan_id || "basis",
    plan_status: row.plan_status || "active",
    notification_prefs: parseStoredNotificationPrefs(row.notification_prefs),
  }
}

function createEmailVerification(userId, newEmail) {
  const token = crypto.randomBytes(32).toString("hex")
  db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(userId)
  db.prepare(`
    INSERT INTO email_verifications (user_id, new_email, token, expires_at)
    VALUES (?, ?, ?, datetime('now', '+24 hours'))
  `).run(userId, newEmail, token)
  return token
}

function consumeEmailVerification(token) {
  const record = db.prepare(`
    SELECT *
    FROM email_verifications
    WHERE token = ? AND expires_at > datetime('now')
  `).get(token)
  if (!record) return { ok: false, error: "Token ungültig oder abgelaufen" }

  db.prepare("UPDATE users SET email = ?, email_verified = 1 WHERE id = ?").run(record.new_email, record.user_id)
  db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(record.user_id)
  logAudit({ userId: record.user_id, action: "auth.email_verified", targetType: "user", targetId: record.user_id })
  return { ok: true, userId: record.user_id }
}

const deleteOwnedProjects = db.transaction((userId) => {
  const projectIds = db.prepare("SELECT id FROM projects WHERE user_id = ?").all(userId).map((row) => row.id)
  for (const projectId of projectIds) {
    db.prepare("DELETE FROM project_assignees WHERE project_id = ?").run(projectId)
    db.prepare("DELETE FROM project_shares WHERE project_id = ?").run(projectId)
    db.prepare("DELETE FROM project_exports WHERE project_id = ?").run(projectId)
    db.prepare("DELETE FROM project_versions WHERE project_id = ?").run(projectId)
    db.prepare("DELETE FROM project_workflow_events WHERE project_id = ?").run(projectId)
    db.prepare("DELETE FROM publish_deployments WHERE project_id = ?").run(projectId)
    db.prepare("DELETE FROM project_preview_tokens WHERE project_id = ?").run(projectId)
    db.prepare("DELETE FROM block_comments WHERE project_id = ?").run(String(projectId))
    db.prepare("DELETE FROM projects WHERE id = ?").run(projectId)
  }
});

const deleteUserData = db.transaction((userId, email) => {
  deleteOwnedProjects(userId)
  db.prepare("DELETE FROM templates WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM deleted_projects WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM deleted_templates WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM team_members WHERE owner_id = ? OR member_email = ?").run(userId, email)
  const ownedOrgIds = db.prepare("SELECT id FROM organisations WHERE owner_id = ?").all(userId).map((row) => row.id)
  for (const orgId of ownedOrgIds) {
    db.prepare("DELETE FROM org_members WHERE org_id = ?").run(orgId)
  }
  db.prepare("DELETE FROM organisations WHERE owner_id = ?").run(userId)
  db.prepare("DELETE FROM org_members WHERE user_id = ? OR invite_email = ?").run(userId, email)
  db.prepare("DELETE FROM user_api_keys WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM product_events WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM ai_studio_runs WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM credit_transactions WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM credits WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM user_invoices WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM totp_pending_sessions WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM user_settings WHERE user_id = ?").run(userId)
  db.prepare("DELETE FROM users WHERE id = ?").run(userId)
});

export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE] || req.headers.authorization?.replace("Bearer ", "")
  if (!token) return res.status(401).json({ ok: false, error: "Nicht eingeloggt" })
  try {
    const decoded = jwt.verify(token, SECRET)
    const lastActive = Number(decoded?.act || 0) || Number(decoded?.iat || 0) * 1000
    if (!Number.isFinite(lastActive) || Date.now() - lastActive > AUTH_IDLE_TIMEOUT_MS) {
      clearAuthCookies(res)
      return res.status(401).json({ ok: false, error: "Session expired due to inactivity." })
    }

    // Sliding idle window for cookie-based sessions.
    if (req.cookies?.[COOKIE] && Date.now() - lastActive > AUTH_ACTIVITY_RENEW_SECONDS * 1000) {
      const refreshed = jwt.sign(
        { id: decoded.id, email: decoded.email, act: Date.now() },
        SECRET,
        { expiresIn: "15m" },
      )
      res.cookie(COOKIE, refreshed, { ...AUTH_COOKIE_OPTIONS, maxAge: 15 * 60 * 1000 })
      req.user = { ...decoded, act: Date.now() }
      return next()
    }

    req.user = decoded
    next()
  } catch {
    res.status(401).json({ ok: false, error: "Session abgelaufen" })
  }
}

export function registerAuthRoutes(app) {
  app.use("/api/auth", requireHttpsInProd)

  app.post("/api/auth/register", registerRateLimit, async (req, res) => {
    try {
      const email = readEmail(req.body?.email)
      const password = readPassword(req.body?.password)
      const name = readOptionalString(req.body?.name, "Name", { max: 120, empty: "" })

      const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email)
      if (existing) return res.status(400).json({ ok: false, error: "Email bereits registriert" })

      const hash = await bcrypt.hash(password, 10)
      const displayName = name || email.split("@")[0]
      const result = db.prepare(`
        INSERT INTO users (email, password_hash, name, email_verified, plan_id, plan_status)
        VALUES (?, ?, ?, 0, 'basis', 'active')
      `).run(email, hash, displayName)
      const userId = Number(result.lastInsertRowid)

      syncUserSettingsPlan(userId, "basis")

      const verifyToken = createEmailVerification(userId, email)
      sendWelcome(email, verifyToken, displayName).catch((error) => {
        console.error("sendWelcome error:", error?.message || error)
      })

      setAuthCookies(res, userId, email)
      logAudit({ userId, action: "auth.register", targetType: "user", targetId: userId, meta: { email } })
      res.json({ ok: true, user: readUserProfile(userId) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "Registration failed" })
    }
  })

  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      const email = readEmail(req.body?.email)
      const password = readPassword(req.body?.password)

      const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email)
      if (!user) return res.status(401).json({ ok: false, error: "Email oder Passwort falsch" })

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return res.status(401).json({ ok: false, error: "Email oder Passwort falsch" })

      if (user.totp_enabled) {
        const sessionToken = crypto.randomBytes(32).toString("hex")
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()
        db.prepare("DELETE FROM totp_pending_sessions WHERE user_id = ?").run(user.id)
        db.prepare(`
          INSERT INTO totp_pending_sessions (user_id, session_token, expires_at)
          VALUES (?, ?, ?)
        `).run(user.id, sessionToken, expiresAt)
        return res.json({ ok: true, requires_2fa: true, session_token: sessionToken })
      }

      setAuthCookies(res, user.id, email)
      logAudit({ userId: user.id, action: "auth.login", targetType: "user", targetId: user.id, meta: { email } })
      res.json({ ok: true, user: readUserProfile(user.id) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "Login failed" })
    }
  })

  app.post("/api/auth/login/2fa", login2faRateLimit, (req, res) => {
    try {
      const sessionToken = readRequiredString(req.body?.session_token, "session_token", { max: 128 })
      const code = readRequiredString(String(req.body?.code || ""), "code", { max: 10 })

      const pending = db.prepare(`
        SELECT *
        FROM totp_pending_sessions
        WHERE session_token = ? AND expires_at > datetime('now')
      `).get(sessionToken)
      if (!pending) return res.status(401).json({ ok: false, error: "Session abgelaufen — bitte erneut einloggen" })

      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(pending.user_id)
      if (!user) return res.status(401).json({ ok: false, error: "Benutzer nicht gefunden" })
      if (!verifyTotp(user.totp_secret, code)) {
        return res.status(401).json({ ok: false, error: "Code falsch" })
      }

      db.prepare("DELETE FROM totp_pending_sessions WHERE user_id = ?").run(user.id)
      setAuthCookies(res, user.id, user.email)
      logAudit({ userId: user.id, action: "auth.login.2fa", targetType: "user", targetId: user.id })
      res.json({ ok: true, user: readUserProfile(user.id) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "2FA login failed" })
    }
  })

  app.post("/api/auth/forgot-password", forgotPasswordRateLimit, async (req, res) => {
    try {
      const email = readEmail(req.body?.email)
      const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email)
      if (!user) return res.json({ ok: true })

      const token = crypto.randomBytes(32).toString("hex")
      const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString()
      db.prepare("DELETE FROM password_resets WHERE user_id = ? OR used = 1").run(user.id)
      db.prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)").run(user.id, token, expires)

      await sendPasswordReset(email, token, user.name || "").catch((error) => {
        console.error("Reset mail:", error?.message || error)
      })
      logAudit({ userId: user.id, action: "auth.password_reset_requested", targetType: "user", targetId: user.id, meta: { email } })
      res.json({ ok: true })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "Forgot password failed" })
    }
  })

  app.post("/api/auth/reset-password", resetPasswordRateLimit, async (req, res) => {
    try {
      const token = readRequiredString(req.body?.token, "Token", { max: 128 })
      const password = readPassword(req.body?.password)

      const reset = db.prepare("SELECT * FROM password_resets WHERE token = ? AND used = 0").get(token)
      if (!reset || new Date(reset.expires_at) < new Date()) {
        return res.status(400).json({ ok: false, error: "Token ungültig oder abgelaufen" })
      }

      const hashed = await bcrypt.hash(password, 10)
      db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashed, reset.user_id)
      db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(reset.id)
      db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(reset.user_id)
      db.prepare("DELETE FROM totp_pending_sessions WHERE user_id = ?").run(reset.user_id)

      logAudit({ userId: reset.user_id, action: "auth.password_reset_completed", targetType: "user", targetId: reset.user_id })
      res.json({ ok: true })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "Reset failed" })
    }
  })

  app.post("/api/auth/refresh", (req, res) => {
    try {
      const refreshToken = req.cookies?.[REFRESH_COOKIE]
      if (!refreshToken) return res.status(401).json({ ok: false, error: "Kein Refresh-Token" })

      const record = db.prepare(`
        SELECT *
        FROM refresh_tokens
        WHERE token = ? AND expires_at > datetime('now')
      `).get(refreshToken)
      if (!record) return res.status(401).json({ ok: false, error: "Refresh-Token ungültig oder abgelaufen" })

      const user = db.prepare("SELECT id, email FROM users WHERE id = ?").get(record.user_id)
      if (!user) return res.status(401).json({ ok: false, error: "Benutzer nicht gefunden" })

      db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(refreshToken)
      setAuthCookies(res, user.id, user.email)
      res.json({ ok: true })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Refresh failed" })
    }
  })

  app.post("/api/auth/verify-email", (req, res) => {
    try {
      const token = readRequiredString(req.body?.token, "token", { max: 128 })
      const result = consumeEmailVerification(token)
      if (!result.ok) return res.status(400).json({ ok: false, error: result.error })
      res.json({ ok: true })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "Verification failed" })
    }
  })

  app.get("/verify", (req, res) => {
    try {
      const token = readRequiredString(String(req.query.token || ""), "token", { max: 128 })
      const result = consumeEmailVerification(token)
      if (!result.ok) {
        return res.status(400).send(`
          <div style="font-family:system-ui;max-width:520px;margin:80px auto;padding:32px">
            <h1 style="color:#dc2626">Email verification failed</h1>
            <p>${result.error}</p>
            <a href="/" style="color:#6366f1">Return to Site Editor</a>
          </div>
        `)
      }
      res.send(`
        <div style="font-family:system-ui;max-width:520px;margin:80px auto;padding:32px">
          <h1 style="color:#22c55e">Email verified</h1>
          <p>Your email address is now confirmed.</p>
          <a href="/" style="display:inline-block;margin-top:16px;padding:12px 20px;background:#6366f1;color:white;border-radius:8px;text-decoration:none;font-weight:600">Open Site Editor</a>
        </div>
      `)
    } catch (error) {
      res.status(400).send(`
        <div style="font-family:system-ui;max-width:520px;margin:80px auto;padding:32px">
          <h1 style="color:#dc2626">Email verification failed</h1>
          <p>${error?.message || "Invalid verification link"}</p>
          <a href="/" style="color:#6366f1">Return to Site Editor</a>
        </div>
      `)
    }
  })

  app.get("/api/auth/email-verified", authMiddleware, (req, res) => {
    const user = db.prepare("SELECT email_verified FROM users WHERE id = ?").get(req.user.id)
    res.json({ ok: true, email_verified: Boolean(user?.email_verified) })
  })

  app.get("/api/auth/providers", (_req, res) => {
    res.json({
      ok: true,
      providers: {
        google: {
          enabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        },
      },
    })
  })

  app.get("/api/auth/google", (req, res) => {
    const clientId = process.env.GOOGLE_CLIENT_ID
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET
    if (!clientId || !clientSecret) {
      const message = encodeURIComponent("Google sign-in is not available right now.")
      return res.redirect(`/?error=${message}`)
    }

    const state = createOAuthStateToken()
    setOAuthStateCookie(res, state)

    const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
      state,
    })
    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`)
  })

  app.get("/api/auth/google/callback", async (req, res) => {
    try {
      const code = readRequiredString(String(req.query.code || ""), "code", { max: 1024 })
      const state = readRequiredString(String(req.query.state || ""), "state", { max: 256 })
      const storedState = String(req.cookies?.[OAUTH_STATE_COOKIE] || "")
      clearOAuthStateCookie(res)
      if (!tokensMatch(state, storedState)) {
        throw new Error("Invalid OAuth state")
      }

      const clientId = readRequiredString(process.env.GOOGLE_CLIENT_ID || "", "GOOGLE_CLIENT_ID", { max: 512 })
      const clientSecret = readRequiredString(process.env.GOOGLE_CLIENT_SECRET || "", "GOOGLE_CLIENT_SECRET", { max: 512 })
      const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/google/callback`

      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      })
      if (!tokenRes.ok) {
        const body = await tokenRes.text().catch(() => "")
        throw new Error(`Google token exchange failed (${tokenRes.status}): ${body}`)
      }

      const tokenData = await tokenRes.json()
      const accessToken = tokenData?.access_token
      if (!accessToken) throw new Error("Google did not return an access token")

      const profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
      if (!profileRes.ok) throw new Error(`Google userinfo failed (${profileRes.status})`)
      const profile = await profileRes.json()

      const email = readEmail(profile?.email, "Google email")
      const name = readOptionalString(profile?.name, "Google name", { max: 120, empty: email.split("@")[0] })
      const avatarUrl = readOptionalString(profile?.picture, "Google avatar", { max: 512, empty: "" })

      let userId = null
      const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email)
      if (existing) {
        userId = existing.id
        db.prepare(`
          UPDATE users
          SET
            avatar_url = CASE
              WHEN COALESCE(NULLIF(avatar_url, ''), '') = '' THEN ?
              ELSE avatar_url
            END,
            email_verified = 1
          WHERE id = ?
        `).run(avatarUrl || null, userId)
      } else {
        const hash = await bcrypt.hash(crypto.randomBytes(24).toString("hex"), 10)
        const result = db.prepare(`
          INSERT INTO users (email, password_hash, name, avatar_url, email_verified, plan_id, plan_status)
          VALUES (?, ?, ?, ?, 1, 'basis', 'active')
        `).run(email, hash, name, avatarUrl || null)
        userId = Number(result.lastInsertRowid)
        syncUserSettingsPlan(userId, "basis")
        logAudit({ userId, action: "auth.register.google", targetType: "user", targetId: userId, meta: { email } })
      }

      syncUserSettingsPlan(userId, "basis")
      setAuthCookies(res, userId, email)
      logAudit({ userId, action: "auth.login.google", targetType: "user", targetId: userId, meta: { email } })
      res.redirect("/")
    } catch (error) {
      console.error("Google OAuth callback error:", error)
      res.redirect(`/?error=${encodeURIComponent("Google sign-in failed. Please try again.")}`)
    }
  })

  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies?.[COOKIE] || req.headers.authorization?.replace("Bearer ", "")
    const refreshToken = req.cookies?.[REFRESH_COOKIE]
    try {
      if (token) {
        const user = jwt.verify(token, SECRET)
        logAudit({ userId: user?.id || null, action: "auth.logout", targetType: "user", targetId: user?.id || null })
      }
    } catch {}
    if (refreshToken) {
      try {
        db.prepare("DELETE FROM refresh_tokens WHERE token = ?").run(refreshToken)
      } catch {}
    }
    clearAuthCookies(res)
    res.json({ ok: true })
  })

  app.get("/api/auth/me", authMiddleware, (req, res) => {
    const user = readUserProfile(req.user.id)
    if (!user) return res.status(404).json({ ok: false, error: "Benutzer nicht gefunden" })
    res.json({ ok: true, user })
  })

  app.put("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id)
      if (!user) return res.status(404).json({ ok: false, error: "Benutzer nicht gefunden" })

      if (req.body?.name !== undefined) {
        const name = readOptionalString(req.body?.name, "Name", { max: 120, empty: "" })
        db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name || user.email.split("@")[0], user.id)
      }

      if (req.body?.avatar_url !== undefined) {
        const avatarUrl = readOptionalString(req.body?.avatar_url, "avatar_url", { max: 512, empty: "" })
        db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(avatarUrl || null, user.id)
      }

      if (req.body?.notification_prefs !== undefined) {
        const prefs = normalizeNotificationPrefs(req.body.notification_prefs)
        db.prepare("UPDATE users SET notification_prefs = ? WHERE id = ?").run(JSON.stringify(prefs), user.id)
      }

      if (req.body?.new_password !== undefined && req.body?.new_password !== "") {
        const currentPassword = readRequiredString(req.body?.current_password, "Aktuelles Passwort", { max: 128 })
        const valid = await bcrypt.compare(currentPassword, user.password_hash)
        if (!valid) return res.status(403).json({ ok: false, error: "Aktuelles Passwort falsch" })
        const newPassword = readPassword(req.body?.new_password, "Neues Passwort")
        const hash = await bcrypt.hash(newPassword, 10)
        db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id)
        db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(user.id)
        logAudit({ userId: user.id, action: "auth.password_changed", targetType: "user", targetId: user.id })
      }

      if (req.body?.email !== undefined) {
        const newEmail = readEmail(req.body?.email)
        if (newEmail !== String(user.email || "").toLowerCase()) {
          const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ? AND id != ?").get(newEmail, user.id)
          if (existing) return res.status(400).json({ ok: false, error: "Email bereits registriert" })
          const verifyToken = createEmailVerification(user.id, newEmail)
          sendWelcome(newEmail, verifyToken, user.name || "").catch((error) => {
            console.error("Email change verification mail:", error?.message || error)
          })
        }
      }

      logAudit({ userId: user.id, action: "auth.profile_updated", targetType: "user", targetId: user.id })
      res.json({ ok: true, user: readUserProfile(user.id) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "Update failed" })
    }
  })

  const upload = multer({
  limits: { fileSize: 4 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/gif"];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error("Only PNG, JPG, WEBP, and GIF are allowed"));
    }
    cb(null, true);
  }
});

app.post("/api/auth/avatar", authMiddleware, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, error: "No image provided or file too large." });
    }

    const mime = req.file.mimetype;
    const extension = mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : mime === "image/gif" ? "gif" : "jpg";
    
    await fs.mkdir(THUMBNAILS_DIR, { recursive: true });
    const fileName = `avatar-${req.user.id}-${Date.now()}.${extension}`;
    const diskPath = path.join(THUMBNAILS_DIR, fileName);
    
    await fs.writeFile(diskPath, req.file.buffer);
    
    const avatarUrl = `/thumbnails/${fileName}`;
    db.prepare("UPDATE users SET avatar_url = ? WHERE id = ?").run(avatarUrl, req.user.id);
    
    logAudit({
      userId: req.user.id,
      action: "auth.avatar_uploaded",
      targetType: "user",
      targetId: req.user.id,
      meta: { mime, bytes: req.file.size },
    });
    
    res.json({ ok: true, avatar_url: avatarUrl, user: readUserProfile(req.user.id) });
  } catch (error) {
    res.status(500).json({ ok: false, error: error?.message || "Avatar upload failed" });
  }
})

  app.delete("/api/auth/me", authMiddleware, async (req, res) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id)
      if (!user) return res.status(404).json({ ok: false, error: "Benutzer nicht gefunden" })

      const password = readRequiredString(req.body?.password, "Passwort", { max: 128 })
      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return res.status(403).json({ ok: false, error: "Passwort falsch" })

      logAudit({ userId: user.id, action: "auth.account_deleted", targetType: "user", targetId: user.id, meta: { email: user.email } })
      deleteUserData(user.id, user.email)
      clearAuthCookies(res)
      res.json({ ok: true })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "Deletion failed" })
    }
  })

  app.get("/api/auth/export", authMiddleware, (req, res) => {
    try {
      const user = db.prepare(`
        SELECT id, email, name, created_at, avatar_url, email_verified, plan_id, plan_status
        FROM users
        WHERE id = ?
      `).get(req.user.id)
      const projects = db.prepare("SELECT id, name, url, created_at, updated_at FROM projects WHERE user_id = ?").all(req.user.id)
      const credits = db.prepare("SELECT * FROM credit_transactions WHERE user_id = ?").all(req.user.id)
      const invoices = db.prepare(`
        SELECT stripe_invoice_id, amount_eur, status, receipt_url, refunded, created_at
        FROM user_invoices
        WHERE user_id = ?
      `).all(req.user.id)
      const auditEvents = db.prepare(`
        SELECT action, target_type, target_id, meta_json, created_at
        FROM audit_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 500
      `).all(req.user.id)

      logAudit({ userId: req.user.id, action: "auth.gdpr_export", targetType: "user", targetId: req.user.id })
      res.attachment("gdpr-export.json").json({
        exportedAt: new Date().toISOString(),
        user,
        projects,
        credits,
        invoices,
        auditEvents,
      })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Export failed" })
    }
  })

  app.post("/api/auth/2fa/setup", authMiddleware, (req, res) => {
    try {
      const user = db.prepare("SELECT email FROM users WHERE id = ?").get(req.user.id)
      if (!user) return res.status(404).json({ ok: false, error: "Benutzer nicht gefunden" })

      const secret = generateBase32Secret()
      db.prepare("UPDATE users SET totp_secret = ?, totp_enabled = 0 WHERE id = ?").run(secret, req.user.id)

      const issuer = encodeURIComponent("Site Editor")
      const account = encodeURIComponent(user.email)
      const otpauthUri = `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`
      res.json({ ok: true, secret, otpauth_uri: otpauthUri })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "2FA setup failed" })
    }
  })

  app.post("/api/auth/2fa/verify-setup", authMiddleware, (req, res) => {
    try {
      const code = readRequiredString(String(req.body?.code || ""), "code", { max: 10 })
      const user = db.prepare("SELECT totp_secret FROM users WHERE id = ?").get(req.user.id)
      if (!user?.totp_secret) return res.status(400).json({ ok: false, error: "2FA setup not started" })
      if (!verifyTotp(user.totp_secret, code)) {
        return res.status(400).json({ ok: false, error: "Code incorrect — try again" })
      }

      db.prepare("UPDATE users SET totp_enabled = 1 WHERE id = ?").run(req.user.id)
      logAudit({ userId: req.user.id, action: "auth.2fa_enabled", targetType: "user", targetId: req.user.id })
      res.json({ ok: true, totp_enabled: true })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error?.message || "2FA verification failed" })
    }
  })

  app.delete("/api/auth/2fa", authMiddleware, async (req, res) => {
    try {
      const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.id)
      if (!user) return res.status(404).json({ ok: false, error: "Benutzer nicht gefunden" })
      const valid = await bcrypt.compare(req.body?.password || "", user.password_hash)
      if (!valid) return res.status(403).json({ ok: false, error: "Passwort falsch" })
      db.prepare("UPDATE users SET totp_enabled = 0, totp_secret = NULL WHERE id = ?").run(req.user.id)
      db.prepare("DELETE FROM totp_pending_sessions WHERE user_id = ?").run(req.user.id)
      logAudit({ userId: req.user.id, action: "auth.2fa_disabled", targetType: "user", targetId: req.user.id })
      res.json({ ok: true })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Disable 2FA failed" })
    }
  })
}
