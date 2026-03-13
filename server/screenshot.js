import puppeteer from "puppeteer"
import { normalizeManagedThumbnailUrl, streamManagedFile, uploadThumbnail } from "./cloudStorage.js"
import { authMiddleware } from "./auth.js"
import db from "./db.js"
import path from "path"
import fs from "fs"

const CHROME_PATH = process.env.CHROME_PATH || null
const THUMB_DIR = path.join(process.cwd(), "thumbnails")

if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true })

function getBaseUrl() {
  return String(process.env.APP_URL || process.env.ALLOWED_ORIGIN || "")
    .split(",")[0]
    .trim()
    .replace(/\/$/, "")
}

function resolveScreenshotUrl(input) {
  const raw = String(input || "").trim()
  if (!raw) throw new Error("url erforderlich")
  if (/^https?:\/\//i.test(raw)) return raw
  const base = getBaseUrl()
  if (!base) throw new Error("APP_URL oder ALLOWED_ORIGIN fehlt für relative Screenshot-URLs")
  return new URL(raw.startsWith("/") ? raw : `/${raw}`, `${base}/`).toString()
}

function parseProjectId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) throw new Error("ungültige project_id")
  return id
}

function requireOwnedProject(userId, projectId) {
  const row = db
    .prepare("SELECT id FROM projects WHERE id = ? AND user_id = ?")
    .get(projectId, userId)
  if (!row) throw new Error("Projekt nicht gefunden")
  return row
}

function makeFallbackSvg(title, subtitle) {
  const safeTitle = String(title || "Preview unavailable").replace(/[<>&"]/g, "")
  const safeSubtitle = String(subtitle || "").replace(/[<>&"]/g, "")
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="800" viewBox="0 0 1280 800">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stop-color="#111827"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <rect width="1280" height="800" fill="url(#bg)"/>
    <rect x="60" y="60" width="1160" height="680" rx="24" fill="#111111" stroke="#374151" stroke-width="2"/>
    <text x="100" y="180" fill="#ffffff" font-family="Arial, sans-serif" font-size="44" font-weight="700">${safeTitle}</text>
    <text x="100" y="240" fill="#9ca3af" font-family="Arial, sans-serif" font-size="24">${safeSubtitle}</text>
    <text x="100" y="680" fill="#6b7280" font-family="Arial, sans-serif" font-size="18">Site Editor fallback thumbnail</text>
  </svg>`
}

async function saveFallbackThumbnail(projectId, reason) {
  const filename = `thumb_${projectId}_${Date.now()}.svg`
  const filepath = path.join(THUMB_DIR, filename)
  const svg = makeFallbackSvg("Preview unavailable", reason || "Screenshot could not be generated")
  fs.writeFileSync(filepath, svg, "utf8")

  let thumbUrl = `/thumbnails/${filename}`
  try {
    thumbUrl = await uploadThumbnail(filepath, filename)
  } catch {}

  thumbUrl = normalizeManagedThumbnailUrl(thumbUrl)
  db.prepare("UPDATE projects SET thumbnail = ? WHERE id = ?").run(thumbUrl, projectId)
  return thumbUrl
}

async function launchBrowser() {
  return puppeteer.launch({
    executablePath: CHROME_PATH || undefined,
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--no-zygote",
      "--single-process"
    ]
  })
}

export function registerScreenshotRoutes(app) {
  app.post("/api/screenshot", authMiddleware, async (req, res) => {
    const { url, project_id } = req.body || {}

    if (!url || !project_id) {
      return res.status(400).json({ ok: false, error: "url + project_id erforderlich" })
    }

    let browser

    try {
      const userId = Number(req.user?.id)
      if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(401).json({ ok: false, error: "Unauthorized" })
      }

      const projectId = parseProjectId(project_id)
      requireOwnedProject(userId, projectId)

      const targetUrl = resolveScreenshotUrl(url)
      browser = await launchBrowser()

      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 })
      await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 20000 })
      await page.evaluate(async () => {
        if (document.fonts?.ready) {
          try { await document.fonts.ready } catch {}
        }
      })
      await new Promise(resolve => setTimeout(resolve, 1200))

      const filename = `thumb_${projectId}_${Date.now()}.jpg`
      const filepath = path.join(THUMB_DIR, filename)

      await page.screenshot({
        path: filepath,
        type: "jpeg",
        quality: 72,
        fullPage: false
      })

      let thumbUrl = `/thumbnails/${filename}`
      try {
        thumbUrl = await uploadThumbnail(filepath, filename)
      } catch {}

      thumbUrl = normalizeManagedThumbnailUrl(thumbUrl)
      db.prepare("UPDATE projects SET thumbnail = ? WHERE id = ?").run(thumbUrl, projectId)

      return res.json({ ok: true, thumbnail: thumbUrl })
    } catch (e) {
      const msg = String(e?.message || e || "Screenshot failed")
      console.error("Screenshot Fehler:", msg)

      try {
        const projectId = parseProjectId(project_id)
        const fallback = await saveFallbackThumbnail(projectId, msg.slice(0, 120))
        return res.json({ ok: true, thumbnail: fallback, warning: msg })
      } catch (fallbackError) {
        console.error("Fallback thumbnail Fehler:", fallbackError?.message || fallbackError)
        return res.status(500).json({ ok: false, error: msg })
      }
    } finally {
      if (browser) {
        try {
          await browser.close()
        } catch {}
      }
    }
  })

  app.get("/thumbnails/:filename", async (req, res, next) => {
    const filename = path.basename(req.params.filename || "")
    const filepath = path.join(THUMB_DIR, filename)

    if (fs.existsSync(filepath)) {
      if (filename.endsWith(".svg")) res.type("image/svg+xml")
      res.setHeader("Cache-Control", "public, max-age=31536000")
      return res.sendFile(filepath)
    }

    try {
      const streamed = await streamManagedFile(`thumbnails/${filename}`, res)
      if (streamed) return
    } catch (error) {
      console.warn("Thumbnail proxy failed:", error.message)
    }

    next()
  })
}
