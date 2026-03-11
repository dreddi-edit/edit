import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { logAudit } from "./auditLog.js"
import { getPlatformGuide, normalizeProjectDocument, normalizeSiteUrl } from "./siteMeta.js"
import { isValidationError, readId, readOptionalString, readRequiredString } from "./validation.js"

// DB-Tabelle anlegen
db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    html TEXT NOT NULL,
    platform TEXT DEFAULT 'unknown',
    thumbnail TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)
try { db.exec(`ALTER TABLE templates ADD COLUMN platform TEXT DEFAULT 'unknown'`) } catch {}

export function registerTemplateRoutes(app) {

  // GET /api/templates – alle Templates des Users
  app.get("/api/templates", authMiddleware, (req, res) => {
    const templates = db.prepare(
      "SELECT id, name, url, platform, thumbnail, created_at FROM templates WHERE user_id = ? ORDER BY created_at DESC"
    ).all(req.user.id)
    res.json({
      ok: true,
      templates: templates.map((template) => ({
        ...template,
        platformGuide: getPlatformGuide(template.platform),
      })),
    })
  })

  app.get("/api/templates/deleted", authMiddleware, (req, res) => {
    const archives = db.prepare(
      "SELECT id, original_template_id, name, deleted_at FROM deleted_templates WHERE user_id = ? ORDER BY deleted_at DESC LIMIT 50"
    ).all(req.user.id)
    res.json({ ok: true, archives })
  })

  // POST /api/templates/extract – HTML von URL laden + speichern
  app.post("/api/templates/extract", authMiddleware, async (req, res) => {
    try {
      const rawUrl = readRequiredString(req.body?.url, "URL", { max: 2048 })
      const requestedUrl = normalizeSiteUrl(rawUrl)
      const requestedName = readOptionalString(req.body?.name, "Name", { max: 160, empty: "" })
      if (!requestedUrl) return res.status(400).json({ ok: false, error: "URL erforderlich" })

      const response = await fetch(requestedUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SiteEditor/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
        },
        redirect: "follow",
        signal: AbortSignal.timeout(10000)
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const contentType = String(response.headers.get("content-type") || "")
      if (contentType && !/html|xml/i.test(contentType)) {
        throw new Error("Die URL liefert kein editierbares HTML")
      }
      const rawHtml = await response.text()
      if (!rawHtml || rawHtml.length < 100) throw new Error("Kein gültiges HTML gefunden")

      const prepared = normalizeProjectDocument({ html: rawHtml, url: response.url || requestedUrl, platform: "" })
      const meta = prepared.meta
      const templateName = requestedName || meta.title || new URL(meta.url || requestedUrl).hostname
      const result = db.prepare(
        "INSERT INTO templates (user_id, name, url, html, platform) VALUES (?, ?, ?, ?, ?)"
      ).run(req.user.id, templateName, meta.url || response.url || requestedUrl, prepared.html, meta.platform)

      res.json({
        ok: true,
        template: {
          id: result.lastInsertRowid,
          name: templateName,
          url: meta.url || response.url || requestedUrl,
          platform: meta.platform,
          platformGuide: getPlatformGuide(meta.platform),
        }
      })
      logAudit({ userId: req.user.id, action: "template.extract", targetType: "template", targetId: result.lastInsertRowid, meta: { platform: meta.platform, url: meta.url || requestedUrl } })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/templates/apply – neues Projekt aus Template erstellen
  app.post("/api/templates/apply", authMiddleware, (req, res) => {
    try {
      const templateId = readId(req.body?.template_id, "template_id")
      const name = readRequiredString(req.body?.name, "Name", { max: 160 })

      const template = db.prepare(
        "SELECT * FROM templates WHERE id = ? AND user_id = ?"
      ).get(templateId, req.user.id)
      if (!template) return res.status(404).json({ ok: false, error: "Template nicht gefunden" })

      const result = db.prepare(
        `INSERT INTO projects (
          user_id, name, url, html, platform, workflow_status, workflow_stage,
          delivery_status, last_activity_at
        ) VALUES (?, ?, ?, ?, ?, 'draft', 'draft', 'not_exported', datetime('now'))`
      ).run(req.user.id, name, template.url || "", template.html, template.platform || "unknown")
      db.prepare(
        "INSERT INTO project_workflow_events (project_id, user_id, from_stage, to_stage, comment) VALUES (?, ?, ?, ?, ?)"
      ).run(result.lastInsertRowid, req.user.id, null, "draft", "Project created from template")
      logAudit({ userId: req.user.id, action: "template.apply", targetType: "project", targetId: result.lastInsertRowid, meta: { templateId } })

      res.json({
        ok: true,
        project: {
          id: result.lastInsertRowid,
          name,
          url: template.url || "",
          platform: template.platform || "unknown",
          platformGuide: getPlatformGuide(template.platform || "unknown"),
        }
      })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // DELETE /api/templates/:id – Template löschen
  app.delete("/api/templates/:id", authMiddleware, (req, res) => {
    const template = db.prepare(
      "SELECT * FROM templates WHERE id = ? AND user_id = ?"
    ).get(req.params.id, req.user.id)
    if (!template) return res.status(404).json({ ok: false, error: "Template nicht gefunden" })
    const archiveId = db.prepare(
      "INSERT INTO deleted_templates (original_template_id, user_id, name, archive_json) VALUES (?, ?, ?, ?)"
    ).run(template.id, req.user.id, template.name || "Template", JSON.stringify({ template })).lastInsertRowid
    db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id)
    logAudit({ userId: req.user.id, action: "template.delete", targetType: "template", targetId: req.params.id, meta: { archiveId } })
    res.json({ ok: true, archiveId })
  })

  app.post("/api/templates/deleted/:archiveId/restore", authMiddleware, (req, res) => {
    try {
      const archiveId = readId(req.params.archiveId, "Archiv")
      const archived = db.prepare(
        "SELECT * FROM deleted_templates WHERE id = ? AND user_id = ?"
      ).get(archiveId, req.user.id)
      if (!archived) return res.status(404).json({ ok: false, error: "Archiv nicht gefunden" })

      let payload
      try {
        payload = JSON.parse(archived.archive_json || "{}")
      } catch {
        return res.status(500).json({ ok: false, error: "Archiv beschädigt" })
      }
      const template = payload?.template
      if (!template) return res.status(500).json({ ok: false, error: "Archiv unvollständig" })

      const restoredName = db.prepare("SELECT id FROM templates WHERE user_id = ? AND name = ?").get(req.user.id, template.name)
        ? `${template.name} (Restored)`
        : template.name
      const result = db.prepare(
        "INSERT INTO templates (user_id, name, url, html, platform, thumbnail) VALUES (?, ?, ?, ?, ?, ?)"
      ).run(req.user.id, restoredName, template.url || "", template.html || "", template.platform || "unknown", template.thumbnail || null)
      db.prepare("DELETE FROM deleted_templates WHERE id = ? AND user_id = ?").run(archiveId, req.user.id)
      logAudit({ userId: req.user.id, action: "template.restore_deleted", targetType: "template", targetId: result.lastInsertRowid, meta: { archiveId } })
      res.json({ ok: true, template: { id: result.lastInsertRowid, name: restoredName, url: template.url || "", platform: template.platform || "unknown", platformGuide: getPlatformGuide(template.platform || "unknown") } })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })
}
