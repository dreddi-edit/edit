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
          { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
          { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
          { value: "claude-opus-4-1-20250805", label: "Claude Opus 4.1" },
          { value: "claude-opus-4-20250514", label: "Claude Opus 4" },
          { value: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet" },
          { value: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
          { value: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
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
        .slice(0, 20)
      return { ok: true, provider: "gemini", providerLabel: "Google Gemini", models }
    }

    if (provider === "groq") {
      const r = await fetch("https://api.groq.com/openai/v1/models", {
        headers: { "Authorization": `Bearer ${key}` }
      })
      if (!r.ok) return { ok: false, error: "Key ungültig" }
      const data = await r.json()
      const models = (data.data || []).map(m => ({ value: `groq:${m.id}`, label: m.id })).slice(0, 20)
      return { ok: true, provider: "groq", providerLabel: "Groq", models }
    }

    if (provider === "openai") {
      const r = await fetch("https://api.openai.com/v1/models", {
        headers: { "Authorization": `Bearer ${key}` },
      })
      if (!r.ok) return { ok: false, error: "Key ungültig" }
      const data = await r.json()
      const models = (data.data || [])
        .map(m => ({ value: m.id, label: m.id }))
        .filter(m => /^(gpt-|o[134]|text-|chatgpt)/i.test(String(m.value || "")))
        .slice(0, 25)
      return { ok: true, provider: "openai", providerLabel: "OpenAI", models }
    }

    if (provider === "openrouter") {
      const r = await fetch("https://openrouter.ai/api/v1/models", {
        headers: {
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
        },
      })
      if (!r.ok) return { ok: false, error: "Key ungültig" }
      const data = await r.json()
      const models = (data.data || [])
        .map(m => ({ value: `openrouter:${m.id}`, label: m.name || m.id }))
        .slice(0, 30)
      return { ok: true, provider: "openrouter", providerLabel: "OpenRouter", models }
    }

    return { ok: false, error: "Provider nicht erkannt" }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

export function registerOrgRoutes(app) {

  function getUserPendingInvites(user) {
    const normalizedEmail = String(user?.email || "").trim().toLowerCase()
    if (!normalizedEmail) return []
    return db.prepare(`
      SELECT om.id, om.org_id, om.invite_email, om.role, om.status, om.invited_at, om.joined_at, o.name AS org_name
      FROM org_members om
      JOIN organisations o ON o.id = om.org_id
      WHERE lower(om.invite_email) = ? AND om.status = 'pending'
      ORDER BY om.invited_at DESC
    `).all(normalizedEmail)
  }

  function getAccessibleOrgForUser(orgId, user) {
    const owned = db.prepare("SELECT * FROM organisations WHERE id = ? AND owner_id = ?").get(orgId, user.id)
    if (owned) return { org: owned, viewerRole: "owner", isOwner: true }

    const membership = db.prepare(`
      SELECT o.*, om.role
      FROM organisations o
      JOIN org_members om ON om.org_id = o.id
      WHERE o.id = ? AND om.user_id = ? AND om.status = 'accepted'
    `).get(orgId, user.id)
    if (!membership) return null
    return { org: membership, viewerRole: membership.role || "member", isOwner: false }
  }

  // === API KEYS ===

  // Smart Key Detection + Test
  app.post("/api/keys/detect", authMiddleware, async (req, res) => {
    const { key } = req.body
    if (!key) return res.status(400).json({ ok: false, error: "Key erforderlich" })

    const provider = detectProvider(key.trim())
    if (!provider) return res.json({ ok: false, error: "Key-Format nicht erkannt. Unterstützt: Anthropic (sk-ant-), Gemini (AIza...), Groq (gsk_), OpenRouter (sk-or-), OpenAI (sk-)" })

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
    const pending = getUserPendingInvites(req.user)
    res.json({ ok: true, owned, member, pending })
  })

  app.get("/api/orgs/invitations", authMiddleware, (req, res) => {
    res.json({ ok: true, invitations: getUserPendingInvites(req.user) })
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

  app.get("/api/orgs/:id/dashboard", authMiddleware, (req, res) => {
    const access = getAccessibleOrgForUser(req.params.id, req.user)
    if (!access) return res.status(403).json({ ok: false, error: "Kein Zugriff" })

    const owner = db.prepare(`
      SELECT u.id, u.name, u.email,
             COALESCE(NULLIF(u.plan_id, ''), 'basis') AS plan_id,
             COALESCE(NULLIF(u.plan_status, ''), 'active') AS plan_status,
             COALESCE(c.balance_eur, 0) AS credits_eur
      FROM organisations o
      JOIN users u ON u.id = o.owner_id
      LEFT JOIN credits c ON c.user_id = u.id
      WHERE o.id = ?
    `).get(req.params.id)

    const members = db.prepare(`
      SELECT om.id, om.org_id, om.user_id, om.invite_email, om.role, om.status, om.invited_at, om.joined_at,
             u.name, COALESCE(u.email, om.invite_email) AS email
      FROM org_members om
      LEFT JOIN users u ON u.id = om.user_id
      WHERE om.org_id = ?
      ORDER BY CASE WHEN om.status = 'accepted' THEN 0 ELSE 1 END, om.invited_at DESC
    `).all(req.params.id)

    const projectAssignments = db.prepare(`
      SELECT pa.member_email,
             COUNT(DISTINCT pa.project_id) AS project_count,
             GROUP_CONCAT(DISTINCT p.name) AS project_names
      FROM project_assignees pa
      JOIN projects p ON p.id = pa.project_id
      WHERE lower(pa.member_email) IN (
        SELECT lower(om.invite_email) FROM org_members om WHERE om.org_id = ?
        UNION
        SELECT lower(u.email) FROM organisations o JOIN users u ON u.id = o.owner_id WHERE o.id = ?
      )
      GROUP BY lower(pa.member_email)
    `).all(req.params.id, req.params.id)

    const assignmentMap = new Map(projectAssignments.map((row) => [String(row.member_email || "").toLowerCase(), row]))
    const ownerEmail = String(owner?.email || "").toLowerCase()
    const ownerProjects = assignmentMap.get(ownerEmail)

    const normalizedMembers = members.map((member) => {
      const key = String(member.email || member.invite_email || "").toLowerCase()
      const assignment = assignmentMap.get(key)
      return {
        ...member,
        project_count: Number(assignment?.project_count || 0),
        project_names: String(assignment?.project_names || "")
          .split(",")
          .map((name) => String(name || "").trim())
          .filter(Boolean),
      }
    })

    const acceptedCount = normalizedMembers.filter((member) => member.status === "accepted").length + 1
    const pendingCount = normalizedMembers.filter((member) => member.status !== "accepted").length
    const totalAssignedProjects = normalizedMembers.reduce((sum, member) => sum + Number(member.project_count || 0), Number(ownerProjects?.project_count || 0))

    res.json({
      ok: true,
      dashboard: {
        org: {
          id: access.org.id,
          name: access.org.name,
          created_at: access.org.created_at,
        },
        viewer: {
          is_owner: access.isOwner,
          role: access.viewerRole,
        },
        owner: owner
          ? {
              id: owner.id,
              name: owner.name,
              email: owner.email,
              plan_id: owner.plan_id,
              plan_status: owner.plan_status,
              credits_eur: Number(owner.credits_eur || 0),
              project_count: Number(ownerProjects?.project_count || 0),
              project_names: String(ownerProjects?.project_names || "")
                .split(",")
                .map((name) => String(name || "").trim())
                .filter(Boolean),
            }
          : null,
        members: normalizedMembers,
        stats: {
          accepted_members: acceptedCount,
          pending_invites: pendingCount,
          assigned_projects: totalAssignedProjects,
        },
      },
    })
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
