import path from "node:path"
import { normalizeProjectDocument, normalizeSiteUrl } from "./siteMeta.js"

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

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
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

function buildPageRecord({ id, name, title = "", path: pagePath, url = "", html = "" }) {
  return {
    id,
    name,
    title,
    path: pagePath,
    url,
    html,
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
          stream.on("data", (chunk) => chunks.push(chunk))
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
    return buildPageRecord({
      id: page.id,
      name: page.name,
      title: page.title || extractDocumentTitleFromHtml(normalizedPage.html, page.name),
      path: page.path,
      url: pageUrl,
      html: normalizedPage.html,
    })
  })

  return {
    name: cleanText(name) || extractDocumentTitleFromHtml(normalized.html, "Imported project"),
    url: normalized.meta.url || url || "",
    html: normalized.html,
    pages: normalizedPages,
    platform: resolvedPlatform,
    summary: cleanText(summary) || `${source} import ready`,
    analysis: analysis
      ? {
          ...analysis,
          platform: resolvedPlatform,
        }
      : undefined,
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

async function maybeGenerateImportOverview(analysis) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) return analysis.overview
  if (analysis.fileCount > 80) return analysis.overview
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
    const generated = await callGemini({ prompt, model: "gemini-2.5-flash" })
    const summary = cleanText(stripCodeFence(generated))
    return summary || analysis.overview
  } catch {
    return analysis.overview
  }
}

async function buildPagesFromEntries(entries, options = {}) {
  const { analysis, pageEntries, assetEntries } = analyzeImportEntries(entries, options)
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

  analysis.overview = await maybeGenerateImportOverview(analysis)
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

async function fetchTextResponse(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteEditor/1.0)" },
  })
  if (!response.ok) throw new Error(`Could not load ${url} (${response.status})`)
  return {
    text: await response.text(),
    finalUrl: response.url || url,
  }
}

async function fetchSitePage(url) {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (compatible; SiteEditor/1.0)" },
  })
  if (!response.ok) throw new Error(`Could not load page (${response.status})`)
  const rawHtml = await response.text()
  const finalUrl = response.url || url
  const normalized = normalizeProjectDocument({ html: rawHtml, url: finalUrl, platform: "unknown" })
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

async function discoverSitemapUrls(rootUrl) {
  const root = new URL(rootUrl)
  const queue = [new URL("/sitemap.xml", root).toString()]
  const discovered = new Set(queue)

  try {
    const robots = await fetchTextResponse(new URL("/robots.txt", root).toString())
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
      const response = await fetchTextResponse(sitemapUrl)
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

async function importFromUrl(rawUrl, mode = "crawl") {
  const rootUrl = normalizeSiteUrl(rawUrl)
  if (!/^https?:\/\//i.test(rootUrl)) throw new Error("A full website URL is required.")

  const homepage = await fetchSitePage(rootUrl)
  let targetUrls = [homepage.finalUrl]

  if (mode === "sitemap") {
    targetUrls = await discoverSitemapUrls(homepage.finalUrl)
  } else if (mode === "crawl") {
    targetUrls = extractSitePagesFromHtml(homepage.rawHtml, homepage.finalUrl).map((page) => page.url)
  }

  const pages = []
  for (const targetUrl of Array.from(new Set(targetUrls)).slice(0, MAX_SITE_PAGES)) {
    try {
      const fetched = targetUrl === homepage.finalUrl ? homepage : await fetchSitePage(targetUrl)
      const pagePath = normalizePagePath(fetched.finalUrl, homepage.finalUrl)
      const title = fetched.title || derivePageName(pagePath, "", "")
      pages.push(
        buildPageRecord({
          id: pagePath === "/" ? "home" : pathToPageId(pagePath),
          name: title,
          title,
          path: pagePath,
          url: fetched.finalUrl,
          html: fetched.html,
        }),
      )
    } catch {
      if (targetUrl === homepage.finalUrl) throw new Error("Homepage could not be imported.")
    }
  }

  if (!pages.length) throw new Error("No importable pages were found for this URL.")

  return buildPreviewFromPages({
    name: extractDocumentTitleFromHtml(homepage.html, new URL(homepage.finalUrl).hostname),
    url: homepage.finalUrl,
    pages,
    platform: homepage.platform,
    summary:
      mode === "sitemap"
        ? `${pages.length} page${pages.length === 1 ? "" : "s"} imported from sitemap.xml`
        : mode === "crawl"
        ? `${pages.length} internal page${pages.length === 1 ? "" : "s"} imported from live links`
        : "Homepage imported from live URL",
    source: "Live",
  })
}

function stripCodeFence(value) {
  const text = String(value || "").trim()
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i)
  if (fenced) return fenced[1].trim()
  return text
}

async function callGemini({ prompt, model = "gemini-2.5-pro", inlineData }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
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

async function importPdfBrief(buffer, fileName) {
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

async function importScreenshot(buffer, fileName, mimeType) {
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

export async function buildProjectImportPreview(payload = {}) {
  const kind = cleanText(payload.kind || "url").toLowerCase()
  if (kind === "url") {
    const mode = cleanText(payload.mode || "crawl").toLowerCase()
    return importFromUrl(payload.url, mode)
  }

  if (kind === "entries") {
    const entries = Array.isArray(payload.entries) ? payload.entries : []
    return await buildPagesFromEntries(entries, {
      title: cleanText(payload.title || payload.fileName || "Imported files"),
      summary: cleanText(payload.summary || ""),
      entryMode: cleanText(payload.entryMode || "auto"),
    })
  }

  if (kind === "zip") {
    const fileName = cleanText(payload.fileName || "site.zip")
    const buffer = readBase64Buffer(payload.contentBase64)
    const entries = await readZipEntries(buffer)
    return await buildPagesFromEntries(entries, {
      title: fileName.replace(/\.zip$/i, "") || "Imported ZIP site",
      summary: "ZIP website imported into project pages",
      entryMode: "zip",
    })
  }

  if (kind === "brief") {
    const fileName = cleanText(payload.fileName || "brief")
    const mimeType = guessMimeType(fileName, cleanText(payload.mimeType || ""))
    const buffer = readBase64Buffer(payload.contentBase64)
    if (/pdf/i.test(mimeType) || /\.pdf$/i.test(fileName)) {
      return importPdfBrief(buffer, fileName)
    }
    if (/wordprocessingml/i.test(mimeType) || /\.docx$/i.test(fileName)) {
      return importDocxBrief(buffer, fileName)
    }
    return await buildPagesFromEntries(
      [{ name: fileName, mimeType, buffer }],
      {
        title: fileName.replace(/\.[a-z0-9]+$/i, "") || "Imported brief",
        summary: "Brief imported into one project page",
        entryMode: "single-file",
      },
    )
  }

  if (kind === "screenshot") {
    const fileName = cleanText(payload.fileName || "screenshot.png")
    const mimeType = guessMimeType(fileName, cleanText(payload.mimeType || "image/png"))
    const buffer = readBase64Buffer(payload.contentBase64)
    return importScreenshot(buffer, fileName, mimeType)
  }

  throw new Error("Unknown import type")
}
