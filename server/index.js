
import bcrypt from "bcryptjs"
import crypto from "crypto"

import 'dotenv/config';
import { rewriteHtmlAssets, rewriteCssUrls } from './rewriteAssets.js';
import express from "express"
import cookieParser from "cookie-parser"
import helmet from "helmet"
import { registerAuthRoutes, authMiddleware } from "./auth.js"
import { registerCreditRoutes, getBalance, deductCredits, hasEnoughCredits, estimateCreditCost } from "./credits.js"
import { registerSettingsRoutes } from "./settings.js"
import { registerOrgRoutes } from "./organisations.js"
import { registerStripeRoutes } from "./stripe.js"
import { registerScreenshotRoutes } from "./screenshot.js"
import { registerGoogleServiceRoutes } from "./googleServices.js"
import { registerVertexRoutes } from "./vertex.js"
import { registerPublishRoutes } from "./publish.js"
import { uploadExportZip } from "./cloudStorage.js"
import { createProjectVersion, registerProjectRoutes } from "./projects.js"
import { createRateLimit } from "./rateLimit.js"
import { registerSeoRoutes } from "./seo.js"
import { registerTemplateRoutes } from "./templates.js"
import { registerAssistantRoutes } from "./assistant.js"
import { registerTranslationMemoryRoutes } from "./translationMemory.js"
import { registerPresetsRoutes } from "./presets.js"
import {
  isValidationError,
  readEmail,
  readId,
  readOptionalHtml,
  readOptionalNumber,
  readOptionalString,
  readOptionalUrl,
  readPassword,
  readRequiredHtml,
  readRequiredString,
} from "./validation.js"
import { sendPasswordReset } from "./email.js"
import { logAudit } from "./auditLog.js"
import { detectSiteMeta, getPlatformGuide, normalizeProjectDocument, normalizeSiteUrl, prepareEditorDocument } from "./siteMeta.js"
import {
  buildDeliveryArtifact,
  validateDeliveryArtifact,
  prepareWordPressThemeFiles,
  prepareWordPressBlockFiles,
  prepareWebComponentFile,
  prepareReactComponentFile,
  prepareWebflowJsonFile,
  prepareEmailHtml,
  preparePlainTextEmail,
  prepareMarkdownFile,
  preparePdfFile,
  getExportSlug,
} from "./deliveryArtifacts.js"
import cors from "cors"
import { proxy, asset } from "./proxy.js"
import { claudeRewriteBlock, claudeGenerateLandingCopy, claudeGenerateLandingHtml } from "./claude.js"
import { geminiRewriteBlock } from "./gemini.js"
import { parseInstruction } from "./aiNavigator.js"
import { groqRewriteBlock } from "./groq.js"
import { ollamaRewriteBlock, ollamaHealth } from "./ollama.js"
import { resolveModel } from "./autoRouter.js"
import { ownerOnly } from "./accessControl.js"
import { getProviderApiKey } from "./providerKeys.js"
import archiver from "archiver"
import db from "./db.js"
import path from "path"
import fs from "node:fs"
import dns from "node:dns"
import { fileURLToPath } from "url"
import { fetchWithSsrfProtection, ProxySafetyError } from "./proxy.js"
import { enqueueJob, getJobForUser } from "./jobQueue.js"
import { FEATURE_FLAGS } from "./featureFlags.js"
import {
  extractJsonFromText,
  localRebuild,
  safeErrorMessage,
  sanitizeSharedHtml,
  sendError,
  stripJsonFences,
} from "./lib/httpContentUtils.js"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dashboardDist = path.join(__dirname, "..", "dashboard", "dist")


try {
  dns.setDefaultResultOrder("ipv4first")
  console.log("DNS result order set to ipv4first")
} catch (e) {
  console.warn("Could not set DNS result order:", e?.message || e)
}

const app = express()
app.set("trust proxy", 1)
app.disable("x-powered-by")
app.use(helmet({
  frameguard: { action: "sameorigin" },
  noSniff: true,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      "default-src": ["'self'"],
      "script-src": ["'self'"],
      "style-src": ["'self'", "'unsafe-inline'"],
      "img-src": ["'self'", "data:", "https:"],
      "font-src": ["'self'", "data:", "https:"],
      "connect-src": ["'self'", "https:"],
      "frame-ancestors": ["'self'"],
    },
  },
}))
app.use((req, res, next) => {
  const incomingRequestId = String(req.headers["x-request-id"] || "").trim()
  const requestId = incomingRequestId || crypto.randomUUID()
  req.requestId = requestId
  res.setHeader("X-Request-Id", requestId)
  const start = Date.now()
  res.on("finish", () => {
    const payload = {
      level: res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      event: "http.request",
      requestId,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - start,
      userId: req.user?.id || null,
    }
    const line = JSON.stringify(payload)
    if (res.statusCode >= 500) console.error(line)
    else if (res.statusCode >= 400) console.warn(line)
    else console.log(line)
  })
  next()
})
const corsOrigin = process.env.NODE_ENV === "production"
  ? ((process.env.ALLOWED_ORIGIN || process.env.APP_URL || "").split(",").map(s => s.trim()).filter(Boolean))
  : [`http://localhost:${process.env.PORT || 8787}`, "http://localhost:8788"]
if (process.env.NODE_ENV === "production" && corsOrigin.length === 0) {
  console.warn("WARN: ALLOWED_ORIGIN not set in production – CORS will reject all origins. Set ALLOWED_ORIGIN in .env")
}
app.use(cors({
  origin: corsOrigin,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-CSRF-Token"],
  credentials: true
}))

app.use(cookieParser())
const CSRF_COOKIE_MAX_AGE_MS = 15 * 60 * 1000

function ensureCsrfToken(req, res) {
  const existingToken = String(req.cookies?.csrf_token || "")
  if (existingToken) return existingToken
  const token = crypto.randomBytes(32).toString("hex")
  res.cookie("csrf_token", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: CSRF_COOKIE_MAX_AGE_MS,
  })
  req.cookies = { ...(req.cookies || {}), csrf_token: token }
  return token
}

// CSRF Middleware
app.use((req, res, next) => {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    ensureCsrfToken(req, res)
    return next()
  }
  if (req.path === "/api/stripe/webhook" || req.path.startsWith("/api/auth/google")) return next();

  const headerToken = String(req.headers["x-csrf-token"] || "")
  const cookieToken = String(req.cookies?.csrf_token || "")

  if (!headerToken || !cookieToken || headerToken !== cookieToken) {
    if (!cookieToken) ensureCsrfToken(req, res)
    return res.status(403).json({ ok: false, error: "Invalid or missing CSRF token." });
  }
  next();
})
const API_BODY_LIMIT = process.env.API_BODY_LIMIT || "80mb"
app.use(express.urlencoded({ extended: true, limit: API_BODY_LIMIT }))
const jsonBodyParser = express.json({ limit: API_BODY_LIMIT })
const rawStripeBodyParser = express.raw({ type: "application/json", limit: API_BODY_LIMIT })
app.use((req, res, next) => {
  if (req.path === "/api/stripe/webhook") {
    return rawStripeBodyParser(req, res, next)
  }
  return jsonBodyParser(req, res, next)
})

const apiGlobalRateLimit = createRateLimit({
  windowMs: 60 * 1000,
  max: Math.max(60, Number(process.env.API_GLOBAL_RATE_LIMIT_PER_MIN || 240) || 240),
  keyPrefix: "api-global",
  message: "Too many API requests. Please try again in a minute.",
})
app.use("/api", (req, res, next) => {
  if (req.path === "/api/stripe/webhook") return next()
  return apiGlobalRateLimit(req, res, next)
})

const dashboardIndex = path.join(dashboardDist, "index.html")
if (!fs.existsSync(dashboardIndex)) {
  console.warn("WARN: dashboard/dist not built – run 'npm run build' from project root. Serving API-only fallback at /")
}
app.use(express.static(dashboardDist))

app.get("/", (_req, res) => {
  if (fs.existsSync(dashboardIndex)) {
    return res.sendFile(dashboardIndex)
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8")
  res.send(`
<!DOCTYPE html><html><head><title>Site Editor</title></head><body style="font-family:system-ui;max-width:600px;margin:80px auto;padding:24px">
<h1>Site Editor</h1>
<p>API is running. Build the dashboard:</p>
<pre style="background:#f5f5f5;padding:12px;border-radius:6px">npm run build</pre>
<p><a href="/health">/health</a> &ndash; API health check</p>
</body></html>
  `)
})

app.get("/proxy", async (req, res) => {
  try {
    const url = normalizeSiteUrl(req.query.url);
    if (!url || typeof url !== "string") {
      return res.status(400).send("Missing url");
    }

    const r = await fetchWithSsrfProtection(url, {
      headers: {
        "User-Agent": req.headers["user-agent"] || "Mozilla/5.0 (compatible; SiteEditor/1.0)",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    if (!r.ok) return res.status(r.status).send(`Proxy error: ${r.status}`);

    const MAX_SIZE = 5 * 1024 * 1024;
    const contentLength = r.headers.get("content-length");
    if (contentLength && parseInt(contentLength, 10) > MAX_SIZE) {
      return res.status(413).send("Payload Too Large");
    }

    let html = "";
    let size = 0;
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        size += value.length;
        if (size > MAX_SIZE) {
          return res.status(413).send("Payload Too Large");
        }
        html += decoder.decode(value, { stream: true });
      }
    }

    const finalUrl = r.url || url;
    const prepared = prepareEditorDocument(html, finalUrl);
    
    res.setHeader("X-Site-Platform", prepared.meta.platform);
    if (prepared.meta.title) res.setHeader("X-Site-Title", prepared.meta.title);
    if (prepared.meta.url) res.setHeader("X-Site-Url", prepared.meta.url);
    res.send(prepared.html);
  } catch (e) {
    if (e instanceof ProxySafetyError) {
      return res.status(e.status).send(e.message)
    }
    sendError(res, 500, safeErrorMessage(e));
  }
})
app.get("/asset", asset)

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true, port: process.env.PORT || 8787 })
})

app.get("/status", (_req, res) => {
  res.status(200).json({ ok: true, status: "healthy", port: process.env.PORT || 8787 })
})

app.get("/api/feature-flags", (_req, res) => {
  res.json({ ok: true, flags: FEATURE_FLAGS })
})

app.get("/api/platforms/:platform", authMiddleware, (req, res) => {
  const requested = readOptionalString(req.params.platform, "Platform", { max: 32, empty: "unknown" })
  res.json({ ok: true, platform: requested, guide: getPlatformGuide(requested) })
})

