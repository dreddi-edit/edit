import db from "./db.js"
import { authMiddleware } from "./auth.js"

export function registerProjectRoutes(app) {

  // Alle Projekte des Users
  app.get("/api/projects", authMiddleware, (req, res) => {
    const projects = db.prepare(
      "SELECT id, name, url, html, thumbnail, updated_at, created_at FROM projects WHERE user_id = ? ORDER BY updated_at DESC"
    ).all(req.user.id)
    res.json({ ok: true, projects })
  })

  // Einzelnes Projekt laden
  app.get("/api/projects/:id", authMiddleware, (req, res) => {
    const project = db.prepare(
      "SELECT * FROM projects WHERE id = ? AND user_id = ?"
    ).get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    res.json({ ok: true, project })
  })

  // Neues Projekt erstellen
  app.post("/api/projects", authMiddleware, (req, res) => {
    const { name, url, html } = req.body
    if (!name) return res.status(400).json({ ok: false, error: "Name erforderlich" })
    const result = db.prepare(
      "INSERT INTO projects (user_id, name, url, html) VALUES (?, ?, ?, ?)"
    ).run(req.user.id, name, url || "", html || "")
    res.json({ ok: true, id: result.lastInsertRowid })
  })

  // Projekt speichern
  app.put("/api/projects/:id", authMiddleware, (req, res) => {
    const { name, html, url, thumbnail } = req.body
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

    db.prepare(`
      UPDATE projects SET
        name = COALESCE(?, name),
        html = COALESCE(?, html),
        url = COALESCE(?, url),
        thumbnail = COALESCE(?, thumbnail),
        updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).run(name || null, html || null, url || null, thumbnail || null, req.params.id, req.user.id)

    res.json({ ok: true })
  })

  // Projekt löschen
  app.delete("/api/projects/:id", authMiddleware, (req, res) => {
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id)
    res.json({ ok: true })
  })
}
