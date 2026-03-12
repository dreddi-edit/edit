import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { logAudit } from "./auditLog.js"
import { normalizeManagedThumbnailUrl } from "./cloudStorage.js"
import { sendShareLink } from "./email.js"
import crypto from "node:crypto"
import { buildProjectImportPreview } from "./projectImport.js"
import { getPlatformGuide, normalizeProjectDocument } from "./siteMeta.js"
import {
  ValidationError,
  isValidationError,
  readEmail,
  readId,
  readOptionalBoolean,
  readOptionalEnum,
  readOptionalHtml,
  readOptionalIsoDate,
  readOptionalString,
  readOptionalUrl,
  readRequiredString,
} from "./validation.js"

const WORKFLOW_STAGES = ["draft", "internal_review", "client_review", "approved", "shipped"]
const DELIVERY_STATUSES = ["not_exported", "export_ready", "exported", "handed_off", "shipped"]
const PROJECT_VERSION_SOURCES = ["autosave", "manual", "translate", "ai_block", "ai_page", "ai_prompt", "restore", "export"]
const PROJECT_HTML_MAX = Number(process.env.PROJECT_HTML_MAX || 20_000_000)
const NON_PAGE_FILE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
  ".pdf", ".zip", ".xml", ".json", ".txt", ".css", ".js",
  ".mp4", ".mov", ".mp3", ".wav", ".webm", ".woff", ".woff2", ".ttf", ".eot",
])
const WORKFLOW_TRANSITIONS = {
  draft: ["internal_review"],
  internal_review: ["draft", "client_review"],
  client_review: ["internal_review", "approved"],
  approved: ["client_review", "shipped"],
  shipped: ["approved"],
}

function mapAssigneeRow(row) {
  if (!row) return row
  return {
    email: row.email || row.member_email || row.invite_email || "",
    name: row.name || "",
    role: row.role || "editor",
    status: row.status || "accepted",
    source: row.source || "project",
  }
}

function mapProjectRow(row, assignees = []) {
  if (!row) return row
  const workflowStage = row.workflow_stage || row.workflow_status || "draft"
  const deliveryStatus = row.delivery_status || "not_exported"
  return {
    ...row,
    ownerUserId: row.user_id,
    clientName: row.client_name || "",
    approvalStatus: row.approval_status || "draft",
    brandContext: typeof row.brand_context === "string" ? row.brand_context : "{}",
    thumbnail: normalizeManagedThumbnailUrl(row.thumbnail),
    workflowStage,
    deliveryStatus,
    dueAt: row.due_at || "",
    lastActivityAt: row.last_activity_at || row.updated_at || row.created_at || "",
    lastExportAt: row.last_export_at || "",
    lastExportMode: row.last_export_mode || "",
    lastExportWarningCount: Number(row.last_export_warning_count || 0),
    platformGuide: getPlatformGuide(row.platform || "unknown"),
    pages: parseProjectPages(row.pages_json, row.url),
    assetLibrary: parseProjectAssetLibrary(row.asset_library_json),
    assignees,
  }
}

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function stripHtml(value) {
  return cleanText(String(value || "").replace(/<[^>]+>/g, " "))
}

function normalizePagePath(pageUrl, siteRootUrl) {
  try {
    const resolved = new URL(pageUrl, siteRootUrl || pageUrl)
    resolved.hash = ""
    resolved.search = ""
    let pathname = resolved.pathname || "/"
    pathname = pathname.replace(/\/index\.html?$/i, "/")
    pathname = pathname.replace(/\/{2,}/g, "/")
    return pathname || "/"
  } catch {
    return "/"
  }
}

function pageIdFromPath(pathname) {
  const normalized = String(pathname || "/").replace(/^\/+|\/+$/g, "")
  if (!normalized) return "home"
  return normalized.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "page"
}

function derivePageName(pathname, title = "", anchorText = "") {
  const preferred = cleanText(title) || cleanText(anchorText)
  if (preferred) return preferred
  if (!pathname || pathname === "/") return "Home"
  const segment = pathname.split("/").filter(Boolean).pop() || "Page"
  return segment
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function isLikelyPageUrl(candidateUrl, rootUrl) {
  try {
    const resolved = new URL(candidateUrl, rootUrl || candidateUrl)
    if (!/^https?:$/i.test(resolved.protocol)) return false
    const pathname = resolved.pathname || "/"
    const extMatch = pathname.toLowerCase().match(/\.[a-z0-9]+$/)
    if (extMatch && NON_PAGE_FILE_EXTENSIONS.has(extMatch[0])) return false
    return !/^(mailto|tel|javascript):/i.test(String(candidateUrl || ""))
  } catch {
    return false
  }
}

function normalizeTranslationOverrides(input) {
  if (!input || typeof input !== "object") return undefined
  const entries = Object.entries(input)
    .map(([key, value]) => [cleanText(key).slice(0, 120), typeof value === "string" ? value : ""])
    .filter(([key, value]) => key && value.trim())
    .slice(0, 400)
  return entries.length ? Object.fromEntries(entries) : undefined
}

function normalizeTranslationSegment(input, index) {
  const kind = cleanText(input?.kind) === "attr" ? "attr" : "text"
  const selector = cleanText(input?.selector).slice(0, 600)
  const sourceText = typeof input?.sourceText === "string" ? input.sourceText : ""
  const translatedText = typeof input?.translatedText === "string" ? input.translatedText : ""
  if (!selector || (!sourceText.trim() && !translatedText.trim())) return null
  const textIndexRaw = Number(input?.textIndex)
  return {
    id: cleanText(input?.id) || `seg-${index + 1}`,
    kind,
    selector,
    attr: kind === "attr" ? cleanText(input?.attr).slice(0, 80) : undefined,
    textIndex: Number.isFinite(textIndexRaw) && textIndexRaw >= 0 ? Math.floor(textIndexRaw) : undefined,
    sourceText,
    translatedText,
  }
}

function normalizeProjectPage(input, siteRootUrl) {
  const url = cleanText(input?.url)
  const path = normalizePagePath(url || input?.path || "/", siteRootUrl)
  const languageVariants =
    input?.languageVariants && typeof input.languageVariants === "object"
      ? Object.fromEntries(
          Object.entries(input.languageVariants)
            .map(([language, value]) => [
              cleanText(language).slice(0, 24),
              {
                html: typeof value?.html === "string" ? value.html : "",
                baseHtml: typeof value?.baseHtml === "string" ? value.baseHtml : "",
                updatedAt: cleanText(value?.updatedAt),
                detectedSourceLanguage: cleanText(value?.detectedSourceLanguage),
                translatedCount: Number(value?.translatedCount || 0) || 0,
                overrides: normalizeTranslationOverrides(value?.overrides),
                segments: Array.isArray(value?.segments)
                  ? value.segments
                      .map((segment, index) => normalizeTranslationSegment(segment, index))
                      .filter(Boolean)
                      .slice(0, 1200)
                  : undefined,
              },
            ])
            .filter(([language, value]) => language && (value.html || value.baseHtml)),
        )
      : undefined
  return {
    id: cleanText(input?.id) || pageIdFromPath(path),
    name: cleanText(input?.name) || derivePageName(path, input?.title, ""),
    title: cleanText(input?.title),
    path,
    url,
    html: typeof input?.html === "string" ? input.html : "",
    languageVariants,
    updatedAt: cleanText(input?.updatedAt),
    scannedAt: cleanText(input?.scannedAt),
  }
}

function parseProjectPages(rawPagesJson, siteRootUrl = "") {
  if (!rawPagesJson) return []
  try {
    const parsed = JSON.parse(rawPagesJson)
    if (!Array.isArray(parsed)) return []
    const seen = new Set()
    return parsed
      .map((entry) => normalizeProjectPage(entry, siteRootUrl))
      .filter((page) => {
        const key = `${page.path}|${page.url}`
        if (!page.url || seen.has(key)) return false
        seen.add(key)
        return true
      })
  } catch {
    return []
  }
}

function serializeProjectPages(pages = [], siteRootUrl = "") {
  return JSON.stringify(parseProjectPages(JSON.stringify(pages), siteRootUrl))
}

function parseProjectAssetLibrary(rawAssetLibraryJson) {
  if (!rawAssetLibraryJson) return []
  try {
    const parsed = JSON.parse(rawAssetLibraryJson)
    if (!Array.isArray(parsed)) return []
    const seen = new Set()
    return parsed
      .map((entry, index) => ({
        id: cleanText(entry?.id) || `asset-${index + 1}`,
        label: cleanText(entry?.label || entry?.name || ""),
        type: cleanText(entry?.type || "image") === "font" ? "font" : "image",
        url: cleanText(entry?.url || ""),
        mimeType: cleanText(entry?.mimeType || ""),
        createdAt: cleanText(entry?.createdAt || entry?.created_at || ""),
      }))
      .filter((entry) => {
        if (!entry.url || seen.has(entry.url)) return false
        seen.add(entry.url)
        return /^(data:|https?:\/\/|blob:)/i.test(entry.url)
      })
      .slice(0, 120)
  } catch {
    return []
  }
}

function serializeProjectAssetLibrary(assetLibrary = []) {
  return JSON.stringify(parseProjectAssetLibrary(JSON.stringify(assetLibrary)))
}

async function fetchSitePage(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteEditor/1.0)" },
  })
  if (!response.ok) throw new Error(`Could not load page (${response.status})`)
  const rawHtml = await response.text()
  const finalUrl = response.url || url
  const normalized = normalizeProjectDocument({ html: rawHtml, url: finalUrl, platform: "unknown" })
  const titleMatch = cleanText(String(rawHtml || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "")
  return {
    html: normalized.html,
    finalUrl: normalized.meta.url || finalUrl,
    platform: normalized.meta.platform,
    rawHtml,
    title: titleMatch,
  }
}