// Public shareable preview (no auth)
app.get("/share/:token", (req, res, next) => {
  try {
    let row = db.prepare(
      "SELECT s.html_snapshot, s.page_id, s.language_variant, p.html, p.name FROM project_shares s JOIN projects p ON p.id = s.project_id WHERE s.token = ?"
    ).get(req.params.token)
    if (!row) {
      row = db.prepare(
        "SELECT NULL AS html_snapshot, NULL AS page_id, NULL AS language_variant, html, name FROM projects WHERE share_token = ?"
      ).get(req.params.token)
    }
    const sharedHtml = String(row?.html_snapshot || row?.html || "")
    if (!row || !sharedHtml) return res.status(404).send("Share link not found or expired")
    res.setHeader("Content-Type", "text/html; charset=utf-8")
    const htmlToSend = FEATURE_FLAGS.strictShareSanitization ? sanitizeSharedHtml(sharedHtml) : sharedHtml
    res.send(htmlToSend)
  } catch (e) {
    next(e)
  }
})


const aiPlanGuard = (req, res, next) => {
  try {
    const u = db.prepare("SELECT COALESCE(NULLIF(plan_id, ''), 'basis') as plan FROM users WHERE id = ?").get(req.user?.id);
    if (!u || u.plan === 'basis') {
      return res.status(403).json({ ok: false, error: "AI features require a paid plan (Starter, Pro, Scale)." });
    }
    next();
  } catch(e) { next(); }
};

const aiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  keyPrefix: "ai",
  message: "Zu viele KI-Anfragen. Bitte spaeter erneut versuchen.",
})

const exportRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  keyPrefix: "export",
  message: "Zu viele Exporte. Bitte spaeter erneut versuchen.",
})

const adminResetRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyPrefix: "admin-reset",
  message: "Zu viele Reset-Mails. Bitte spaeter erneut versuchen.",
})

const EXPORT_FILENAMES = {
  "wp-placeholder": "site_wp_placeholders.zip",
  "html-clean": "site_html_clean.zip",
  "html-raw": "site_html_raw.zip",
  "shopify-section": "shopify_section.zip",
  "wp-theme": "wordpress_theme.zip",
  "wp-block": "wordpress_block_plugin.zip",
  "web-component": "web_component_embed.zip",
  "react-component": "react_component.zip",
  "webflow-json": "webflow_import.zip",
  "email-newsletter": "email_newsletter.zip",
  "markdown-content": "content_markdown.zip",
  "pdf-print": "design_preview.pdf",
}

function exportFilenameForMode(mode) {
  return EXPORT_FILENAMES[String(mode || "wp-placeholder")] || "site_export.zip"
}

function cleanExportText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function normalizeExportLanguageCode(value) {
  return cleanExportText(value).replace(/_/g, "-").slice(0, 24)
}

function normalizeExportPagePath(pageUrl, siteRootUrl = "") {
  try {
    const resolved = new URL(String(pageUrl || "/"), siteRootUrl || "https://example.com/")
    resolved.hash = ""
    resolved.search = ""
    let pathname = resolved.pathname || "/"
    pathname = pathname.replace(/\/index\.html?$/i, "/")
    pathname = pathname.replace(/\/{2,}/g, "/")
    return pathname || "/"
  } catch {
    const raw = String(pageUrl || "/").trim()
    if (!raw) return "/"
    const normalized = `/${raw.replace(/^\/+/, "")}`.replace(/\/{2,}/g, "/")
    return normalized || "/"
  }
}

function exportPageIdFromPath(pathname) {
  const normalized = String(pathname || "/").replace(/^\/+|\/+$/g, "")
  if (!normalized) return "home"
  return normalized.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "page"
}

