import { authMiddleware } from "./auth.js"
import { createRateLimit } from "./rateLimit.js"
import { isValidationError, readRequiredString, readOptionalString } from "./validation.js"
import { getProviderApiKey } from "./providerKeys.js"
import db from "./db.js"

async function callAiJson({ prompt, system, userId, fallback }) {
  const key = getProviderApiKey("anthropic", { userId }) || getProviderApiKey("gemini", { userId })
  if (!key) return fallback

  const isGemini = !getProviderApiKey("anthropic", { userId }) && getProviderApiKey("gemini", { userId })

  if (isGemini) {
    const geminiKey = getProviderApiKey("gemini", { userId })
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${system}\n\n${prompt}` }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 800 },
        }),
      }
    )
    const d = await r.json()
    const text = d?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("").trim() || ""
    try { return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim()) } catch { return fallback }
  }

  const anthropicKey = getProviderApiKey("anthropic", { userId })
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": anthropicKey, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 800,
      temperature: 0.3,
      system,
      messages: [{ role: "user", content: prompt }],
    }),
  })
  const d = await r.json()
  const text = (d?.content || []).map((c) => (c?.type === "text" ? c.text : "")).join("").trim()
  try { return JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim()) } catch { return fallback }
}

const KEY = process.env.GOOGLE_API_KEY || process.env.VITE_PAGESPEED_API_KEY
const seoAuditRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: "seo-audit",
  message: "Zu viele SEO-Audits. Bitte spaeter erneut versuchen.",
})
const seoAiRateLimit = createRateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  keyPrefix: "seo-ai",
  message: "Zu viele SEO-AI-Anfragen.",
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

  // POST /api/seo/generate-meta — AI-generate meta title, description, keywords (#102, #103, #104)
  app.post("/api/seo/generate-meta", authMiddleware, seoAiRateLimit, async (req, res) => {
    try {
      const html = readOptionalString(req.body?.html, "html", { max: 50000, empty: "" })
      const url = readOptionalString(req.body?.url, "url", { max: 2048, empty: "" })
      const topic = readOptionalString(req.body?.topic, "topic", { max: 500, empty: "" })
      const projectId = req.body?.project_id ? Number(req.body.project_id) : null

      const context = html
        ? `HTML (first 3000 chars):\n${String(html).slice(0, 3000)}`
        : topic
        ? `Topic: ${topic}`
        : `URL: ${url}`

      const result = await callAiJson({
        system: "You are an expert SEO copywriter. Respond ONLY with valid JSON.",
        prompt: `Generate SEO meta tags for this page.\n${context}\n\nReturn JSON: {"meta_title":"string (50-60 chars)","meta_description":"string (150-160 chars)","keywords":["word1","word2","word3","word4","word5"],"og_title":"string","og_description":"string","focus_keyword":"string"}`,
        userId: req.user.id,
        fallback: { meta_title: "", meta_description: "", keywords: [], og_title: "", og_description: "", focus_keyword: "" },
      })

      if (projectId) {
        db.prepare(
          "UPDATE projects SET seo_meta_title = ?, seo_meta_description = ?, seo_keywords = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?"
        ).run(
          result.meta_title || "",
          result.meta_description || "",
          JSON.stringify(result.keywords || []),
          projectId,
          req.user.id
        )
      }

      res.json({ ok: true, ...result, saved: !!projectId })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/seo/keyword-suggestions — keyword suggestions for content (#104)
  app.post("/api/seo/keyword-suggestions", authMiddleware, seoAiRateLimit, async (req, res) => {
    try {
      const html = readOptionalString(req.body?.html, "html", { max: 30000, empty: "" })
      const topic = readOptionalString(req.body?.topic, "topic", { max: 500, empty: "" })
      const targetAudience = readOptionalString(req.body?.target_audience, "target_audience", { max: 200, empty: "" })

      const context = html ? `HTML:\n${String(html).slice(0, 3000)}` : `Topic: ${topic}`

      const result = await callAiJson({
        system: "You are an SEO keyword researcher. Respond ONLY with valid JSON.",
        prompt: `Suggest keywords for this content.\n${context}\n${targetAudience ? `Target audience: ${targetAudience}` : ""}\n\nReturn JSON: {"primary_keywords":["word"],"secondary_keywords":["word"],"long_tail_keywords":["phrase"],"semantic_clusters":[{"cluster":"string","keywords":["word"]}],"content_suggestions":["string"]}`,
        userId: req.user.id,
        fallback: { primary_keywords: [], secondary_keywords: [], long_tail_keywords: [], semantic_clusters: [], content_suggestions: [] },
      })

      res.json({ ok: true, ...result })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/seo/content-gap — content gap analysis (#105)
  app.post("/api/seo/content-gap", authMiddleware, seoAiRateLimit, async (req, res) => {
    try {
      const html = readOptionalString(req.body?.html, "html", { max: 30000, empty: "" })
      const topic = readOptionalString(req.body?.topic, "topic", { max: 500, empty: "" })
      const competitors = readOptionalString(req.body?.competitors, "competitors", { max: 1000, empty: "" })

      const context = html ? `Current page HTML (excerpt):\n${String(html).slice(0, 3000)}` : `Topic: ${topic}`

      const result = await callAiJson({
        system: "You are an expert content strategist and SEO analyst. Respond ONLY with valid JSON.",
        prompt: `Perform a content gap analysis.\n${context}\n${competitors ? `Competitor context: ${competitors}` : ""}\n\nReturn JSON: {"missing_topics":["string"],"underserved_queries":["string"],"recommended_sections":[{"title":"string","priority":"high|medium|low","rationale":"string"}],"content_score":0-100,"gaps_summary":"string"}`,
        userId: req.user.id,
        fallback: { missing_topics: [], underserved_queries: [], recommended_sections: [], content_score: 0, gaps_summary: "" },
      })

      res.json({ ok: true, ...result })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/seo/schema-suggestions — structured data / JSON-LD suggestions (#106)
  app.post("/api/seo/schema-suggestions", authMiddleware, seoAiRateLimit, async (req, res) => {
    try {
      const html = readOptionalString(req.body?.html, "html", { max: 30000, empty: "" })
      const pageType = readOptionalString(req.body?.page_type, "page_type", { max: 100, empty: "WebPage" })

      const result = await callAiJson({
        system: "You are an expert in Schema.org structured data. Respond ONLY with valid JSON.",
        prompt: `Suggest Schema.org structured data for this page.\nPage type hint: ${pageType}\nHTML excerpt:\n${String(html).slice(0, 3000)}\n\nReturn JSON: {"recommended_schemas":["string"],"json_ld_snippet":"string (valid JSON-LD)","rationale":"string","additional_schemas":["string"]}`,
        userId: req.user.id,
        fallback: { recommended_schemas: [], json_ld_snippet: "", rationale: "", additional_schemas: [] },
      })

      res.json({ ok: true, ...result })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // POST /api/seo/page-optimization — AI page optimization suggestions (#109)
  app.post("/api/seo/page-optimization", authMiddleware, seoAiRateLimit, async (req, res) => {
    try {
      const html = readOptionalString(req.body?.html, "html", { max: 50000, empty: "" })
      const url = readOptionalString(req.body?.url, "url", { max: 2048, empty: "" })
      const currentScore = req.body?.current_score != null ? Number(req.body.current_score) : null

      const result = await callAiJson({
        system: "You are an SEO and web performance expert. Respond ONLY with valid JSON.",
        prompt: `Generate actionable page optimization suggestions.\n${url ? `URL: ${url}` : ""}\n${currentScore != null ? `Current SEO score: ${currentScore}` : ""}\nHTML excerpt:\n${String(html).slice(0, 4000)}\n\nReturn JSON: {"quick_wins":[{"action":"string","impact":"high|medium|low","effort":"low|medium|high"}],"technical_fixes":["string"],"content_improvements":["string"],"estimated_score_gain":0-30,"priority_action":"string"}`,
        userId: req.user.id,
        fallback: { quick_wins: [], technical_fixes: [], content_improvements: [], estimated_score_gain: 0, priority_action: "" },
      })

      res.json({ ok: true, ...result })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // GET /api/seo/snippet-preview — compute search snippet preview data (#110)
  app.get("/api/seo/snippet-preview", authMiddleware, (req, res) => {
    try {
      const title = readOptionalString(req.query?.title, "title", { max: 200, empty: "" })
      const description = readOptionalString(req.query?.description, "description", { max: 1000, empty: "" })
      const url = readOptionalString(req.query?.url, "url", { max: 2048, empty: "" })

      const truncateTitle = (t, max = 60) => {
        const s = String(t || "").trim()
        return s.length > max ? s.slice(0, max - 1) + "…" : s
      }
      const truncateDesc = (d, max = 160) => {
        const s = String(d || "").trim()
        return s.length > max ? s.slice(0, max - 1) + "…" : s
      }
      const formatUrl = (u) => {
        try {
          const parsed = new URL(String(u || ""))
          const breadcrumb = [parsed.hostname, ...parsed.pathname.split("/").filter(Boolean)].join(" › ")
          return { display: breadcrumb, canonical: parsed.href }
        } catch {
          return { display: String(u || "").replace(/^https?:\/\//, ""), canonical: u || "" }
        }
      }

      const displayTitle = truncateTitle(title)
      const displayDesc = truncateDesc(description)
      const urlInfo = formatUrl(url)

      const titleWarning = String(title || "").length > 60 ? "Title too long (>60 chars). Google may truncate it." : String(title || "").length < 30 ? "Title too short (<30 chars)." : null
      const descWarning = String(description || "").length > 160 ? "Description too long (>160 chars)." : String(description || "").length < 70 ? "Description too short (<70 chars)." : null

      res.json({
        ok: true,
        snippet: {
          title: displayTitle,
          description: displayDesc,
          url: urlInfo.display,
          canonical: urlInfo.canonical,
        },
        analysis: {
          title_length: String(title || "").length,
          description_length: String(description || "").length,
          title_warning: titleWarning,
          description_warning: descWarning,
          score: [!titleWarning, !descWarning, !!url].filter(Boolean).length * 33,
        },
      })
    } catch (e) {
      if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // GET /api/seo/project-meta/:projectId — get saved SEO meta for a project
  app.get("/api/seo/project-meta/:projectId", authMiddleware, (req, res) => {
    try {
      const projectId = Number(req.params.projectId)
      if (!Number.isFinite(projectId) || projectId <= 0) return res.status(400).json({ ok: false, error: "Invalid project id" })
      const row = db.prepare(
        "SELECT seo_meta_title, seo_meta_description, seo_keywords FROM projects WHERE id = ? AND user_id = ?"
      ).get(projectId, req.user.id)
      if (!row) return res.status(404).json({ ok: false, error: "Project not found" })
      res.json({
        ok: true,
        meta_title: row.seo_meta_title || "",
        meta_description: row.seo_meta_description || "",
        keywords: (() => { try { return JSON.parse(row.seo_keywords || "[]") } catch { return [] } })(),
      })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })
}
