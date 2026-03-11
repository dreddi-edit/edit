import path from "node:path"
import { normalizeProjectDocument, normalizeSiteUrl } from "./siteMeta.js"

const MAX_SITE_PAGES = 16
const MAX_SITEMAP_FILES = 6
const HTML_FILE_EXTENSIONS = new Set([".html", ".htm"])
const TEXT_FILE_EXTENSIONS = new Set([".md", ".markdown", ".txt"])
const IMAGE_FILE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".avif", ".ico"])
const MEDIA_FILE_EXTENSIONS = new Set([".mp4", ".webm", ".mov", ".mp3", ".wav", ".ogg"])
const FONT_FILE_EXTENSIONS = new Set([".woff", ".woff2", ".ttf", ".otf", ".eot"])
const CSS_FILE_EXTENSIONS = new Set([".css"])
const PAGE_SKIP_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".ico",
  ".pdf", ".zip", ".xml", ".json", ".txt", ".css", ".js",
  ".mp4", ".mov", ".mp3", ".wav", ".webm", ".woff", ".woff2", ".ttf", ".eot", ".otf",
])

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
  if (ext === ".svg") return "image/svg+xml"
  if (CSS_FILE_EXTENSIONS.has(ext)) return "text/css"
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

function buildPreviewFromPages({ name, url = "", pages = [], platform = "static", summary = "", source = "import" }) {
  const primaryPage = pickPrimaryPage(pages)
  const normalized = normalizeProjectDocument({
    html: primaryPage?.html || "",
    url,
    platform,
  })
  const normalizedPages = pages.map((page) => {
    const pageHtml = String(page.html || "")
    const pageUrl = page.url || page.path || url || ""
    const normalizedPage = normalizeProjectDocument({
      html: pageHtml,
      url: /^https?:\/\//i.test(pageUrl) ? pageUrl : url || "",
      platform: normalized.meta.platform || platform,
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
    platform: normalized.meta.platform || platform || "static",
    summary: cleanText(summary) || `${source} import ready`,
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
    if (TEXT_FILE_EXTENSIONS.has(path.extname(entryPath).toLowerCase()) || HTML_FILE_EXTENSIONS.has(path.extname(entryPath).toLowerCase()) || CSS_FILE_EXTENSIONS.has(path.extname(entryPath).toLowerCase()) || path.extname(entryPath).toLowerCase() === ".svg") {
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
  if (HTML_FILE_EXTENSIONS.has(ext)) return String(text || "")
  if (ext === ".svg") return wrapImportedHtml(title, `<div style="display:flex;justify-content:center;padding:24px;background:#fff;border-radius:24px;">${text}</div>`, "SVG import")
  if (TEXT_FILE_EXTENSIONS.has(ext)) {
    return ext === ".txt" ? plainTextToHtml(text, title) : markdownToHtml(text, title)
  }
  return wrapImportedHtml(title, `<pre>${escapeHtml(text)}</pre>`, "Imported file")
}

function buildPagesFromEntries(entries, options = {}) {
  const { textEntries, assetEntries } = entryToBufferMap(entries)
  const pageCandidates = []

  for (const [entryPath, entry] of textEntries) {
    const ext = path.extname(entryPath).toLowerCase()
    if (!HTML_FILE_EXTENSIONS.has(ext) && ext !== ".svg" && !TEXT_FILE_EXTENSIONS.has(ext)) continue
    const rawHtml = convertTextEntryToHtml(entryPath, entry.text)
    const html = inlineHtmlAssets(rawHtml, entryPath, assetEntries, textEntries)
    const pagePath = filePathToPagePath(entryPath)
    pageCandidates.push(
      buildPageRecord({
        id: pathToPageId(entryPath),
        name: extractDocumentTitleFromHtml(html, pathToTitle(entryPath)),
        title: extractDocumentTitleFromHtml(html, pathToTitle(entryPath)),
        path: pagePath,
        url: pagePath,
        html,
      }),
    )
  }

  if (!pageCandidates.length) {
    const assetEntriesList = Array.from(assetEntries.values()).filter((entry) => {
      const ext = path.extname(entry.name).toLowerCase()
      return IMAGE_FILE_EXTENSIONS.has(ext) || MEDIA_FILE_EXTENSIONS.has(ext) || FONT_FILE_EXTENSIONS.has(ext)
    })
    if (!assetEntriesList.length) throw new Error("No importable pages or assets found in the uploaded files.")
    const html = buildAssetLibraryHtml(assetEntriesList, options.title || "Asset library")
    pageCandidates.push(
      buildPageRecord({
        id: "assets",
        name: options.title || "Asset library",
        title: options.title || "Asset library",
        path: "/",
        url: "",
        html,
      }),
    )
  }

  pageCandidates.sort((left, right) => {
    if (left.path === "/") return -1
    if (right.path === "/") return 1
    return left.path.localeCompare(right.path)
  })

  return buildPreviewFromPages({
    name: options.title || pathToTitle(pageCandidates[0]?.name || "Imported project"),
    url: "",
    pages: pageCandidates,
    platform: "static",
    summary: options.summary || `${pageCandidates.length} page${pageCandidates.length === 1 ? "" : "s"} imported from files`,
    source: "Local",
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
    return buildPagesFromEntries(entries, {
      title: cleanText(payload.title || payload.fileName || "Imported files"),
      summary: cleanText(payload.summary || ""),
    })
  }

  if (kind === "zip") {
    const fileName = cleanText(payload.fileName || "site.zip")
    const buffer = readBase64Buffer(payload.contentBase64)
    const entries = await readZipEntries(buffer)
    return buildPagesFromEntries(entries, {
      title: fileName.replace(/\.zip$/i, "") || "Imported ZIP site",
      summary: "ZIP website imported into project pages",
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
    return buildPagesFromEntries(
      [{ name: fileName, mimeType, buffer }],
      {
        title: fileName.replace(/\.[a-z0-9]+$/i, "") || "Imported brief",
        summary: "Brief imported into one project page",
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