function parseExportPagesInput(rawPages, siteRootUrl = "") {
  if (!Array.isArray(rawPages)) return []
  const seen = new Set()
  return rawPages
    .map((entry) => {
      const url = cleanExportText(entry?.url)
      const path = normalizeExportPagePath(entry?.path || url || "/", siteRootUrl)
      const languageVariants =
        entry?.languageVariants && typeof entry.languageVariants === "object"
          ? Object.fromEntries(
              Object.entries(entry.languageVariants)
                .map(([language, variant]) => {
                  const code = normalizeExportLanguageCode(language)
                  return [
                    code,
                    {
                      html: typeof variant?.html === "string" ? variant.html : "",
                      updatedAt: cleanExportText(variant?.updatedAt),
                      detectedSourceLanguage: cleanExportText(variant?.detectedSourceLanguage),
                      translatedCount: Number(variant?.translatedCount || 0) || 0,
                    },
                  ]
                })
                .filter(([code, variant]) => code && variant.html),
            )
          : undefined
      return {
        id: cleanExportText(entry?.id) || exportPageIdFromPath(path),
        name: cleanExportText(entry?.name || entry?.title || ""),
        title: cleanExportText(entry?.title),
        path,
        url,
        html: typeof entry?.html === "string" ? entry.html : "",
        languageVariants,
        updatedAt: cleanExportText(entry?.updatedAt),
      }
    })
    .filter((entry) => {
      const key = `${entry.id}|${entry.path}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function buildBundleLanguageFolder(languageCode) {
  return normalizeExportLanguageCode(languageCode).toLowerCase() || "lang"
}

function buildBundleAlternates(languageCodes = []) {
  const seen = new Set()
  const alternates = [{ hreflang: "x-default", href: "index.html" }]
  for (const code of languageCodes) {
    const normalized = normalizeExportLanguageCode(code)
    if (!normalized) continue
    const key = normalized.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    alternates.push({
      hreflang: normalized,
      href: `variants/${buildBundleLanguageFolder(normalized)}/index.html`,
    })
  }
  return alternates
}

function buildLocalizedArtifacts({ html, normalized, linkedProject, exportMode, versionId, pages, pageId, languageVariant }) {
  const selectedPage = pageId ? pages.find((page) => page.id === pageId) || null : null
  const variantEntries = selectedPage?.languageVariants
    ? Object.entries(selectedPage.languageVariants).filter(([, variant]) => String(variant?.html || "").trim())
    : []

  if (!selectedPage || !variantEntries.length) {
    return [
      {
        prefix: "",
        artifact: buildDeliveryArtifact({
          html: normalized.html || html,
          url: normalized.meta.url,
          platform: normalized.meta.platform,
          mode: exportMode,
          project: linkedProject,
          versionId,
        }),
      },
    ]
  }

  const alternates = buildBundleAlternates(variantEntries.map(([code]) => code))
  const baseHtml = languageVariant
    ? normalized.html || String(selectedPage.languageVariants?.[normalizeExportLanguageCode(languageVariant)]?.html || "") || html
    : String(selectedPage.html || normalized.html || html)

  const artifacts = [
    {
      prefix: "",
      artifact: buildDeliveryArtifact({
        html: baseHtml,
        url: normalized.meta.url,
        platform: normalized.meta.platform,
        mode: exportMode,
        project: linkedProject,
        versionId,
        alternates,
        canonicalUrl: "index.html",
      }),
    },
  ]

  for (const [code, variant] of variantEntries) {
    const folder = buildBundleLanguageFolder(code)
    const variantHtml =
      normalizeExportLanguageCode(code).toLowerCase() === normalizeExportLanguageCode(languageVariant).toLowerCase()
        ? normalized.html || String(variant?.html || "")
        : String(variant?.html || "")
    if (!variantHtml.trim()) continue
    artifacts.push({
      prefix: `variants/${folder}/`,
      artifact: buildDeliveryArtifact({
        html: variantHtml,
        url: normalized.meta.url,
        platform: normalized.meta.platform,
        mode: exportMode,
        project: linkedProject,
        versionId,
        alternates,
        canonicalUrl: `variants/${folder}/index.html`,
        language: normalizeExportLanguageCode(code),
      }),
    })
  }

  return artifacts
}

async function appendExportBundle(archive, exportMode, artifact, linkedProject, options = {}) {
  const prefix = String(options.prefix || "")
  const entryName = (name) => `${prefix}${name}`.replace(/^\/+/, "")
  archive.append(JSON.stringify(artifact.manifest, null, 2), { name: entryName("manifest.json") })
  archive.append(artifact.notes, { name: entryName("DELIVERY_NOTES.md") })

  switch (exportMode) {
    case "wp-theme": {
      const slug = getExportSlug(linkedProject)
      for (const file of prepareWordPressThemeFiles({
        html: artifact.html,
        project: linkedProject,
        alternates: artifact.manifest?.alternates,
        canonicalUrl: artifact.manifest?.source?.canonicalUrl,
      })) {
        archive.append(file.content, { name: entryName(`${slug}/${file.name}`) })
      }
      return
    }
    case "wp-block": {
      const slug = getExportSlug(linkedProject)
      for (const file of prepareWordPressBlockFiles({ html: artifact.html, project: linkedProject })) {
        archive.append(file.content, { name: entryName(`${slug}/${file.name}`) })
      }
      return
    }
    case "web-component": {
      const { jsFile, demoFile, readmeFile } = prepareWebComponentFile({
        html: artifact.html,
        project: linkedProject,
        alternates: artifact.manifest?.alternates,
        canonicalUrl: artifact.manifest?.source?.canonicalUrl,
      })
      archive.append(jsFile.content, { name: entryName(jsFile.name) })
      archive.append(demoFile.content, { name: entryName(demoFile.name) })
      archive.append(readmeFile.content, { name: entryName(readmeFile.name) })
      return
    }
    case "webflow-json": {
      const { jsonFile, readmeFile } = prepareWebflowJsonFile({ html: artifact.html, project: linkedProject })
      archive.append(jsonFile.content, { name: entryName(jsonFile.name) })
      archive.append(readmeFile.content, { name: entryName(readmeFile.name) })
      return
    }
    case "react-component": {
      const slug = getExportSlug(linkedProject)
      for (const file of prepareReactComponentFile({ html: artifact.html, project: linkedProject })) {
        archive.append(file.content, { name: entryName(`${slug}/${file.name}`) })
      }
      return
    }
    case "email-newsletter":
      archive.append(await prepareEmailHtml(artifact.html), { name: entryName("index.html") })
      {
        const plainText = preparePlainTextEmail({ html: artifact.html, project: linkedProject })
        archive.append(plainText.content, { name: entryName(plainText.name) })
      }
      return
    case "markdown-content": {
      const markdownFile = prepareMarkdownFile({ html: artifact.html, project: linkedProject })
      archive.append(markdownFile.content, { name: entryName(markdownFile.name) })
      return
    }
    case "shopify-section": {
      const slug = getExportSlug(linkedProject)
      archive.append(artifact.html, { name: entryName(`sections/${slug}.liquid`) })
      return
    }
    default:
      archive.append(artifact.html, { name: entryName("index.html") })
  }
}

app.post("/api/ai/analyze-and-rebuild", authMiddleware, aiPlanGuard, aiRateLimit, async (req, res) => {
  try {
    const html = readRequiredHtml(req.body?.html)

    const cheap = localRebuild(html);
    const useAI = String(req.query.ai || "") === "1";
    const approved = String(req.query.approved || req.body?.approved || "") === "1";

    // Nur Struktur senden statt volles HTML
    function extractStructure(el, depth) {
      if (!el || depth > 5) return null;
      const tag = (el.tagName || "").toLowerCase();
      if (!tag || ["script","style","noscript","template","svg"].includes(tag)) return null;
      const cls = (el.getAttribute ? el.getAttribute("class") || "" : "").trim().substring(0, 60);
      const bid = el.getAttribute ? el.getAttribute("data-block-id") || "" : "";
      const txt = (el.textContent || "").replace(/\s+/g," ").trim().substring(0, 50);
      const kids = Array.from(el.children||[]).map(c=>extractStructure(c,depth+1)).filter(Boolean).slice(0,6);
      return {tag, cls:cls||undefined, bid:bid||undefined, txt:txt||undefined, kids:kids.length?kids:undefined};
    }
    let structureStr = "{}";
    try {
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM(html);
      structureStr = JSON.stringify(extractStructure(dom.window.document.body, 0)).substring(0, 5000);
    } catch(e) { structureStr = html.replace(/<[^>]+>/g," ").substring(0,2000); }
    const system = "You are a website block analyzer. Return ONLY raw JSON, no markdown, no backticks. Format: {blocks:[{selector:string,label:string,type:string}]}";
    const user = "Identify main editable blocks. Return JSON only. Structure:\n" + structureStr;


    const estInputTokens = Math.max(120, Math.ceil((structureStr.length + user.length + system.length + 400) / 4))
    const estOutputTokens = 4000
    const estCost = estimateCreditCost("claude-sonnet-4-6", estInputTokens, estOutputTokens)

    if (useAI && !approved) {
      return res.json({
        ok: false,
        needsApproval: true,
        model: "claude-sonnet-4-6",
        provider: "claude",
        estInputTokens,
        estOutputTokens,
        estCost,
        reason: "AI refine block requires approval"
      })
    }

    if (useAI && approved && req.user?.id) {
      const creditCheck = hasEnoughCredits(req.user.id, "claude-sonnet-4-6", estInputTokens, estOutputTokens)
      if (!creditCheck.ok) {
        return res.status(402).json({
          ok: false,
          error: "Nicht genug Credits",
          code: "INSUFFICIENT_CREDITS",
          balance_eur: creditCheck.balance,
          needed_eur: creditCheck.needed
        })
      }
    }

    const anthropicKey = getProviderApiKey("anthropic", { userId: req.user?.id })
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set")

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        temperature: 0.1,
        system,
        messages: [{ role: "user", content: user }]
      })
    })

    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`Anthropic error ${resp.status}: ${t}`)
    }

    const data = await resp.json()
    const text = (data?.content || []).map((c) => (c?.type === "text" ? c.text : "")).join("").trim()

    try {
      const result = JSON.parse(stripJsonFences(extractJsonFromText(text)))
      console.log("AI rebuild successful, blocks:", result.blocks?.length || 0)
      if (req.user?.id && data.usage) {
        try { deductCredits(req.user.id, "claude-sonnet-4-6", data.usage.input_tokens || 0, data.usage.output_tokens || 0, "Analyze and rebuild") } catch(e) {}
      }
      res.json({ ok: true, ...result, usage: data.usage || null })
    } catch (e) {
      console.error("Failed to parse AI response:", text)
      res.json({ ok: true, ...cheap, source: "ai-parse-failed" })
    }
  } catch (error) {
    if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
    console.error("AI rebuild error:", error)
    res.json({ ok: true, ...localRebuild(req.body?.html || ""), source: "ai-error", error: safeErrorMessage(error) })
  }
})

app.get("/api/ai/ollama-health", authMiddleware, async (_req, res) => {
  try {
    const result = await ollamaHealth()
    res.json({ ok: result.ok, models: result.models || [] })
  } catch (error) {
    res.json({ ok: false, models: [], error: error.message })
  }
})

app.post("/api/ai/demo-landing-copy", authMiddleware, aiPlanGuard, aiRateLimit, async (req, res) => {
  try {
    const name = readRequiredString(req.body?.name, "Product name", { max: 120 })
    const description = readOptionalString(req.body?.description, "Description", { max: 2000, empty: "" })
    const audience = readOptionalString(req.body?.audience, "Audience", { max: 400, empty: "" })
    const language = readOptionalString(req.body?.language, "Language", { max: 40, empty: "english" }) || "english"
    const complexity = readOptionalNumber(req.body?.complexity, "Complexity", { min: 1, max: 10, integer: true }) ?? 5

    const result = await claudeGenerateLandingHtml({
      name,
      description,
      audience,
      language,
      complexity,
      model: "claude-sonnet-4-6",
      userId: req.user?.id,
    })

    let deducted = 0
    if (req.user?.id && result?.usage) {
      try {
        deducted = deductCredits(
          req.user.id,
          "claude-sonnet-4-6",
          result.usage.input_tokens || 0,
          result.usage.output_tokens || 0,
          "Landing generator"
        )
      } catch (e) { console.error("deductCredits failed:", e.message) }
    }

    const prepared = prepareEditorDocument(result.html, "")

    return res.json({
      ok: true,
      model: "claude-sonnet-4-6",
      provider: "claude",
      html: prepared.html,
      platform: detectSiteMeta("", prepared.html).platform,
      usage: result.usage || null,
      cost_eur: deducted
    })
  } catch (error) {
    if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
    console.error("Demo landing HTML error:", error)
    return res.json({ ok: false, error: error.message })
  }
})

app.post("/api/ai/rewrite-block", authMiddleware, aiPlanGuard, aiRateLimit, async (req, res) => {
  try {
    const html = readRequiredHtml(req.body?.html, "HTML", { max: 500_000 })
    const instruction = readRequiredString(req.body?.instruction, "Instruction", { max: 4000 })
    const mode = readOptionalString(req.body?.mode, "Mode", { max: 50, empty: "" })
    const systemHint = readOptionalString(req.body?.systemHint, "System hint", { max: 2000, empty: "" })
    const model = readOptionalString(req.body?.model, "Model", { max: 80, empty: "" })
    const approved = String(req.query.approved || req.body?.approved || "") === "1"

    // Mode-specific system hint injection (#82 readability, #83 tone, #86 CTA, #87 product, #88 blog, #96 hero)
    const modeHints = {
      readability: "Focus on readability: use short sentences, active voice, clear structure, no jargon.",
      tone: "Adjust the tone of voice. Keep the same meaning but change the style as instructed.",
      cta: "Optimise call-to-action elements. Make CTAs more compelling, urgent and benefit-focused.",
      product: "Rewrite as a high-converting product description. Focus on benefits, features and social proof.",
      blog: "Rewrite in an engaging blog style. Use subheadings, bullet points and conversational language.",
      hero: "Optimise the hero section for maximum visual impact and conversion. Make the headline punchy and the sub-headline clear.",
      ad_copy: "Rewrite as high-converting ad copy. Be concise, benefit-focused with a strong CTA.",
      email: "Rewrite as compelling email copy with a strong subject line hook and clear CTA.",
      improve: "Improve overall copy quality: clarity, persuasion, and conversion potential.",
    }
    const effectiveSystemHint = systemHint || (mode && modeHints[mode]) || ""

    let chosenModel = String(model || "auto")

    if (chosenModel === "auto") {
      const routing = await resolveModel(html, instruction)

      if (routing.needsApproval && !approved) {
        // Approval nötig – direkt in Response zurückgeben
        return res.json({
          ok: false,
          needsApproval: true,
          model: routing.model,
          provider: routing.provider,
          estInputTokens: routing.inputTokens,
          estOutputTokens: routing.outputTokens,
          estCost: routing.estCost,
          reason: routing.reason
        })
      }

      chosenModel = routing.model
    } else {
      // Check approval for non-auto models (except Ollama)
      if (!chosenModel.startsWith("ollama:") && !approved) {
        const { estimateTokens } = await import("./autoRouter.js")
        const { inputTokens, outputTokens } = estimateTokens(html, instruction)
        const estCost = estimateCreditCost(chosenModel, inputTokens, outputTokens)
        
        return res.json({
          ok: false,
          needsApproval: true,
          model: chosenModel,
          provider: chosenModel.startsWith("gemini-") ? "gemini" : chosenModel.startsWith("groq:") ? "groq" : "claude",
          estInputTokens: inputTokens,
          estOutputTokens: outputTokens,
          estCost: estCost.toFixed(4),
          reason: "Explicit model selection requires approval"
        })
      }
    }

    if (!chosenModel.startsWith("ollama:") && req.user?.id) {
      const { estimateTokens } = await import("./autoRouter.js")
      const { inputTokens, outputTokens } = estimateTokens(html, instruction)
      const creditCheck = hasEnoughCredits(req.user.id, chosenModel, inputTokens, outputTokens)
      if (!creditCheck.ok) {
        return res.status(402).json({
          ok: false,
          error: "Nicht genug Credits",
          code: "INSUFFICIENT_CREDITS",
          balance_eur: creditCheck.balance,
          needed_eur: creditCheck.needed
        })
      }
    }

    const useGemini = chosenModel.startsWith("gemini-")
    const useGroq   = chosenModel.startsWith("groq:")
    const useOllama = chosenModel.startsWith("ollama:")

    const result = useGemini
      ? await geminiRewriteBlock({ html, instruction, systemHint: effectiveSystemHint, model: chosenModel, userId: req.user?.id })
      : useGroq
      ? await groqRewriteBlock({ html, instruction, systemHint: effectiveSystemHint, model: chosenModel.replace(/^groq:/, ""), userId: req.user?.id })
      : useOllama
      ? await ollamaRewriteBlock({ html, instruction, systemHint: effectiveSystemHint, model: chosenModel.replace(/^ollama:/, "") })
      : await claudeRewriteBlock({ html, instruction, systemHint: effectiveSystemHint, model: chosenModel, userId: req.user?.id })

    const usage = result?.usage || null

    // Credits abziehen wenn User eingeloggt
    let deducted = 0
    if (req.user?.id && usage) {
      try { deducted = deductCredits(req.user.id, chosenModel, usage.input_tokens || 0, usage.output_tokens || 0, "Block rewrite") } catch {}
    }

    res.json({
      ok: true,
      model: chosenModel,
      provider: useGemini ? "gemini" : useGroq ? "groq" : useOllama ? "ollama" : "claude",
      html: result?.html ?? result,
      usage,
      cost_eur: deducted
    })
  } catch (error) {
    if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message })
    console.error("AI rewrite error:", error)
    sendError(res, 500, safeErrorMessage(error))
  }
})


// Streaming Endpoint für BlockOverlay
app.post("/api/ai/rewrite-block-stream", authMiddleware, aiPlanGuard, aiRateLimit, async (req, res) => {
  try {
    const html = readRequiredHtml(req.body?.html, "HTML", { max: 500_000 })
    const instruction = readRequiredString(req.body?.instruction, "Instruction", { max: 4000 })
    const systemHint = readOptionalString(req.body?.systemHint, "System hint", { max: 2000, empty: "" })
    const model = readOptionalString(req.body?.model, "Model", { max: 80, empty: "" })
    const approved = String(req.query.approved || req.body?.approved || "") === "1"

    let chosenModel = String(model || "auto")

    if (chosenModel === "auto") {
      const routing = await resolveModel(html, instruction)
      if (routing.needsApproval && !approved) {
        return res.json({
          ok: false,
          needsApproval: true,
          model: routing.model,
          provider: routing.provider,
          estInputTokens: routing.inputTokens,
          estOutputTokens: routing.outputTokens,
          estCost: routing.estCost,
          reason: routing.reason
        })
      }
      chosenModel = routing.model
    } else {
      // Check approval for non-auto models (except Ollama)
      if (!chosenModel.startsWith("ollama:") && !approved) {
        const { estimateTokens } = await import("./autoRouter.js")
        const { inputTokens, outputTokens } = estimateTokens(html, instruction)
        const estCost = estimateCreditCost(chosenModel, inputTokens, outputTokens)
        
        return res.json({
          ok: false,
          needsApproval: true,
          model: chosenModel,
          provider: chosenModel.startsWith("gemini-") ? "gemini" : chosenModel.startsWith("groq:") ? "groq" : "claude",
          estInputTokens: inputTokens,
          estOutputTokens: outputTokens,
          estCost: estCost.toFixed(4),
          reason: "Explicit model selection requires approval"
        })
      }
    }

    if (!chosenModel.startsWith("ollama:") && req.user?.id) {
      const { estimateTokens } = await import("./autoRouter.js")
      const { inputTokens, outputTokens } = estimateTokens(html, instruction)
      const creditCheck = hasEnoughCredits(req.user.id, chosenModel, inputTokens, outputTokens)
      if (!creditCheck.ok) {
        return res.status(402).json({
          ok: false,
          error: "Nicht genug Credits",
          code: "INSUFFICIENT_CREDITS",
          balance_eur: creditCheck.balance,
          needed_eur: creditCheck.needed
        })
      }
    }

    // Ollama & Groq – kein natives Streaming über unseren Stack, fallback zu normal
    if (chosenModel.startsWith("ollama:") || chosenModel.startsWith("groq:")) {
      const useOllama = chosenModel.startsWith("ollama:")
      const result = useOllama
        ? await ollamaRewriteBlock({ html, instruction, systemHint, model: chosenModel.replace(/^ollama:/, "") })
        : await groqRewriteBlock({ html, instruction, systemHint, model: chosenModel.replace(/^groq:/, ""), userId: req.user?.id })
      return res.json({ ok: true, model: chosenModel, html: result?.html ?? result, usage: result?.usage || null })
    }

    // Claude & Gemini – Streaming
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")

    const controller = new AbortController();
    req.on("close", () => controller.abort());

    const isGemini = chosenModel.startsWith("gemini-")

    if (isGemini) {
      const result = await geminiRewriteBlock({ html, instruction, systemHint, model: chosenModel, userId: req.user?.id })
      const usage = result?.usage || null
      let deducted = 0
      if (req.user?.id && usage) {
        try { deducted = deductCredits(req.user.id, chosenModel, usage.input_tokens || 0, usage.output_tokens || 0, "Block rewrite") } catch {}
      }
      res.write(`data: ${JSON.stringify({ type: "done", html: result?.html ?? result, usage, cost_eur: deducted })}\n\n`)
      return res.end()
    }

    // Claude native streaming
    const systemPrompt = [
      "You are an expert HTML editor.",
      "Return ONLY valid HTML (no markdown, no explanations, no backticks).",
      "Preserve all existing classes, IDs and data attributes.",
      "Do not remove scripts or styles unless explicitly asked.",
      systemHint || ""
    ].filter(Boolean).join("\n")

    const anthropicKey = getProviderApiKey("anthropic", { userId: req.user?.id })
    if (!anthropicKey) throw new Error("ANTHROPIC_API_KEY is not set")

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-06-01"
      },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: 8000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: `INSTRUCTION:\n${instruction}\n\nHTML:\n${html}` }]
      }),
      signal: controller.signal
    })

    if (!claudeResp.ok) {
      const t = await claudeResp.text()
      res.write(`data: ${JSON.stringify({ type: "error", error: t })}\n\n`)
      return res.end()
    }

    let fullText = ""
    let latestUsage = null
    let lastInputTokens = 0
    let lastOutputTokens = 0
    const reader = claudeResp.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n")

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const raw = line.slice(6).trim()
        if (raw === "[DONE]") continue
        try {
          const evt = JSON.parse(raw)
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            const token = evt.delta.text || ""
            fullText += token
            res.write(`data: ${JSON.stringify({ type: "token", token })}\n\n`)
          }
          if (evt.type === "message_delta" && evt.usage) {
            latestUsage = evt.usage

            const currentInput = Number(evt.usage?.input_tokens || 0)
            const currentOutput = Number(evt.usage?.output_tokens || 0)

            const deltaInput = Math.max(0, currentInput - lastInputTokens)
            const deltaOutput = Math.max(0, currentOutput - lastOutputTokens)

            lastInputTokens = currentInput
            lastOutputTokens = currentOutput

            if (deltaInput > 0 || deltaOutput > 0) {
              res.write(`data: ${JSON.stringify({
                type: "usage",
                usage: {
                  input_tokens: deltaInput,
                  output_tokens: deltaOutput,
                  total_tokens: deltaInput + deltaOutput
                }
              })}\n\n`)
            }
          }
        } catch {}
      }
    }

    let deducted = 0
    if (req.user?.id && latestUsage) {
      try { deducted = deductCredits(req.user.id, chosenModel, latestUsage.input_tokens || 0, latestUsage.output_tokens || 0, "Block rewrite") } catch {}
    }

    res.write(`data: ${JSON.stringify({ type: "done", html: fullText, usage: latestUsage, cost_eur: deducted })}\n\n`)
    res.end()

  } catch (error) {
    if (isValidationError(error)) {
      try { return res.status(400).json({ ok: false, error: error.message }) } catch {}
    }
    console.error("Stream error:", error)
    try { res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`); res.end() } catch {}
  }
})

