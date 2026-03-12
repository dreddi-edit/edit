import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { canInviteWithRole, normalizeAgencyRole } from "./accessControl.js"

export function registerSettingsRoutes(app) {

  // Settings laden
  app.get("/api/settings", authMiddleware, (req, res) => {
    let s = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(req.user.id)
    if (!s) {
      db.prepare("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)").run(req.user.id)
      s = db.prepare("SELECT * FROM user_settings WHERE user_id = ?").get(req.user.id)
    }
    // API Keys nie im Klartext zurückgeben – nur ob gesetzt
    res.json({
      ok: true,
      settings: {
        theme: s.theme,
        theme_explicit: !!s.theme_explicit,
        disabled_models: JSON.parse(s.disabled_models || "[]"),
        has_anthropic_key: !!s.anthropic_key,
        has_gemini_key: !!s.gemini_key,
        has_groq_key: !!s.groq_key,
      }
    })
  })

  // Settings speichern
  app.put("/api/settings", authMiddleware, (req, res) => {
    const { theme, disabled_models, anthropic_key, gemini_key, groq_key } = req.body
    db.prepare("INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)").run(req.user.id)

    if (theme) db.prepare("UPDATE user_settings SET theme = ?, theme_explicit = 1 WHERE user_id = ?").run(theme, req.user.id)
    if (disabled_models) db.prepare("UPDATE user_settings SET disabled_models = ? WHERE user_id = ?").run(JSON.stringify(disabled_models), req.user.id)
    if (anthropic_key !== undefined) db.prepare("UPDATE user_settings SET anthropic_key = ? WHERE user_id = ?").run(anthropic_key, req.user.id)
    if (gemini_key !== undefined) db.prepare("UPDATE user_settings SET gemini_key = ? WHERE user_id = ?").run(gemini_key, req.user.id)
    if (groq_key !== undefined) db.prepare("UPDATE user_settings SET groq_key = ? WHERE user_id = ?").run(groq_key, req.user.id)

    res.json({ ok: true })
  })

  // API Key testen
  app.post("/api/settings/test-key", authMiddleware, async (req, res) => {
    const { provider, key } = req.body
    try {
      if (provider === "anthropic") {
        const r = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
          body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 10, messages: [{ role: "user", content: "hi" }] })
        })
        res.json({ ok: r.ok, status: r.status })
      } else if (provider === "gemini") {
        const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
        res.json({ ok: r.ok, status: r.status })
      } else if (provider === "groq") {
        const r = await fetch("https://api.groq.com/openai/v1/models", {
          headers: { "Authorization": `Bearer ${key}` }
        })
        res.json({ ok: r.ok, status: r.status })
      } else {
        res.json({ ok: false, error: "Unbekannter Provider" })
      }
    } catch (e) {
      res.json({ ok: false, error: e.message })
    }
  })

  // Team Members laden
  app.get("/api/team", authMiddleware, (req, res) => {
    const members = db.prepare(
      "SELECT tm.*, u.name, u.email FROM team_members tm LEFT JOIN users u ON u.email = tm.member_email WHERE tm.owner_id = ?"
    ).all(req.user.id)
    res.json({ ok: true, members })
  })

  // Team Member einladen
  app.post("/api/team/invite", authMiddleware, (req, res) => {
    const { email, role } = req.body
    if (!email) return res.status(400).json({ ok: false, error: "Email erforderlich" })
    if (!canInviteWithRole(role || "editor")) return res.status(400).json({ ok: false, error: "Rolle ungültig" })
    const existing = db.prepare("SELECT id FROM team_members WHERE owner_id = ? AND member_email = ?").get(req.user.id, email)
    if (existing) return res.status(400).json({ ok: false, error: "Bereits eingeladen" })
    db.prepare("INSERT INTO team_members (owner_id, member_email, role) VALUES (?, ?, ?)").run(req.user.id, email, normalizeAgencyRole(role, "editor"))
    res.json({ ok: true })
  })

  // Team Member entfernen
  app.delete("/api/team/:id", authMiddleware, (req, res) => {
    db.prepare("DELETE FROM team_members WHERE id = ? AND owner_id = ?").run(req.params.id, req.user.id)
    res.json({ ok: true })
  })
}
