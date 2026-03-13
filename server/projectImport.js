import path from "node:path"
import { JSDOM } from "jsdom"
import { normalizeProjectDocument, normalizeSiteUrl } from "./siteMeta.js"
import { getProviderApiKey } from "./providerKeys.js"

const MAX_SITE_PAGES = 16
const MAX_SITEMAP_FILES = 6
const HTML_FILE_EXTENSIONS = new Set([".html", ".htm"])
const HTML_LIKE_FILE_EXTENSIONS = new Set([
  ".html", ".htm", ".xhtml",
  ".php", ".phtml", ".php5",
  ".liquid", ".twig", ".njk", ".nunjucks",
  ".hbs", ".handlebars", ".mustache", ".ejs", ".erb",
  ".aspx", ".jsp",
])
const TEXT_FILE_EXTENSIONS = new Set([".md", ".markdown", ".txt"])
const IMAGE_FILE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".ico"])
const MEDIA_FILE_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg"])
const FONT_FILE_EXTENSIONS = new Set([".woff", ".woff2", ".ttf", ".otf", ".eot"])
const CSS_FILE_EXTENSIONS = new Set([".css"])
const SCRIPT_FILE_EXTENSIONS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".jsx"])
const NON_PAGE_TEMPLATE_NAMES = new Set([
  "header",
  "footer",
  "functions",
  "function",
  "style",
  "styles",
  "scripts",
  "script",
  "nav",
  "navbar",
  "menu",
  "sidebar",
  "layout",
  "_layout",
  "_app",
  "_document",
  "app",
  "document",
  "snippet",
  "snippets",
  "partial",
  "partials",
])
const PAGE_SKIP_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
  ".pdf", ".zip", ".xml", ".json", ".txt", ".css", ".js",
  ".mp4", ".mov", ".mp3", ".wav", ".webm", ".woff", ".woff2", ".ttf", ".eot", ".otf",
])
const HOMEPAGE_TEMPLATE_NAMES = new Set(["index", "home", "homepage", "front-page", "front_page", "landing"])
const CONTENT_SOURCE_SEGMENTS = new Set(["text", "texts", "copy", "content", "contents", "locale", "locales", "i18n", "translations"])
const WORDPRESS_THEME_SIGNALS = new Set([
  "functions.php",
  "style.css",
  "front-page.php",
  "home.php",
  "page.php",
  "single.php",
  "archive.php",
  "theme.json",
])
const WORDPRESS_SUPPORT_NAMES = new Set(["functions", "header", "footer", "sidebar", "comments", "searchform", "theme", "screenshot"])
const SHOPIFY_THEME_SEGMENTS = new Set(["sections", "snippets", "templates", "layout", "config"])
const LOCALE_FILE_PATTERN = /(?:^|[._-])(en|de|fr|es|it|nl|pt|pl|cs|sv|no|da|fi|tr|ro|hu|el|ar|he|ja|ko|zh|uk|ru)(?:[._-]|$)/i
const MAX_AI_IMPORT_FILES = 36
const MAX_AI_SNIPPET_LENGTH = 3600
const MAX_URL_IMPORT_ASSETS = 180
const MAX_URL_IMPORT_ASSET_BYTES = 2_000_000
const MAX_URL_IMPORT_TOTAL_BYTES = 20_000_000
const MAX_CUSTOM_IMPORT_HEADERS = 12
const BLOCKED_IMPORT_HEADERS = new Set([
  "host",
  "content-length",
  "connection",
  "upgrade",
  "transfer-encoding",
])
const FIGMA_FRAME_HINT_PATTERN = /(figma|frame|desktop|mobile|tablet|screen|artboard|variant)/i
const IMPORT_ANALYSIS_MODEL = "claude-sonnet-4-6"

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function isTestRuntime() {
  if (String(process.env.NODE_ENV || "").toLowerCase() === "test") return true
  return process.argv.includes("--test")
}

function readLimitedText(value, max = 4000) {
  return cleanText(value).slice(0, Math.max(0, max))
}

function normalizeImportHeaderName(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 80)
}

function parseImportRequestOverrides(raw = {}) {
  const basicAuth = raw?.basicAuth && typeof raw.basicAuth === "object"
    ? {
        username: readLimitedText(raw.basicAuth.username, 200),
        password: String(raw.basicAuth.password || "").slice(0, 500),
      }
    : null

  const cookie = String(raw?.cookie || "").trim().slice(0, 6000)
  const headersInput = Array.isArray(raw?.headers) ? raw.headers : []
  const headers = []
  for (const item of headersInput.slice(0, MAX_CUSTOM_IMPORT_HEADERS)) {
    const key = normalizeImportHeaderName(item?.key)
    const value = String(item?.value || "").trim().slice(0, 1000)
    if (!key || !value || BLOCKED_IMPORT_HEADERS.has(key)) continue
    headers.push({ key, value })
  }

  return {
    basicAuth: basicAuth && basicAuth.username ? basicAuth : null,
    cookie: cookie || "",
    headers,
  }
}