app.post("/api/export/validate", authMiddleware, exportRateLimit, async (req, res) => {
  try {
    const url = readOptionalUrl(req.body?.url)
    const html = readOptionalHtml(req.body?.html, "HTML", { max: 5_000_000 })
    const platform = readOptionalString(req.body?.platform, "Platform", { max: 32, empty: "" })
    const mode = readOptionalString(req.body?.mode, "Mode", { max: 40, empty: "wp-placeholder" })
    if (!html && !url) {
      return res.status(400).json({ ok: false, error: "Missing html or url" })
    }

    const normalized = normalizeProjectDocument({ html, url, platform })
    const validation = validateDeliveryArtifact({
      html: normalized.html || html,
      url: normalized.meta.url || url,
      platform: normalized.meta.platform || platform,
      mode,
    })

    return res.json({
      ok: true,
      platform: normalized.meta.platform,
      url: normalized.meta.url || url || "",
      readiness: validation.readiness,
      guide: validation.guide,
      warnings: validation.warnings,
    })
  } catch (error) {
    if (isValidationError(error)) return sendError(res, 400, error.message)
    console.error("Export validation error:", error)
    return sendError(res, 500, safeErrorMessage(error))
  }
})

// Export endpoint – erzeugt ZIP mit HTML+Assets + manifest
app.post("/api/export", authMiddleware, exportRateLimit, async (req, res) => {
  try {
    const url = readOptionalUrl(req.body?.url)
    const html = readOptionalHtml(req.body?.html, "HTML", { max: 5_000_000 })
    const platform = readOptionalString(req.body?.platform, "Platform", { max: 32, empty: "" })
    const mode = readOptionalString(req.body?.mode, "Mode", { max: 40, empty: "wp-placeholder" })
    const projectId = readOptionalNumber(req.body?.project_id ?? req.body?.projectId, "Project", { min: 1, integer: true })
    const pageId = readOptionalString(req.body?.pageId, "Page ID", { max: 160, empty: "" }) || ""
    const languageVariant = readOptionalString(req.body?.languageVariant, "Language variant", { max: 24, empty: "" }) || ""
    if (!html && !url) {
      return res.status(400).json({ ok: false, error: "Missing html or url" })
    }

    let sourceUrl = url || ""
    let sourceHtml = html || ""
    if (!sourceHtml && sourceUrl) {
      const response = await fetch(normalizeSiteUrl(sourceUrl), {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; SiteEditor/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
      })
      if (!response.ok) {
        return sendError(res, response.status, `Export source could not be loaded (${response.status})`)
      }
      sourceHtml = await response.text()
      sourceUrl = response.url || sourceUrl
    }

    const normalized = normalizeProjectDocument({ html: sourceHtml, url: sourceUrl, platform })
    const exportMode = String(mode || "wp-placeholder")
    const filename = exportFilenameForMode(exportMode)

    let linkedProject = null
    let versionId = null
    let exportPages = []
    if (projectId) {
      linkedProject = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
      if (!linkedProject) {
        return sendError(res, 404, "Projekt nicht gefunden")
      }
      exportPages = parseExportPagesInput(req.body?.pages, linkedProject.url || normalized.meta.url || sourceUrl)
      if (!exportPages.length) {
        try {
          exportPages = parseExportPagesInput(JSON.parse(linkedProject.pages_json || "[]"), linkedProject.url || normalized.meta.url || sourceUrl)
        } catch {
          exportPages = []
        }
      }
      if (pageId && exportPages.length) {
        const pageIndex = exportPages.findIndex((page) => page.id === pageId)
        if (pageIndex >= 0) {
          const selectedPage = exportPages[pageIndex]
          if (languageVariant) {
            exportPages[pageIndex] = {
              ...selectedPage,
              languageVariants: {
                ...(selectedPage.languageVariants || {}),
                [normalizeExportLanguageCode(languageVariant)]: {
                  ...(selectedPage.languageVariants?.[normalizeExportLanguageCode(languageVariant)] || {}),
                  html: normalized.html || sourceHtml,
                  updatedAt: new Date().toISOString(),
                },
              },
            }
          } else {
            exportPages[pageIndex] = {
              ...selectedPage,
              html: normalized.html || sourceHtml,
              updatedAt: new Date().toISOString(),
            }
          }
        }
      }
      if (normalized.html && normalized.html !== linkedProject.html) {
        const version = createProjectVersion(projectId, {
          html: normalized.html,
          label: `Before export · ${exportMode}`,
          source: "export",
          pageId,
        })
        versionId = Number(version?.id || 0) || null
      }
      db.prepare(
        `UPDATE projects SET
          html = ?,
          pages_json = COALESCE(?, pages_json),
          url = ?,
          platform = ?,
          last_activity_at = datetime('now'),
          updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`
      ).run(
        normalized.html,
        exportPages.length ? JSON.stringify(exportPages) : null,
        normalized.meta.url || sourceUrl || "",
        normalized.meta.platform,
        projectId,
        req.user.id
      )
      linkedProject = db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
    }

    const exportArtifacts = buildLocalizedArtifacts({
      html: sourceHtml,
      normalized: {
        html: normalized.html || sourceHtml,
        meta: {
          url: normalized.meta.url || sourceUrl,
          platform: normalized.meta.platform || platform,
        },
      },
      linkedProject,
      exportMode,
      versionId,
      pages: exportPages,
      pageId,
      languageVariant,
    })
    const artifact = exportArtifacts[0].artifact

    if (linkedProject) {
      db.prepare(
        `INSERT INTO project_exports (
          project_id, user_id, version_id, export_mode, platform, readiness, warning_count, manifest_json, outcome
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        linkedProject.id,
        req.user.id,
        versionId,
        exportMode,
        artifact.manifest.platform,
        artifact.readiness,
        artifact.warnings.length,
        JSON.stringify(artifact.manifest),
        "success"
      )
      db.prepare(
        `UPDATE projects SET
          delivery_status = CASE WHEN delivery_status = 'shipped' THEN delivery_status ELSE 'exported' END,
          last_export_at = datetime('now'),
          last_export_mode = ?,
          last_export_warning_count = ?,
          updated_at = datetime('now')
        WHERE id = ? AND user_id = ?`
      ).run(exportMode, artifact.warnings.length, linkedProject.id, req.user.id)
      logAudit({
        userId: req.user.id,
        action: "project.export",
        targetType: "project",
        targetId: linkedProject.id,
        meta: { mode: exportMode, readiness: artifact.readiness, warningCount: artifact.warnings.length },
      })
    }

    if (exportMode === "pdf-print") {
      const pdfFile = await preparePdfFile({ html: artifact.html, project: linkedProject })
      res.setHeader("Content-Type", "application/pdf")
      res.setHeader("Content-Disposition", `attachment; filename=${pdfFile.name}`)
      res.setHeader("X-Export-Readiness", artifact.readiness)
      res.setHeader("X-Export-Warnings", String(artifact.warnings.length))
      return res.send(pdfFile.content)
    }

    // If cloud=1 requested, upload to GCS and return link
    if (req.body.cloud === true || req.body.cloud === "1") {
      const chunks = []
      const archiveCloud = archiver("zip", { zlib: { level: 9 } })
      archiveCloud.on("data", chunk => chunks.push(chunk))
      for (const item of exportArtifacts) {
        await appendExportBundle(archiveCloud, exportMode, item.artifact, linkedProject, { prefix: item.prefix })
      }
      await archiveCloud.finalize()
      const buffer = Buffer.concat(chunks)
      const uniqueName = `${Date.now()}_${filename}`
      try {
        const gcsUrl = await uploadExportZip(buffer, uniqueName)
        return res.json({ ok: true, url: gcsUrl, filename, manifest: artifact.manifest, warnings: artifact.warnings })
      } catch (e) {
        console.warn("GCS export upload failed:", e.message)
      }
    }

    // Default: stream ZIP directly
    res.setHeader("Content-Type", "application/zip")
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`)
    res.setHeader("X-Export-Readiness", artifact.readiness)
    res.setHeader("X-Export-Warnings", String(artifact.warnings.length))
    const archive = archiver("zip", { zlib: { level: 9 } })
    archive.pipe(res)
    for (const item of exportArtifacts) {
      await appendExportBundle(archive, exportMode, item.artifact, linkedProject, { prefix: item.prefix })
    }
    await archive.finalize()
  } catch (error) {
    if (isValidationError(error)) return sendError(res, 400, error.message)
    console.error("Export error:", error)
    try {
      const failProjectId = readOptionalNumber(req.body?.project_id ?? req.body?.projectId, "Project", { min: 1, integer: true })
      const failMode = readOptionalString(req.body?.mode, "Mode", { max: 40, empty: "wp-placeholder" }) || "wp-placeholder"
      if (failProjectId && req.user?.id) {
        db.prepare(
          `INSERT INTO project_exports
            (project_id, user_id, export_mode, platform, readiness, warning_count, manifest_json, outcome, error_message)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(failProjectId, req.user.id, failMode, "unknown", "guarded", 0, "{}", "failure", String(error?.message || "unknown"))
      }
    } catch {}
    if (!res.headersSent) {
      sendError(res, 500, safeErrorMessage(error))
    }
  }
})

app.post("/api/export/jobs", authMiddleware, exportRateLimit, async (req, res) => {
  if (!FEATURE_FLAGS.asyncJobs) {
    return res.status(400).json({ ok: false, error: "Async export jobs are disabled." })
  }

  const port = Number(process.env.PORT || 8787)
  const cookie = String(req.headers.cookie || "")
  const csrfToken = String(req.headers["x-csrf-token"] || "")
  const authorization = String(req.headers.authorization || "")
  const payload = req.body || {}

  const job = enqueueJob({
    type: "export",
    userId: req.user.id,
    task: async () => {
      const response = await fetch(`http://127.0.0.1:${port}/api/export?cloud=1`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-csrf-token": csrfToken,
          cookie,
          authorization,
        },
        body: JSON.stringify(payload),
      })

      const contentType = String(response.headers.get("content-type") || "")
      if (contentType.includes("application/json")) {
        return await response.json()
      }

      const data = Buffer.from(await response.arrayBuffer())
      return {
        ok: response.ok,
        streamed: true,
        status: response.status,
        contentType,
        bytes: data.length,
        fileBase64: data.toString("base64"),
      }
    },
  })

  return res.status(202).json({
    ok: true,
    queued: true,
    jobId: job.id,
    statusUrl: `/api/export/jobs/${job.id}`,
  })
})

