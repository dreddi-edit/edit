import { sendWelcome, sendPasswordReset } from "./email.js"
import crypto from "crypto"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"
import db from "./db.js"

const SECRET = process.env.JWT_SECRET || "site-editor-secret-change-in-prod"
const COOKIE = "se_token"

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

  // Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const { email, password, name } = req.body
      if (!email || !password) return res.status(400).json({ ok: false, error: "Email und Passwort erforderlich" })
      if (password.length < 6) return res.status(400).json({ ok: false, error: "Passwort min. 6 Zeichen" })

      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email)
      if (existing) return res.status(400).json({ ok: false, error: "Email bereits registriert" })

      const hash = await bcrypt.hash(password, 10)
      const result = db.prepare("INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)").run(email, hash, name || email.split("@")[0])

      const token = jwt.sign({ id: result.lastInsertRowid, email }, SECRET, { expiresIn: "30d" })
      res.cookie(COOKIE, token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" })
      res.json({ ok: true, user: { id: result.lastInsertRowid, email, name: name || email.split("@")[0] } })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body
      if (!email || !password) return res.status(400).json({ ok: false, error: "Email und Passwort erforderlich" })

      const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email)
      if (!user) return res.status(401).json({ ok: false, error: "Email oder Passwort falsch" })

      const valid = await bcrypt.compare(password, user.password_hash)
      if (!valid) return res.status(401).json({ ok: false, error: "Email oder Passwort falsch" })

      const token = jwt.sign({ id: user.id, email }, SECRET, { expiresIn: "30d" })
      res.cookie(COOKIE, token, { httpOnly: true, maxAge: 30 * 24 * 60 * 60 * 1000, sameSite: "lax" })
      res.json({ ok: true, user: { id: user.id, email, name: user.name } })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })


  // Passwort-Reset anfordern
  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body
    if (!email) return res.status(400).json({ ok: false, error: "Email erforderlich" })
    const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email)
    if (!user) return res.json({ ok: true }) // Kein Hinweis ob User existiert

    const token = crypto.randomBytes(32).toString("hex")
    const expires = new Date(Date.now() + 3600000).toISOString() // 1h

    db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    )`)
    db.prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)").run(user.id, token, expires)

    await sendPasswordReset(email, token).catch(e => console.error("Reset mail:", e.message))
    res.json({ ok: true })
  })

  // Passwort-Reset durchführen
  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, password } = req.body
    if (!token || !password) return res.status(400).json({ ok: false, error: "Token + Passwort erforderlich" })

    db.exec(`CREATE TABLE IF NOT EXISTS password_resets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    )`)

    const reset = db.prepare("SELECT * FROM password_resets WHERE token = ? AND used = 0").get(token)
    if (!reset || new Date(reset.expires_at) < new Date()) {
      return res.status(400).json({ ok: false, error: "Token ungültig oder abgelaufen" })
    }

    const hashed = await bcrypt.hash(password, 10)
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashed, reset.user_id)
    db.prepare("UPDATE password_resets SET used = 1 WHERE id = ?").run(reset.id)

    res.json({ ok: true })
  })

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    res.clearCookie(COOKIE)
    res.json({ ok: true })
  })

  // Me
  app.get("/api/auth/me", authMiddleware, (req, res) => {
    const user = db.prepare("SELECT id, email, name, created_at FROM users WHERE id = ?").get(req.user.id)
    res.json({ ok: true, user })
  })
}