function extractSitePagesFromHtml(html, rootUrl) {
  const root = new URL(rootUrl)
  const pages = new Map()
  const addPage = (pageUrl, anchorText = "", title = "") => {
    if (!isLikelyPageUrl(pageUrl, rootUrl)) return
    const resolved = new URL(pageUrl, rootUrl)
    if (resolved.origin !== root.origin) return
    resolved.hash = ""
    resolved.search = ""
    const path = normalizePagePath(resolved.toString(), rootUrl)
    if (pages.has(path)) return
    pages.set(path, {
      id: pageIdFromPath(path),
      name: derivePageName(path, title, anchorText),
      title: cleanText(title),
      path,
      url: resolved.toString(),
      html: "",
      updatedAt: "",
      scannedAt: new Date().toISOString(),
    })
  }

  addPage(rootUrl, "", "Home")
  const anchorRegex = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
  for (const match of String(html || "").matchAll(anchorRegex)) {
    addPage(match[2], stripHtml(match[3] || ""))
    if (pages.size >= 24) break
  }
  return Array.from(pages.values())
}

function getProjectAssigneeMap(projectIds) {
  const ids = Array.from(new Set(projectIds.map(value => Number(value)).filter(value => Number.isInteger(value) && value > 0)))
  const map = new Map(ids.map(id => [id, []]))
  if (!ids.length) return map

  const placeholders = ids.map(() => "?").join(", ")
  const rows = db.prepare(
    `SELECT pa.project_id, pa.member_email, pa.role, u.name, COALESCE(u.email, pa.member_email) AS email
     FROM project_assignees pa
     LEFT JOIN users u ON lower(u.email) = lower(pa.member_email)
     WHERE pa.project_id IN (${placeholders})
     ORDER BY pa.created_at ASC, pa.id ASC`
  ).all(...ids)

  for (const row of rows) {
    if (!map.has(row.project_id)) map.set(row.project_id, [])
    map.get(row.project_id).push(mapAssigneeRow(row))
  }
  return map
}

function getProjectAssignees(projectId) {
  return getProjectAssigneeMap([projectId]).get(Number(projectId)) || []
}

function readProjectAssignees(value) {
  if (value === undefined) return undefined
  if (value == null || value === "") return []
  if (!Array.isArray(value)) throw new ValidationError("Assignees ungültig")

  const deduped = new Map()
  for (const item of value) {
    const email = readEmail(item?.email ?? item, "Assignee")
    const role = readOptionalString(item?.role, "Rolle", { max: 40, empty: "editor" }) || "editor"
    if (!deduped.has(email)) {
      deduped.set(email, { email, role })
    }
  }
  return Array.from(deduped.values()).slice(0, 24)
}

function syncProjectAssignees(projectId, assignees = []) {
  const replaceAssignments = db.transaction((entries) => {
    db.prepare("DELETE FROM project_assignees WHERE project_id = ?").run(projectId)
    const insert = db.prepare("INSERT INTO project_assignees (project_id, member_email, role) VALUES (?, ?, ?)")
    for (const entry of entries) insert.run(projectId, entry.email, entry.role || "editor")
  })
  replaceAssignments(assignees)
}