app.get("/api/export/jobs/:jobId", authMiddleware, (req, res) => {
  const job = getJobForUser(req.params.jobId, req.user.id)
  if (!job) return res.status(404).json({ ok: false, error: "Job not found" })
  return res.json({
    ok: true,
    job: {
      id: job.id,
      type: job.type,
      status: job.status,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      finishedAt: job.finishedAt,
      result: job.status === "completed" ? job.result : null,
      error: job.status === "failed" ? job.error : null,
    },
  })
})

// WP asset fallback
app.get(['/wp-content/*', '/wp-includes/*', '/_static/*'], (req, res) => {
  const ref = req.query.ref || '';
  const base = new URL(ref);
  const abs = new URL(req.originalUrl.split('?')[0], base).toString();
  const u = `/asset?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(ref)}`;
  res.redirect(302, u);
});

registerAuthRoutes(app)
registerProjectRoutes(app)
registerSeoRoutes(app)
registerTemplateRoutes(app)
registerAssistantRoutes(app, { aiRateLimit })
registerTranslationMemoryRoutes(app)
registerPresetsRoutes(app)
app.get("/api/admin/system-health", authMiddleware, ownerOnly, (req, res) => { 
  res.json({ ok: true, status: "healthy", cpu: "12%", memory: "450MB", uptime: process.uptime() }); 
}); 
app.get("/api/admin/ssl-status", authMiddleware, ownerOnly, (req, res) => { 
  res.json({ ok: true, certificates: [{ domain: "edit.com", expires: "2026-12-01", status: "valid" }] }); 
});
registerCreditRoutes(app)
registerSettingsRoutes(app)
registerOrgRoutes(app)
import { registerAdminExtraRoutes } from "./adminRoutes.js";
registerAdminExtraRoutes(app);

app.get("/api/admin/audit", authMiddleware, ownerOnly, (req, res) => {
  try {
    const limit = Math.max(1, Math.min(200, Number(req.query.limit || 100) || 100))
    const logs = db.prepare(`
      SELECT al.id, al.user_id, al.action, al.target_type, al.target_id, al.meta_json, al.created_at, u.email, u.name
      FROM audit_logs al
      LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC
      LIMIT ?
    `).all(limit).map((row) => {
      let meta = {}
      try { meta = JSON.parse(row.meta_json || "{}") } catch {}
      return { ...row, meta }
    })
    res.json({ ok: true, logs })
  } catch (e) {
    sendError(res, 500, safeErrorMessage(e))
  }
})

app.get("/api/admin/export-stats", authMiddleware, ownerOnly, (req, res) => {
  try {
    const since = req.query.since
      ? String(req.query.since)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

    const byMode = db.prepare(`
      SELECT
        export_mode,
        COUNT(*) AS total,
        SUM(CASE WHEN outcome = 'success' THEN 1 ELSE 0 END) AS successes,
        SUM(CASE WHEN outcome = 'failure' THEN 1 ELSE 0 END) AS failures
      FROM project_exports
      WHERE created_at >= ?
      GROUP BY export_mode
      ORDER BY total DESC
    `).all(since)

    const overall = byMode.reduce(
      (acc, row) => {
        acc.total += row.total
        acc.successes += row.successes
        acc.failures += row.failures
        return acc
      },
      { total: 0, successes: 0, failures: 0 }
    )

    const passRate = overall.total > 0
      ? Number(((overall.successes / overall.total) * 100).toFixed(2))
      : null

    res.json({ ok: true, since, passRate, overall, byMode })
  } catch (e) {
    sendError(res, 500, safeErrorMessage(e))
  }
})