function buildImportRequestHeaders(overrides = {}, options = {}) {
  const headers = {
    "User-Agent": "Mozilla/5.0 (compatible; SiteEditor/1.0)",
    Accept: options.accept || "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  }

  if (options.referer) headers.Referer = String(options.referer)
  if (overrides.cookie) headers.Cookie = overrides.cookie
  if (overrides.basicAuth?.username) {
    headers.Authorization = `Basic ${Buffer.from(`${overrides.basicAuth.username}:${overrides.basicAuth.password || ""}`).toString("base64")}`
  }
  for (const pair of overrides.headers || []) {
    headers[pair.key] = pair.value
  }
  return headers
}

function detectImportedAssetKind(url = "", mimeType = "") {
  const lowerMime = String(mimeType || "").toLowerCase()
  const lowerUrl = String(url || "").toLowerCase()
  if (lowerMime.startsWith("image/") || IMAGE_FILE_EXTENSIONS.has(path.extname(lowerUrl))) return "image"
  if (lowerMime.startsWith("font/") || FONT_FILE_EXTENSIONS.has(path.extname(lowerUrl))) return "font"
  if (lowerMime.includes("css") || CSS_FILE_EXTENSIONS.has(path.extname(lowerUrl))) return "style"
  if (lowerMime.includes("javascript") || SCRIPT_FILE_EXTENSIONS.has(path.extname(lowerUrl))) return "script"
  if (lowerMime.startsWith("video/") || lowerMime.startsWith("audio/") || MEDIA_FILE_EXTENSIONS.has(path.extname(lowerUrl))) return "media"
  return "asset"
}

function shouldSkipImportAssetReference(value) {
  const ref = String(value || "").trim()
  if (!ref) return true
  return /^(data:|mailto:|tel:|javascript:|#)/i.test(ref)
}

function resolveImportAssetUrl(candidate, baseUrl) {
  const ref = String(candidate || "").trim()
  if (!ref || shouldSkipImportAssetReference(ref)) return ""
  try {
    if (ref.startsWith("//")) {
      const base = new URL(baseUrl)
      return new URL(`${base.protocol}${ref}`).toString()
    }
    return new URL(ref, baseUrl).toString()
  } catch {
    return ""
  }
}

async function replaceAsync(value, pattern, replacer) {
  const source = String(value || "")
  const matches = Array.from(source.matchAll(pattern))
  if (!matches.length) return source
  let output = ""
  let lastIndex = 0
  for (const match of matches) {
    output += source.slice(lastIndex, match.index)
    output += await replacer(...match)
    lastIndex = match.index + match[0].length
  }
  output += source.slice(lastIndex)
  return output
}

function stripHtml(value) {
  return cleanText(String(value || "").replace(/<[^>]+>/g, " "))
}

function decodeXmlEntities(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function readBase64Buffer(contentBase64) {
  return Buffer.from(String(contentBase64 || ""), "base64")
}

function guessMimeType(name, explicit = "") {
  if (explicit) return explicit
  const ext = path.extname(String(name || "")).toLowerCase()
  if (HTML_FILE_EXTENSIONS.has(ext)) return "text/html"
  if (HTML_LIKE_FILE_EXTENSIONS.has(ext)) return "text/html"
  if (ext === ".svg") return "image/svg+xml"
  if (CSS_FILE_EXTENSIONS.has(ext)) return "text/css"
  if (SCRIPT_FILE_EXTENSIONS.has(ext)) return "application/javascript"
  if (TEXT_FILE_EXTENSIONS.has(ext)) return "text/plain"
  if ([".png"].includes(ext)) return "image/png"
  if ([".jpg", ".jpeg"].includes(ext)) return "image/jpeg"
  if ([".gif"].includes(ext)) return "image/gif"
  if ([".webp"].includes(ext)) return "image/webp"
  if ([".ico"].includes(ext)) return "image/x-icon"
  if ([".mp4"].includes(ext)) return "video/mp4"
  if ([".webm"].includes(ext)) return "video/webm"
  if ([".mov"].includes(ext)) return "video/quicktime"
  if ([".mp3"].includes(ext)) return "audio/mpeg"
  if ([".wav"].includes(ext)) return "audio/wav"
  if ([".ogg"].includes(ext)) return "audio/ogg"
  if ([".woff"].includes(ext)) return "font/woff"
  if ([".woff2"].includes(ext)) return "font/woff2"
  if ([".ttf"].includes(ext)) return "font/ttf"
  if ([".otf"].includes(ext)) return "font/otf"
  if ([".pdf"].includes(ext)) return "application/pdf"
  if ([".docx"].includes(ext)) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  if ([".zip"].includes(ext)) return "application/zip"
  return "application/octet-stream"
}

function dataUrlFromBuffer(buffer, mimeType) {
  return `data:${mimeType};base64,${Buffer.from(buffer).toString("base64")}`
}

function pathToPageId(filePath) {
  const normalized = String(filePath || "").replace(/^\/+|\/+$/g, "").replace(/\.[a-z0-9]+$/i, "")
  if (!normalized) return "home"
  return normalized.replace(/[^\w]+/g, "-").replace(/^-+|-+$/g, "") || "page"
}

function filePathToPagePath(filePath) {
  const normalized = String(filePath || "").replace(/^\/+/, "")
  if (!normalized || /^(index|home)\.[a-z0-9]+$/i.test(normalized)) return "/"
  const withoutExt = normalized.replace(/\.[a-z0-9]+$/i, "")
  return `/${withoutExt}`.replace(/\/index$/i, "/").replace(/\/{2,}/g, "/")
}

function pathToTitle(filePath) {
  const pathName = filePathToPagePath(filePath)
  if (pathName === "/") return "Home"
  const segment = pathName.split("/").filter(Boolean).pop() || "Page"
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase())
}

function buildPageRecord({ id, name, title = "", path: pagePath, url = "", html = "", seo = null, semantic = null }) {
  return {
    id,
    name,
    title,
    path: pagePath,
    url,
    html,
    seo,
    semantic,
    updatedAt: "",
    scannedAt: new Date().toISOString(),
  }
}

function normalizeEntryPath(entryName) {
  const raw = String(entryName || "")
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
  const normalized = path.posix.normalize(raw).replace(/^(\.\.(\/|$))+/, "")
  return normalized === "." ? "" : normalized
}

function stripCommonRootPrefix(filePath, rootPrefix = "") {
  const normalized = normalizeEntryPath(filePath)
  const prefix = normalizeEntryPath(rootPrefix)
  if (!prefix) return normalized
  return normalized.startsWith(`${prefix}/`) ? normalized.slice(prefix.length + 1) : normalized
}

function detectCommonRootPrefix(paths) {
  const segments = Array.isArray(paths)
    ? paths
        .map((entry) => normalizeEntryPath(entry).split("/").filter(Boolean))
        .filter((parts) => parts.length > 1)
    : []
  if (!segments.length) return ""
  const [first] = segments
  const root = first[0]
  if (!root) return ""
  if (segments.every((parts) => parts[0] === root)) return root
  return ""
}

function detectLocaleCode(filePath) {
  const match = stripCommonRootPrefix(filePath).match(LOCALE_FILE_PATTERN)
  return match?.[1]?.toLowerCase() || ""
}

function humanizeLocaleCode(code) {
  const value = String(code || "").toLowerCase()
  if (!value) return ""
  return (
    {
      en: "English",
      de: "German",
      fr: "French",
      es: "Spanish",
      it: "Italian",
      nl: "Dutch",
      pt: "Portuguese",
      pl: "Polish",
      cs: "Czech",
      sv: "Swedish",
      no: "Norwegian",
      da: "Danish",
      fi: "Finnish",
      tr: "Turkish",
      ro: "Romanian",
      hu: "Hungarian",
      el: "Greek",
      ar: "Arabic",
      he: "Hebrew",
      ja: "Japanese",
      ko: "Korean",
      zh: "Chinese",
      uk: "Ukrainian",
      ru: "Russian",
    }[value] || value.toUpperCase()
  )
}

function decodeReference(ref) {
  try {
    return decodeURIComponent(ref)
  } catch {
    return ref
  }
}

function resolveEntryReference(basePath, candidate) {
  const raw = String(candidate || "").trim()
  if (!raw || /^(data:|https?:|mailto:|tel:|javascript:|#)/i.test(raw)) return ""
  const [withoutHash] = raw.split("#")
  const [withoutQuery] = withoutHash.split("?")
  const cleaned = decodeReference(withoutQuery)
  if (!cleaned) return ""
  if (cleaned.startsWith("/")) return normalizeEntryPath(cleaned)
  return normalizeEntryPath(path.posix.join(path.posix.dirname(basePath), cleaned))
}

function inlineCssAssetUrls(cssText, basePath, assets) {
  return String(cssText || "").replace(/url\(([^)]+)\)/gi, (match, inner) => {
    const raw = String(inner || "").trim().replace(/^['"]|['"]$/g, "")
    const resolved = resolveEntryReference(basePath, raw)
    const asset = resolved ? assets.get(resolved) : null
    if (!asset) return match
    return `url("${asset.dataUrl}")`
  })
}

function inlineHtmlAssets(html, filePath, assets, textEntries) {
  let output = String(html || "")

  output = output.replace(/<link\b([^>]*?)\bhref=(["'])([^"']+)\2([^>]*)>/gi, (match, before = "", _quote, href = "", after = "") => {
    const resolved = resolveEntryReference(filePath, href)
    const cssEntry = resolved ? textEntries.get(resolved) : null
    if (!cssEntry || !CSS_FILE_EXTENSIONS.has(path.extname(resolved).toLowerCase())) return match
    return `<style data-imported-from="${escapeHtml(resolved)}">${inlineCssAssetUrls(cssEntry.text, resolved, assets)}</style>`
  })

  output = output.replace(/(<(?:img|source|video|audio)\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi, (match, prefix, quote, src) => {
    const resolved = resolveEntryReference(filePath, src)
    const asset = resolved ? assets.get(resolved) : null
    if (!asset) return match
    return `${prefix}${quote}${asset.dataUrl}${quote}`
  })

  output = output.replace(/\ssrcset=(["'])([^"']+)\1/gi, (match, _quote, value = "") => {
    const rewritten = value
      .split(",")
      .map((part) => {
        const [src, descriptor] = part.trim().split(/\s+/, 2)
        const resolved = resolveEntryReference(filePath, src)
        const asset = resolved ? assets.get(resolved) : null
        if (!asset) return part.trim()
        return descriptor ? `${asset.dataUrl} ${descriptor}` : asset.dataUrl
      })
      .join(", ")
    return ` srcset="${rewritten}"`
  })

  output = output.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (match, quote, value) => {
    return ` style=${quote}${inlineCssAssetUrls(value, filePath, assets)}${quote}`
  })

  output = output.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (match, attrs = "", css = "") => {
    return `<style${attrs}>${inlineCssAssetUrls(css, filePath, assets)}</style>`
  })

  return output
}

async function localizeCssUrlsFromWeb(cssText, cssUrl, context, depth = 0) {
  if (depth > 2) return String(cssText || "")
  return replaceAsync(String(cssText || ""), /url\(([^)]+)\)/gi, async (match, inner = "") => {
    const raw = String(inner || "").trim().replace(/^['"]|['"]$/g, "")
    const resolved = resolveImportAssetUrl(raw, cssUrl)
    if (!resolved) return match
    const asset = await fetchAndCacheImportAsset(resolved, context, { referer: cssUrl, depth: depth + 1 })
    if (!asset?.dataUrl) return `url("${resolved}")`
    return `url("${asset.dataUrl}")`
  })
}

async function fetchAndCacheImportAsset(assetUrl, context, options = {}) {
  const cache = context.assetCache
  if (cache.has(assetUrl)) return cache.get(assetUrl)
  if (cache.size >= MAX_URL_IMPORT_ASSETS) {
    context.warnings.add("Asset download limit reached; some references remain external.")
    cache.set(assetUrl, null)
    return null
  }

  let response
  try {
    response = await fetch(assetUrl, {
      redirect: "follow",
      headers: buildImportRequestHeaders(context.requestOverrides, {
        accept: "*/*",
        referer: options.referer || context.rootUrl,
      }),
    })
  } catch {
    cache.set(assetUrl, null)
    return null
  }

  if (!response?.ok) {
    cache.set(assetUrl, null)
    return null
  }

  const mimeType = cleanText(response.headers.get("content-type") || "").split(";")[0] || guessMimeType(assetUrl)
  const buffer = Buffer.from(await response.arrayBuffer())
  if (buffer.length > MAX_URL_IMPORT_ASSET_BYTES) {
    context.warnings.add(`Skipped large asset (> ${Math.round(MAX_URL_IMPORT_ASSET_BYTES / 1_000_000)}MB): ${assetUrl}`)
    cache.set(assetUrl, null)
    return null
  }
  if (context.totalBytes + buffer.length > MAX_URL_IMPORT_TOTAL_BYTES) {
    context.warnings.add("Asset byte budget reached; remaining assets were left as external URLs.")
    cache.set(assetUrl, null)
    return null
  }

  context.totalBytes += buffer.length
  const kind = detectImportedAssetKind(assetUrl, mimeType)

  if (kind === "style" || /\.css($|\?)/i.test(assetUrl)) {
    const localizedCss = await localizeCssUrlsFromWeb(buffer.toString("utf8"), assetUrl, context, options.depth || 0)
    const cssBuffer = Buffer.from(localizedCss, "utf8")
    const result = {
      url: assetUrl,
      mimeType: "text/css",
      kind: "style",
      size: cssBuffer.length,
      text: localizedCss,
      dataUrl: dataUrlFromBuffer(cssBuffer, "text/css"),
    }
    cache.set(assetUrl, result)
    context.downloadedAssets.set(assetUrl, result)
    return result
  }

  const result = {
    url: assetUrl,
    mimeType,
    kind,
    size: buffer.length,
    dataUrl: dataUrlFromBuffer(buffer, mimeType),
  }
  cache.set(assetUrl, result)
  context.downloadedAssets.set(assetUrl, result)
  return result
}

async function localizeHtmlAssetsFromWeb(html, pageUrl, context) {
  let output = String(html || "")

  output = await replaceAsync(output, /<link\b([^>]*?)\bhref=(["'])([^"']+)\2([^>]*)>/gi, async (match, before = "", _quote, href = "", after = "") => {
    const resolved = resolveImportAssetUrl(href, pageUrl)
    if (!resolved) return match
    const relMatch = String(match).match(/\brel=(["'])([^"']+)\1/i)
    const relValue = String(relMatch?.[2] || "").toLowerCase()
    const asset = await fetchAndCacheImportAsset(resolved, context, { referer: pageUrl })
    if (!asset) return `<link${before}href="${resolved}"${after}>`
    if (relValue.includes("stylesheet") || asset.kind === "style") {
      if (asset.text) {
        return `<style data-imported-from="${escapeHtml(resolved)}">${asset.text}</style>`
      }
    }
    return `<link${before}href="${asset.dataUrl}"${after}>`
  })

  output = await replaceAsync(output, /(<script\b[^>]*?\bsrc=)(["'])([^"']+)\2/gi, async (match, prefix, quote, src) => {
    const resolved = resolveImportAssetUrl(src, pageUrl)
    if (!resolved) return match
    const asset = await fetchAndCacheImportAsset(resolved, context, { referer: pageUrl })
    if (!asset?.dataUrl) return `${prefix}${quote}${resolved}${quote}`
    return `${prefix}${quote}${asset.dataUrl}${quote}`
  })

  output = await replaceAsync(output, /(<(?:img|source|video|audio|track|input)\b[^>]*?\b(?:src|poster)=)(["'])([^"']+)\2/gi, async (match, prefix, quote, src) => {
    const resolved = resolveImportAssetUrl(src, pageUrl)
    if (!resolved) return match
    const asset = await fetchAndCacheImportAsset(resolved, context, { referer: pageUrl })
    if (!asset?.dataUrl) return `${prefix}${quote}${resolved}${quote}`
    return `${prefix}${quote}${asset.dataUrl}${quote}`
  })

  output = await replaceAsync(output, /\ssrcset=(["'])([^"']+)\1/gi, async (match, _quote, value = "") => {
    const items = String(value || "")
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
    const rewritten = []
    for (const item of items) {
      const [rawSrc, descriptor] = item.split(/\s+/, 2)
      const resolved = resolveImportAssetUrl(rawSrc, pageUrl)
      if (!resolved) {
        rewritten.push(item)
        continue
      }
      const asset = await fetchAndCacheImportAsset(resolved, context, { referer: pageUrl })
      const target = asset?.dataUrl || resolved
      rewritten.push(descriptor ? `${target} ${descriptor}` : target)
    }
    return ` srcset="${rewritten.join(", ")}"`
  })

  output = await replaceAsync(output, /\sstyle=(["'])([\s\S]*?)\1/gi, async (match, quote, value) => {
    return ` style=${quote}${await localizeCssUrlsFromWeb(value, pageUrl, context)}${quote}`
  })

  output = await replaceAsync(output, /<style\b([^>]*)>([\s\S]*?)<\/style>/gi, async (match, attrs = "", css = "") => {
    const localizedCss = await localizeCssUrlsFromWeb(css, pageUrl, context)
    return `<style${attrs}>${localizedCss}</style>`
  })

  return output
}

function isLikelyCtaElement(element) {
  const tag = String(element?.tagName || "").toLowerCase()
  const classes = String(element?.className || "").toLowerCase()
  const text = cleanText(element?.textContent || element?.value || "").toLowerCase()
  if (tag === "button") return true
  if (tag === "input") {
    const type = String(element?.getAttribute?.("type") || "").toLowerCase()
    return type === "submit" || type === "button"
  }
  if (tag !== "a") return false
  if (/(cta|button|btn|primary|action|signup|purchase|checkout)/i.test(classes)) return true
  return /(book|buy|start|join|demo|contact|talk|get|order|subscribe|register|trial|pricing|quote|download)/i.test(text)
}

function extractSeoMetadata(html, pageUrl = "") {
  const dom = new JSDOM(String(html || ""))
  const doc = dom.window.document
  const readMeta = (selector) => cleanText(doc.querySelector(selector)?.getAttribute("content") || "")
  const title = cleanText(doc.querySelector("title")?.textContent || "")
  const description = readMeta("meta[name='description']")
  const canonical = cleanText(doc.querySelector("link[rel='canonical']")?.getAttribute("href") || "")
  const robots = readMeta("meta[name='robots']")
  const og = {}
  for (const meta of Array.from(doc.querySelectorAll("meta[property^='og:']"))) {
    const key = cleanText(meta.getAttribute("property") || "")
    const value = cleanText(meta.getAttribute("content") || "")
    if (!key || !value) continue
    og[key] = value
  }
  return {
    title,
    description,
    canonical: canonical ? resolveImportAssetUrl(canonical, pageUrl) || canonical : "",
    robots,
    og,
  }
}

function normalizeImportedInteractions(html, pageUrl) {
  const dom = new JSDOM(String(html || ""))
  const doc = dom.window.document
  const forms = []
  const ctas = []

  const formNodes = Array.from(doc.querySelectorAll("form"))
  formNodes.forEach((form, formIndex) => {
    const rawAction = cleanText(form.getAttribute("action") || "")
    const resolvedAction = rawAction ? (resolveImportAssetUrl(rawAction, pageUrl) || rawAction) : pageUrl
    const methodRaw = cleanText(form.getAttribute("method") || "post").toLowerCase()
    const method = methodRaw === "get" ? "get" : "post"
    form.setAttribute("action", resolvedAction || pageUrl)
    form.setAttribute("method", method)
    form.setAttribute("data-imported-form", "1")
    form.setAttribute("data-imported-form-index", String(formIndex + 1))

    let fieldCounter = 0
    for (const field of Array.from(form.querySelectorAll("input, select, textarea"))) {
      if (field.getAttribute("type") === "hidden") continue
      if (!field.getAttribute("name")) {
        fieldCounter += 1
        const fallbackName = cleanText(field.getAttribute("id") || field.getAttribute("aria-label") || "") || `field_${fieldCounter}`
        field.setAttribute("name", fallbackName.replace(/[^\w-]+/g, "_").slice(0, 80))
      }
    }
    forms.push({ action: resolvedAction || pageUrl, method, fields: form.querySelectorAll("input, select, textarea").length })
  })

  const ctaNodes = Array.from(doc.querySelectorAll("a, button, input[type='submit'], input[type='button']"))
  ctaNodes.forEach((node) => {
    if (!isLikelyCtaElement(node)) return
    const label = cleanText(node.textContent || node.getAttribute("value") || "")
    if (!label) return
    node.setAttribute("data-imported-cta", "1")
    node.setAttribute("data-imported-cta-label", label.slice(0, 120))
    ctas.push({ label, href: cleanText(node.getAttribute("href") || ""), tag: String(node.tagName || "").toLowerCase() })
  })

  return {
    html: dom.serialize(),
    forms,
    ctas,
  }
}

function buildSectionSignature(element) {
  const tag = String(element.tagName || "").toLowerCase()
  const classTokens = String(element.getAttribute("class") || "")
    .split(/\s+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 3)
    .sort()
  const headingCount = element.querySelectorAll("h1, h2, h3, h4, h5, h6").length
  const buttonCount = element.querySelectorAll("button, a[data-imported-cta='1'], input[type='submit'], input[type='button']").length
  const imageCount = element.querySelectorAll("img, picture, video").length
  const formCount = element.querySelectorAll("form").length
  const text = cleanText(element.textContent || "").slice(0, 120)
  const label =
    cleanText(element.getAttribute("aria-label") || "")
    || cleanText(element.querySelector("h1, h2, h3, h4, h5, h6")?.textContent || "")
    || cleanText(text.split(".")[0] || "")
    || tag
  return {
    signature: `${tag}|${classTokens.join(".")}|h${headingCount}|b${buttonCount}|i${imageCount}|f${formCount}`,
    label: label.slice(0, 120),
  }
}

function extractNavigationLinks(root, siteRootUrl = "") {
  const links = []
  const seen = new Set()
  for (const node of Array.from(root?.querySelectorAll?.("a[href]") || [])) {
    const label = cleanText(node.textContent || "").slice(0, 120)
    const hrefRaw = cleanText(node.getAttribute("href") || "")
    if (!label || !hrefRaw || /^(#|javascript:|mailto:|tel:)/i.test(hrefRaw)) continue
    const href = resolveImportAssetUrl(hrefRaw, siteRootUrl) || hrefRaw
    const key = `${label}::${href}`
    if (seen.has(key)) continue
    seen.add(key)
    links.push({ label, href })
    if (links.length >= 24) break
  }
  return links
}

function collectFidelitySignals(html) {
  const dom = new JSDOM(String(html || ""))
  const doc = dom.window.document
  return {
    title: cleanText(doc.querySelector("title")?.textContent || ""),
    description: cleanText(doc.querySelector("meta[name='description']")?.getAttribute("content") || ""),
    ogCount: doc.querySelectorAll("meta[property^='og:']").length,
    headings: doc.querySelectorAll("h1, h2, h3, h4, h5, h6").length,
    links: doc.querySelectorAll("a[href]").length,
    images: doc.querySelectorAll("img, picture source, video source").length,
    forms: doc.querySelectorAll("form").length,
    ctas: doc.querySelectorAll("[data-imported-cta='1'], button, input[type='submit'], input[type='button']").length,
    sections: doc.querySelectorAll("section, article, nav, header, footer, main, aside").length,
  }
}


function calculateDeepFidelity(originalHtml, rebuiltHtml) {
  try {
    const origTags = (originalHtml.match(/<[a-zA-Z0-9]+/g) || []).length;
    const newTags = (rebuiltHtml.match(/<[a-zA-Z0-9]+/g) || []).length;
    const origClasses = (originalHtml.match(/class="[^"]+"/g) || []).length;
    const newClasses = (rebuiltHtml.match(/class="[^"]+"/g) || []).length;
    
    let tagScore = origTags > 0 ? Math.min(newTags / origTags, 1) : 1;
    let classScore = origClasses > 0 ? Math.min(newClasses / origClasses, 1) : 1;
    
    return Math.round(((tagScore * 0.6) + (classScore * 0.4)) * 100);
  } catch(e) { return 0; }
}

function calculateFidelityScore(o, r) { return calculateDeepFidelity(o, r); }

function deriveSectionCandidates(document) {
  const selected = Array.from(document.querySelectorAll("main section, section, article, [data-section], [data-component], [role='region']"))
  if (selected.length) return selected
  return Array.from(document.querySelectorAll("header, main > div, footer")).slice(0, 18)
}

function extractSemanticStructure(html, { pageUrl = "", siteRootUrl = "" } = {}) {
  const dom = new JSDOM(String(html || ""))
  const doc = dom.window.document
  const navRoot = doc.querySelector("header nav, nav[aria-label*='primary' i], nav")
  const footerRoot = doc.querySelector("footer nav, footer")
  const sections = []
  const sectionNodes = deriveSectionCandidates(doc).slice(0, 64)
  sectionNodes.forEach((node) => {
    const { signature, label } = buildSectionSignature(node)
    if (!signature) return
    sections.push({ signature, label })
  })

  return {
    sections,
    primaryNav: extractNavigationLinks(navRoot, siteRootUrl || pageUrl),
    footerNav: extractNavigationLinks(footerRoot, siteRootUrl || pageUrl),
  }
}

function dedupeNavigationLinks(list = []) {
  const out = []
  const seen = new Set()
  for (const item of Array.isArray(list) ? list : []) {
    const label = cleanText(item?.label || "")
    const href = cleanText(item?.href || "")
    if (!label || !href) continue
    const key = `${label}::${href}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push({ label, href })
    if (out.length >= 24) break
  }
  return out
}

function buildRepeatedSections(pages = []) {
  const grouped = new Map()
  for (const page of pages) {
    for (const section of page?.semantic?.sections || []) {
      const signature = cleanText(section?.signature || "")
      if (!signature) continue
      if (!grouped.has(signature)) grouped.set(signature, { signature, label: section.label || "", count: 0, pages: new Set() })
      const bucket = grouped.get(signature)
      bucket.count += 1
      bucket.pages.add(page.path || "/")
      if (!bucket.label && section.label) bucket.label = section.label
    }
  }
  return Array.from(grouped.values())
    .filter((entry) => entry.pages.size >= 2 || entry.count >= 3)
    .sort((left, right) => right.count - left.count)
    .slice(0, 18)
    .map((entry) => ({
      signature: entry.signature,
      label: entry.label || "Repeated section",
      count: entry.count,
      pages: Array.from(entry.pages).sort((left, right) => left.localeCompare(right)),
    }))
}

function collectSeoCoverage(pages = []) {
  const total = pages.length
  const withTitle = pages.filter((page) => cleanText(page?.seo?.title || "")).length
  const withDescription = pages.filter((page) => cleanText(page?.seo?.description || "")).length
  const withOg = pages.filter((page) => Object.keys(page?.seo?.og || {}).length > 0).length
  return { total, withTitle, withDescription, withOg }
}

function collectProjectFidelity(pages = []) {
  const scores = pages
    .map((page) => Number(page?.semantic?.fidelityScore))
    .filter((value) => Number.isFinite(value))
  if (!scores.length) return 0
  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length)
}

function enrichImportedPageRecord(page, { siteRootUrl = "", defaultUrl = "" } = {}) {
  const normalizedUrl = cleanText(page?.url || "") || cleanText(page?.path || "") || defaultUrl
  const sourceHtml = String(page?.sourceHtml || page?.html || "")
  const interactions = normalizeImportedInteractions(page?.html || "", normalizedUrl || siteRootUrl || defaultUrl)
  const seo = extractSeoMetadata(interactions.html, normalizedUrl || siteRootUrl || defaultUrl)
  const semanticStructure = extractSemanticStructure(interactions.html, {
    pageUrl: normalizedUrl || siteRootUrl || defaultUrl,
    siteRootUrl: siteRootUrl || defaultUrl,
  })
  const sourceSignals = collectFidelitySignals(sourceHtml)
  const targetSignals = collectFidelitySignals(interactions.html)
  const fidelityScore = calculateFidelityScore(sourceSignals, targetSignals)
  return {
    html: interactions.html,
    seo,
    semantic: {
      forms: interactions.forms.slice(0, 40),
      ctas: interactions.ctas.slice(0, 60),
      sections: semanticStructure.sections.slice(0, 80),
      primaryNav: semanticStructure.primaryNav.slice(0, 24),
      footerNav: semanticStructure.footerNav.slice(0, 24),
      fidelityScore,
      fidelity: {
        source: sourceSignals,
        imported: targetSignals,
      },
    },
  }
}

function stripTemplateSyntax(text, ext = "") {
  let output = String(text || "")
  if (!output) return output
  if ([".php", ".phtml", ".php5"].includes(ext)) {
    output = output.replace(/<\?(?:php|=)?[\s\S]*?\?>/gi, "")
  }
  if ([".liquid", ".twig", ".njk", ".nunjucks", ".hbs", ".handlebars", ".mustache"].includes(ext)) {
    output = output
      .replace(/\{%-?[\s\S]*?-?%\}/g, "")
      .replace(/\{\{-?[\s\S]*?-?\}\}/g, "")
      .replace(/\{#-?[\s\S]*?-?#\}/g, "")
  }
  if ([".ejs", ".erb", ".aspx", ".jsp"].includes(ext)) {
    output = output.replace(/<%[\s\S]*?%>/g, "")
  }
  return output
}

function looksLikeMarkupPage(text) {
  const source = String(text || "")
  if (!source.trim()) return false
  if (/<(?:html|body|main|section|article|header|footer|nav|aside|form|div)\b/i.test(source)) return true
  if (/<(?:h1|h2|h3|p|ul|ol|li|img|picture|video|table)\b/i.test(source)) return true
  return false
}

function wrapMarkupFragment(title, body) {
  return wrapImportedHtml(title, body, "Imported markup")
}

function markdownToHtml(markdown, title = "Document") {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n")
  const blocks = []
  let listBuffer = []

  const flushList = () => {
    if (!listBuffer.length) return
    blocks.push(`<ul>${listBuffer.map((item) => `<li>${item}</li>`).join("")}</ul>`)
    listBuffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) {
      flushList()
      continue
    }
    const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/)
    if (headingMatch) {
      flushList()
      const level = headingMatch[1].length
      blocks.push(`<h${level}>${escapeHtml(headingMatch[2])}</h${level}>`)
      continue
    }
    const listMatch = trimmed.match(/^[-*]\s+(.+)$/)
    if (listMatch) {
      listBuffer.push(escapeHtml(listMatch[1]))
      continue
    }
    flushList()
    blocks.push(`<p>${escapeHtml(trimmed)}</p>`)
  }

  flushList()
  return wrapImportedHtml(title, blocks.join("\n"), "Markdown import")
}

function plainTextToHtml(text, title = "Document") {
  const lines = String(text || "").replace(/\r\n/g, "\n").split("\n").filter((line) => line.trim())
  return wrapImportedHtml(
    title,
    lines.map((line) => `<p>${escapeHtml(line.trim())}</p>`).join("\n"),
    "Text import",
  )
}

function wrapImportedHtml(title, body, eyebrow = "Imported content") {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: Georgia, "Times New Roman", serif;
        color: #182030;
        background: linear-gradient(180deg, #f8fafc 0%, #eef2ff 100%);
      }
      main {
        max-width: 960px;
        margin: 0 auto;
        padding: 64px 24px 80px;
      }
      .import-shell {
        background: rgba(255, 255, 255, 0.92);
        border: 1px solid rgba(148, 163, 184, 0.24);
        border-radius: 28px;
        padding: 32px;
        box-shadow: 0 30px 90px rgba(15, 23, 42, 0.08);
      }
      .import-eyebrow {
        font: 700 12px/1.2 ui-monospace, SFMono-Regular, Menlo, monospace;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        color: #6366f1;
        margin-bottom: 16px;
      }
      h1, h2, h3, h4, h5, h6 { font-family: ui-sans-serif, system-ui, sans-serif; color: #0f172a; margin: 0 0 16px; }
      h1 { font-size: clamp(32px, 5vw, 52px); line-height: 1.02; }
      h2 { margin-top: 32px; font-size: 28px; }
      p, li { font-size: 18px; line-height: 1.7; color: #334155; }
      ul { padding-left: 22px; }
      .import-body > *:first-child { margin-top: 0; }
    </style>
  </head>
  <body>
    <main>
      <section class="import-shell">
        <div class="import-eyebrow">${escapeHtml(eyebrow)}</div>
        <div class="import-body">${body}</div>
      </section>
    </main>
  </body>
</html>`
}

function buildAssetLibraryHtml(entries, title = "Asset library") {
  const cards = entries.map((entry) => {
    const ext = path.extname(entry.name).toLowerCase()
    const fileName = path.posix.basename(entry.name)
    const category = IMAGE_FILE_EXTENSIONS.has(ext)
      ? "Image"
      : MEDIA_FILE_EXTENSIONS.has(ext)
      ? "Media"
      : FONT_FILE_EXTENSIONS.has(ext)
      ? "Font"
      : "Asset"
    const preview = IMAGE_FILE_EXTENSIONS.has(ext)
      ? `<img src="${entry.dataUrl}" alt="${escapeHtml(fileName)}" style="width:100%;height:180px;object-fit:cover;border-radius:18px;" />`
      : MEDIA_FILE_EXTENSIONS.has(ext)
      ? `<video src="${entry.dataUrl}" controls style="width:100%;height:180px;object-fit:cover;border-radius:18px;background:#020617;"></video>`
      : `<div style="height:180px;border-radius:18px;border:1px dashed rgba(99,102,241,0.3);display:flex;align-items:center;justify-content:center;font:700 14px/1 ui-monospace,monospace;color:#4f46e5;">${escapeHtml(ext.replace(".", "").toUpperCase() || "FILE")}</div>`
    return `<article style="background:rgba(255,255,255,0.92);border:1px solid rgba(148,163,184,0.18);border-radius:22px;padding:18px;display:flex;flex-direction:column;gap:14px;">
      ${preview}
      <div style="display:flex;flex-direction:column;gap:6px;">
        <div style="font:800 11px/1.2 ui-monospace,monospace;letter-spacing:0.14em;text-transform:uppercase;color:#6366f1;">${category}</div>
        <div style="font:700 18px/1.3 ui-sans-serif,system-ui,sans-serif;color:#0f172a;">${escapeHtml(fileName)}</div>
        <div style="font:500 14px/1.5 ui-sans-serif,system-ui,sans-serif;color:#64748b;">${escapeHtml(entry.name)}</div>
      </div>
    </article>`
  })

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { margin:0; font-family:ui-sans-serif,system-ui,sans-serif; background:linear-gradient(180deg,#0f172a 0%, #111827 55%, #0b1120 100%); color:#e2e8f0; }
      main { max-width:1200px; margin:0 auto; padding:56px 24px 80px; }
      .eyebrow { font:700 12px/1.2 ui-monospace,monospace; letter-spacing:0.16em; text-transform:uppercase; color:#93c5fd; margin-bottom:14px; }
      h1 { margin:0 0 12px; font-size:clamp(34px, 5vw, 60px); line-height:1; }
      .sub { max-width:760px; margin:0 0 28px; font-size:18px; line-height:1.6; color:#94a3b8; }
      .grid { display:grid; gap:18px; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); }
    </style>
  </head>
  <body>
    <main>
      <div class="eyebrow">Asset library</div>
      <h1>${escapeHtml(title)}</h1>
      <p class="sub">Imported ${entries.length} assets into one review page so the team can inspect visuals, media, and brand files inside the project.</p>
      <section class="grid">${cards.join("\n")}</section>
    </main>
  </body>
</html>`
}

function normalizeFrameLabel(fileName, fallback = "Frame") {
  const stem = path.posix.basename(fileName, path.extname(fileName))
  return cleanText(stem.replace(/[-_]+/g, " ")) || fallback
}

function frameNameToPath(fileName, index = 0) {
  const stem = path.posix.basename(fileName, path.extname(fileName))
  const slug = cleanText(stem)
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!slug) return index === 0 ? "/" : `/frame-${index + 1}`
  return index === 0 ? "/" : `/${slug}`
}

function buildFigmaFrameCard(frame) {
  if (frame.inlineSvg) {
    return `<div class="figma-frame-svg">${frame.inlineSvg}</div>`
  }
  return `<img src="${frame.dataUrl}" alt="${escapeHtml(frame.label)}" loading="lazy" />`
}

function buildFigmaFramePageHtml(frame, { title = "Figma import", frameIndex = 0, frameCount = 1 } = {}) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(frame.label)} · ${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
        color: #0f172a;
        background: radial-gradient(circle at 20% 0%, rgba(14, 165, 233, 0.18), transparent 55%), linear-gradient(170deg, #f8fafc 0%, #e2e8f0 100%);
      }
      main { max-width: 1280px; margin: 0 auto; padding: 38px 20px 56px; }
      .meta { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; margin-bottom: 20px; }
      .chip { padding: 8px 12px; border-radius: 999px; font: 700 11px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace; text-transform: uppercase; letter-spacing: 0.12em; background: rgba(15, 23, 42, 0.08); color: #0f172a; }
      h1 { margin: 0 0 18px; font-size: clamp(24px, 4vw, 44px); line-height: 1.04; }
      .canvas { border-radius: 24px; border: 1px solid rgba(148, 163, 184, 0.4); background: #ffffff; box-shadow: 0 36px 84px rgba(15, 23, 42, 0.12); overflow: hidden; }
      .canvas img, .canvas svg { display: block; width: 100%; height: auto; }
      .canvas .figma-frame-svg svg { width: 100%; height: auto; display: block; }
      .note { margin-top: 18px; color: #334155; font-size: 14px; line-height: 1.6; }
    </style>
  </head>
  <body>
    <main>
      <div class="meta">
        <span class="chip">Figma import</span>
        <span class="chip">Frame ${frameIndex + 1} / ${frameCount}</span>
      </div>
      <h1>${escapeHtml(frame.label)}</h1>
      <section class="canvas">${buildFigmaFrameCard(frame)}</section>
      <p class="note">This frame was imported from a Figma export package. You can now replace text, split sections, and rebuild components directly in the editor.</p>
    </main>
  </body>
</html>`
}

function buildFigmaOverviewHtml(frames, title = "Figma import") {
  const items = frames.map((frame, index) => `<article class="frame-card">
      <div class="frame-preview">${buildFigmaFrameCard(frame)}</div>
      <div class="frame-copy">
        <strong>${escapeHtml(frame.label)}</strong>
        <span>${escapeHtml(frame.path)}</span>
        <small>Frame ${index + 1}</small>
      </div>
    </article>`)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      :root { color-scheme: light; }
      * { box-sizing: border-box; }
      body { margin: 0; font-family: "Space Grotesk", ui-sans-serif, system-ui, sans-serif; color: #e2e8f0; background: linear-gradient(165deg, #020617 0%, #111827 70%, #0f172a 100%); }
      main { max-width: 1240px; margin: 0 auto; padding: 44px 20px 64px; }
      .eyebrow { display: inline-flex; padding: 8px 12px; border-radius: 999px; font: 700 11px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace; letter-spacing: 0.12em; text-transform: uppercase; color: #a5f3fc; background: rgba(8, 145, 178, 0.2); margin-bottom: 14px; }
      h1 { margin: 0 0 12px; font-size: clamp(32px, 5vw, 56px); line-height: 1.02; }
      .sub { margin: 0 0 30px; max-width: 760px; color: #94a3b8; line-height: 1.6; }
      .grid { display: grid; gap: 18px; grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
      .frame-card { background: rgba(15, 23, 42, 0.72); border: 1px solid rgba(148, 163, 184, 0.22); border-radius: 20px; overflow: hidden; backdrop-filter: blur(3px); }
      .frame-preview { min-height: 120px; max-height: 220px; overflow: hidden; background: rgba(255, 255, 255, 0.08); }
      .frame-preview img, .frame-preview svg { width: 100%; display: block; height: auto; }
      .frame-preview .figma-frame-svg svg { width: 100%; height: auto; display: block; }
      .frame-copy { padding: 12px 14px 16px; display: grid; gap: 4px; }
      .frame-copy strong { font-size: 15px; color: #f8fafc; }
      .frame-copy span { font-size: 13px; color: #93c5fd; }
      .frame-copy small { font-size: 12px; color: #94a3b8; }
    </style>
  </head>
  <body>
    <main>
      <span class="eyebrow">Figma frame pack</span>
      <h1>${escapeHtml(title)}</h1>
      <p class="sub">Detected ${frames.length} visual frame${frames.length === 1 ? "" : "s"} and reconstructed them into editable pages. Use this overview as the project index and open each frame page for focused editing.</p>
      <section class="grid">${items.join("\n")}</section>
    </main>
  </body>
</html>`
}

function detectFigmaExportEntries(entries = []) {
  if (!Array.isArray(entries) || !entries.length) return false
  const names = entries.map((entry) => normalizeEntryPath(entry?.name || ""))
  const imageLike = names.filter((name) => IMAGE_FILE_EXTENSIONS.has(path.extname(name).toLowerCase()) || /\.svg$/i.test(name))
  if (imageLike.length < 2) return false
  const figmaHints = names.filter((name) => FIGMA_FRAME_HINT_PATTERN.test(name)).length
  return imageLike.length / names.length >= 0.66 || figmaHints >= 2
}

function buildFigmaPagesFromEntries(entries, options = {}) {
  const { textEntries, assetEntries } = entryToBufferMap(entries)
  const frames = Array.from(assetEntries.values())
    .filter((entry) => {
      const ext = path.extname(entry.name).toLowerCase()
      return IMAGE_FILE_EXTENSIONS.has(ext) || ext === ".svg"
    })
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true }))
    .slice(0, 40)
    .map((entry, index) => {
      const textEntry = textEntries.get(entry.name)
      const inlineSvg = path.extname(entry.name).toLowerCase() === ".svg" && textEntry
        ? String(textEntry.text || "").trim()
        : ""
      const label = normalizeFrameLabel(entry.name, `Frame ${index + 1}`)
      return {
        id: index === 0 ? "home" : pathToPageId(frameNameToPath(entry.name, index)),
        name: label,
        title: label,
        path: frameNameToPath(entry.name, index),
        url: frameNameToPath(entry.name, index),
        label,
        dataUrl: entry.dataUrl,
        inlineSvg,
      }
    })

  if (!frames.length) {
    throw new Error("No image or SVG frames found in the uploaded Figma export.")
  }

  const projectTitle = cleanText(options.title || "Figma import")
  const pages = [
    {
      id: "home",
      name: projectTitle,
      title: projectTitle,
      path: "/",
      url: "/",
      html: buildFigmaOverviewHtml(frames, projectTitle),
    },
    ...frames.slice(0, 24).map((frame, index) => ({
      id: frame.id || `frame-${index + 1}`,
      name: frame.name,
      title: frame.title,
      path: index === 0 ? "/frame-1" : frame.path,
      url: index === 0 ? "/frame-1" : frame.path,
      html: buildFigmaFramePageHtml(frame, { title: projectTitle, frameIndex: index, frameCount: frames.length }),
    })),
  ]

  const analysis = {
    projectType: "Figma export",
    platform: "static",
    confidence: "high",
    homepageFile: "Generated overview",
    homepagePath: "/",
    pageCandidates: pages.map((page) => page.path),
    supportFiles: [],
    contentSources: [],
    localeFiles: [],
    styleFiles: [],
    scriptFiles: [],
    assetFiles: frames.map((frame) => frame.path),
    warnings: [],
    fileCount: entries.length,
    pageCount: pages.length,
    styleCount: 0,
    scriptCount: 0,
    assetCount: frames.length,
    overview: `Detected ${frames.length} frame exports and rebuilt them into ${pages.length} editable page drafts.`,
  }

  return buildPreviewFromPages({
    name: projectTitle,
    url: "",
    pages,
    platform: "static",
    summary: `Figma export imported with ${frames.length} frames`,
    source: "Figma",
    analysis,
  })
}

async function readZipEntries(buffer) {
  const yauzlModule = await import("yauzl")
  const yauzl = yauzlModule.default || yauzlModule
  return new Promise((resolve, reject) => {
    const entries = []
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (openError, zipfile) => {
      if (openError || !zipfile) {
        reject(openError || new Error("ZIP could not be opened"))
        return
      }

      zipfile.readEntry()
      zipfile.on("entry", (entry) => {
        const entryName = normalizeEntryPath(entry.fileName)
        if (!entryName || entry.fileName.endsWith("/")) {
          zipfile.readEntry()
          return
        }
        zipfile.openReadStream(entry, (streamError, stream) => {
          if (streamError || !stream) {
            reject(streamError || new Error("ZIP entry could not be read"))
            return
          }
          const chunks = []
          let decompressedSize = 0;
          const MAX_UNCOMPRESSED_BYTES = 50 * 1024 * 1024; // 50MB limit
          stream.on("data", (chunk) => {
            decompressedSize += chunk.length;
            if (decompressedSize > MAX_UNCOMPRESSED_BYTES) {
              stream.destroy();
              reject(new Error("ZIP file contents exceed maximum allowed size (50MB)"));
              return;
            }
            chunks.push(chunk);
          })
          stream.on("end", () => {
            entries.push({
              name: entryName,
              mimeType: guessMimeType(entryName),
              buffer: Buffer.concat(chunks),
            })
            zipfile.readEntry()
          })
          stream.on("error", reject)
        })
      })
      zipfile.on("end", () => resolve(entries))
      zipfile.on("error", reject)
    })
  })
}

function extractDocumentTitleFromHtml(html, fallback) {
  const titleMatch = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  return cleanText(titleMatch?.[1] || "") || fallback
}

function pickPrimaryPage(pages) {
  return pages.find((page) => page.path === "/" || /index/i.test(page.id)) || pages[0] || null
}

function buildPreviewFromPages({ name, url = "", pages = [], platform = "static", summary = "", source = "import", analysis = null }) {
  const preferredPlatform = cleanText(platform || "").toLowerCase()
  const primaryPage = pickPrimaryPage(pages)
  const normalized = normalizeProjectDocument({
    html: primaryPage?.html || "",
    url,
    platform,
  })
  const resolvedPlatform = preferredPlatform && preferredPlatform !== "unknown"
    ? preferredPlatform
    : normalized.meta.platform || "static"
  const normalizedPages = pages.map((page) => {
    const pageHtml = String(page.html || "")
    const pageUrl = page.url || page.path || url || ""
    const normalizedPage = normalizeProjectDocument({
      html: pageHtml,
      url: /^https?:\/\//i.test(pageUrl) ? pageUrl : url || "",
      platform: resolvedPlatform,
    })
    const enriched = enrichImportedPageRecord(
      {
        ...page,
        html: normalizedPage.html,
      },
      {
        siteRootUrl: normalized.meta.url || url || "",
        defaultUrl: pageUrl || normalized.meta.url || url || "",
      },
    )
    return buildPageRecord({
      id: page.id,
      name: page.name,
      title: page.title || extractDocumentTitleFromHtml(enriched.html, page.name),
      path: page.path,
      url: pageUrl,
      html: enriched.html,
      seo: enriched.seo,
      semantic: enriched.semantic,
    })
  })

  const mergedAnalysis = {
    projectType: cleanText(analysis?.projectType || `${source} import`),
    platform: resolvedPlatform,
    confidence: ["low", "medium", "high"].includes(String(analysis?.confidence || "").toLowerCase())
      ? String(analysis.confidence).toLowerCase()
      : "medium",
    homepageFile: cleanText(analysis?.homepageFile || ""),
    homepagePath: cleanText(analysis?.homepagePath || "") || "/",
    pageCandidates: Array.isArray(analysis?.pageCandidates) ? analysis.pageCandidates : normalizedPages.map((page) => page.path || "/"),
    supportFiles: Array.isArray(analysis?.supportFiles) ? analysis.supportFiles : [],
    contentSources: Array.isArray(analysis?.contentSources) ? analysis.contentSources : [],
    localeFiles: Array.isArray(analysis?.localeFiles) ? analysis.localeFiles : [],
    styleFiles: Array.isArray(analysis?.styleFiles) ? analysis.styleFiles : [],
    scriptFiles: Array.isArray(analysis?.scriptFiles) ? analysis.scriptFiles : [],
    assetFiles: Array.isArray(analysis?.assetFiles) ? analysis.assetFiles : [],
    warnings: Array.isArray(analysis?.warnings) ? analysis.warnings : [],
    fileCount: Number(analysis?.fileCount || normalizedPages.length),
    pageCount: Number(analysis?.pageCount || normalizedPages.length),
    styleCount: Number(analysis?.styleCount || 0),
    scriptCount: Number(analysis?.scriptCount || 0),
    assetCount: Number(analysis?.assetCount || 0),
    overview: cleanText(analysis?.overview || ""),
    ...(analysis && typeof analysis === "object" ? analysis : {}),
  }

  const primaryNav = dedupeNavigationLinks(
    normalizedPages.flatMap((page) => page?.semantic?.primaryNav || []),
  )
  const footerNav = dedupeNavigationLinks(
    normalizedPages.flatMap((page) => page?.semantic?.footerNav || []),
  )
  const repeatedSections = buildRepeatedSections(normalizedPages)
  const formsCount = normalizedPages.reduce((sum, page) => sum + (page?.semantic?.forms?.length || 0), 0)
  const ctaCount = normalizedPages.reduce((sum, page) => sum + (page?.semantic?.ctas?.length || 0), 0)
  const seoCoverage = collectSeoCoverage(normalizedPages)
  const fidelityScore = collectProjectFidelity(normalizedPages)
  if (!mergedAnalysis.homepageFile) {
    mergedAnalysis.homepageFile = primaryPage?.name || primaryPage?.path || "Home"
  }
  if (!mergedAnalysis.overview) {
    mergedAnalysis.overview = cleanText(summary) || `${source} import ready`
  }

  return {
    name: cleanText(name) || extractDocumentTitleFromHtml(normalized.html, "Imported project"),
    url: normalized.meta.url || url || "",
    html: normalized.html,
    pages: normalizedPages,
    platform: resolvedPlatform,
    summary: cleanText(summary) || `${source} import ready`,
    analysis: {
      ...mergedAnalysis,
      platform: resolvedPlatform,
      repeatedSections,
      navStructure: {
        primary: primaryNav,
        footer: footerNav,
      },
      formsCount,
      ctaCount,
      seoCoverage,
      fidelityScore,
    },
  }
}

function entryToBufferMap(entries) {
  const textEntries = new Map()
  const assetEntries = new Map()

  for (const entry of entries) {
    const entryPath = normalizeEntryPath(entry.name)
    if (!entryPath || entryPath.startsWith("__MACOSX/")) continue
    const mimeType = guessMimeType(entryPath, entry.mimeType)
    const buffer = entry.buffer || readBase64Buffer(entry.contentBase64)
    const ext = path.extname(entryPath).toLowerCase()
    if (
      TEXT_FILE_EXTENSIONS.has(ext)
      || HTML_LIKE_FILE_EXTENSIONS.has(ext)
      || CSS_FILE_EXTENSIONS.has(ext)
      || SCRIPT_FILE_EXTENSIONS.has(ext)
      || ext === ".svg"
    ) {
      textEntries.set(entryPath, {
        name: entryPath,
        mimeType,
        buffer,
        text: buffer.toString("utf8"),
      })
    }
    assetEntries.set(entryPath, {
      name: entryPath,
      mimeType,
      buffer,
      dataUrl: dataUrlFromBuffer(buffer, mimeType),
    })
  }

  return { textEntries, assetEntries }
}

function convertTextEntryToHtml(entryPath, text) {
  const ext = path.extname(entryPath).toLowerCase()
  const title = pathToTitle(entryPath)
  const preprocessed = preprocessTemplateSource(entryPath, text)
  if (HTML_LIKE_FILE_EXTENSIONS.has(ext)) {
    const cleaned = stripTemplateSyntax(preprocessed, ext)
    if (/<html[\s>]/i.test(cleaned) || /<!doctype html/i.test(cleaned)) return cleaned
    if (looksLikeMarkupPage(cleaned)) return wrapMarkupFragment(title, cleaned)
    return wrapImportedHtml(title, `<pre>${escapeHtml(cleaned)}</pre>`, "Imported template")
  }
  if (ext === ".svg") return wrapImportedHtml(title, `<div style="display:flex;justify-content:center;padding:24px;background:#fff;border-radius:24px;">${preprocessed}</div>`, "SVG import")
  if (TEXT_FILE_EXTENSIONS.has(ext)) {
    return ext === ".txt" ? plainTextToHtml(preprocessed, title) : markdownToHtml(preprocessed, title)
  }
  return wrapImportedHtml(title, `<pre>${escapeHtml(preprocessed)}</pre>`, "Imported file")
}

function preprocessTemplateSource(entryPath, text) {
  const ext = path.extname(entryPath).toLowerCase()
  let output = String(text || "")
  if (!output) return output
  if ([".php", ".phtml", ".php5"].includes(ext)) {
    output = output.replace(/<\?(?:php|=)?([\s\S]*?)\?>/gi, (match, code = "") => {
      const source = String(code || "")
      const trimmed = cleanText(source)
      if (!trimmed) return ""
      const isThemeUriReference =
        /\$theme_uri\b/i.test(source)
        || /get_template_directory_uri\s*\(/i.test(source)
        || /get_stylesheet_directory_uri\s*\(/i.test(source)
        || /get_theme_file_uri\s*\(/i.test(source)
      if (isThemeUriReference) {
        if (/\$theme_uri\s*=|=\s*get_template_directory_uri\s*\(/i.test(source) && !/\becho\b|print\s*\(/i.test(source)) {
          return ""
        }
        return "."
      }
      const urlMatch = source.match(/(?:home_url|site_url)\s*\(\s*['"]([^'"]+)['"]\s*\)/i)
      if (urlMatch?.[1]) return urlMatch[1]
      if (/\bwp_head\s*\(/i.test(source) || /\bwp_footer\s*\(/i.test(source) || /\bbody_class\s*\(/i.test(source)) {
        return ""
      }
      return match
    })
  }
  return output
}

function isWordPressThemeSupportFile(entryPath) {
  const relative = stripCommonRootPrefix(entryPath).toLowerCase()
  const baseName = path.posix.basename(relative)
  const name = baseName.replace(/\.[a-z0-9]+$/i, "")
  if (WORDPRESS_THEME_SIGNALS.has(baseName) || WORDPRESS_SUPPORT_NAMES.has(name)) return true
  return false
}

function isLikelyContentSource(entryPath) {
  const relative = stripCommonRootPrefix(entryPath).toLowerCase()
  const segments = relative.split("/").filter(Boolean)
  if (segments.some((segment) => CONTENT_SOURCE_SEGMENTS.has(segment))) return true
  const ext = path.extname(relative)
  if (!TEXT_FILE_EXTENSIONS.has(ext)) return false
  return Boolean(detectLocaleCode(relative))
}

function isHomepageTemplate(entryPath) {
  const relative = stripCommonRootPrefix(entryPath).toLowerCase()
  const baseName = path.posix.basename(relative, path.extname(relative))
  return HOMEPAGE_TEMPLATE_NAMES.has(baseName)
}

function buildImportedPagePath(entryPath, rootPrefix = "") {
  const relative = stripCommonRootPrefix(entryPath, rootPrefix)
  const ext = path.extname(relative)
  const directory = path.posix.dirname(relative)
  const baseName = path.posix.basename(relative, ext)
  if (isHomepageTemplate(relative)) return "/"

  let slug = baseName
  const wpNamedTemplate = slug.match(/^(?:page|single|archive|template)[-_](.+)$/i)
  if (wpNamedTemplate?.[1]) slug = wpNamedTemplate[1]

  const relativeDir = directory && directory !== "." ? directory : ""
  const fullPath = [relativeDir, slug].filter(Boolean).join("/")
  return `/${fullPath}`.replace(/\/index$/i, "/").replace(/\/{2,}/g, "/")
}

function getPageCandidatePriority(entryPath) {
  const relative = stripCommonRootPrefix(entryPath).toLowerCase()
  if (isHomepageTemplate(relative)) return 100
  if (/front-page\.php$/i.test(relative)) return 120
  if (/page[-_]/i.test(relative)) return 80
  if (/single[-_]/i.test(relative)) return 72
  if (/archive[-_]/i.test(relative)) return 68
  if (/\.html?$/i.test(relative)) return 64
  return 50
}

function buildAnalysisOverview(analysis) {
  const pageCount = analysis.pageCandidates.length
  const contentCount = analysis.contentSources.length
  const supportCount = analysis.supportFiles.length
  const parts = [
    `Detected a ${analysis.projectType.toLowerCase()} with ${pageCount} editable page${pageCount === 1 ? "" : "s"}.`,
  ]
  if (analysis.homepageFile) {
    parts.push(`${path.posix.basename(analysis.homepageFile)} will be used as the homepage.`)
  }
  if (contentCount) {
    parts.push(`${contentCount} content source file${contentCount === 1 ? "" : "s"} will stay as references instead of becoming pages.`)
  }
  if (supportCount) {
    parts.push(`${supportCount} support/template file${supportCount === 1 ? "" : "s"} will stay out of the page list.`)
  }
  return parts.join(" ")
}

function parseJsonObjectCandidate(value) {
  const source = stripCodeFence(String(value || "").trim())
  if (!source) return null
  try {
    return JSON.parse(source)
  } catch {}
  const start = source.indexOf("{")
  const end = source.lastIndexOf("}")
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(source.slice(start, end + 1))
    } catch {}
  }
  return null
}

function shouldRunAiImportAnalysis(analysis, options = {}) {
  if (options.disableAiAnalysis) return false
  if (isTestRuntime()) return false
  if (!options.userId && !options.forceAiAnalysis) return false
  return true
}

function resolveAnalysisEntryPath(relativePath, rootPrefix = "") {
  const normalized = normalizeEntryPath(relativePath)
  if (!normalized) return ""
  if (!rootPrefix) return normalized
  return normalizeEntryPath(`${rootPrefix}/${normalized}`)
}

function buildAiImportSnippet(text, filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (CSS_FILE_EXTENSIONS.has(ext) || SCRIPT_FILE_EXTENSIONS.has(ext) || TEXT_FILE_EXTENSIONS.has(ext)) {
    return String(text || "").slice(0, MAX_AI_SNIPPET_LENGTH)
  }
  return stripTemplateSyntax(preprocessTemplateSource(filePath, text), ext).slice(0, MAX_AI_SNIPPET_LENGTH)
}

function buildAiImportPrompt({ entryPaths, textEntries, analysis, options = {} }) {
  const rootPrefix = analysis.rootPrefix || ""
  const relativeTextPaths = entryPaths
    .map((entryPath) => stripCommonRootPrefix(entryPath, rootPrefix))
    .filter((entryPath) => {
      const fullPath = resolveAnalysisEntryPath(entryPath, rootPrefix)
      return textEntries.has(fullPath)
    })

  const prioritized = Array.from(
    new Set([
      ...analysis.pageCandidates,
      ...analysis.contentSources,
      ...analysis.supportFiles,
      ...relativeTextPaths,
    ]),
  ).slice(0, 16)

  const snippets = prioritized
    .map((relativePath) => {
      const fullPath = resolveAnalysisEntryPath(relativePath, rootPrefix)
      const entry = textEntries.get(fullPath)
      if (!entry) return ""
      return [
        `FILE: ${relativePath}`,
        buildAiImportSnippet(entry.text, fullPath),
      ].join("\n")
    })
    .filter(Boolean)
    .join("\n\n---\n\n")

  const manifest = [
    `Entry mode: ${options.entryMode || "auto"}`,
    `Detected platform hint: ${analysis.platform}`,
    `Detected project type hint: ${analysis.projectType}`,
    `Detected homepage hint: ${analysis.homepageFile || "none"}`,
    `All files: ${entryPaths.map((entryPath) => stripCommonRootPrefix(entryPath, rootPrefix)).join(", ")}`,
    `Initial page candidates: ${(analysis.pageCandidates || []).join(", ") || "none"}`,
    `Initial content sources: ${(analysis.contentSources || []).join(", ") || "none"}`,
    `Initial support files: ${(analysis.supportFiles || []).join(", ") || "none"}`,
  ].join("\n")

  return [
    "You analyze uploaded website bundles and decide how they should be imported into an editor.",
    "Return ONLY valid JSON.",
    "Never invent files that are not in the manifest.",
    "Page candidates must only include real page/template files, not logos, CSS, scripts, config, or content source files.",
    "Use contentSources for translation text files, copy docs, or locale sources.",
    "Use supportFiles for partials, config, helpers, snippets, functions, layouts, and non-page templates.",
    "Use homepageFile for the file that should become '/'.",
    "For each page candidate, include a path like '/', '/about', '/contact'.",
    "Schema:",
    '{"projectType":"string","platform":"wordpress|shopify|static|other","confidence":"high|medium|low","homepageFile":"string","pageCandidates":[{"file":"string","path":"string","title":"string"}],"supportFiles":["string"],"contentSources":["string"],"warnings":["string"],"overview":"string"}',
    "",
    "Manifest:",
    manifest,
    "",
    "Representative file snippets:",
    snippets || "No text snippets available.",
  ].join("\n")
}

function isLikelyPageEntry(entryPath) {
  const normalized = normalizeEntryPath(entryPath)
  if (!normalized) return false
  const lower = normalized.toLowerCase()
  if (
    lower.includes("/partials/")
    || lower.includes("/partial/")
    || lower.includes("/includes/")
    || lower.includes("/include/")
    || lower.includes("/snippets/")
    || lower.includes("/snippet/")
    || lower.includes("/components/")
    || lower.includes("/component/")
    || lower.includes("/fragments/")
    || lower.includes("/fragment/")
    || lower.includes("/sections/")
    || lower.includes("/section/")
    || lower.startsWith("components/")
    || lower.startsWith("partials/")
    || lower.startsWith("includes/")
    || lower.startsWith("snippets/")
    || lower.startsWith("sections/")
  ) {
    return false
  }
  const baseName = path.posix.basename(lower, path.extname(lower))
  if (NON_PAGE_TEMPLATE_NAMES.has(baseName)) return false
  return true
}

function analyzeImportEntries(entries, options = {}) {
  const { textEntries, assetEntries } = entryToBufferMap(entries)
  const entryPaths = Array.isArray(entries) ? entries.map((entry) => normalizeEntryPath(entry.name)).filter(Boolean) : []
  const rootPrefix = detectCommonRootPrefix(entryPaths)
  const relativePaths = entryPaths.map((entryPath) => stripCommonRootPrefix(entryPath, rootPrefix))
  const mode = cleanText(options.entryMode || "auto").toLowerCase()
  const forceAssetLibrary = mode === "assets"
  const hasHtmlLikeFiles = relativePaths.some((entryPath) => HTML_LIKE_FILE_EXTENSIONS.has(path.extname(entryPath).toLowerCase()))
  const hasWordPressSignals = relativePaths.some((entryPath) => WORDPRESS_THEME_SIGNALS.has(entryPath.toLowerCase()))
  const hasShopifySignals = relativePaths.some((entryPath) => {
    const segments = entryPath.toLowerCase().split("/").filter(Boolean)
    return segments.some((segment) => SHOPIFY_THEME_SEGMENTS.has(segment)) || /\.liquid$/i.test(entryPath)
  })
  const allowTextPages = mode === "single-file" || (!hasHtmlLikeFiles && !forceAssetLibrary)
  const allowSvgPage = mode === "single-file"

  const pageEntries = []
  const supportFiles = []
  const contentSources = []
  const styleFiles = []
  const scriptFiles = []
  const assetFiles = []
  const localeFiles = []

  for (const entryPath of entryPaths) {
    const relativePath = stripCommonRootPrefix(entryPath, rootPrefix)
    const ext = path.extname(relativePath).toLowerCase()
    if (CSS_FILE_EXTENSIONS.has(ext)) {
      styleFiles.push(relativePath)
      continue
    }
    if (SCRIPT_FILE_EXTENSIONS.has(ext)) {
      scriptFiles.push(relativePath)
      continue
    }
    if (IMAGE_FILE_EXTENSIONS.has(ext) || MEDIA_FILE_EXTENSIONS.has(ext) || FONT_FILE_EXTENSIONS.has(ext)) {
      if (ext === ".svg" && allowSvgPage && textEntries.has(entryPath) && entryPaths.length === 1) {
        const html = inlineHtmlAssets(convertTextEntryToHtml(entryPath, textEntries.get(entryPath)?.text || ""), entryPath, assetEntries, textEntries)
        pageEntries.push({
          entryPath: relativePath,
          pagePath: "/",
          priority: 100,
          name: extractDocumentTitleFromHtml(html, pathToTitle(relativePath)),
          title: extractDocumentTitleFromHtml(html, pathToTitle(relativePath)),
          html,
        })
      } else {
        assetFiles.push(relativePath)
      }
      continue
    }
    if (TEXT_FILE_EXTENSIONS.has(ext)) {
      const localeCode = detectLocaleCode(relativePath)
      if (localeCode) localeFiles.push(`${relativePath} (${humanizeLocaleCode(localeCode)})`)
      if (!allowTextPages || isLikelyContentSource(relativePath) || forceAssetLibrary) {
        contentSources.push(relativePath)
        continue
      }
      const html = inlineHtmlAssets(convertTextEntryToHtml(entryPath, textEntries.get(entryPath)?.text || ""), entryPath, assetEntries, textEntries)
      pageEntries.push({
        entryPath: relativePath,
        pagePath: "/",
        priority: 52,
        name: extractDocumentTitleFromHtml(html, pathToTitle(relativePath)),
        title: extractDocumentTitleFromHtml(html, pathToTitle(relativePath)),
        html,
      })
      continue
    }
    if (!HTML_LIKE_FILE_EXTENSIONS.has(ext)) continue

    const entry = textEntries.get(entryPath)
    const preprocessed = preprocessTemplateSource(entryPath, entry?.text || "")
    const cleaned = stripTemplateSyntax(preprocessed, ext)
    const hasMarkup = /<!doctype html/i.test(cleaned) || /<html[\s>]/i.test(cleaned) || looksLikeMarkupPage(cleaned)
    const homepageTemplate = isHomepageTemplate(relativePath)
    const supportPath = !isLikelyPageEntry(relativePath) || isWordPressThemeSupportFile(relativePath)
    const supportOnlyFile = !hasMarkup && supportPath
    if (supportOnlyFile || forceAssetLibrary) {
      supportFiles.push(relativePath)
      continue
    }
    if (!hasMarkup && !homepageTemplate) {
      supportFiles.push(relativePath)
      continue
    }
    const rawHtml = convertTextEntryToHtml(entryPath, entry?.text || "")
    const html = inlineHtmlAssets(rawHtml, entryPath, assetEntries, textEntries)
    pageEntries.push({
      entryPath: relativePath,
      pagePath: buildImportedPagePath(relativePath, ""),
      priority: getPageCandidatePriority(relativePath),
      name: extractDocumentTitleFromHtml(html, pathToTitle(relativePath)),
      title: extractDocumentTitleFromHtml(html, pathToTitle(relativePath)),
      html,
    })
  }

  const uniquePageEntries = []
  const seenPagePaths = new Set()
  for (const candidate of pageEntries.sort((left, right) => right.priority - left.priority || left.pagePath.localeCompare(right.pagePath))) {
    const key = candidate.pagePath || "/"
    if (seenPagePaths.has(key)) {
      supportFiles.push(candidate.entryPath)
      continue
    }
    seenPagePaths.add(key)
    uniquePageEntries.push(candidate)
  }

  let platform = "static"
  let projectType = "Static website bundle"
  let confidence = "medium"
  if (forceAssetLibrary) {
    projectType = "Asset library"
    confidence = "high"
  } else if (hasWordPressSignals) {
    platform = "wordpress"
    projectType = "WordPress theme"
    confidence = "high"
  } else if (hasShopifySignals) {
    platform = "shopify"
    projectType = "Shopify theme bundle"
    confidence = "high"
  } else if (!uniquePageEntries.length && contentSources.length) {
    projectType = "Content source bundle"
    confidence = "medium"
  }

  const homepageEntry = uniquePageEntries.find((candidate) => candidate.pagePath === "/") || uniquePageEntries[0] || null
  const warnings = []
  if (!uniquePageEntries.length && assetFiles.length) warnings.push("No real page templates were found, so the upload will become an asset library.")
  if (contentSources.length) warnings.push("Content source files will be kept as references instead of being turned into standalone pages.")
  if (supportFiles.length) warnings.push("Support files and partial templates stay out of the editable page list.")
  if (platform === "wordpress" && homepageEntry?.entryPath && !/front-page|home|index/i.test(homepageEntry.entryPath)) {
    warnings.push("No dedicated front-page template was found, so the importer picked the strongest page candidate as the homepage.")
  }

  const analysis = {
    projectType,
    platform,
    confidence,
    homepageFile: homepageEntry?.entryPath || "",
    homepagePath: homepageEntry?.pagePath || "",
    pageCandidates: uniquePageEntries.map((entry) => entry.entryPath),
    supportFiles: Array.from(new Set(supportFiles)).sort((left, right) => left.localeCompare(right)),
    contentSources: Array.from(new Set(contentSources)).sort((left, right) => left.localeCompare(right)),
    localeFiles: Array.from(new Set(localeFiles)).sort((left, right) => left.localeCompare(right)),
    styleFiles: Array.from(new Set(styleFiles)).sort((left, right) => left.localeCompare(right)),
    scriptFiles: Array.from(new Set(scriptFiles)).sort((left, right) => left.localeCompare(right)),
    assetFiles: Array.from(new Set(assetFiles)).sort((left, right) => left.localeCompare(right)),
    warnings,
    fileCount: entryPaths.length,
    pageCount: uniquePageEntries.length,
    styleCount: styleFiles.length,
    scriptCount: scriptFiles.length,
    assetCount: assetFiles.length,
    rootPrefix,
    overview: "",
  }

  analysis.overview = buildAnalysisOverview(analysis)
  return { analysis, pageEntries: uniquePageEntries, textEntries, assetEntries }
}

async function maybeRunAiImportStructure({ entries, textEntries, analysis, options = {} }) {
  const entryPaths = Array.isArray(entries) ? entries.map((entry) => normalizeEntryPath(entry.name)).filter(Boolean) : []
  if (!shouldRunAiImportAnalysis(analysis, options)) return null
  const prompt = buildAiImportPrompt({ entryPaths, textEntries, analysis, options })
  try {
    const generated = await callImportAnalysisModel({
      prompt,
      userId: options.userId,
      maxTokens: 2200,
      temperature: 0.2,
    })
    return parseJsonObjectCandidate(generated)
  } catch (error) {
    if (options.requireImportAnalysis) throw error
    return null
  }
}

function normalizeAiAnalysisPathList(value, validPaths) {
  const list = Array.isArray(value) ? value : []
  return Array.from(
    new Set(
      list
        .map((item) => {
          const candidate = normalizeEntryPath(typeof item === "string" ? item : item?.file || "")
          if (!candidate) return ""
          if (validPaths.has(candidate)) return candidate
          const basename = path.posix.basename(candidate)
          return Array.from(validPaths).find((entry) => entry === basename || entry.endsWith(`/${basename}`)) || ""
        })
        .filter(Boolean),
    ),
  )
}

function buildPageEntriesFromSelection(pageSelections, { textEntries, assetEntries, rootPrefix = "" }) {
  const pageEntries = []
  const seenPagePaths = new Set()
  for (const selection of pageSelections) {
    const entryPath = resolveAnalysisEntryPath(selection.entryPath, rootPrefix)
    const entry = textEntries.get(entryPath)
    if (!entry) continue
    const pagePath = String(selection.pagePath || buildImportedPagePath(selection.entryPath, "") || "/").trim() || "/"
    if (seenPagePaths.has(pagePath)) continue
    seenPagePaths.add(pagePath)
    const rawHtml = convertTextEntryToHtml(entryPath, entry.text || "")
    const html = inlineHtmlAssets(rawHtml, entryPath, assetEntries, textEntries)
    const fallbackTitle = extractDocumentTitleFromHtml(html, pathToTitle(selection.entryPath))
    pageEntries.push({
      entryPath: selection.entryPath,
      pagePath,
      priority: pagePath === "/" ? 999 : getPageCandidatePriority(selection.entryPath),
      name: cleanText(selection.title) || fallbackTitle,
      title: cleanText(selection.title) || fallbackTitle,
      html,
    })
  }
  return pageEntries
}

function mergeImportAnalysisWithAi({ baseline, aiStructure, entries, textEntries, assetEntries, options = {} }) {
  if (!aiStructure || typeof aiStructure !== "object") return baseline

  const entryPaths = Array.isArray(entries) ? entries.map((entry) => normalizeEntryPath(entry.name)).filter(Boolean) : []
  const relativePaths = entryPaths.map((entryPath) => stripCommonRootPrefix(entryPath, baseline.analysis.rootPrefix || ""))
  const validPaths = new Set(relativePaths)
  const validPagePaths = new Set(baseline.pageEntries.map((entry) => entry.entryPath))

  const aiPageCandidatesRaw = Array.isArray(aiStructure.pageCandidates) ? aiStructure.pageCandidates : []
  const aiPageSelections = aiPageCandidatesRaw
    .map((candidate) => {
      const candidateFile = normalizeEntryPath(typeof candidate === "string" ? candidate : candidate?.file || "")
      if (!candidateFile) return null
      const matched =
        validPagePaths.has(candidateFile)
          ? candidateFile
          : Array.from(validPagePaths).find((entry) => entry === path.posix.basename(candidateFile) || entry.endsWith(`/${path.posix.basename(candidateFile)}`))
      if (!matched) return null
      return {
        entryPath: matched,
        pagePath: cleanText(typeof candidate === "string" ? "" : candidate?.path || "") || buildImportedPagePath(matched, ""),
        title: cleanText(typeof candidate === "string" ? "" : candidate?.title || ""),
      }
    })
    .filter(Boolean)

  const baselineSelections = baseline.pageEntries.map((entry) => ({
    entryPath: entry.entryPath,
    pagePath: entry.pagePath,
    title: entry.title || entry.name,
  }))

  const mergedSelectionMap = new Map(
    baselineSelections.map((selection) => [selection.entryPath, { ...selection }]),
  )
  for (const selection of aiPageSelections) {
    const existing = mergedSelectionMap.get(selection.entryPath)
    if (!existing) continue
    mergedSelectionMap.set(selection.entryPath, {
      entryPath: selection.entryPath,
      pagePath:
        existing.pagePath === "/"
          ? "/"
          : cleanText(selection.pagePath) || existing.pagePath,
      title: cleanText(selection.title) || existing.title,
    })
  }

  const mergedSelections = Array.from(mergedSelectionMap.values())
  const pageEntries = buildPageEntriesFromSelection(mergedSelections, {
    textEntries,
    assetEntries,
    rootPrefix: baseline.analysis.rootPrefix || "",
  })

  const finalPagePaths = new Set(pageEntries.map((entry) => entry.entryPath))
  const supportFiles = Array.from(
    new Set([
      ...normalizeAiAnalysisPathList(aiStructure.supportFiles, validPaths),
      ...baseline.analysis.supportFiles,
    ]),
  ).filter((entryPath) => !finalPagePaths.has(entryPath))

  const contentSources = Array.from(
    new Set([
      ...normalizeAiAnalysisPathList(aiStructure.contentSources, validPaths),
      ...baseline.analysis.contentSources,
    ]),
  ).filter((entryPath) => !finalPagePaths.has(entryPath))

  const homepageFileCandidate = normalizeAiAnalysisPathList([aiStructure.homepageFile], validPagePaths)[0]
    || (pageEntries.find((entry) => entry.pagePath === "/")?.entryPath || baseline.analysis.homepageFile || "")

  if (homepageFileCandidate) {
    for (const entry of pageEntries) {
      if (entry.entryPath === homepageFileCandidate) entry.pagePath = "/"
    }
    pageEntries.sort((left, right) => {
      if (left.pagePath === "/") return -1
      if (right.pagePath === "/") return 1
      return left.pagePath.localeCompare(right.pagePath)
    })
  }

  const platform = ["wordpress", "shopify", "static", "other"].includes(String(aiStructure.platform || "").toLowerCase())
    ? String(aiStructure.platform).toLowerCase()
    : baseline.analysis.platform
  const projectType = cleanText(aiStructure.projectType) || baseline.analysis.projectType
  const confidence = ["high", "medium", "low"].includes(String(aiStructure.confidence || "").toLowerCase())
    ? String(aiStructure.confidence).toLowerCase()
    : baseline.analysis.confidence
  const warnings = Array.from(new Set([...(baseline.analysis.warnings || []), ...((Array.isArray(aiStructure.warnings) ? aiStructure.warnings : []).map((item) => cleanText(item)).filter(Boolean))]))
  const overview = cleanText(aiStructure.overview) || baseline.analysis.overview

  return {
    analysis: {
      ...baseline.analysis,
      projectType,
      platform,
      confidence,
      homepageFile: homepageFileCandidate || baseline.analysis.homepageFile,
      homepagePath: pageEntries.find((entry) => entry.pagePath === "/")?.pagePath || baseline.analysis.homepagePath || "/",
      pageCandidates: pageEntries.map((entry) => entry.entryPath),
      supportFiles: supportFiles.sort((left, right) => left.localeCompare(right)),
      contentSources: contentSources.sort((left, right) => left.localeCompare(right)),
      warnings,
      overview,
      pageCount: pageEntries.length,
    },
    pageEntries,
    textEntries,
    assetEntries,
  }
}

async function maybeGenerateImportOverview(analysis, options = {}) {
  if (analysis.fileCount > 120) return analysis.overview
  try {
    const prompt = [
      "You are reviewing an uploaded website package before import.",
      "Summarize what this upload is, which file should become the homepage, and which files should stay as support/content references.",
      "Keep it under 90 words. Preserve filenames exactly. No markdown.",
      `Project type: ${analysis.projectType}`,
      `Platform: ${analysis.platform}`,
      `Homepage file: ${analysis.homepageFile || "none"}`,
      `Page candidates: ${(analysis.pageCandidates || []).slice(0, 12).join(", ") || "none"}`,
      `Content sources: ${(analysis.contentSources || []).slice(0, 12).join(", ") || "none"}`,
      `Support files: ${(analysis.supportFiles || []).slice(0, 12).join(", ") || "none"}`,
      `Warnings: ${(analysis.warnings || []).join(" ") || "none"}`,
    ].join("\n")
    const generated = await callImportAnalysisModel({
      prompt,
      userId: options.userId,
      maxTokens: 260,
      temperature: 0.1,
    })
    const summary = cleanText(stripCodeFence(generated))
    return summary || analysis.overview
  } catch {
    return analysis.overview
  }
}

async function buildPagesFromEntries(entries, options = {}) {
  const entryMode = cleanText(options.entryMode || "auto").toLowerCase()
  if (entryMode === "figma-export" || ((entryMode === "auto" || entryMode === "folder") && detectFigmaExportEntries(entries))) {
    return buildFigmaPagesFromEntries(entries, options)
  }

  const baseline = analyzeImportEntries(entries, options)
  const aiStructure = await maybeRunAiImportStructure({
    entries,
    textEntries: baseline.textEntries,
    analysis: baseline.analysis,
    options,
  })
  const { analysis, pageEntries, assetEntries } = mergeImportAnalysisWithAi({
    baseline,
    aiStructure,
    entries,
    textEntries: baseline.textEntries,
    assetEntries: baseline.assetEntries,
    options,
  })
  const pages = []

  for (const entry of pageEntries) {
    pages.push(
      buildPageRecord({
        id: pathToPageId(entry.pagePath || entry.entryPath),
        name: entry.name,
        title: entry.title,
        path: entry.pagePath || "/",
        url: entry.pagePath || "/",
        html: entry.html,
      }),
    )
  }

  if (!pages.length) {
    const assetEntriesList = Array.from(assetEntries.values()).filter((entry) => {
      const ext = path.extname(entry.name).toLowerCase()
      return IMAGE_FILE_EXTENSIONS.has(ext) || MEDIA_FILE_EXTENSIONS.has(ext) || FONT_FILE_EXTENSIONS.has(ext)
    })
    if (!assetEntriesList.length) throw new Error("No importable pages or assets found in the uploaded files.")
    const html = buildAssetLibraryHtml(assetEntriesList, options.title || "Asset library")
    pages.push(
      buildPageRecord({
        id: "assets",
        name: options.title || "Asset library",
        title: options.title || "Asset library",
        path: "/",
        url: "",
        html,
      }),
    )
    analysis.projectType = "Asset library"
    analysis.platform = "static"
    analysis.confidence = "high"
    if (!analysis.homepageFile) {
      analysis.homepageFile = "Generated asset library"
      analysis.homepagePath = "/"
    }
  }

  pages.sort((left, right) => {
    if (left.path === "/") return -1
    if (right.path === "/") return 1
    return left.path.localeCompare(right.path)
  })

  analysis.overview = aiStructure?.overview
    ? cleanText(aiStructure.overview) || analysis.overview
    : await maybeGenerateImportOverview(analysis, { userId: options.userId })
  const summary =
    pages.length > 0
      ? `${pages.length} structured page${pages.length === 1 ? "" : "s"} from ${analysis.fileCount} file${analysis.fileCount === 1 ? "" : "s"} · ${analysis.styleCount} styles · ${analysis.scriptCount} scripts · ${analysis.assetCount} assets`
      : options.summary || `${analysis.fileCount} files analyzed`

  return buildPreviewFromPages({
    name: options.title || pathToTitle(pages[0]?.name || "Imported project"),
    url: "",
    pages,
    platform: analysis.platform || "static",
    summary,
    source: "Local",
    analysis,
  })
}

async function fetchTextResponse(url, requestOverrides = {}, options = {}) {
  const response = await fetch(url, {
    headers: buildImportRequestHeaders(requestOverrides, {
      accept: options.accept || "text/plain,*/*;q=0.8",
      referer: options.referer || "",
    }),
  })
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
  return {
    text: await response.text(),
    finalUrl: response.url || url,
  }
}

async function fetchSitePage(url, context = {}) {
  const requestOverrides = context.requestOverrides || {}
  const response = await fetch(url, {
    headers: buildImportRequestHeaders(requestOverrides, {
      accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      referer: context.rootUrl || "",
    }),
  })
  if (!response.ok) throw new Error(`Could not load page (${response.status})`)
  const rawHtml = await response.text()
  const finalUrl = response.url || url
  let htmlWithLocalizedAssets = rawHtml
  if (context.assetContext) {
    htmlWithLocalizedAssets = await localizeHtmlAssetsFromWeb(rawHtml, finalUrl, context.assetContext)
  }
  const normalized = normalizeProjectDocument({ html: htmlWithLocalizedAssets, url: finalUrl, platform: "unknown" })
  return {
    html: normalized.html,
    finalUrl: normalized.meta.url || finalUrl,
    platform: normalized.meta.platform,
    rawHtml,
    title: extractDocumentTitleFromHtml(rawHtml, ""),
  }
}

function isLikelyPageUrl(candidateUrl, rootUrl) {
  try {
    const resolved = new URL(candidateUrl, rootUrl || candidateUrl)
    if (!/^https?:$/i.test(resolved.protocol)) return false
    const pathname = resolved.pathname || "/"
    const extMatch = pathname.toLowerCase().match(/\.[a-z0-9]+$/)
    if (extMatch && PAGE_SKIP_EXTENSIONS.has(extMatch[0])) return false
    return !/^(mailto|tel|javascript):/i.test(String(candidateUrl || ""))
  } catch {
    return false
  }
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

function derivePageName(pathname, title = "", anchorText = "") {
  const preferred = cleanText(title) || cleanText(anchorText)
  if (preferred) return preferred
  if (!pathname || pathname === "/") return "Home"
  const segment = pathname.split("/").filter(Boolean).pop() || "Page"
  return segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (match) => match.toUpperCase())
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
    const pagePath = normalizePagePath(resolved.toString(), rootUrl)
    if (pages.has(pagePath)) return
    pages.set(pagePath, {
      path: pagePath,
      url: resolved.toString(),
      name: derivePageName(pagePath, title, anchorText),
    })
  }

  addPage(rootUrl, "", "Home")
  const anchorRegex = /<a\b[^>]*href=(["'])(.*?)\1[^>]*>([\s\S]*?)<\/a>/gi
  for (const match of String(html || "").matchAll(anchorRegex)) {
    addPage(match[2], stripHtml(match[3] || ""))
    if (pages.size >= MAX_SITE_PAGES) break
  }
  return Array.from(pages.values())
}

function extractSitemapLocs(xml, rootUrl) {
  const urls = []
  for (const match of String(xml || "").matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
    const candidate = cleanText(match[1])
    if (!candidate) continue
    try {
      const resolved = new URL(candidate, rootUrl).toString()
      urls.push(resolved)
    } catch {}
  }
  return urls
}

async function discoverSitemapUrls(rootUrl, requestOverrides = {}) {
  const root = new URL(rootUrl)
  const queue = [new URL("/sitemap.xml", root).toString()]
  const discovered = new Set(queue)

  try {
    const robots = await fetchTextResponse(new URL("/robots.txt", root).toString(), requestOverrides, {
      referer: rootUrl,
    })
    for (const match of String(robots.text || "").matchAll(/^sitemap:\s*(\S+)/gim)) {
      const candidate = cleanText(match[1])
      if (!candidate) continue
      try {
        const resolved = new URL(candidate, rootUrl).toString()
        if (!discovered.has(resolved)) {
          discovered.add(resolved)
          queue.push(resolved)
        }
      } catch {}
    }
  } catch {}

  const pages = []
  const visitedSitemaps = new Set()

  while (queue.length && visitedSitemaps.size < MAX_SITEMAP_FILES && pages.length < MAX_SITE_PAGES) {
    const sitemapUrl = queue.shift()
    if (!sitemapUrl || visitedSitemaps.has(sitemapUrl)) continue
    visitedSitemaps.add(sitemapUrl)
    try {
      const response = await fetchTextResponse(sitemapUrl, requestOverrides, {
        referer: rootUrl,
      })
      const urls = extractSitemapLocs(response.text, rootUrl)
      const nested = urls.filter((item) => /\.xml($|\?)/i.test(item))
      for (const item of nested) {
        if (!discovered.has(item) && queue.length < MAX_SITEMAP_FILES) {
          discovered.add(item)
          queue.push(item)
        }
      }
      for (const item of urls.filter((entry) => !/\.xml($|\?)/i.test(entry))) {
        if (pages.length >= MAX_SITE_PAGES) break
        if (isLikelyPageUrl(item, rootUrl)) pages.push(item)
      }
    } catch {}
  }

  const unique = Array.from(new Set(pages))
  return unique.length ? unique.slice(0, MAX_SITE_PAGES) : [rootUrl]
}

async function importFromUrl(rawUrl, mode = "crawl", options = {}) {
  const rootUrl = normalizeSiteUrl(rawUrl)
  if (!/^https?:\/\//i.test(rootUrl)) throw new Error("A full website URL is required.")
  const requestOverrides = parseImportRequestOverrides(options.requestOverrides || {})
  const warnings = new Set()
  const assetContext = {
    rootUrl,
    requestOverrides,
    assetCache: new Map(),
    downloadedAssets: new Map(),
    warnings,
    totalBytes: 0,
  }

  const homepage = await fetchSitePage(rootUrl, {
    rootUrl,
    requestOverrides,
    assetContext,
  })
  let targetUrls = [homepage.finalUrl]

  if (mode === "sitemap") {
    targetUrls = await discoverSitemapUrls(homepage.finalUrl, requestOverrides)
  } else if (mode === "crawl") {
    targetUrls = extractSitePagesFromHtml(homepage.rawHtml, homepage.finalUrl).map((page) => page.url)
  }

  const pages = []
  for (const targetUrl of Array.from(new Set(targetUrls)).slice(0, MAX_SITE_PAGES)) {
    try {
      const fetched =
        targetUrl === homepage.finalUrl
          ? homepage
          : await fetchSitePage(targetUrl, {
              rootUrl: homepage.finalUrl,
              requestOverrides,
              assetContext,
            })
      const pagePath = normalizePagePath(fetched.finalUrl, homepage.finalUrl)
      const title = fetched.title || derivePageName(pagePath, "", "")
      pages.push(
        {
          id: pagePath === "/" ? "home" : pathToPageId(pagePath),
          name: title,
          title,
          path: pagePath,
          url: fetched.finalUrl,
          html: fetched.html,
          sourceHtml: fetched.rawHtml,
        },
      )
    } catch {
      if (targetUrl === homepage.finalUrl) throw new Error("Homepage could not be imported.")
    }
  }

  if (!pages.length) throw new Error("No importable pages were found for this URL.")

  const downloadedAssetList = Array.from(assetContext.downloadedAssets.values())
  const styleAssets = downloadedAssetList.filter((entry) => entry?.kind === "style").length
  const analysis = {
    projectType: "Live website import",
    platform: homepage.platform || "static",
    confidence: "medium",
    homepageFile: homepage.finalUrl,
    homepagePath: "/",
    pageCandidates: pages.map((page) => page.path),
    supportFiles: [],
    contentSources: [],
    localeFiles: [],
    styleFiles: [],
    scriptFiles: [],
    assetFiles: downloadedAssetList.map((entry) => entry.url),
    warnings: Array.from(warnings),
    fileCount: pages.length + downloadedAssetList.length,
    pageCount: pages.length,
    styleCount: styleAssets,
    scriptCount: downloadedAssetList.filter((entry) => entry?.kind === "script").length,
    assetCount: downloadedAssetList.length,
    overview: `Imported ${pages.length} page${pages.length === 1 ? "" : "s"} with ${downloadedAssetList.length} localized assets from live URL.`,
    localizedAssets: {
      count: downloadedAssetList.length,
      totalBytes: assetContext.totalBytes,
      byType: downloadedAssetList.reduce((acc, entry) => {
        const key = cleanText(entry?.kind || "asset") || "asset"
        acc[key] = (acc[key] || 0) + 1
        return acc
      }, {}),
    },
  }

  return buildPreviewFromPages({
    name: extractDocumentTitleFromHtml(homepage.html, new URL(homepage.finalUrl).hostname),
    url: homepage.finalUrl,
    pages,
    platform: homepage.platform,
    summary:
      mode === "sitemap"
        ? `${pages.length} page${pages.length === 1 ? "" : "s"} imported from sitemap.xml with ${downloadedAssetList.length} localized assets`
        : mode === "crawl"
        ? `${pages.length} internal page${pages.length === 1 ? "" : "s"} imported from live links with ${downloadedAssetList.length} localized assets`
        : `Homepage imported from live URL with ${downloadedAssetList.length} localized assets`,
    source: "Live",
    analysis,
  })
}

function stripCodeFence(value) {
  const text = String(value || "").trim()
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  return text
}

async function callGemini({ prompt, model = "gemini-2.5-pro", inlineData, userId = null, apiKey = "" }) {
  const key = cleanText(apiKey) || getProviderApiKey("gemini", { userId })
  if (!key) throw new Error("GEMINI_API_KEY not set")
  const parts = [{ text: prompt }]
  if (inlineData?.data && inlineData?.mimeType) {
    parts.push({
      inlineData: {
        mimeType: inlineData.mimeType,
        data: inlineData.data,
      },
    })
  }
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts }] }),
    },
  )
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini error ${response.status}`)
  }
  const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim() || ""
  return text
}

async function callImportAnalysisModel({ prompt, userId = null, model = IMPORT_ANALYSIS_MODEL, maxTokens = 1800, temperature = 0.2 }) {
  const key = getProviderApiKey("anthropic", { userId })
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set")
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system: "You analyze imported website material and return practical, accurate output.",
      messages: [{ role: "user", content: prompt }],
    }),
  })
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Anthropic error ${response.status}`)
  }
  return (data?.content || [])
    .map((chunk) => (chunk?.type === "text" ? chunk.text : ""))
    .join("")
    .trim()
}

function dedupeCleanList(values, max = 20) {
  if (!Array.isArray(values)) return []
  return Array.from(
    new Set(
      values
        .map((value) => cleanText(value))
        .filter(Boolean)
        .slice(0, max),
    ),
  )
}

function buildUniversalImportAnalysisPrompt(preview, payload = {}) {
  const analysis = preview?.analysis && typeof preview.analysis === "object" ? preview.analysis : {}
  const pages = Array.isArray(preview?.pages) ? preview.pages : []
  const pageDigest = pages
    .slice(0, 10)
    .map((page, index) => {
      const text = cleanText(stripHtml(page?.html || "")).slice(0, 260)
      return [
        `PAGE ${index + 1}`,
        `path: ${cleanText(page?.path || "/") || "/"}`,
        `title: ${cleanText(page?.title || page?.name || "") || "untitled"}`,
        `snippet: ${text || "none"}`,
      ].join("\n")
    })
    .join("\n\n---\n\n")

  return [
    "You classify imported website content in an editor pipeline.",
    "Return ONLY valid JSON. No markdown.",
    'Schema: {"projectType":"string","platform":"wordpress|shopify|static|other","confidence":"low|medium|high","overview":"string","homepagePath":"string","warnings":["..."],"contentSources":["..."],"supportFiles":["..."],"keyFindings":["..."],"uploadKind":"string"}',
    `Import kind: ${cleanText(payload.kind || "") || "unknown"}`,
    `Import mode: ${cleanText(payload.mode || "") || "unknown"}`,
    `Entry mode: ${cleanText(payload.entryMode || "") || "unknown"}`,
    `Input file name: ${cleanText(payload.fileName || "") || "none"}`,
    `Input mime type: ${cleanText(payload.mimeType || "") || "none"}`,
    `Current detected projectType: ${cleanText(analysis.projectType || "") || "unknown"}`,
    `Current detected platform: ${cleanText(analysis.platform || "") || "unknown"}`,
    `Current overview: ${cleanText(analysis.overview || "") || "none"}`,
    `Current warnings: ${Array.isArray(analysis.warnings) && analysis.warnings.length ? analysis.warnings.join(" | ") : "none"}`,
    `Page count: ${Number(analysis.pageCount || pages.length || 0)}`,
    `Asset count: ${Number(analysis.assetCount || 0)}`,
    `Support files: ${Array.isArray(analysis.supportFiles) && analysis.supportFiles.length ? analysis.supportFiles.slice(0, 20).join(", ") : "none"}`,
    `Content sources: ${Array.isArray(analysis.contentSources) && analysis.contentSources.length ? analysis.contentSources.slice(0, 20).join(", ") : "none"}`,
    "Page digest:",
    pageDigest || "none",
    "Task: identify what was actually uploaded and refine the classification fields. Keep overview under 80 words.",
  ].join("\n")
}

async function maybeApplyUniversalImportAnalysis(preview, payload = {}, options = {}) {
  if (!preview || typeof preview !== "object") return preview
  if (options.disableAiAnalysis || isTestRuntime()) return preview
  if (!options.userId && !options.forceAiAnalysis) return preview
  const prompt = buildUniversalImportAnalysisPrompt(preview, payload)
  try {
    const generated = await callImportAnalysisModel({
      prompt,
      userId: options.userId,
      maxTokens: 900,
      temperature: 0.1,
    })
    const parsed = parseJsonObjectCandidate(generated)
    if (!parsed || typeof parsed !== "object") return preview

    const normalizedPlatform = cleanText(parsed.platform || "").toLowerCase()
    const normalizedConfidence = cleanText(parsed.confidence || "").toLowerCase()
    const nextAnalysis = {
      ...(preview.analysis && typeof preview.analysis === "object" ? preview.analysis : {}),
    }

    if (cleanText(parsed.projectType)) nextAnalysis.projectType = cleanText(parsed.projectType).slice(0, 140)
    if (["wordpress", "shopify", "static", "other"].includes(normalizedPlatform)) nextAnalysis.platform = normalizedPlatform
    if (["low", "medium", "high"].includes(normalizedConfidence)) nextAnalysis.confidence = normalizedConfidence
    if (cleanText(parsed.overview)) nextAnalysis.overview = cleanText(parsed.overview).slice(0, 600)
    if (cleanText(parsed.homepagePath)) nextAnalysis.homepagePath = cleanText(parsed.homepagePath)

    const warnings = dedupeCleanList([...(nextAnalysis.warnings || []), ...(Array.isArray(parsed.warnings) ? parsed.warnings : [])], 24)
    if (warnings.length) nextAnalysis.warnings = warnings

    const contentSources = dedupeCleanList([...(nextAnalysis.contentSources || []), ...(Array.isArray(parsed.contentSources) ? parsed.contentSources : [])], 40)
    if (contentSources.length) nextAnalysis.contentSources = contentSources

    const supportFiles = dedupeCleanList([...(nextAnalysis.supportFiles || []), ...(Array.isArray(parsed.supportFiles) ? parsed.supportFiles : [])], 40)
    if (supportFiles.length) nextAnalysis.supportFiles = supportFiles

    nextAnalysis.importClassifier = {
      model: IMPORT_ANALYSIS_MODEL,
      uploadKind: cleanText(parsed.uploadKind || payload.kind || "unknown") || "unknown",
      keyFindings: dedupeCleanList(parsed.keyFindings || [], 8),
      analyzedAt: new Date().toISOString(),
    }

    return {
      ...preview,
      analysis: nextAnalysis,
      summary: cleanText(nextAnalysis.overview || preview.summary || "") || preview.summary,
      platform: cleanText(nextAnalysis.platform || preview.platform || "") || preview.platform,
    }
  } catch (error) {
    if (options.requireImportAnalysis) throw error
    const warning = cleanText(error?.message || "")
    if (!warning) return preview
    const nextAnalysis = {
      ...(preview.analysis && typeof preview.analysis === "object" ? preview.analysis : {}),
      warnings: dedupeCleanList([...(preview.analysis?.warnings || []), `AI import analysis unavailable: ${warning}`], 24),
    }
    return {
      ...preview,
      analysis: nextAnalysis,
    }
  }
}

function extractPdfTextFallback(buffer) {
  const binary = buffer.toString("latin1")
  const snippets = []
  const pushText = (value) => {
    const cleaned = cleanText(String(value || "").replace(/\\([()\\])/g, "$1").replace(/\\n/g, " ").replace(/\\r/g, " "))
    if (cleaned && !snippets.includes(cleaned)) snippets.push(cleaned)
  }

  for (const match of binary.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)) {
    pushText(match[1])
  }
  for (const match of binary.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    for (const sub of String(match[1]).matchAll(/\(([^()]*(?:\\.[^()]*)*)\)/g)) {
      pushText(sub[1])
    }
  }

  return snippets.join("\n")
}

async function importPdfBrief(buffer, fileName, options = {}) {
  let html = ""
  try {
    const prompt = [
      "Read this PDF brief and convert it into a single clean HTML briefing page.",
      "Return HTML only.",
      "Preserve names, brands, and URLs exactly.",
      "Use semantic headings, lists, and sections for requirements, goals, content, and action items.",
    ].join("\n")
    const generated = await callGemini({
      prompt,
      model: "gemini-2.5-pro",
      userId: options.userId,
      inlineData: {
        mimeType: "application/pdf",
        data: buffer.toString("base64"),
      },
    })
    html = stripCodeFence(generated)
  } catch {
    const fallbackText = extractPdfTextFallback(buffer)
    html = plainTextToHtml(fallbackText || `${fileName} uploaded`, fileName.replace(/\.pdf$/i, ""))
  }

  return buildPreviewFromPages({
    name: fileName.replace(/\.pdf$/i, "") || "Imported PDF brief",
    url: "",
    pages: [
      buildPageRecord({
        id: "brief",
        name: "Brief",
        title: fileName.replace(/\.pdf$/i, "") || "Brief",
        path: "/",
        url: "",
        html,
      }),
    ],
    platform: "static",
    summary: "PDF brief imported into one structured project page",
    source: "Brief",
  })
}

async function importDocxBrief(buffer, fileName) {
  const entries = await readZipEntries(buffer)
  const documentEntry = entries.find((entry) => entry.name === "word/document.xml")
  if (!documentEntry) throw new Error("DOCX document.xml could not be found")
  const xml = documentEntry.buffer.toString("utf8")
  const paragraphs = []

  for (const paragraph of xml.match(/<w:p[\s\S]*?<\/w:p>/g) || []) {
    const style = paragraph.match(/<w:pStyle[^>]*w:val="([^"]+)"/i)?.[1] || ""
    const text = decodeXmlEntities(
      Array.from(paragraph.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g))
        .map((match) => match[1])
        .join(" "),
    )
    const cleaned = cleanText(text)
    if (!cleaned) continue
    paragraphs.push({ style, text: cleaned })
  }

  const body = paragraphs
    .map((entry, index) => {
      if (/heading1/i.test(entry.style) || (index === 0 && entry.text.length < 80)) return `<h1>${escapeHtml(entry.text)}</h1>`
      if (/heading2/i.test(entry.style)) return `<h2>${escapeHtml(entry.text)}</h2>`
      if (/heading3/i.test(entry.style)) return `<h3>${escapeHtml(entry.text)}</h3>`
      return `<p>${escapeHtml(entry.text)}</p>`
    })
    .join("\n")

  const html = wrapImportedHtml(fileName.replace(/\.docx$/i, "") || "Imported DOCX", body, "DOCX brief")
  return buildPreviewFromPages({
    name: fileName.replace(/\.docx$/i, "") || "Imported DOCX brief",
    url: "",
    pages: [
      buildPageRecord({
        id: "brief",
        name: "Brief",
        title: fileName.replace(/\.docx$/i, "") || "Brief",
        path: "/",
        url: "",
        html,
      }),
    ],
    platform: "static",
    summary: "DOCX brief imported into one structured project page",
    source: "Brief",
  })
}

async function importScreenshot(buffer, fileName, mimeType, options = {}) {
  const prompt = [
    "You are rebuilding a screenshot as a clean static HTML and CSS page.",
    "Return HTML only. No markdown. No explanations.",
    "Use one embedded <style> block and semantic markup.",
    "Recreate the visible layout, hierarchy, and text as faithfully as possible.",
    "Do not use external image URLs, scripts, frameworks, or placeholder lorem ipsum.",
    "Make the result responsive and editable.",
  ].join("\n")

  const generated = await callGemini({
    prompt,
    model: "gemini-2.5-pro",
    userId: options.userId,
    inlineData: {
      mimeType,
      data: buffer.toString("base64"),
    },
  })

  const html = stripCodeFence(generated)
  return buildPreviewFromPages({
    name: fileName.replace(/\.[a-z0-9]+$/i, "") || "Screenshot import",
    url: "",
    pages: [
      buildPageRecord({
        id: "home",
        name: "Home",
        title: fileName.replace(/\.[a-z0-9]+$/i, "") || "Screenshot import",
        path: "/",
        url: "",
        html,
      }),
    ],
    platform: "static",
    summary: "Screenshot converted into an editable page draft",
    source: "Visual",
  })
}

export async function buildProjectImportPreview(payload = {}, options = {}) {
  const kind = cleanText(payload.kind || "url").toLowerCase()
  const userId = options.userId ?? payload.userId ?? null
  const sharedOptions = {
    ...options,
    userId,
    requireImportAnalysis: options.requireImportAnalysis !== false && Boolean(userId || options.forceAiAnalysis),
  }
  let preview = null
  if (kind === "url") {
    const mode = cleanText(payload.mode || "crawl").toLowerCase()
    preview = await importFromUrl(payload.url, mode, {
      requestOverrides: payload.requestOverrides,
    })
    return maybeApplyUniversalImportAnalysis(preview, payload, sharedOptions)
  }

  if (kind === "entries") {
    const entries = Array.isArray(payload.entries) ? payload.entries : []
    preview = await buildPagesFromEntries(entries, {
      title: cleanText(payload.title || payload.fileName || "Imported files"),
      summary: cleanText(payload.summary || ""),
      entryMode: cleanText(payload.entryMode || "auto"),
      userId,
      requireImportAnalysis: sharedOptions.requireImportAnalysis,
    })
    return maybeApplyUniversalImportAnalysis(preview, payload, sharedOptions)
  }

  if (kind === "zip") {
    const fileName = cleanText(payload.fileName || "site.zip")
    const buffer = readBase64Buffer(payload.contentBase64)
    const entries = await readZipEntries(buffer)
    preview = await buildPagesFromEntries(entries, {
      title: fileName.replace(/\.zip$/i, "") || "Imported ZIP site",
      summary: "ZIP website imported into project pages",
      entryMode: "zip",
      userId,
      requireImportAnalysis: sharedOptions.requireImportAnalysis,
    })
    return maybeApplyUniversalImportAnalysis(preview, payload, sharedOptions)
  }

  if (kind === "brief") {
    const fileName = cleanText(payload.fileName || "brief")
    const mimeType = guessMimeType(fileName, cleanText(payload.mimeType || ""))
    const buffer = readBase64Buffer(payload.contentBase64)
    if (/pdf/i.test(mimeType) || /\.pdf$/i.test(fileName)) {
      preview = await importPdfBrief(buffer, fileName, { userId })
      return maybeApplyUniversalImportAnalysis(preview, payload, sharedOptions)
    }
    if (/wordprocessingml/i.test(mimeType) || /\.docx$/i.test(fileName)) {
      preview = await importDocxBrief(buffer, fileName)
      return maybeApplyUniversalImportAnalysis(preview, payload, sharedOptions)
    }
    preview = await buildPagesFromEntries(
      [{ name: fileName, mimeType, buffer }],
      {
        title: fileName.replace(/\.[a-z0-9]+$/i, "") || "Imported brief",
        summary: "Brief imported into one project page",
        entryMode: "single-file",
        userId,
        requireImportAnalysis: sharedOptions.requireImportAnalysis,
      },
    )
    return maybeApplyUniversalImportAnalysis(preview, payload, sharedOptions)
  }

  if (kind === "screenshot") {
    const fileName = cleanText(payload.fileName || "screenshot.png")
    const mimeType = guessMimeType(fileName, cleanText(payload.mimeType || "image/png"))
    const buffer = readBase64Buffer(payload.contentBase64)
    preview = await importScreenshot(buffer, fileName, mimeType, { userId })
    return maybeApplyUniversalImportAnalysis(preview, payload, sharedOptions)
  }

  throw new Error("Unknown import type")
}
