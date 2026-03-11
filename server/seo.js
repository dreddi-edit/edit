import { authMiddleware } from "./auth.js"
import { createRateLimit } from "./rateLimit.js"
import { isValidationError, readRequiredString } from "./validation.js"

const KEY = process.env.GOOGLE_API_KEY || process.env.VITE_PAGESPEED_API_KEY
const seoAuditRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: "seo-audit",
  message: "Zu viele SEO-Audits. Bitte spaeter erneut versuchen.",
})

export function registerSeoRoutes(app) {
  app.post("/api/seo/audit", authMiddleware, seoAuditRateLimit, async (req, res) => {
    try {
      const url = readRequiredString(req.body?.url, "url", { max: 2048 })
      if (!KEY) return res.status(503).json({ ok: false, error: "SEO audit not configured (missing API key)" })

      const r = await fetch(
        `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(url)}&key=${KEY}&strategy=mobile&category=performance&category=accessibility&category=seo&category=best-practices`
      )
      if (!r.ok) throw new Error(`PageSpeed API ${r.status}`)
      const data = await r.json()
      const lh = data.lighthouseResult || {}

      const categories = lh.categories || {}
      const audits = lh.audits || {}

      const score = (c) => Math.round(((categories[c] || {}).score || 0) * 100)
      const auditVal = (id, key = "displayValue") => (audits[id] || {})[key] || "—"

      res.json({
        ok: true,
        url,
        scores: {
          performance: score("performance"),
          accessibility: score("accessibility"),
          seo: score("seo"),
          bestPractices: score("best-practices")
        },
        metrics: {
          fcp: auditVal("first-contentful-paint"),
          lcp: auditVal("largest-contentful-paint"),
          cls: auditVal("cumulative-layout-shift"),
          ttfb: auditVal("server-response-time")
        },
        opportunities: [
          { id: "render-blocking", title: "Render-blocking resources", value: auditVal("render-blocking-resources") },
          { id: "unused-css", title: "Unused CSS", value: auditVal("unused-css-rules") },
          { id: "image-size", title: "Proper image sizes", value: auditVal("uses-responsive-images") },
          { id: "meta-description", title: "Meta description", value: auditVal("meta-description") }
        ].filter((o) => o.value && o.value !== "—")
      })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })
}
