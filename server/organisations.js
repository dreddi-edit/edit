import { sendTeamInvite } from "./email.js"
import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { canInviteWithRole, normalizeAgencyRole } from "./accessControl.js"

// Auto-detect provider from key format
function detectProvider(key) {
  if (key.startsWith("sk-ant-")) return "anthropic"
  if (key.startsWith("AIza")) return "gemini"
  if (key.startsWith("gsk_")) return "groq"
  if (key.startsWith("sk-or-")) return "openrouter"
  if (key.startsWith("sk-")) return "openai"
  return null
}

// Test key + discover available models
async function discoverKey(provider, key) {
  try {
    if (provider === "anthropic") {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 5, messages: [{ role: "user", content: "hi" }] })
      })
      if (!r.ok) return { ok: false, error: "Key ungültig" }
      return {
        ok: true,
        provider: "anthropic",
        providerLabel: "Anthropic",
        models: [
          { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
          { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
        ]
      }
    }

    if (provider === "gemini") {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`)
      if (!r.ok) return { ok: false, error: "Key ungültig" }
      const data = await r.json()
      const models = (data.models || [])
        .filter(m => m.name.includes("gemini"))
        .map(m => ({ value: m.name.replace("models/", ""), label: m.displayName || m.name }))
        .slice(0, 6)
      return { ok: true, provider: "gemini", providerLabel: "Google Gemini", models }
    }

    if (provider === "groq") {
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` }
      })
      if (!r.ok) return { ok: false, error: "Key ungültig" }
      const data = await r.json()
      const models = (data.data || []).map(m => ({ value: `groq:${m.id}`, label: m.id })).slice(0, 8)
      return { ok: true, provider: "groq", providerLabel: "Groq", models }
    }

    return { ok: false, error: "Provider nicht erkannt" }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export function registerOrgRoutes(app) {

  // === API KEYS ===

  // Smart Key Detection + Test
  app.post("/api/keys/detect", authMiddleware, async (req, res) => {
    const { key } = req.body
    if (!key) return res.status(400).json({ ok: false, error: "Key erforderlich" })

    const provider = detectProvider(key.trim())
    if (!provider) return res.json({ ok: false, error: "Key-Format nicht erkannt. Unterstützt: Anthropic (sk-ant-), Gemini (AIza...), Groq (gsk_)" })

    const result = await discoverKey(provider, key.trim())
    res.json(result)
  })

  // Key speichern
  app.post("/api/keys", authMiddleware, async (req, res) => {
    const { key, provider, detected_models, label, use_all } = req.body
    if (!key || !provider) return res.status(400).json({ ok: false, error: "Key und Provider erforderlich" })

    // Alten Key desselben Providers deaktivieren
    db.prepare("UPDATE user_api_keys SET active = 0 WHERE user_id = ? AND provider = ?").run(req.user.id, provider)

    const modelsJson = use_all
      ? JSON.stringify(detected_models || [])
      : JSON.stringify(detected_models || [])

    const result = db.prepare(
      "INSERT INTO user_api_keys (user_id, provider, key_value, detected_models, label) VALUES (?, ?, ?, ?, ?)"
    ).run(req.user.id, provider, key, modelsJson, label || provider)

    res.json({ ok: true, id: result.lastInsertRowid })
  })

  // Keys laden (ohne key_value)
  app.get("/api/keys", authMiddleware, (req, res) => {
    const keys = db.prepare(
      "SELECT id, provider, label, detected_models, active, created_at FROM user_api_keys WHERE user_id = ? ORDER BY created_at DESC"
    ).all(req.user.id)
    res.json({ ok: true, keys: keys.map(k => ({ ...k, detected_models: JSON.parse(k.detected_models || "[]") })) })
  })

  // Key löschen
  app.delete("/api/keys/:id", authMiddleware, (req, res) => {
    db.prepare("DELETE FROM user_api_keys WHERE id = ? AND user_id = ?").run(req.params.id, req.user.id)
    res.json({ ok: true })
  })

  // === ORGANISATIONEN ===

  // Meine Orgs
  app.get("/api/orgs", authMiddleware, (req, res) => {
    const owned = db.prepare("SELECT * FROM organisations WHERE owner_id = ?").all(req.user.id)
    const member = db.prepare(`
      SELECT o.*, om.role, om.status FROM organisations o
      JOIN org_members om ON om.org_id = o.id
      WHERE om.user_id = ? AND om.status = 'accepted'
    `).all(req.user.id)
    res.json({ ok: true, owned, member })
  })

  // Org erstellen
  app.post("/api/orgs", authMiddleware, (req, res) => {
    const { name } = req.body
    if (!name) return res.status(400).json({ ok: false, error: "Name erforderlich" })
    const existing = db.prepare("SELECT id FROM organisations WHERE owner_id = ?").get(req.user.id)
    if (existing) return res.status(400).json({ ok: false, error: "Du hast bereits eine Organisation" })
    const result = db.prepare("INSERT INTO organisations (name, owner_id) VALUES (?, ?)").run(name, req.user.id)
    res.json({ ok: true, id: result.lastInsertRowid })
  })

  // Mitglieder einer Org laden
  app.get("/api/orgs/:id/members", authMiddleware, (req, res) => {
    const org = db.prepare("SELECT * FROM organisations WHERE id = ? AND owner_id = ?").get(req.params.id, req.user.id)
    if (!org) return res.status(403).json({ ok: false, error: "Kein Zugriff" })
    const members = db.prepare(`
      SELECT om.*, u.name, u.email FROM org_members om
      LEFT JOIN users u ON u.id = om.user_id
      WHERE om.org_id = ?
      ORDER BY om.invited_at DESC
    `).all(req.params.id)
    res.json({ ok: true, org, members })
  })

  // Mitglied einladen
  app.post("/api/orgs/:id/invite", authMiddleware, (req, res) => {
    const { email, role } = req.body
    const normalizedEmail = String(email || "").trim().toLowerCase()
    if (!normalizedEmail) return res.status(400).json({ ok: false, error: "Email erforderlich" })
    if (!canInviteWithRole(role || "editor")) return res.status(400).json({ ok: false, error: "Rolle ungültig" })
    const org = db.prepare("SELECT * FROM organisations WHERE id = ? AND owner_id = ?").get(req.params.id, req.user.id)
    if (!org) return res.status(403).json({ ok: false, error: "Kein Zugriff" })

    const existing = db.prepare("SELECT id FROM org_members WHERE org_id = ? AND lower(invite_email) = ?").get(req.params.id, normalizedEmail)
    if (existing) return res.status(400).json({ ok: false, error: "Bereits eingeladen" })

    // Check ob User existiert
    const user = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(normalizedEmail)
    db.prepare("INSERT INTO org_members (org_id, user_id, invite_email, role) VALUES (?, ?, ?, ?)").run(
      req.params.id, user?.id || null, normalizedEmail, normalizeAgencyRole(role, "editor")
    )
    // Einladungs-Mail senden
    sendTeamInvite(normalizedEmail, org.name, req.user.name || req.user.email).catch(e => console.error("Invite mail:", e.message))
    res.json({ ok: true })
  })

  // Einladung annehmen (beim Login prüfen)
  app.post("/api/orgs/accept-invite", authMiddleware, (req, res) => {
    const pending = db.prepare(
      "SELECT om.* FROM org_members om JOIN users u ON lower(u.email) = lower(om.invite_email) WHERE u.id = ? AND om.status = 'pending'"
    ).all(req.user.id)

    for (const inv of pending) {
      db.prepare("UPDATE org_members SET user_id = ?, status = 'accepted', joined_at = datetime('now') WHERE id = ?").run(req.user.id, inv.id)
    }

    res.json({ ok: true, accepted: pending.length })
  })

  // Mitglied entfernen
  app.delete("/api/orgs/:orgId/members/:memberId", authMiddleware, (req, res) => {
    const org = db.prepare("SELECT id FROM organisations WHERE id = ? AND owner_id = ?").get(req.params.orgId, req.user.id)
    if (!org) return res.status(403).json({ ok: false, error: "Kein Zugriff" })
    db.prepare("DELETE FROM org_members WHERE id = ? AND org_id = ?").run(req.params.memberId, req.params.orgId)
    res.json({ ok: true })
  })

  // Org löschen
  app.delete("/api/orgs/:id", authMiddleware, (req, res) => {
    db.prepare("DELETE FROM org_members WHERE org_id = ?").run(req.params.id)
    db.prepare("DELETE FROM organisations WHERE id = ? AND owner_id = ?").run(req.params.id, req.user.id)
    res.json({ ok: true })
  })
}
