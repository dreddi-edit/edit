import db from "./db.js"
import { authMiddleware } from "./auth.js"

// DB-Tabelle anlegen
db.exec(`
  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    url TEXT,
    html TEXT NOT NULL,
    thumbnail TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

export function registerTemplateRoutes(app) {

  // GET /api/templates – alle Templates des Users
  app.get("/api/templates", authMiddleware, (req, res) => {
    const templates = db.prepare(
      "SELECT id, name, url, thumbnail, created_at FROM templates WHERE user_id = ? ORDER BY created_at DESC"
    ).all(req.user.id)
    res.json({ ok: true, templates })
  })

  // POST /api/templates/extract – HTML von URL laden + speichern
  app.post("/api/templates/extract", authMiddleware, async (req, res) => {
    const { url, name } = req.body
    if (!url) return res.status(400).json({ ok: false, error: "URL erforderlich" })

    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteEditor/1.0)" },
        signal: AbortSignal.timeout(10000)
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const html = await response.text()
      if (!html || html.length < 100) throw new Error("Kein gültiges HTML gefunden")

      const templateName = name || new URL(url).hostname
      const result = db.prepare(
        "INSERT INTO templates (user_id, name, url, html) VALUES (?, ?, ?, ?)"
      ).run(req.user.id, templateName, url, html)

      res.json({ ok: true, id: result.lastInsertRowid })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/templates/apply – neues Projekt aus Template erstellen
  app.post("/api/templates/apply", authMiddleware, (req, res) => {
    const { template_id, name } = req.body
    if (!template_id || !name) return res.status(400).json({ ok: false, error: "template_id + name erforderlich" })

    const template = db.prepare(
      "SELECT * FROM templates WHERE id = ? AND user_id = ?"
    ).get(template_id, req.user.id)
    if (!template) return res.status(404).json({ ok: false, error: "Template nicht gefunden" })

    const result = db.prepare(
      "INSERT INTO projects (user_id, name, url, html) VALUES (?, ?, ?, ?)"
    ).run(req.user.id, name, template.url || "", template.html)

    res.json({ ok: true, id: result.lastInsertRowid })
  })

  // DELETE /api/templates/:id – Template löschen
  app.delete("/api/templates/:id", authMiddleware, (req, res) => {
    const template = db.prepare(
      "SELECT id FROM templates WHERE id = ? AND user_id = ?"
    ).get(req.params.id, req.user.id)
    if (!template) return res.status(404).json({ ok: false, error: "Template nicht gefunden" })
    db.prepare("DELETE FROM templates WHERE id = ?").run(req.params.id)
    res.json({ ok: true })
  })
}
