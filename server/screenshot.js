import puppeteer from "puppeteer-core"
import { authMiddleware } from "./auth.js"
import db from "./db.js"
import path from "path"
import fs from "fs"

const CHROME_PATH = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
const THUMB_DIR = path.join(process.cwd(), "thumbnails")

if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR)

export function registerScreenshotRoutes(app) {

  app.post("/api/screenshot", authMiddleware, async (req, res) => {
    const { url, project_id } = req.body
    if (!url || !project_id) return res.status(400).json({ ok: false, error: "url + project_id erforderlich" })

    let browser
    try {
      browser = await puppeteer.launch({
        executablePath: CHROME_PATH,
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
      })

      const page = await browser.newPage()
      await page.setViewport({ width: 1280, height: 800 })
      await page.goto(url, { waitUntil: "networkidle2", timeout: 15000 })

      const filename = `thumb_${project_id}_${Date.now()}.jpg`
      const filepath = path.join(THUMB_DIR, filename)

      await page.screenshot({ path: filepath, type: "jpeg", quality: 70, clip: { x: 0, y: 0, width: 1280, height: 800 } })

      // In DB speichern
      const thumbUrl = `/thumbnails/${filename}`
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
