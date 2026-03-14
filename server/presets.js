import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { isValidationError, readOptionalString, readRequiredString } from "./validation.js"

const DEFAULT_PRESETS = [
  { name: "Professional", prompt: "Rewrite this for a corporate B2B audience. Use formal, precise language.", system_hint: "Be concise, professional and credible.", category: "tone" },
  { name: "Conversion-Focused", prompt: "Rewrite this to maximise conversions. Add urgency, clear benefits and a strong CTA.", system_hint: "Focus on benefits, social proof and clear calls to action.", category: "cro" },
  { name: "Simplify", prompt: "Simplify the text. Use short sentences and plain language for a broader audience.", system_hint: "Use simple vocabulary, short sentences, no jargon.", category: "readability" },
  { name: "SEO Boost", prompt: "Rewrite with SEO in mind. Integrate natural keywords, improve headings and meta signals.", system_hint: "Add relevant keywords naturally, improve heading hierarchy.", category: "seo" },
]

export function registerPresetsRoutes(app) {
  // GET /api/presets — list user presets (+ seeded defaults if empty)
  app.get("/api/presets", authMiddleware, (req, res) => {
    try {
      let rows = db.prepare(
        "SELECT id, name, prompt, system_hint, category, created_at, updated_at FROM ai_presets WHERE user_id = ? ORDER BY created_at ASC"
      ).all(req.user.id)

      // Seed defaults for new users
      if (!rows.length) {
        const insert = db.prepare(
          "INSERT INTO ai_presets (user_id, name, prompt, system_hint, category) VALUES (?, ?, ?, ?, ?)"
        )
        const seedTx = db.transaction(() => {
          DEFAULT_PRESETS.forEach((p) => insert.run(req.user.id, p.name, p.prompt, p.system_hint, p.category))
        })
        seedTx()
        rows = db.prepare(
          "SELECT id, name, prompt, system_hint, category, created_at, updated_at FROM ai_presets WHERE user_id = ? ORDER BY created_at ASC"
        ).all(req.user.id)
      }

      res.json({ ok: true, presets: rows })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/presets — create new preset
  app.post("/api/presets", authMiddleware, (req, res) => {
    try {
      const name = readRequiredString(req.body?.name, "name", { max: 100 })
      const prompt = readRequiredString(req.body?.prompt, "prompt", { max: 4000 })
      const systemHint = readOptionalString(req.body?.system_hint, "system_hint", { max: 1000, empty: "" })
      const category = readOptionalString(req.body?.category, "category", { max: 50, empty: "custom" })

      // Max 50 presets per user
      const count = db.prepare("SELECT COUNT(*) as c FROM ai_presets WHERE user_id = ?").get(req.user.id)
      if ((count?.c || 0) >= 50) return res.status(400).json({ ok: false, error: "Maximum 50 presets allowed" })

      const info = db.prepare(
        "INSERT INTO ai_presets (user_id, name, prompt, system_hint, category) VALUES (?, ?, ?, ?, ?)"
      ).run(req.user.id, name, prompt, systemHint, category || "custom")

      const preset = db.prepare("SELECT * FROM ai_presets WHERE id = ?").get(info.lastInsertRowid)
      res.json({ ok: true, preset })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // PUT /api/presets/:id — update preset
  app.put("/api/presets/:id", authMiddleware, (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" })

      const existing = db.prepare("SELECT id FROM ai_presets WHERE id = ? AND user_id = ?").get(id, req.user.id)
      if (!existing) return res.status(404).json({ ok: false, error: "Preset not found" })

      const name = readRequiredString(req.body?.name, "name", { max: 100 })
      const prompt = readRequiredString(req.body?.prompt, "prompt", { max: 4000 })
      const systemHint = readOptionalString(req.body?.system_hint, "system_hint", { max: 1000, empty: "" })
      const category = readOptionalString(req.body?.category, "category", { max: 50, empty: "custom" })

      db.prepare(
        "UPDATE ai_presets SET name = ?, prompt = ?, system_hint = ?, category = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
      ).run(name, prompt, systemHint, category || "custom", id, req.user.id)

      const preset = db.prepare("SELECT * FROM ai_presets WHERE id = ?").get(id)
      res.json({ ok: true, preset })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // DELETE /api/presets/:id — delete preset
  app.delete("/api/presets/:id", authMiddleware, (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" })
      const info = db.prepare("DELETE FROM ai_presets WHERE id = ? AND user_id = ?").run(id, req.user.id)
      if (!info.changes) return res.status(404).json({ ok: false, error: "Preset not found" })
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })
}