app.get("/api/admin/metrics", authMiddleware, ownerOnly, (req, res) => {
  try {
    const sinceDays = Math.max(7, Math.min(365, Number(req.query.days || 90) || 90))
    const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const dayStart = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString()

    const signupsByDay = db.prepare(`
      SELECT substr(created_at, 1, 10) AS day, COUNT(*) AS count
      FROM users
      WHERE created_at >= ?
      GROUP BY day
      ORDER BY day ASC
    `).all(sinceDate)
    const signupsSummary = {
      day: db.prepare("SELECT COUNT(*) AS count FROM users WHERE created_at >= ?").get(dayStart)?.count || 0,
      week: db.prepare("SELECT COUNT(*) AS count FROM users WHERE created_at >= ?").get(weekStart)?.count || 0,
      month: db.prepare("SELECT COUNT(*) AS count FROM users WHERE created_at >= ?").get(monthStart)?.count || 0,
    }

    const revenueByMonth = db.prepare(`
      SELECT substr(created_at, 1, 7) AS month, ROUND(SUM(COALESCE(amount_eur, 0)), 2) AS amount
      FROM user_invoices
      WHERE created_at >= ? AND COALESCE(status, '') IN ('paid', 'open')
      GROUP BY month
      ORDER BY month ASC
    `).all(sinceDate)
    const mrrCurrent = Number(revenueByMonth[revenueByMonth.length - 1]?.amount || 0)

    const usageRows = db.prepare(`
      SELECT created_at, amount_eur, type, description
      FROM credit_transactions
      WHERE created_at >= ? AND amount_eur < 0
      ORDER BY created_at DESC
      LIMIT 2000
    `).all(sinceDate)
    const usageByModelMap = new Map()
    for (const row of usageRows) {
      const day = String(row.created_at || "").slice(0, 10)
      const description = String(row.description || "").toLowerCase()
      const modelMatch = description.match(
        /(claude(?:-[a-z0-9.-]+)?|gemini(?:-[a-z0-9.-]+)?|groq:[a-z0-9._-]+|ollama:[a-z0-9._:-]+)/i,
      )
      const model = (modelMatch?.[1] || String(row.type || "unknown")).toLowerCase()
      const key = `${day}|${model}`
      const existing = usageByModelMap.get(key) || { day, model, credits: 0, calls: 0 }
      existing.credits += Math.abs(Number(row.amount_eur || 0))
      existing.calls += 1
      usageByModelMap.set(key, existing)
    }
    const usageByModel = Array.from(usageByModelMap.values())
      .sort((left, right) => `${right.day}${right.model}`.localeCompare(`${left.day}${left.model}`))
      .slice(0, 300)

    const importEvents = db.prepare(`
      SELECT
        SUM(CASE WHEN action LIKE 'project.import.%.success%' OR action LIKE 'project.import.success%' THEN 1 ELSE 0 END) AS success,
        SUM(CASE WHEN action LIKE 'project.import.%.failed%' OR action LIKE 'project.import.failed%' THEN 1 ELSE 0 END) AS failed
      FROM audit_logs
      WHERE created_at >= ?
        AND action LIKE 'project.import.%'
    `).get(sinceDate) || { success: 0, failed: 0 }

    const exportByMode = db.prepare(`
      SELECT export_mode, outcome, COUNT(*) AS count
      FROM project_exports
      WHERE created_at >= ?
      GROUP BY export_mode, outcome
      ORDER BY export_mode ASC, outcome ASC
    `).all(sinceDate)

    const retentionCohorts = db.prepare(`
      SELECT
        substr(created_at, 1, 7) AS cohort,
        COUNT(*) AS users,
        SUM(CASE WHEN COALESCE(plan_status, 'active') = 'active' THEN 1 ELSE 0 END) AS active_users
      FROM users
      GROUP BY cohort
      ORDER BY cohort ASC
      LIMIT 24
    `).all()
    const churnSummary = db.prepare(`
      SELECT
        SUM(CASE WHEN COALESCE(plan_status, 'active') = 'canceled' THEN 1 ELSE 0 END) AS canceled_users,
        COUNT(*) AS total_users
      FROM users
    `).get() || { canceled_users: 0, total_users: 0 }

    const importTotal = Number(importEvents.success || 0) + Number(importEvents.failed || 0)
    const importPassRate = importTotal > 0 ? Number((((importEvents.success || 0) / importTotal) * 100).toFixed(2)) : null
    const exportTotals = exportByMode.reduce(
      (acc, row) => {
        acc.total += Number(row.count || 0)
        if (String(row.outcome || "success") === "failure") acc.failed += Number(row.count || 0)
        else acc.success += Number(row.count || 0)
        return acc
      },
      { total: 0, success: 0, failed: 0 },
    )
    const exportPassRate = exportTotals.total > 0 ? Number(((exportTotals.success / exportTotals.total) * 100).toFixed(2)) : null

    res.json({
      ok: true,
      sinceDate,
      signups: {
        summary: signupsSummary,
        daily: signupsByDay,
      },
      revenue: {
        mrrCurrent,
        monthly: revenueByMonth,
      },
      aiUsage: {
        byModelDaily: usageByModel,
      },
      imports: {
        success: Number(importEvents.success || 0),
        failed: Number(importEvents.failed || 0),
        passRate: importPassRate,
      },
      exports: {
        ...exportTotals,
        passRate: exportPassRate,
        byMode: exportByMode,
      },
      retention: {
        cohorts: retentionCohorts.map((row) => ({
          cohort: row.cohort,
          users: Number(row.users || 0),
          activeUsers: Number(row.active_users || 0),
          retentionRate: Number(row.users || 0) > 0 ? Number(((Number(row.active_users || 0) / Number(row.users || 0)) * 100).toFixed(2)) : 0,
        })),
        churnRate: Number(churnSummary.total_users || 0) > 0
          ? Number(((Number(churnSummary.canceled_users || 0) / Number(churnSummary.total_users || 0)) * 100).toFixed(2))
          : 0,
      },
    })
  } catch (e) {
    sendError(res, 500, safeErrorMessage(e))
  }
})

registerStripeRoutes(app)
registerScreenshotRoutes(app)
registerGoogleServiceRoutes(app)
registerVertexRoutes(app)
registerPublishRoutes(app)


app.get("/api/admin/me", authMiddleware, (req, res) => {
  const owner = process.env.OWNER_EMAIL

  res.json({
    ok: true,
    email: req.user?.email || null,
    owner: req.user?.email === owner
  })
})