function listAssignableMembers(user) {
  const membersByEmail = new Map()
  const addMember = (row) => {
    const mapped = mapAssigneeRow(row)
    const key = mapped.email.toLowerCase()
    if (!mapped.email || membersByEmail.has(key)) return
    membersByEmail.set(key, mapped)
  }

  addMember({
    email: user.email,
    name: user.name || user.email,
    role: "owner",
    status: "accepted",
    source: "owner",
  })

  const teamMembers = db.prepare(
    `SELECT tm.member_email, tm.role, u.name, COALESCE(u.email, tm.member_email) AS email
     FROM team_members tm
     LEFT JOIN users u ON lower(u.email) = lower(tm.member_email)
     WHERE tm.owner_id = ?
     ORDER BY tm.invited_at DESC`
  ).all(user.id)
  for (const member of teamMembers) addMember({ ...member, status: "accepted", source: "team" })

  const orgs = db.prepare("SELECT id FROM organisations WHERE owner_id = ?").all(user.id)
  for (const org of orgs) {
    const members = db.prepare(
      `SELECT om.invite_email, om.role, om.status, u.name, COALESCE(u.email, om.invite_email) AS email
       FROM org_members om
       LEFT JOIN users u ON u.id = om.user_id
       WHERE om.org_id = ?
       ORDER BY om.invited_at DESC`
    ).all(org.id)
    for (const member of members) addMember({ ...member, source: "organisation" })
  }

  return Array.from(membersByEmail.values())
}

function canTransitionWorkflow(fromStage, toStage) {
  const current = WORKFLOW_STAGES.includes(fromStage) ? fromStage : "draft"
  const next = WORKFLOW_STAGES.includes(toStage) ? toStage : current
  if (current === next) return true
  return (WORKFLOW_TRANSITIONS[current] || []).includes(next)
}

function normalizeProjectVersionSource(value, fallback = "autosave") {
  const normalized = cleanText(value).toLowerCase().replace(/[\s-]+/g, "_")
  return PROJECT_VERSION_SOURCES.includes(normalized) ? normalized : fallback
}

function mapProjectVersionRow(row, options = {}) {
  if (!row) return row
  const version = {
    id: Number(row.id),
    projectId: Number(row.project_id),
    label: cleanText(row.label),
    source: normalizeProjectVersionSource(row.source),
    pageId: cleanText(row.page_id),
    created_at: row.created_at || "",
  }
  if (options.includeHtml) {
    version.html = typeof row.html === "string" ? row.html : ""
  }
  return version
}

function trimProjectVersions(projectId, keep = 50) {
  const limit = Number(keep)
  if (!Number.isFinite(limit) || limit <= 0) return
  const staleRows = db.prepare(
    `SELECT id
     FROM project_versions
     WHERE project_id = ?
     ORDER BY datetime(created_at) DESC, id DESC
     LIMIT -1 OFFSET ?`
  ).all(projectId, limit)
  if (!staleRows.length) return
  const remove = db.prepare("DELETE FROM project_versions WHERE id = ?")
  const tx = db.transaction((rows) => {
    for (const row of rows) remove.run(row.id)
  })
  tx(staleRows)
}

export function createProjectVersion(projectId, payload = {}, options = {}) {
  const snapshotHtml = typeof payload.html === "string" ? payload.html : ""
  if (!snapshotHtml.trim()) return null

  const label = cleanText(payload.label)
  const source = normalizeProjectVersionSource(payload.source, "autosave")
  const pageId = cleanText(payload.pageId)
  const createdAt = cleanText(payload.createdAt)

  const result = db.prepare(
    `INSERT INTO project_versions (project_id, html, label, source, page_id, created_at)
     VALUES (?, ?, NULLIF(?, ''), ?, NULLIF(?, ''), COALESCE(NULLIF(?, ''), datetime('now')))`
  ).run(projectId, snapshotHtml, label, source, pageId, createdAt)

  trimProjectVersions(projectId, options.keep ?? 50)
  return mapProjectVersionRow(
    db.prepare("SELECT * FROM project_versions WHERE id = ?").get(result.lastInsertRowid),
    { includeHtml: true }
  )
}

function archiveProjectRecord(projectId, userId) {
  const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId)
  if (!project) return null
  const assignees = getProjectAssignees(projectId)
  const versions = db.prepare("SELECT * FROM project_versions WHERE project_id = ? ORDER BY created_at DESC").all(projectId)
  const exports = db.prepare("SELECT * FROM project_exports WHERE project_id = ? ORDER BY created_at DESC").all(projectId)
  const workflowEvents = db.prepare("SELECT * FROM project_workflow_events WHERE project_id = ? ORDER BY created_at DESC").all(projectId)
  const shares = db.prepare("SELECT * FROM project_shares WHERE project_id = ? ORDER BY created_at DESC").all(projectId)
  const result = db.prepare(
    "INSERT INTO deleted_projects (original_project_id, user_id, name, archive_json) VALUES (?, ?, ?, ?)"
  ).run(projectId, userId, project.name || "Project", JSON.stringify({ project, assignees, versions, exports, workflowEvents, shares }))
  return result.lastInsertRowid
}

