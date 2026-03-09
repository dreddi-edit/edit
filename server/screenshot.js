import puppeteer from "puppeteer"
import { uploadThumbnail } from "./cloudStorage.js"
import { authMiddleware } from "./auth.js"
import db from "./db.js"
import path from "path"
import fs from "fs"

const CHROME_PATH = process.env.CHROME_PATH || null
const THUMB_DIR = path.join(process.cwd(), "thumbnails")

if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR)

export function registerScreenshotRoutes(app) {

  app.post("/api/screenshot", authMiddleware, async (req, res) => {
    const { url, project_id } = req.body
    if (!url || !project_id) return res.status(400).json({ ok: false, error: "url + project_id erforderlich" })

    let browser
    try {
      browser = await puppeteer.launch({
        executablePath: CHROME_PATH || undefined,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      })

      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 800 })
      await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 })

      const filename = `thumb_${project_id}_${Date.now()}.jpg`
      const filepath = path.join(THUMB_DIR, filename)

      await page.screenshot({ path: filepath, type: "jpeg", quality: 70, clip: { x: 0, y: 0, width: 1280, height: 800 } })

      // Upload to GCS
      let thumbUrl = `/thumbnails/${filename}`
      try {
        thumbUrl = await uploadThumbnail(filepath, filename)
        console.log("Thumbnail uploaded to GCS:", thumbUrl)
      } catch (e) {
        console.warn("GCS upload failed, using local:", e.message)
      }
      db.prepare("UPDATE projects SET thumbnail = ? WHERE id = ?").run(thumbUrl, project_id)
      res.json({ ok: true, thumbnail: thumbUrl })
    } catch (e) {
      console.error("Screenshot Fehler:", e.message)
      res.status(500).json({ ok: false, error: e.message })
    } finally {
      if (browser) await browser.close()
    }
  })

  // Thumbnails statisch ausliefern
  app.use("/thumbnails", (req, res, next) => {
    const filepath = path.join(THUMB_DIR, path.basename(req.path))
    if (fs.existsSync(filepath)) res.sendFile(filepath)
    else next()
  })
}