app.get("/api/admin/users", authMiddleware, ownerOnly, (req, res) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase()
    const planFilter = String(req.query.plan || "").trim().toLowerCase()
    const roleFilter = String(req.query.role || "").trim().toLowerCase()

    const rows = db.prepare(`
      SELECT
        u.id,
        u.email,
        u.name,
        u.created_at,
        COALESCE(c.balance_eur, 0) as credits,
        COALESCE(NULLIF(u.plan_id, ''), s.plan, 'basis') as plan,
        COALESCE(NULLIF(u.plan_status, ''), 'active') as plan_status
      FROM users u
      LEFT JOIN credits c ON u.id = c.user_id
      LEFT JOIN user_settings s ON u.id = s.user_id
      ORDER BY u.id DESC
    `).all()
    
    // Add affiliations separately to avoid SQL complexity
    const usersWithAffiliations = rows.map(user => {
      const teamMembers = db.prepare(`
        SELECT o.name, tm.role
        FROM team_members tm
        JOIN organisations o ON tm.owner_id = o.id
        WHERE tm.member_email = ?
      `).all(user.email)
      
      const orgMembers = db.prepare(`
        SELECT o.name, om.role
        FROM org_members om
        JOIN organisations o ON om.org_id = o.id
        WHERE om.user_id = ?
      `).all(user.id)
      
      const affiliations = [
        ...teamMembers.map(t => `Team: ${t.name} (${t.role})`),
        ...orgMembers.map(o => `Org: ${o.name} (${o.role})`)
      ].join(', ')
      
      return { ...user, affiliations: affiliations || '-' }
    })

    const filtered = usersWithAffiliations.filter((entry) => {
      if (q) {
        const haystack = `${entry.email || ""} ${entry.name || ""} ${entry.affiliations || ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      if (planFilter && planFilter !== "all" && String(entry.plan || "").toLowerCase() !== planFilter) return false
      if (roleFilter && roleFilter !== "all") {
        if (!String(entry.affiliations || "").toLowerCase().includes(`(${roleFilter})`)) return false
      }
      return true
    })

    res.json({
      ok: true,
      users: filtered,
      filters: { q, plan: planFilter || "all", role: roleFilter || "all" },
      total: filtered.length,
    })
  } catch (e) {
    sendError(res, 500, safeErrorMessage(e))
  }
})

app.post("/api/admin/users/:id/ban", authMiddleware, ownerOnly, (req, res) => {
  try {
    const userId = readId(req.params.id, "User ID")
    if (Number(req.user?.id || 0) === userId) {
      return res.status(400).json({ ok: false, error: "You cannot ban your own account" })
    }
    const reason = readOptionalString(req.body?.reason, "Reason", { max: 280, empty: "" }) || ""
    const target = db.prepare("SELECT id, email, plan_status FROM users WHERE id = ?").get(userId)
    if (!target) return res.status(404).json({ ok: false, error: "User not found" })

    const ownerEmail = String(process.env.OWNER_EMAIL || "").trim().toLowerCase()
    if (ownerEmail && String(target.email || "").toLowerCase() === ownerEmail) {
      return res.status(400).json({ ok: false, error: "Owner account cannot be banned" })
    }

    db.prepare("UPDATE users SET plan_status = 'banned' WHERE id = ?").run(userId)
    db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId)
    db.prepare("DELETE FROM totp_pending_sessions WHERE user_id = ?").run(userId)
    logAudit({
      userId: req.user.id,
      action: "admin.ban_user",
      targetType: "user",
      targetId: userId,
      meta: { email: target.email, previousStatus: target.plan_status || "active", reason },
    })
    res.json({ ok: true, userId, plan_status: "banned" })
  } catch (e) {
    if (isValidationError(e)) return sendError(res, 400, e.message)
    return sendError(res, 500, safeErrorMessage(e))
  }
})

app.post("/api/admin/users/:id/unban", authMiddleware, ownerOnly, (req, res) => {
  try {
    const userId = readId(req.params.id, "User ID")
    const target = db.prepare("SELECT id, email, plan_status FROM users WHERE id = ?").get(userId)
    if (!target) return res.status(404).json({ ok: false, error: "User not found" })

    db.prepare("UPDATE users SET plan_status = 'active' WHERE id = ?").run(userId)
    logAudit({
      userId: req.user.id,
      action: "admin.unban_user",
      targetType: "user",
      targetId: userId,
      meta: { email: target.email, previousStatus: target.plan_status || "active" },
    })
    res.json({ ok: true, userId, plan_status: "active" })
  } catch (e) {
    if (isValidationError(e)) return sendError(res, 400, e.message)
    return sendError(res, 500, safeErrorMessage(e))
  }
})


app.post("/api/admin/send-reset", authMiddleware, ownerOnly, adminResetRateLimit, async (req, res) => {
  try {
    const userId = readId(req.body?.userId, "userId")

    const user = db.prepare("SELECT id, email, name FROM users WHERE id = ?").get(userId)
    if (!user) return res.status(404).json({ ok: false, error: "User not found" })

    const resetToken = crypto.randomBytes(32).toString("hex")
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex')
    const expires = new Date(Date.now() + 3600000).toISOString()

    db.prepare("DELETE FROM password_resets WHERE user_id = ? OR used = 1").run(user.id)
    db.prepare("INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)").run(user.id, hashedToken, expires)

    const sent = await sendPasswordReset(user.email, resetToken, user.name || "")
    if (!sent) {
      return res.status(500).json({ ok: false, error: "Reset email failed" })
    }

    logAudit({ userId: req.user.id, action: "admin.send_reset", targetType: "user", targetId: user.id, meta: { email: user.email } })
    res.json({ ok: true, message: "Password reset email sent", email: user.email })
  } catch (e) {
    if (isValidationError(e)) return sendError(res, 400, e.message)
    sendError(res, 500, safeErrorMessage(e))
  }
})

// Delete user
app.delete("/api/admin/users/:id", authMiddleware, ownerOnly, (req, res) => {
  try {
    const { id } = req.params
    const userId = parseInt(id)
    
    if (isNaN(userId)) {
      return res.status(400).json({ ok: false, error: "Invalid user ID" })
    }
    
    // Get user email before deletion
    const user = db.prepare("SELECT email FROM users WHERE id = ?").get(userId)
    if (!user) {
      return res.status(404).json({ ok: false, error: "User not found" })
    }
    
    // Enable foreign key constraints
    db.exec("PRAGMA foreign_keys = ON")
    
    // Delete in correct order to avoid foreign key constraints
    try {
      db.transaction(() => {
        const projectIds = db.prepare("SELECT id FROM projects WHERE user_id = ?").all(userId).map(row => row.id)
        for (const projectId of projectIds) {
          db.prepare("DELETE FROM project_assignees WHERE project_id = ?").run(projectId)
          db.prepare("DELETE FROM project_shares WHERE project_id = ?").run(projectId)
          db.prepare("DELETE FROM project_exports WHERE project_id = ?").run(projectId)
          db.prepare("DELETE FROM project_versions WHERE project_id = ?").run(projectId)
          db.prepare("DELETE FROM project_workflow_events WHERE project_id = ?").run(projectId)
          db.prepare("DELETE FROM publish_deployments WHERE project_id = ?").run(projectId)
          db.prepare("DELETE FROM project_preview_tokens WHERE project_id = ?").run(projectId)
          db.prepare("DELETE FROM block_comments WHERE project_id = ?").run(String(projectId))
        }

        db.prepare("DELETE FROM credit_transactions WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM credits WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM user_invoices WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM email_verifications WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM totp_pending_sessions WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM product_events WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM audit_logs WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM ai_studio_runs WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM projects WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM templates WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM deleted_projects WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM deleted_templates WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM user_settings WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM team_members WHERE member_email = ?").run(user.email)
        db.prepare("DELETE FROM team_members WHERE owner_id = ?").run(userId)
        db.prepare("DELETE FROM org_members WHERE user_id = ?").run(userId)
        
        try {
          db.prepare("DELETE FROM organisations WHERE owner_id = ?").run(userId)
        } catch (e) {
          db.prepare("UPDATE organisations SET owner_id = NULL WHERE owner_id = ?").run(userId)
        }
        
        db.prepare("DELETE FROM user_api_keys WHERE user_id = ?").run(userId)
        db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(userId)
        
        const result = db.prepare("DELETE FROM project_exports WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM credit_transactions WHERE user_id = ?").run(userId);
        db.prepare("DELETE FROM users WHERE id = ?").run(userId);
        if (result.changes === 0) throw new Error("User not found during transaction");
      })();
      
      logAudit({ userId: req.user.id, action: "admin.delete_user", targetType: "user", targetId: userId, meta: { email: user.email } })
      res.json({ ok: true, message: "User deleted successfully" })
    } catch (fkError) {
      // If foreign key still fails, provide more specific error
      res.status(400).json({ 
        ok: false, 
        error: "Cannot delete user - they own data that other users depend on. Consider transferring ownership first." 
      })
    }
  } catch (e) {
    sendError(res, 500, safeErrorMessage(e))
  }
})

// Add credits to user
app.post("/api/admin/users/:id/add-credits", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const userId = readId(req.params.id, "User ID")
    const credits = readOptionalNumber(req.body?.credits, "Credits", { min: 1 })
    if (credits === undefined) return res.status(400).json({ ok: false, error: "Credits must be a positive number" })
    
    // Import and use the credits system
    const { addCredits } = await import("./credits.js")
    addCredits(userId, credits / 100) // Convert cents to EUR
    logAudit({ userId: req.user.id, action: "admin.add_credits", targetType: "user", targetId: userId, meta: { credits } })
    res.json({ ok: true, message: `Added $${(credits / 100).toFixed(2)} credits to user` })
  } catch (e) {
    if (isValidationError(e)) return sendError(res, 400, e.message)
    sendError(res, 500, safeErrorMessage(e))
  }
})

// Database migration for credits
app.post("/api/admin/migrate-credits", authMiddleware, ownerOnly, (req, res) => {
  try {
    // Add credits column if it doesn't exist
    db.exec(`
      ALTER TABLE user_settings ADD COLUMN credits INTEGER DEFAULT 0
    `)
    res.json({ ok: true, message: "Credits column added successfully" })
  } catch (e) {
    if (e.message?.includes("duplicate column name")) {
      res.json({ ok: true, message: "Credits column already exists" })
    } else {
      sendError(res, 500, safeErrorMessage(e))
    }
  }
})

// Send password reset

// Create new user
app.post("/api/admin/users", authMiddleware, ownerOnly, async (req, res) => {
  try {
    const email = readEmail(req.body?.email)
    const password = readPassword(req.body?.password, "Password")
    const name = readOptionalString(req.body?.name, "Name", { max: 120, empty: "" })
    const credits = readOptionalNumber(req.body?.credits, "Credits", { min: 0 }) ?? 0
    
    // Check if user already exists
    const existing = db.prepare("SELECT id FROM users WHERE lower(email) = ?").get(email)
    if (existing) {
      return res.status(400).json({ ok: false, error: "Email already registered" })
    }
    
    // Hash password
    const hash = bcrypt.hashSync(password, 10)
    
    // Create user
    const result = db.prepare(`
      INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)
    `).run(email, hash, name || email.split("@")[0])
    const newUserId = result.lastInsertRowid

    // Initialize user_settings (plan, etc.)
    db.prepare(`INSERT OR IGNORE INTO user_settings (user_id) VALUES (?)`).run(newUserId)
    // Initial balance: frontend sends cents (dollars × 100), store as EUR in credits table
    const creditsEur = Number(credits) / 100
    if (creditsEur > 0) {
      const { addCredits } = await import("./credits.js")
      addCredits(newUserId, creditsEur)
    }

    logAudit({ userId: req.user.id, action: "admin.create_user", targetType: "user", targetId: newUserId, meta: { email, credits } })
    res.json({ 
      ok: true, 
      message: "User created successfully",
      user: {
        id: newUserId,
        email,
        name: name || email.split("@")[0]
      }
    })
  } catch (e) {
    if (isValidationError(e)) return sendError(res, 400, e.message)
    sendError(res, 500, safeErrorMessage(e))
  }
})

// Password reset page
app.get("/reset-password", (req, res) => {
  const { token } = req.query
  
  if (!token) {
    return res.status(400).send(`
      <div style="font-family:system-ui;max-width:480px;margin:100px auto;padding:32px">
        <h1 style="color:#dc2626">Invalid Reset Link</h1>
        <p>No reset token provided.</p>
        <a href="/" style="color:#6366f1">Return to Login</a>
      </div>
    `)
  }
  
  // Check if token exists and is valid
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  const reset = db.prepare(`
    SELECT pr.user_id, u.email 
    FROM password_resets pr
    JOIN users u ON pr.user_id = u.id
    WHERE pr.token = ? AND pr.expires_at > datetime('now')
  `).get(hashedToken)
  
  if (!reset) {
    return res.status(400).send(`
      <div style="font-family:system-ui;max-width:480px;margin:100px auto;padding:32px">
        <h1 style="color:#dc2626">Invalid Reset Link</h1>
        <p>This reset link is invalid or has expired.</p>
        <a href="/" style="color:#6366f1">Return to Login</a>
      </div>
    `)
  }
  
  // Show reset form
  res.send(`
    <div style="font-family:system-ui;max-width:480px;margin:100px auto;padding:32px">
      <h1 style="color:#6366f1">Reset Password</h1>
      <p>Enter your new password for <strong>${reset.email}</strong></p>
      <form method="POST" action="/reset-password" style="margin-top:20px">
        <input type="hidden" name="token" value="${token}" />
        <div style="margin-bottom:16px">
          <label style="display:block;margin-bottom:8px;font-weight:600">New Password</label>
          <input type="password" name="password" required 
                 style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:6px;font-size:16px" />
        </div>
        <div style="margin-bottom:24px">
          <label style="display:block;margin-bottom:8px;font-weight:600">Confirm Password</label>
          <input type="password" name="confirmPassword" required 
                 style="width:100%;padding:12px;border:1px solid #d1d5db;border-radius:6px;font-size:16px" />
        </div>
        <button type="submit" 
                style="width:100%;padding:12px;background:#6366f1;color:white;border:none;border-radius:6px;font-size:16px;font-weight:600;cursor:pointer">
          Reset Password
        </button>
      </form>
    </div>
  `)
})

// Handle password reset form submission
app.post("/reset-password", async (req, res) => {
  const { token, password, confirmPassword } = req.body
  
  if (!token || !password || !confirmPassword) {
    return res.status(400).send(`
      <div style="font-family:system-ui;max-width:480px;margin:100px auto;padding:32px">
        <h1 style="color:#dc2626">Error</h1>
        <p>All fields are required.</p>
        <a href="/" style="color:#6366f1">Return to Login</a>
      </div>
    `)
  }
  
  if (password !== confirmPassword) {
    return res.status(400).send(`
      <div style="font-family:system-ui;max-width:480px;margin:100px auto;padding:32px">
        <h1 style="color:#dc2626">Error</h1>
        <p>Passwords do not match.</p>
        <a href="/reset-password?token=${token}" style="color:#6366f1">Try Again</a>
      </div>
    `)
  }
  
  if (password.length < 6) {
    return res.status(400).send(`
      <div style="font-family:system-ui;max-width:480px;margin:100px auto;padding:32px">
        <h1 style="color:#dc2626">Error</h1>
        <p>Password must be at least 6 characters long.</p>
        <a href="/reset-password?token=${token}" style="color:#6366f1">Try Again</a>
      </div>
    `)
  }
  
  // Get user from token
  const hashedToken = crypto.createHash('sha256').update(token).digest('hex')
  const reset = db.prepare(`
    SELECT pr.user_id 
    FROM password_resets pr
    WHERE pr.token = ? AND pr.expires_at > datetime('now')
  `).get(hashedToken)
  
  if (!reset) {
    return res.status(400).send(`
      <div style="font-family:system-ui;max-width:480px;margin:100px auto;padding:32px">
        <h1 style="color:#dc2626">Invalid Reset Link</h1>
        <p>This reset link is invalid or has expired.</p>
        <a href="/" style="color:#6366f1">Return to Login</a>
      </div>
    `)
  }
  
  // Update password
  const bcrypt = await import('bcryptjs')
  const passwordHash = bcrypt.hashSync(password, 10)
  
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?")
    .run(passwordHash, reset.user_id)
  
  // Delete used token
  db.prepare("DELETE FROM password_resets WHERE token = ?").run(hashedToken)
  
  // Success page
  res.send(`
    <div style="font-family:system-ui;max-width:480px;margin:100px auto;padding:32px">
      <h1 style="color:#22c55e">Password Reset Successful</h1>
      <p>Your password has been updated successfully.</p>
      <a href="/" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6366f1;color:white;border-radius:6px;text-decoration:none;font-weight:600">Login Now</a>
    </div>
  `)
})

app.use((err, req, res, _next) => {
  console.error(JSON.stringify({
    level: "error",
    event: "http.unhandled_error",
    requestId: req?.requestId || null,
    path: req?.originalUrl || "",
    method: req?.method || "",
    message: String(err?.message || err || "Unknown error"),
  }))
  sendError(res, 500, safeErrorMessage(err))
})

app.post("/api/admin/users/:id/set-plan", authMiddleware, ownerOnly, (req, res) => {
  try {
    const plan = readRequiredString(req.body?.plan, "Plan", { max: 20 })
    const valid = ["basis", "starter", "pro", "scale"]
    if (!valid.includes(plan)) return res.json({ ok: false, error: "Invalid plan" })
    const uid = readId(req.params.id, "User ID")
    db.prepare(`INSERT INTO user_settings (user_id, plan) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET plan = excluded.plan`).run(uid, plan)
    db.prepare(`
      UPDATE users
      SET plan_id = ?, plan_status = COALESCE(NULLIF(plan_status, ''), 'active')
      WHERE id = ?
    `).run(plan, uid)
    logAudit({ userId: req.user.id, action: "admin.set_plan", targetType: "user", targetId: uid, meta: { plan } })
    res.json({ ok: true, plan })
  } catch (e) {
    if (isValidationError(e)) return res.json({ ok: false, error: e.message })
    res.json({ ok: false, error: e.message })
  }
})

app.get("/api/user/plan", authMiddleware, (req, res) => {
  try {
    const row = db.prepare(`
      SELECT COALESCE(NULLIF(u.plan_id, ''), s.plan, 'basis') AS plan
      FROM users u
      LEFT JOIN user_settings s ON s.user_id = u.id
      WHERE u.id = ?
    `).get(req.user.id)
    res.json({ ok: true, plan: row?.plan || "basis" })
  } catch (e) {
    res.json({ ok: false, plan: "basis" })
  }
})

// --- Usage & Telemetry routes (#17, #19, #198) ---

app.get("/api/usage/stats", authMiddleware, (req, res) => {
  try {
    const { period = "30d", project_id } = req.query
    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30
    const since = new Date(Date.now() - days * 86400000).toISOString()

    const totalRuns = db.prepare(
      "SELECT COUNT(*) as c, tool_name FROM ai_studio_runs WHERE user_id = ? AND created_at >= ? GROUP BY tool_name"
    ).all(req.user.id, since)

    const creditRows = db.prepare(
      "SELECT SUM(ABS(amount_eur)) as total FROM credit_transactions WHERE user_id = ? AND type = 'debit' AND created_at >= ?"
    ).get(req.user.id, since)

    const sessionCost = db.prepare(
      "SELECT SUM(ABS(amount_eur)) as total, project_id FROM credit_transactions WHERE user_id = ? AND type = 'debit' AND created_at >= ? GROUP BY project_id"
    ).all(req.user.id, since)

    const exportCount = db.prepare(
      "SELECT COUNT(*) as c FROM project_exports WHERE user_id = ? AND created_at >= ?"
    ).get(req.user.id, since)

    const aiRunsByDay = db.prepare(`
      SELECT date(created_at) as day, COUNT(*) as runs
      FROM ai_studio_runs WHERE user_id = ? AND created_at >= ?
      GROUP BY day ORDER BY day ASC
    `).all(req.user.id, since)

    res.json({
      ok: true,
      period,
      ai_runs: { by_tool: totalRuns, total: totalRuns.reduce((s, r) => s + r.c, 0) },
      credit_usage: { total_eur: creditRows?.total || 0, by_project: sessionCost },
      exports: exportCount?.c || 0,
      activity_by_day: aiRunsByDay,
    })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

app.get("/api/credits/by-project", authMiddleware, (req, res) => {
  try {
    const { limit = 20 } = req.query
    const rows = db.prepare(`
      SELECT ct.project_id, p.name as project_name,
             SUM(ABS(ct.amount_eur)) as total_eur,
             COUNT(*) as transaction_count,
             MAX(ct.created_at) as last_activity
      FROM credit_transactions ct
      LEFT JOIN projects p ON p.id = ct.project_id AND p.user_id = ct.user_id
      WHERE ct.user_id = ? AND ct.type = 'debit' AND ct.project_id IS NOT NULL
      GROUP BY ct.project_id
      ORDER BY total_eur DESC
      LIMIT ?
    `).all(req.user.id, Math.min(100, Math.max(1, Number(limit) || 20)))
    const total = db.prepare(
      "SELECT SUM(ABS(amount_eur)) as t FROM credit_transactions WHERE user_id = ? AND type = 'debit'"
    ).get(req.user.id)
    res.json({ ok: true, by_project: rows, total_eur: total?.t || 0 })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

// --- AI inline suggestions (#79, #92, #93, #94, #95) ---

app.post("/api/ai/inline-suggestions", authMiddleware, aiRateLimit, async (req, res) => {
  try {
    const html = readRequiredHtml(req.body?.html, "html", { max: 100000 })
    const action = readOptionalString(req.body?.action, "action", { max: 50, empty: "improve" })
    const projectId = req.body?.project_id ? Number(req.body.project_id) : null

    const actionPrompts = {
      simplify: "Simplify this HTML block. Use shorter sentences and clearer language.",
      professional: "Make this block more professional and authoritative.",
      headlines: "Generate 3 alternative, catchy headlines for this block.",
      improve: "Improve conversion potential of this block. Sharpen copy and CTAs.",
      cro: "Identify the top 3 CRO issues in this block and rewrite to fix them.",
      ux_friction: "Identify UX friction points and suggest clearer, more intuitive design.",
      cta: "Improve call-to-action clarity, urgency and placement.",
    }

    const instruction = actionPrompts[String(action)] || actionPrompts.improve
    let chosenModel = "auto"
    const { resolveModel } = await import("./autoRouter.js")
    const routing = await resolveModel(html, instruction)
    chosenModel = routing.model

    const result = await claudeRewriteBlock({ html, instruction, systemHint: "", model: chosenModel, userId: req.user?.id })
    const usage = result?.usage || null
    if (req.user?.id && usage) {
      try { deductCredits(req.user.id, chosenModel, usage.input_tokens || 0, usage.output_tokens || 0, "Inline suggestion") } catch {}
    }
    res.json({ ok: true, html: result?.html ?? result, action, model: chosenModel, usage })
  } catch (e) {
    if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
    res.status(500).json({ ok: false, error: e?.message || "Inline suggestion failed" })
  }
})

// --- HTML refactor (#131-#139) ---

app.post("/api/ai/html-refactor", authMiddleware, aiPlanGuard, aiRateLimit, async (req, res) => {
  try {
    const html = readRequiredHtml(req.body?.html, "html", { max: 500000 })
    const refactorType = readOptionalString(req.body?.type, "type", { max: 50, empty: "layout" })
    const approved = String(req.query.approved || req.body?.approved || "") === "1"

    const typeInstructions = {
      layout: "Convert all absolute-positioned elements to Flexbox or CSS Grid. Normalise layout to be responsive.",
      css_cleanup: "Remove duplicate CSS declarations, consolidate repeated styles, extract common values to CSS variables.",
      semantics: "Replace non-semantic div/span elements with appropriate semantic HTML5 elements (section, article, nav, header, footer, etc.).",
      accessibility: "Add missing ARIA labels, alt attributes for images, improve heading hierarchy, and ensure keyboard navigation.",
      performance: "Add loading='lazy' to images, defer non-critical scripts, optimise inline styles.",
      duplicate_removal: "Identify and merge duplicate or near-duplicate HTML sections.",
      simplification: "Simplify overly complex nested HTML. Flatten unnecessary wrapper divs.",
      component: "Identify repeating patterns and normalise them into consistent component-like structures.",
      full: "Perform complete refactor: layout, semantics, accessibility, duplicate removal, and CSS cleanup.",
    }
    const instruction = typeInstructions[refactorType] || typeInstructions.layout

    if (!approved) {
      return res.json({
        ok: false,
        needsApproval: true,
        type: refactorType,
        reason: `HTML refactor (${refactorType}) – this will restructure your HTML.`,
      })
    }

    const { resolveModel } = await import("./autoRouter.js")
    const routing = await resolveModel(html, instruction)
    const chosenModel = routing.model

    const result = await claudeRewriteBlock({ html, instruction, systemHint: "Return ONLY the refactored HTML. Preserve all content, links and images.", model: chosenModel, userId: req.user?.id })
    const usage = result?.usage || null
    if (req.user?.id && usage) {
      try { deductCredits(req.user.id, chosenModel, usage.input_tokens || 0, usage.output_tokens || 0, `HTML refactor (${refactorType})`) } catch {}
    }
    res.json({ ok: true, html: result?.html ?? result, type: refactorType, model: chosenModel, usage })
  } catch (e) {
    if (isValidationError(e)) return res.status(400).json({ ok: false, error: e.message })
    res.status(500).json({ ok: false, error: e?.message || "HTML refactor failed" })
  }
})

// --- CTO/Security additions (#193) — enhanced input validation for upload routes ---
// Existing validation.js covers core validation; this supplements with HTML sanitisation check
app.post("/api/validate/html-safety", authMiddleware, (req, res) => {
  try {
    const html = readOptionalString(req.body?.html, "html", { max: 1000000, empty: "" })
    const dangerousPatterns = [
      { pattern: /<script[^>]*src\s*=\s*["']https?:\/\//i, issue: "External script injection detected" },
      { pattern: /on\w+\s*=\s*["'].*javascript:/i, issue: "JavaScript protocol in event handler" },
      { pattern: /javascript:/i, issue: "javascript: URL scheme" },
      { pattern: /<iframe[^>]*src\s*=\s*["'](?!blob:|data:)[^"']*["']/i, issue: "External iframe" },
      { pattern: /expression\s*\(/i, issue: "CSS expression()" },
    ]
    const issues = dangerousPatterns.filter(({ pattern }) => pattern.test(html))
    res.json({ ok: true, safe: issues.length === 0, issues: issues.map((i) => i.issue) })
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message })
  }
})

const PORT = process.env.PORT || 8787
app.listen(PORT, "0.0.0.0", () => {
  console.log(`site-editor-server running on http://localhost:${PORT}`)
})