export function registerProjectRoutes(app) {
  app.post("/api/projects/import-preview", authMiddleware, async (req, res) => {
    try {
      const preview = await buildProjectImportPreview(req.body || {})
      res.json({ ok: true, preview })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // Alle Projekte des Users (search: ?q=..., sort: ?sort=updated|created|name; pinned first)
  app.get("/api/projects", authMiddleware, (req, res) => {
    const q = String(req.query.q || "").trim()
    const sort = ["updated", "created", "name"].includes(req.query.sort) ? req.query.sort : "updated"
    const orderCol = sort === "name" ? "name ASC" : sort === "created" ? "created_at DESC" : "updated_at DESC"
    let projects
    if (q) {
      projects = db.prepare(
        `SELECT id, user_id, name, client_name, url, html, platform, workflow_status, workflow_stage, delivery_status, due_at,
                approved_at, shipped_at, thumbnail, pinned, pages_json, asset_library_json, last_activity_at, last_export_at, last_export_mode, last_export_warning_count,
                approval_status, brand_context,
                updated_at, created_at
         FROM projects
         WHERE user_id = ? AND (name LIKE ? OR url LIKE ?) ORDER BY pinned DESC, ${orderCol}`
      ).all(req.user.id, `%${q}%`, `%${q}%`)
    } else {
      projects = db.prepare(
        `SELECT id, user_id, name, client_name, url, html, platform, workflow_status, workflow_stage, delivery_status, due_at,
                approved_at, shipped_at, thumbnail, pinned, pages_json, asset_library_json, last_activity_at, last_export_at, last_export_mode, last_export_warning_count,
                approval_status, brand_context,
                updated_at, created_at
         FROM projects
         WHERE user_id = ? ORDER BY pinned DESC, ${orderCol}`
      ).all(req.user.id)
    }
    const assigneeMap = getProjectAssigneeMap(projects.map(project => project.id))
    res.json({ ok: true, projects: projects.map(project => mapProjectRow(project, assigneeMap.get(project.id) || [])) })
  })

  app.get("/api/projects/assignee-options", authMiddleware, (req, res) => {
    res.json({ ok: true, members: listAssignableMembers(req.user) })
  })

  // Einzelnes Projekt laden
  app.get("/api/projects/:id", authMiddleware, (req, res) => {
    const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    const latestExport = db.prepare(
      "SELECT id, version_id, export_mode, platform, readiness, warning_count, manifest_json, created_at FROM project_exports WHERE project_id = ? ORDER BY created_at DESC LIMIT 1"
    ).get(req.params.id)
    let exportInfo = null
    if (latestExport) {
      let manifest = {}
      try { manifest = JSON.parse(latestExport.manifest_json || "{}") } catch {}
      exportInfo = { ...latestExport, manifest }
    }
    res.json({ ok: true, project: mapProjectRow(project, getProjectAssignees(project.id)), latestExport: exportInfo })
  })

  app.get("/api/projects/deleted", authMiddleware, (req, res) => {
    const archives = db.prepare(
      "SELECT id, original_project_id, name, deleted_at FROM deleted_projects WHERE user_id = ? ORDER BY deleted_at DESC LIMIT 50"
    ).all(req.user.id)
    res.json({ ok: true, archives })
  })

  app.post("/api/projects/deleted/:archiveId/restore", authMiddleware, (req, res) => {
    try {
      const archiveId = readId(req.params.archiveId, "Archiv")
      const archived = db.prepare(
        "SELECT * FROM deleted_projects WHERE id = ? AND user_id = ?"
      ).get(archiveId, req.user.id)
      if (!archived) return res.status(404).json({ ok: false, error: "Archiv nicht gefunden" })

      let payload
      try {
        payload = JSON.parse(archived.archive_json || "{}")
      } catch {
        return res.status(500).json({ ok: false, error: "Archiv beschädigt" })
      }

      const project = payload?.project
      if (!project) return res.status(500).json({ ok: false, error: "Archiv unvollständig" })

      const restoredName = db.prepare("SELECT id FROM projects WHERE user_id = ? AND name = ?").get(req.user.id, project.name)
        ? `${project.name} (Restored)`
        : project.name

      const insert = db.prepare(`
        INSERT INTO projects (
          user_id, name, client_name, url, html, pages_json, asset_library_json, platform, workflow_status, workflow_stage,
          delivery_status, due_at, last_activity_at, last_export_at, last_export_mode,
          last_export_warning_count, approved_at, shipped_at, thumbnail, pinned, approval_status, brand_context
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        req.user.id,
        restoredName,
        project.client_name || null,
        project.url || "",
        project.html || "",
        project.pages_json || "[]",
        project.asset_library_json || "[]",
        project.platform || "unknown",
        project.workflow_status || project.workflow_stage || "draft",
        project.workflow_stage || project.workflow_status || "draft",
        project.delivery_status || "not_exported",
        project.due_at || null,
        project.last_activity_at || project.updated_at || project.created_at || null,
        project.last_export_at || null,
        project.last_export_mode || null,
        project.last_export_warning_count || 0,
        project.approved_at || null,
        project.shipped_at || null,
        project.thumbnail || null,
        project.pinned || 0,
        project.approval_status || "draft",
        project.brand_context || "{}"
      )

      const newProjectId = Number(insert.lastInsertRowid)
      const assignees = Array.isArray(payload?.assignees) ? readProjectAssignees(payload.assignees) : []
      syncProjectAssignees(newProjectId, assignees)
      const versions = Array.isArray(payload?.versions) ? payload.versions : []
      for (const version of versions) {
        db.prepare(
          `INSERT INTO project_versions (project_id, html, label, source, page_id, created_at)
           VALUES (?, ?, NULLIF(?, ''), ?, NULLIF(?, ''), COALESCE(NULLIF(?, ''), datetime('now')))`
        ).run(
          newProjectId,
          version.html || "",
          version.label || "",
          normalizeProjectVersionSource(version.source, "autosave"),
          version.page_id || version.pageId || "",
          version.created_at || null
        )
      }
      const workflowEvents = Array.isArray(payload?.workflowEvents) ? payload.workflowEvents : []
      for (const event of workflowEvents) {
        db.prepare(
          "INSERT INTO project_workflow_events (project_id, user_id, from_stage, to_stage, comment, created_at) VALUES (?, ?, ?, ?, ?, ?)"
        ).run(newProjectId, req.user.id, event.from_stage || null, event.to_stage || "draft", event.comment || "", event.created_at || null)
      }
      const exports = Array.isArray(payload?.exports) ? payload.exports : []
      for (const item of exports) {
        db.prepare(
          "INSERT INTO project_exports (project_id, user_id, version_id, export_mode, platform, readiness, warning_count, manifest_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).run(newProjectId, req.user.id, null, item.export_mode || "html-clean", item.platform || project.platform || "unknown", item.readiness || "ready", item.warning_count || 0, item.manifest_json || "{}", item.created_at || null)
      }

      db.prepare("DELETE FROM deleted_projects WHERE id = ? AND user_id = ?").run(archiveId, req.user.id)
      logAudit({ userId: req.user.id, action: "project.restore_deleted", targetType: "project", targetId: newProjectId, meta: { archiveId } })
      const restored = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(newProjectId, req.user.id)
      res.json({ ok: true, project: mapProjectRow(restored, getProjectAssignees(newProjectId)) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // Neues Projekt erstellen
  app.post("/api/projects", authMiddleware, (req, res) => {
    try {
      const name = readRequiredString(req.body?.name, "Name", { max: 160 })
      const url = readOptionalUrl(req.body?.url)
      const html = readOptionalHtml(req.body?.html, "HTML", { max: PROJECT_HTML_MAX })
      const platform = readOptionalString(req.body?.platform, "Platform", { max: 32, empty: "" })
      const clientName = readOptionalString(req.body?.clientName ?? req.body?.client_name, "Client", { max: 160, empty: "" })
      const dueAt = readOptionalIsoDate(req.body?.dueAt ?? req.body?.due_at, "Due date")
      const workflowStage = readOptionalEnum(req.body?.workflowStage ?? req.body?.workflow_stage, WORKFLOW_STAGES, "Workflow Stage", "draft") || "draft"
      const deliveryStatus = readOptionalEnum(req.body?.deliveryStatus ?? req.body?.delivery_status, DELIVERY_STATUSES, "Delivery status", "not_exported") || "not_exported"
      const assignees = readProjectAssignees(req.body?.assignees) || []
      const normalized = normalizeProjectDocument({ html, url, platform })
      const pages = req.body?.pages ? parseProjectPages(JSON.stringify(req.body.pages), normalized.meta.url || url || "") : []
      const assetLibrary = req.body?.assetLibrary ? parseProjectAssetLibrary(JSON.stringify(req.body.assetLibrary)) : []
      const result = db.prepare(
        `INSERT INTO projects (
          user_id, name, client_name, url, html, pages_json, asset_library_json, platform, workflow_status, workflow_stage,
          delivery_status, due_at, approval_status, brand_context, last_activity_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', '{}', datetime('now'))`
      ).run(
        req.user.id,
        name,
        clientName || null,
        normalized.meta.url || url || "",
        normalized.html || "",
        serializeProjectPages(pages, normalized.meta.url || url || ""),
        serializeProjectAssetLibrary(assetLibrary),
        normalized.meta.platform,
        workflowStage,
        workflowStage,
        deliveryStatus,
        dueAt || null
      )
      syncProjectAssignees(result.lastInsertRowid, assignees)
      db.prepare(
        "INSERT INTO project_workflow_events (project_id, user_id, from_stage, to_stage, comment) VALUES (?, ?, ?, ?, ?)"
      ).run(result.lastInsertRowid, req.user.id, null, workflowStage, "Project created")
      logAudit({
        userId: req.user.id,
        action: "project.create",
        targetType: "project",
        targetId: result.lastInsertRowid,
        meta: { name, platform: normalized.meta.platform, workflowStage, deliveryStatus, assigneeCount: assignees.length },
      })
      const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid)
      res.json({
        ok: true,
        id: result.lastInsertRowid,
        platform: normalized.meta.platform,
        project: mapProjectRow(project, getProjectAssignees(result.lastInsertRowid)),
      })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // Toggle pin
  app.post("/api/projects/:id/pin", authMiddleware, (req, res) => {
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    const current = db.prepare("SELECT pinned FROM projects WHERE id = ?").get(req.params.id)
    const next = current?.pinned ? 0 : 1
    db.prepare("UPDATE projects SET pinned = ? WHERE id = ?").run(next, req.params.id)
    res.json({ ok: true, pinned: !!next })
  })

  // Projekt speichern (with version snapshot when html changes)
  app.put("/api/projects/:id", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare(
        "SELECT id, html, url, pages_json, asset_library_json, platform, workflow_stage, workflow_status, delivery_status, client_name, due_at FROM projects WHERE id = ? AND user_id = ?"
      ).get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      const name = req.body?.name === undefined ? undefined : readRequiredString(req.body.name, "Name", { max: 160 })
      const html = req.body?.html === undefined ? undefined : readOptionalHtml(req.body.html, "HTML", { max: PROJECT_HTML_MAX })
      const url = req.body?.url === undefined ? undefined : readOptionalUrl(req.body.url)
      const thumbnail = req.body?.thumbnail === undefined ? undefined : readOptionalUrl(req.body.thumbnail, "Thumbnail URL")
      const pinned = readOptionalBoolean(req.body?.pinned, "Pinned")
      const platform = req.body?.platform === undefined ? undefined : readOptionalString(req.body.platform, "Platform", { max: 32, empty: "" })
      const clientName = req.body?.clientName === undefined && req.body?.client_name === undefined
        ? undefined
        : readOptionalString(req.body?.clientName ?? req.body?.client_name, "Client", { max: 160, empty: "" })
      const dueAt = req.body?.dueAt === undefined && req.body?.due_at === undefined
        ? undefined
        : readOptionalIsoDate(req.body?.dueAt ?? req.body?.due_at, "Due date")
      const workflowStage = req.body?.workflowStage === undefined && req.body?.workflow_stage === undefined
        ? undefined
        : readOptionalEnum(req.body?.workflowStage ?? req.body?.workflow_stage, WORKFLOW_STAGES, "Workflow Stage", undefined)
      const deliveryStatus = req.body?.deliveryStatus === undefined && req.body?.delivery_status === undefined
        ? undefined
        : readOptionalEnum(req.body?.deliveryStatus ?? req.body?.delivery_status, DELIVERY_STATUSES, "Delivery status", undefined)
      const assignees = readProjectAssignees(req.body?.assignees)
      const pages = req.body?.pages === undefined ? undefined : parseProjectPages(JSON.stringify(req.body.pages), project.url || "")
      const assetLibrary = req.body?.assetLibrary === undefined ? undefined : parseProjectAssetLibrary(JSON.stringify(req.body.assetLibrary))
      const versionLabel = readOptionalString(req.body?.versionLabel, "Version label", { max: 160, empty: "" }) || ""
      const versionSource = normalizeProjectVersionSource(req.body?.versionSource, "autosave")
      const pageId = readOptionalString(req.body?.pageId, "Page ID", { max: 160, empty: "" }) || ""

      const nextHtmlInput = html !== undefined ? html : project.html
      const nextUrlInput = url !== undefined ? url : project.url
      const normalized = normalizeProjectDocument({ html: nextHtmlInput, url: nextUrlInput, platform: platform || project.platform })
      const normalizedHtml = normalized.html
      const normalizedUrl = normalized.meta.url || nextUrlInput || ""
      const nextPlatform = normalized.meta.platform || project.platform || "unknown"
      const nextWorkflowStage = workflowStage || project.workflow_stage || project.workflow_status || "draft"
      const nextDeliveryStatus = deliveryStatus || project.delivery_status || "not_exported"
      const currentWorkflowStage = project.workflow_stage || project.workflow_status || "draft"

      if (normalizedHtml && normalizedHtml !== project.html && String(normalizedHtml).length > 100) {
        createProjectVersion(projectId, { html: normalizedHtml, label: versionLabel, source: versionSource, pageId })
      }
      if (workflowStage && workflowStage !== currentWorkflowStage && canTransitionWorkflow(currentWorkflowStage, workflowStage)) {
        db.prepare(
          "INSERT INTO project_workflow_events (project_id, user_id, from_stage, to_stage, comment) VALUES (?, ?, ?, ?, ?)"
        ).run(projectId, req.user.id, currentWorkflowStage, workflowStage, "")
      }

      db.prepare(`
        UPDATE projects SET
          name = COALESCE(?, name),
          html = COALESCE(?, html),
          pages_json = COALESCE(?, pages_json),
          asset_library_json = COALESCE(?, asset_library_json),
          url = COALESCE(?, url),
          platform = COALESCE(?, platform),
          client_name = COALESCE(?, client_name),
          workflow_status = COALESCE(?, workflow_status),
          workflow_stage = COALESCE(?, workflow_stage),
          delivery_status = COALESCE(?, delivery_status),
          due_at = COALESCE(?, due_at),
          thumbnail = COALESCE(?, thumbnail),
          pinned = COALESCE(?, pinned),
          approved_at = CASE
            WHEN COALESCE(?, workflow_stage, workflow_status) = 'approved' AND approved_at IS NULL THEN datetime('now')
            ELSE approved_at
          END,
          shipped_at = CASE
            WHEN COALESCE(?, workflow_stage, workflow_status) = 'shipped' AND shipped_at IS NULL THEN datetime('now')
            ELSE shipped_at
          END,
          updated_at = datetime('now'),
          last_activity_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(
        name ?? null,
        html !== undefined ? normalizedHtml : null,
        pages !== undefined ? serializeProjectPages(pages, project.url || normalizedUrl) : null,
        assetLibrary !== undefined ? serializeProjectAssetLibrary(assetLibrary) : null,
        url !== undefined || html !== undefined ? normalizedUrl : null,
        nextPlatform || null,
        clientName ?? null,
        nextWorkflowStage || null,
        nextWorkflowStage || null,
        nextDeliveryStatus || null,
        dueAt ?? null,
        thumbnail ?? null,
        pinned ?? null,
        nextWorkflowStage || null,
        nextWorkflowStage || null,
        projectId,
        req.user.id
      )
      if (assignees !== undefined) syncProjectAssignees(projectId, assignees)

      const updated = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      logAudit({
        userId: req.user.id,
        action: "project.update",
        targetType: "project",
        targetId: projectId,
        meta: { workflowStage: nextWorkflowStage, deliveryStatus: nextDeliveryStatus, platform: nextPlatform, assigneeCount: assignees?.length },
      })
      res.json({ ok: true, project: mapProjectRow(updated, getProjectAssignees(projectId)) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // Projekt löschen
  app.delete("/api/projects/:id", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      const removeProject = db.transaction(() => {
        const archiveId = archiveProjectRecord(projectId, req.user.id)
        db.prepare("DELETE FROM product_events WHERE project_id = ?").run(projectId)
        db.prepare("DELETE FROM project_shares WHERE project_id = ?").run(projectId)
        db.prepare("DELETE FROM project_workflow_events WHERE project_id = ?").run(projectId)
        db.prepare("DELETE FROM project_exports WHERE project_id = ?").run(projectId)
        db.prepare("DELETE FROM project_versions WHERE project_id = ?").run(projectId)
        db.prepare("DELETE FROM project_assignees WHERE project_id = ?").run(projectId)
        db.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").run(projectId, req.user.id)
        return archiveId
      })

      const archiveId = removeProject()
      logAudit({ userId: req.user.id, action: "project.delete", targetType: "project", targetId: projectId, meta: { archiveId } })
      res.json({ ok: true, archiveId })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // Duplicate project
  app.post("/api/projects/:id/duplicate", authMiddleware, (req, res) => {
    const p = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!p) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    const assignees = getProjectAssignees(req.params.id)
    const result = db.prepare(
      `INSERT INTO projects (
        user_id, name, client_name, url, html, pages_json, asset_library_json, platform, workflow_status, workflow_stage,
        delivery_status, due_at, approval_status, brand_context, thumbnail, last_activity_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).run(
      req.user.id,
      (p.name || "Project") + " (Copy)",
      p.client_name || null,
      p.url || "",
      p.html || "",
      p.pages_json || "[]",
      p.asset_library_json || "[]",
      p.platform || "unknown",
      "draft",
      "draft",
      "not_exported",
      p.due_at || null,
      p.approval_status || "draft",
      p.brand_context || "{}",
      p.thumbnail || null
    )
    syncProjectAssignees(result.lastInsertRowid, assignees)
    db.prepare(
      "INSERT INTO project_workflow_events (project_id, user_id, from_stage, to_stage, comment) VALUES (?, ?, ?, ?, ?)"
    ).run(result.lastInsertRowid, req.user.id, null, "draft", "Project duplicated")
    logAudit({ userId: req.user.id, action: "project.duplicate", targetType: "project", targetId: result.lastInsertRowid, meta: { sourceProjectId: req.params.id } })
    const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid)
    res.json({
      ok: true,
      id: result.lastInsertRowid,
      platform: p.platform || "unknown",
      project: mapProjectRow(project, getProjectAssignees(result.lastInsertRowid)),
    })
  })

  // Shareable preview - create link (body: { email?: string } to email client)
  app.post("/api/projects/:id/share", authMiddleware, async (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare("SELECT id, name FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
      const crypto = await import("crypto")
      const token = crypto.randomBytes(16).toString("hex")
      const htmlSnapshot = readOptionalHtml(req.body?.html, "Share HTML", { max: PROJECT_HTML_MAX }) || ""
      const pageId = readOptionalString(req.body?.pageId, "Page ID", { max: 160, empty: "" }) || ""
      const languageVariant = readOptionalString(req.body?.languageVariant, "Language variant", { max: 24, empty: "" }) || ""
      const result = db.prepare(
        "INSERT INTO project_shares (project_id, token, html_snapshot, page_id, language_variant) VALUES (?, ?, NULLIF(?, ''), NULLIF(?, ''), NULLIF(?, ''))"
      ).run(project.id, token, htmlSnapshot, pageId, languageVariant)
      const base = req.protocol + "://" + req.get("host")
      const url = `${base}/share/${token}`
      const clientEmail = req.body?.email ? readEmail(req.body.email) : ""
      if (clientEmail) {
        const user = db.prepare("SELECT name FROM users WHERE id = ?").get(req.user.id)
        sendShareLink(clientEmail, project.name, url, user?.name).catch(e => console.warn("Share email:", e?.message))
      }
      logAudit({
        userId: req.user.id,
        action: "project.share.create",
        targetType: "project",
        targetId: project.id,
        meta: { emailed: !!clientEmail, pageId: pageId || null, languageVariant: languageVariant || null },
      })
      res.json({ ok: true, id: Number(result.lastInsertRowid), url, token, pageId, languageVariant })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // List shares for a project (to revoke)
  app.get("/api/projects/:id/shares", authMiddleware, (req, res) => {
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    const shares = db.prepare(
      "SELECT id, token, page_id, language_variant, created_at FROM project_shares WHERE project_id = ? ORDER BY created_at DESC"
    ).all(req.params.id)
    const base = req.protocol + "://" + req.get("host")
    res.json({ ok: true, shares: shares.map(s => ({ ...s, url: `${base}/share/${s.token}` })) })
  })

  // Revoke share link
  app.delete("/api/projects/:id/shares/:shareId", authMiddleware, (req, res) => {
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    const r = db.prepare("DELETE FROM project_shares WHERE id = ? AND project_id = ?").run(req.params.shareId, req.params.id)
    if (r.changes === 0) return res.status(404).json({ ok: false, error: "Share link nicht gefunden" })
    logAudit({ userId: req.user.id, action: "project.share.revoke", targetType: "project", targetId: req.params.id, meta: { shareId: req.params.shareId } })
    res.json({ ok: true })
  })

  // Version history - list
  app.get("/api/projects/:id/versions", authMiddleware, (req, res) => {
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    const versions = db.prepare(
      `SELECT id, project_id, label, source, page_id, created_at
       FROM project_versions
       WHERE project_id = ?
       ORDER BY datetime(created_at) DESC, id DESC
       LIMIT 50`
    ).all(req.params.id)
    res.json({ ok: true, versions: versions.map((row) => mapProjectVersionRow(row)) })
  })

  app.get("/api/projects/:id/versions/:versionId", authMiddleware, (req, res) => {
    const projectId = Number(req.params.id)
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    const version = db.prepare("SELECT * FROM project_versions WHERE id = ? AND project_id = ?").get(req.params.versionId, projectId)
    if (!version) return res.status(404).json({ ok: false, error: "Version nicht gefunden" })
    res.json({ ok: true, version: mapProjectVersionRow(version, { includeHtml: true }) })
  })

  app.post("/api/projects/:id/versions", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare(
        "SELECT id, html, pages_json FROM projects WHERE id = ? AND user_id = ?"
      ).get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      const pageId = readOptionalString(req.body?.pageId, "Page ID", { max: 160, empty: "" }) || ""
      const label = readOptionalString(req.body?.label, "Version label", { max: 160, empty: "" }) || ""
      const source = normalizeProjectVersionSource(req.body?.source, "manual")

      let html = req.body?.html === undefined
        ? String(project.html || "")
        : String(readOptionalHtml(req.body?.html, "HTML", { max: PROJECT_HTML_MAX }) || "")

      if (!html.trim() && pageId) {
        const page = parseProjectPages(project.pages_json, "").find((entry) => entry.id === pageId)
        html = String(page?.html || "")
      }
      if (!html.trim()) return res.status(400).json({ ok: false, error: "Keine HTML-Version zum Speichern vorhanden" })

      const version = createProjectVersion(projectId, { html, label, source, pageId })
      const versionMeta = version ? { ...version } : null
      if (versionMeta) delete versionMeta.html
      logAudit({
        userId: req.user.id,
        action: "project.version.create",
        targetType: "project",
        targetId: projectId,
        meta: { versionId: version?.id, source, pageId, label: label || null },
      })
      res.json({ ok: true, version: versionMeta })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.get("/api/projects/:id/workflow-history", authMiddleware, (req, res) => {
    const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(req.params.id, req.user.id)
    if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
    const events = db.prepare(`
      SELECT pwe.id, pwe.from_stage, pwe.to_stage, pwe.comment, pwe.created_at, u.id AS user_id, u.name, u.email
      FROM project_workflow_events pwe
      LEFT JOIN users u ON u.id = pwe.user_id
      WHERE pwe.project_id = ?
      ORDER BY pwe.created_at DESC
      LIMIT 50
    `).all(req.params.id)
    res.json({ ok: true, events })
  })

  app.post("/api/projects/:id/workflow-stage", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const stage = readOptionalEnum(req.body?.stage, WORKFLOW_STAGES, "Workflow Stage")
      const comment = readOptionalString(req.body?.comment, "Comment", { max: 500, empty: "" })
      if (!stage) return res.status(400).json({ ok: false, error: "Workflow Stage erforderlich" })

      const project = db.prepare(
        "SELECT id, workflow_stage, workflow_status, delivery_status FROM projects WHERE id = ? AND user_id = ?"
      ).get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      const currentStage = project.workflow_stage || project.workflow_status || "draft"
      if (!canTransitionWorkflow(currentStage, stage)) {
        return res.status(400).json({ ok: false, error: `Workflow transition ${currentStage} -> ${stage} ist nicht erlaubt` })
      }

      db.prepare(
        "INSERT INTO project_workflow_events (project_id, user_id, from_stage, to_stage, comment) VALUES (?, ?, ?, ?, ?)"
      ).run(projectId, req.user.id, currentStage, stage, comment)
      logAudit({ userId: req.user.id, action: "project.workflow.transition", targetType: "project", targetId: projectId, meta: { from: currentStage, to: stage, comment } })

      const nextDeliveryStatus = stage === "shipped"
        ? "shipped"
        : project.delivery_status === "shipped"
        ? "handed_off"
        : project.delivery_status

      db.prepare(`
        UPDATE projects SET
          workflow_status = ?,
          workflow_stage = ?,
          delivery_status = ?,
          approved_at = CASE WHEN ? = 'approved' THEN datetime('now') ELSE approved_at END,
          shipped_at = CASE WHEN ? = 'shipped' THEN datetime('now') ELSE shipped_at END,
          updated_at = datetime('now'),
          last_activity_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(stage, stage, nextDeliveryStatus, stage, stage, projectId, req.user.id)

      const updated = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      res.json({ ok: true, project: mapProjectRow(updated, getProjectAssignees(projectId)) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  // Version history - restore
  app.post("/api/projects/:id/restore/:versionId", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const requestedPageId = readOptionalString(req.body?.pageId, "Page ID", { max: 160, empty: "" }) || ""
      const project = db.prepare(
        "SELECT id, url, platform, html, pages_json FROM projects WHERE id = ? AND user_id = ?"
      ).get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      const version = db.prepare("SELECT * FROM project_versions WHERE id = ? AND project_id = ?").get(req.params.versionId, projectId)
      if (!version) return res.status(404).json({ ok: false, error: "Version nicht gefunden" })

      const restorePageId = requestedPageId || cleanText(version.page_id)
      const normalized = normalizeProjectDocument({
        html: version.html,
        url: project.url || "",
        platform: project.platform || "unknown",
      })

      if (project.html && project.html !== normalized.html) {
        createProjectVersion(projectId, {
          html: project.html,
          label: `Before restore #${version.id}`,
          source: "restore",
          pageId: restorePageId,
        })
      }

      const existingPages = parseProjectPages(project.pages_json, project.url || normalized.meta.url || "")
      const nextPages = restorePageId
        ? existingPages.map((page) =>
            page.id === restorePageId
              ? { ...page, html: normalized.html, updatedAt: new Date().toISOString() }
              : page
          )
        : existingPages

      db.prepare(
        `UPDATE projects SET
          html = ?,
          pages_json = ?,
          platform = ?,
          updated_at = datetime('now'),
          last_activity_at = datetime('now')
        WHERE id = ? AND user_id = ?`
      ).run(
        normalized.html,
        serializeProjectPages(nextPages, project.url || normalized.meta.url || ""),
        normalized.meta.platform,
        projectId,
        req.user.id
      )

      const updated = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      logAudit({
        userId: req.user.id,
        action: "project.restore_version",
        targetType: "project",
        targetId: projectId,
        meta: { versionId: req.params.versionId, pageId: restorePageId || null },
      })
      res.json({
        ok: true,
        html: normalized.html,
        platform: normalized.meta.platform,
        pageId: restorePageId,
        version: mapProjectVersionRow(version),
        project: mapProjectRow(updated, getProjectAssignees(projectId)),
      })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.post("/api/projects/:id/pages/scan", authMiddleware, async (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
      if (!project.url) return res.status(400).json({ ok: false, error: "Project needs a root URL before scanning pages" })

      const fetched = await fetchSitePage(project.url)
      const scannedPages = extractSitePagesFromHtml(fetched.rawHtml, fetched.finalUrl)
      const existingPages = parseProjectPages(project.pages_json, project.url || fetched.finalUrl)
      const existingByPath = new Map(existingPages.map((page) => [page.path, page]))
      const mergedPages = scannedPages.map((page, index) => {
        const existing = existingByPath.get(page.path)
        return {
          ...page,
          html: index === 0 ? fetched.html : existing?.html || "",
          title: index === 0 ? fetched.title || page.title || page.name : existing?.title || page.title || "",
          name: existing?.name || page.name,
          updatedAt: existing?.updatedAt || "",
        }
      })

      db.prepare(`
        UPDATE projects SET
          url = ?,
          html = ?,
          pages_json = ?,
          platform = ?,
          updated_at = datetime('now'),
          last_activity_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(
        fetched.finalUrl,
        fetched.html,
        JSON.stringify(mergedPages),
        fetched.platform,
        projectId,
        req.user.id
      )

      const updated = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      logAudit({ userId: req.user.id, action: "project.scan_pages", targetType: "project", targetId: projectId, meta: { pageCount: mergedPages.length } })
      res.json({ ok: true, project: mapProjectRow(updated, getProjectAssignees(projectId)) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.post("/api/projects/:id/pages/load", authMiddleware, async (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const pageId = readRequiredString(req.body?.pageId, "Page", { max: 200 })
      const project = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      const pages = parseProjectPages(project.pages_json, project.url)
      const index = pages.findIndex((page) => page.id === pageId)
      if (index === -1) return res.status(404).json({ ok: false, error: "Page not found in project" })

      const targetPage = pages[index]
      const fetched = await fetchSitePage(targetPage.url)
      const updatedPage = {
        ...targetPage,
        url: fetched.finalUrl,
        path: normalizePagePath(fetched.finalUrl, project.url || fetched.finalUrl),
        title: fetched.title || targetPage.title || targetPage.name,
        name: targetPage.name || derivePageName(targetPage.path, fetched.title, ""),
        html: fetched.html,
        updatedAt: new Date().toISOString(),
      }
      const nextPages = [...pages]
      nextPages[index] = updatedPage

      db.prepare(`
        UPDATE projects SET
          html = ?,
          pages_json = ?,
          platform = ?,
          updated_at = datetime('now'),
          last_activity_at = datetime('now')
        WHERE id = ? AND user_id = ?
      `).run(
        fetched.html,
        JSON.stringify(nextPages),
        fetched.platform,
        projectId,
        req.user.id
      )

      const updated = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      res.json({ ok: true, project: mapProjectRow(updated, getProjectAssignees(projectId)), page: updatedPage })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.get("/api/search", authMiddleware, (req, res) => {
    try {
      const raw = readOptionalString(req.query.q, "q", { max: 200, empty: "" })
      if (!raw || raw.trim().length < 2) {
        return res.json({ ok: true, results: [] })
      }
      const q = `%${raw.trim()}%`
      const projects = db.prepare(
        `SELECT id, name, url, thumbnail, 'project' AS type, updated_at
         FROM projects
         WHERE user_id = ? AND (name LIKE ? OR url LIKE ?)
         ORDER BY updated_at DESC
         LIMIT 12`
      ).all(req.user.id, q, q)
      res.json({ ok: true, results: projects.map((project) => ({ ...project, thumbnail: normalizeManagedThumbnailUrl(project.thumbnail) })) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.post("/api/projects/:id/client-share", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare("SELECT id, share_token FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      let token = project.share_token
      if (!token) {
        token = crypto.randomBytes(20).toString("hex")
        db.prepare("UPDATE projects SET share_token = ?, updated_at = datetime('now') WHERE id = ?").run(token, projectId)
      }

      const shareUrl = `${req.protocol}://${req.get("host")}/share/${token}`
      logAudit({ userId: req.user.id, action: "project.client_share.create", targetType: "project", targetId: projectId, meta: { token } })
      res.json({ ok: true, share_url: shareUrl, token })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.delete("/api/projects/:id/client-share", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })
      db.prepare("UPDATE projects SET share_token = NULL, updated_at = datetime('now') WHERE id = ?").run(projectId)
      logAudit({ userId: req.user.id, action: "project.client_share.revoke", targetType: "project", targetId: projectId })
      res.json({ ok: true })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.get("/api/shared/:token", (req, res) => {
    try {
      const token = readRequiredString(req.params.token, "Token", { max: 64 })
      const project = db.prepare(
        "SELECT id, name, url, pages_json, approval_status FROM projects WHERE share_token = ?"
      ).get(token)
      if (!project) return res.status(404).json({ ok: false, error: "Link ungültig oder widerrufen" })
      let pages = []
      try {
        pages = JSON.parse(project.pages_json || "[]")
      } catch {}
      res.json({ ok: true, project: { ...project, pages } })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.put("/api/projects/:id/approval", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const validStatuses = ["draft", "pending_review", "approved", "rejected"]
      const status = readRequiredString(req.body?.status, "Status", { max: 20 })
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ ok: false, error: `Ungültiger Status. Erlaubt: ${validStatuses.join(", ")}` })
      }

      const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      db.prepare("UPDATE projects SET approval_status = ?, updated_at = datetime('now'), last_activity_at = datetime('now') WHERE id = ?")
        .run(status, projectId)
      logAudit({ userId: req.user.id, action: "project.approval.updated", targetType: "project", targetId: projectId, meta: { status } })
      res.json({ ok: true, status })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.post("/api/projects/:id/comments", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      const blockId = readRequiredString(req.body?.block_id, "Block ID", { max: 200 })
      const commentText = readRequiredString(req.body?.comment_text, "Kommentar", { max: 2000 })
      const id = `cmt-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

      db.prepare(
        "INSERT INTO block_comments (id, project_id, block_id, user_id, comment_text) VALUES (?, ?, ?, ?, ?)"
      ).run(id, String(projectId), blockId, req.user.id, commentText)

      const comment = db.prepare(
        `SELECT bc.*, u.name AS author_name, u.email AS author_email
         FROM block_comments bc
         LEFT JOIN users u ON u.id = bc.user_id
         WHERE bc.id = ?`
      ).get(id)

      res.json({ ok: true, comment })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.get("/api/projects/:id/comments", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      const comments = db.prepare(
        `SELECT bc.*, u.name AS author_name, u.email AS author_email
         FROM block_comments bc
         LEFT JOIN users u ON u.id = bc.user_id
         WHERE bc.project_id = ?
         ORDER BY bc.created_at ASC`
      ).all(String(projectId))
      res.json({ ok: true, comments })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })

  app.put("/api/projects/:id/comments/:commentId", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt")
      const commentId = readRequiredString(req.params.commentId, "Kommentar", { max: 80 })
      const resolved = req.body?.resolved ? 1 : 0
      const project = db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" })

      db.prepare("UPDATE block_comments SET resolved = ? WHERE id = ? AND project_id = ?")
        .run(resolved, commentId, String(projectId))
      res.json({ ok: true, resolved: Boolean(resolved) })
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
      res.status(500).json({ ok: false, error: error.message })
    }
  })
}
