import { sendWelcome, sendPasswordReset } from "./email.js"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import db from "./db.js"
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

if (process.env.NODE_ENV === "production") {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === DEFAULT_SECRET) {
    throw new Error("FATAL: In production, JWT_SECRET must be set in .env and must not be the default")
  }
}
const COOKIE = "se_token"
const authIdentifier = (req) => `${req.ip || req.socket?.remoteAddress || "unknown"}:${String(req.body?.email || "").toLowerCase()}`
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

export function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE] || req.headers["authorization"]?.replace("Bearer ", "")
  if (!token) return res.status(401).json({ ok: false, error: "Nicht eingeloggt" })
  try {
    req.user = jwt.verify(token, SECRET)
    next()
  } catch {
    res.status(401).json({ ok: false, error: "Session abgelaufen" })
  }
}

export function registerAuthRoutes(app) {

  // Register (rate limited)
  app.post("/api/auth/register", registerRateLimit, async (req, res) => {
    try {
      const email = readEmail(req.body?.email)
      const password = readPassword(req.body?.password)
      const name = readOptionalString(req.body?.name, "Name", { max: 120, empty: "" })

      const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email)
      if (existing) return res.status(400).json({ ok: false, error: "Email bereits registriert" })

      const hash = await bcrypt.hash(password, 10)
      const result = db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(email, hash, name || email.split("@")[0])

      const token = jwt.sign({ id: result.lastInsertRowid, email }, SECRET, { expiresIn: "30d" })
      res.cookie(COOKIE, token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" })
      logAudit({ userId: result.lastInsertRowid, action: "auth.register", targetType: "user", targetId: result.lastInsertRowid, meta: { email } })
      res.json({ ok: true, user: { id: result.lastInsertRowid, email, name: name || email.split("@")[0] } })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // Login (rate limited)
  app.post("/api/auth/login", loginRateLimit, async (req, res) => {
    try {
      const email = readEmail(req.body?.email)
      const password = readPassword(req.body?.password)

      const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email)
      if (!user) return res.status(401).json({ ok: false, error: "Email oder Passwort falsch" })

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return res.status(401).json({ ok: false, error: "Email oder Passwort falsch" })

      const token = jwt.sign({ id: user.id, email }, SECRET, { expiresIn: "30d" })
      res.cookie(COOKIE, token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" })
      logAudit({ userId: user.id, action: "auth.login", targetType: "user", targetId: user.id, meta: { email } })
      res.json({ ok: true, user: { id: user.id, email, name: user.name } })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })


  // Passwort-Reset anfordern
  app.post("/api/auth/forgot-password", forgotPasswordRateLimit, async (req, res) => {
    try {
      const email = readEmail(req.body?.email)
      const user = db.prepare("SELECT * FROM users WHERE lower(email) = ?").get(email)
      if (!user) return res.json({ ok: true })

      const token = crypto.randomBytes(32).toString("hex")
      const expires = new Date(Date.now() + 3600000).toISOString()

      db.prepare("DELETE FROM password_resets WHERE user_id = ? OR used = 1").run(user.id)
      db.prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)").run(user.id, token, expires)

      await sendPasswordReset(email, token, user.name || "").catch(e => console.error("Reset mail:", e.message))
      logAudit({ userId: user.id, action: "auth.password_reset_requested", targetType: "user", targetId: user.id, meta: { email } })
      res.json({ ok: true })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // Passwort-Reset durchführen
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

      logAudit({ userId: reset.user_id, action: "auth.password_reset_completed", targetType: "user", targetId: reset.user_id })
      res.json({ ok: true })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    const token = req.cookies?.[COOKIE] || req.headers["authorization"]?.replace("Bearer ", "")
    try {
      if (token) {
        const user = jwt.verify(token, SECRET)
        logAudit({ userId: user?.id || null, action: "auth.logout", targetType: "user", targetId: user?.id || null })
      }
    } catch {}
    res.clearCookie(COOKIE)
    res.json({ ok: true })
  })

  // Me
  app.get("/api/auth/me", authMiddleware, (req, res) => {
    const user = db.prepare("SELECT id, email, name, created_at FROM users WHERE id = ?").get(req.user.id)
    res.json({ ok: true, user })
  })
}
