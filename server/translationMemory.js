import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { isValidationError, readOptionalString, readRequiredString } from "./validation.js"
import crypto from "crypto"

function hashText(text) {
  return crypto.createHash("sha256").update(String(text || "")).digest("hex").slice(0, 16)
}

export function registerTranslationMemoryRoutes(app) {
  // GET /api/translation-memory — list entries for current user
  app.get("/api/translation-memory", authMiddleware, (req, res) => {
    try {
      const { source_lang, target_lang, project_id, limit = 100 } = req.query
      let query = `SELECT id, source_lang, target_lang, source_text, translation, context_hash, project_id, created_at
                   FROM translation_memory WHERE user_id = ?`
      const params = [req.user.id]
      if (source_lang) { query += ` AND source_lang = ?`; params.push(String(source_lang).slice(0, 10)) }
      if (target_lang) { query += ` AND target_lang = ?`; params.push(String(target_lang).slice(0, 10)) }
      if (project_id) { query += ` AND project_id = ?`; params.push(Number(project_id)) }
      query += ` ORDER BY created_at DESC LIMIT ?`
      params.push(Math.min(500, Math.max(1, Number(limit) || 100)))

      const rows = db.prepare(query).all(...params)
      res.json({ ok: true, entries: rows })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/translation-memory — store one or many entries
  app.post("/api/translation-memory", authMiddleware, (req, res) => {
    try {
      const body = req.body
      const entries = Array.isArray(body?.entries) ? body.entries : [body]
      const projectId = body?.project_id != null ? Number(body.project_id) : null
      const inserted = []

      const stmt = db.prepare(`
        INSERT INTO translation_memory (user_id, project_id, source_lang, target_lang, source_text, translation, context_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT DO NOTHING
      `)

      const upsertStmt = db.prepare(`
        INSERT INTO translation_memory (user_id, project_id, source_lang, target_lang, source_text, translation, context_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET translation = excluded.translation
      `)

      const tx = db.transaction(() => {
        for (const entry of entries.slice(0, 500)) {
          const sourceLang = String(entry?.source_lang || "en").slice(0, 10)
          const targetLang = readRequiredString(entry?.target_lang, "target_lang", { max: 10 })
          const sourceText = readRequiredString(entry?.source_text, "source_text", { max: 10000 })
          const translation = readRequiredString(entry?.translation, "translation", { max: 10000 })
          const entryProjectId = entry?.project_id != null ? Number(entry.project_id) : projectId
          const contextHash = hashText(`${sourceLang}|${targetLang}|${sourceText}`)

          // Check for existing entry by hash
          const existing = db.prepare(
            `SELECT id FROM translation_memory WHERE user_id = ? AND context_hash = ?`
          ).get(req.user.id, contextHash)

          if (existing) {
            db.prepare(
              `UPDATE translation_memory SET translation = ?, project_id = COALESCE(?, project_id) WHERE id = ?`
            ).run(translation, entryProjectId, existing.id)
            inserted.push({ id: existing.id, updated: true })
          } else {
            const info = stmt.run(req.user.id, entryProjectId, sourceLang, targetLang, sourceText, translation, contextHash)
            inserted.push({ id: info.lastInsertRowid, updated: false })
          }
        }
      })
      tx()

      res.json({ ok: true, count: inserted.length, entries: inserted })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/translation-memory/lookup — look up translations for a batch of source texts
  app.post("/api/translation-memory/lookup", authMiddleware, (req, res) => {
    try {
      const sourceLang = String(req.body?.source_lang || "en").slice(0, 10)
      const targetLang = readRequiredString(req.body?.target_lang, "target_lang", { max: 10 })
      const rawTexts = Array.isArray(req.body?.texts) ? req.body.texts : []
      const texts = rawTexts.slice(0, 200).map((t) => String(t || "").trim()).filter(Boolean)

      const matches = {}
      for (const text of texts) {
        const hash = hashText(`${sourceLang}|${targetLang}|${text}`)
        const row = db.prepare(
          `SELECT translation FROM translation_memory WHERE user_id = ? AND context_hash = ? ORDER BY created_at DESC LIMIT 1`
        ).get(req.user.id, hash)
        if (row) matches[text] = row.translation
      }
      res.json({ ok: true, matches, total: Object.keys(matches).length, queried: texts.length })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // DELETE /api/translation-memory/:id — remove single entry
  app.delete("/api/translation-memory/:id", authMiddleware, (req, res) => {
    try {
      const id = Number(req.params.id)
      if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ ok: false, error: "Invalid id" })
      const info = db.prepare("DELETE FROM translation_memory WHERE id = ? AND user_id = ?").run(id, req.user.id)
      if (!info.changes) return res.status(404).json({ ok: false, error: "Entry not found" })
      res.json({ ok: true })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // DELETE /api/translation-memory — clear all entries for user (or by language pair)
  app.delete("/api/translation-memory", authMiddleware, (req, res) => {
    try {
      const { target_lang, project_id } = req.query
      let query = "DELETE FROM translation_memory WHERE user_id = ?"
      const params = [req.user.id]
      if (target_lang) { query += " AND target_lang = ?"; params.push(String(target_lang).slice(0, 10)) }
      if (project_id) { query += " AND project_id = ?"; params.push(Number(project_id)) }
      const info = db.prepare(query).run(...params)
      res.json({ ok: true, deleted: info.changes })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })
}
