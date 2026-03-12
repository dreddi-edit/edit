import type { ProjectAsset as AssetEntry, ProjectPage } from "./api/projects";

export const BLOCK_FILTER_OPTIONS: Array<{ value: BlockFilter; label: string }> = [
  { value: "all", label: "All blocks" },
  { value: "button", label: "Buttons" },
  { value: "heading", label: "Headings" },
  { value: "image", label: "Images" },
  { value: "form", label: "Forms" },
  { value: "navigation", label: "Navigation" },
  { value: "container", label: "Containers" },
  { value: "list", label: "Lists" },
  { value: "content", label: "Content" },
]

export const EDIT_RAIL_EXPANDED_WIDTH = 272
export const EDIT_RAIL_COLLAPSED_WIDTH = 72
export const DEFAULT_CHROME_BACKGROUND = "rgba(5, 12, 24, 0.96)"
export const DEFAULT_CHROME_BORDER = "rgba(96, 165, 250, 0.18)"
export const EXPORT_FILENAME_MAP: Record<ExportMode, string> = {
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
export const EXPORT_MODE_OPTIONS: Array<{ value: ExportMode; label: string }> = [
  { value: "wp-placeholder", label: "WP Placeholder" },
  { value: "html-clean", label: "HTML Clean" },
  { value: "html-raw", label: "HTML Raw" },
  { value: "shopify-section", label: "Shopify Section" },
  { value: "wp-theme", label: "WordPress Theme" },
  { value: "wp-block", label: "WordPress Block" },
  { value: "web-component", label: "Web Component" },
  { value: "react-component", label: "React Component" },
  { value: "webflow-json", label: "Webflow JSON" },
  { value: "email-newsletter", label: "Email Newsletter" },
  { value: "markdown-content", label: "Markdown" },
  { value: "pdf-print", label: "PDF Print" },
]
export const WORKFLOW_STAGE_OPTIONS: Array<{ value: WorkflowStage; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "internal_review", label: "Internal review" },
  { value: "client_review", label: "Client review" },
  { value: "approved", label: "Approved" },
  { value: "shipped", label: "Shipped" },
]
export const PROJECT_VERSION_SOURCE_LABELS: Record<ProjectVersionSource, string> = {
  autosave: "Autosave",
  manual: "Manual snapshot",
  translate: "Before translation",
  ai_block: "Before AI block",
  ai_page: "Before AI page",
  ai_prompt: "Before AI prompt",
  restore: "Restore backup",
  export: "Before export",
}
export const VIEWPORT_PRESETS: Record<ViewportPreset, { label: string; width: number | null }> = {
  desktop: { label: "Desktop", width: null },
  tablet: { label: "Tablet", width: 820 },
  mobile: { label: "Mobile", width: 390 },
}
export const DEFAULT_GLOBAL_STYLE_OVERRIDES: GlobalStyleOverrides = {
  fontFamily: "",
  textColor: "",
  backgroundColor: "",
  accentColor: "",
}

export function titleCaseFallback(value: string): string {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}


export function formatEditorDateTime(value: string): string {
  if (!value) return "Unknown date"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

export function parseRgbChannels(color: string): [number, number, number] | null {
  const match = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

export function getColorBrightness(color: string): number | null {
  const channels = parseRgbChannels(color)
  if (!channels) return null
  const [r, g, b] = channels
  return (r * 299 + g * 587 + b * 114) / 1000
}

export function pickEditorChromeFromDocument(doc: Document | null): { background: string; border: string } {
  if (!doc) return { background: DEFAULT_CHROME_BACKGROUND, border: DEFAULT_CHROME_BORDER }
  const candidates = Array.from(
    doc.querySelectorAll("header, nav, [role='banner'], .site-header, .navbar, .header, .topbar, body")
  ) as HTMLElement[]

  for (const el of candidates) {
    const style = doc.defaultView?.getComputedStyle(el)
    const color = style?.backgroundColor || ""
    if (!color || color === "transparent" || color === "rgba(0, 0, 0, 0)") continue
    const brightness = getColorBrightness(color)
    if (brightness == null || brightness > 192) continue
    return {
      background: color.replace("rgb(", "rgba(").replace(")", ", 0.96)"),
      border: "rgba(255,255,255,0.08)",
    }
  }

  return { background: DEFAULT_CHROME_BACKGROUND, border: DEFAULT_CHROME_BORDER }
}

export function getDownloadFilename(response: Response, mode: ExportMode): string {
  const disposition = response.headers.get("Content-Disposition") || ""
  const match = disposition.match(/filename="?([^"]+)"?/i)
  if (match?.[1]) return match[1]
  return EXPORT_FILENAME_MAP[mode]
}

export function readSavedTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"
  const bodyTheme = document.body.getAttribute("data-theme")
  if (bodyTheme === "light" || bodyTheme === "dark") return bodyTheme
  return localStorage.getItem("se_theme") === "light" ? "light" : "dark"
}

export function serializeEditorHtml(doc: Document, inputIsDocument: boolean) {
  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ""}${
        doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ""
      }>`
    : ""
  return inputIsDocument
    ? `${doctype ? `${doctype}\n` : ""}${doc.documentElement.outerHTML}`
    : doc.body.innerHTML
}

export function stripHtmlForPreview(value: string) {
  return String(value || "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildDiffPreview(value: string, max = 420) {
  return shortenText(stripHtmlForPreview(value), max)
}

export function collectProjectAssets(currentHtml: string, pages: ProjectPage[]) {
  const parser = new DOMParser()
  const seen = new Set<string>()
  const assets: AssetEntry[] = []
  const documents = [String(currentHtml || ""), ...pages.map((page) => String(page.html || ""))]

  for (const html of documents) {
    if (!html.trim()) continue
    const doc = parser.parseFromString(
      /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`,
      "text/html",
    )
    doc.querySelectorAll("img[src], source[src], img[data-bo-local-src], link[href]").forEach((element) => {
      const tag = element.tagName.toLowerCase()
      const url = String(element.getAttribute(tag === "link" ? "href" : "src") || "").trim()
      if (!url || seen.has(url)) return
      const lower = url.toLowerCase()
      const isFont = tag === "link" || /\.(woff2?|ttf|otf|eot)(\?|#|$)/i.test(lower)
      const isImage = tag !== "link" || /\.(png|jpe?g|gif|webp|svg|avif)(\?|#|$)/i.test(lower)
      if (!isFont && !isImage) return
      seen.add(url)
      assets.push({
        id: `${isFont ? "font" : "image"}:${url}`,
        type: isFont ? "font" : "image",
        url,
        label: url.split("/").pop() || url,
      })
    })
  }

  return assets.slice(0, 80)
}

export function mergeAssetLibraries(primary: AssetEntry[], secondary: AssetEntry[]) {
  const seen = new Set<string>()
  return [...primary, ...secondary].filter((asset, index) => {
    const key = `${asset.type}:${asset.url || asset.id || index}`
    if (!asset.url || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error("File read failed"))
    reader.onload = () => resolve(String(reader.result || ""))
    reader.readAsDataURL(file)
  })
}

export function collectCssVariables(html: string) {
  const seen = new Set<string>()
  const vars: string[] = []
  for (const match of String(html || "").matchAll(/(--[A-Za-z0-9_-]+)\s*:/g)) {
    const name = match[1]
    if (!name || seen.has(name)) continue
    seen.add(name)
    vars.push(name)
  }
  return vars.slice(0, 40)
}

export function applyGlobalStylesToHtml(
  html: string,
  overrides: GlobalStyleOverrides,
  cssVariables: Record<string, string>,
  fontAsset?: AssetEntry | null,
) {
  const source = String(html || "")
  if (!source.trim()) return source
  const parser = new DOMParser()
  const inputIsDocument = /<html[\s>]/i.test(source) || /<!doctype/i.test(source)
  const doc = parser.parseFromString(
    inputIsDocument ? source : `<!doctype html><html><head></head><body>${source}</body></html>`,
    "text/html",
  )
  const head = doc.head || doc.documentElement.insertBefore(doc.createElement("head"), doc.body || null)
  const styleId = "se-global-style-overrides"
  doc.getElementById(styleId)?.remove()

  const rootLines = Object.entries(cssVariables)
    .filter(([, value]) => String(value || "").trim())
    .map(([name, value]) => `${name}: ${String(value).trim()};`)
  if (overrides.textColor.trim()) rootLines.push(`--se-editor-text-color: ${overrides.textColor.trim()};`)
  if (overrides.backgroundColor.trim()) rootLines.push(`--se-editor-surface-color: ${overrides.backgroundColor.trim()};`)
  if (overrides.accentColor.trim()) rootLines.push(`--se-editor-accent-color: ${overrides.accentColor.trim()};`)

  const bodyRules = [
    overrides.fontFamily.trim() ? `font-family: ${overrides.fontFamily.trim()} !important;` : "",
    overrides.textColor.trim() ? `color: var(--se-editor-text-color) !important;` : "",
    overrides.backgroundColor.trim() ? `background: var(--se-editor-surface-color) !important;` : "",
  ].filter(Boolean)

  const accentRules = overrides.accentColor.trim()
    ? `
      a { color: var(--se-editor-accent-color) !important; }
      button, .button, [class*="button"], [type="submit"] {
        border-color: var(--se-editor-accent-color) !important;
      }
    `
    : ""

  const fontFaceCss =
    fontAsset?.type === "font" && fontAsset.url
      ? `
        @font-face {
          font-family: '${String(fontAsset.label || "ProjectFont").replace(/\.[A-Za-z0-9]+$/, "")}';
          src: url('${fontAsset.url}') format('${/woff2/i.test(fontAsset.mimeType || fontAsset.url) ? "woff2" : /woff/i.test(fontAsset.mimeType || fontAsset.url) ? "woff" : /otf/i.test(fontAsset.mimeType || fontAsset.url) ? "opentype" : "truetype"}');
          font-display: swap;
        }
      `
      : ""

  const css = `
    ${fontFaceCss}
    :root {
      ${rootLines.join("\n")}
    }
    ${bodyRules.length ? `body { ${bodyRules.join(" ")} }` : ""}
    ${accentRules}
  `.trim()

  if (!css) return serializeEditorHtml(doc, inputIsDocument)

  const style = doc.createElement("style")
  style.id = styleId
  style.textContent = css
  head.appendChild(style)

  return serializeEditorHtml(doc, inputIsDocument)
}

export function applyTranslationOverrideToHtml(
  html: string,
  segment: WebsiteTranslationSegment,
  nextValue: string,
) {
  const source = String(html || "")
  if (!source.trim()) return source
  const parser = new DOMParser()
  const inputIsDocument = /<html[\s>]/i.test(source) || /<!doctype/i.test(source)
  const doc = parser.parseFromString(
    inputIsDocument ? source : `<!doctype html><html><body>${source}</body></html>`,
    "text/html",
  )
  const element = doc.querySelector(segment.selector)
  if (!element) return source

  if (segment.kind === "attr" && segment.attr) {
    element.setAttribute(segment.attr, nextValue)
  } else {
    const textNodes = Array.from(element.childNodes).filter((node) => node.nodeType === Node.TEXT_NODE) as Text[]
    const targetNode = textNodes[Math.max(0, Number(segment.textIndex || 0))]
    if (!targetNode) return source
    const leading = targetNode.nodeValue?.match(/^\s*/)?.[0] || ""
    const trailing = targetNode.nodeValue?.match(/\s*$/)?.[0] || ""
    targetNode.nodeValue = `${leading}${nextValue}${trailing}`
  }

  return serializeEditorHtml(doc, inputIsDocument)
}

export function buildTranslationSegmentsWithOverrides(
  segments: WebsiteTranslationSegment[],
  overrides: Record<string, string> = {},
) {
  return segments.map((segment) => ({
    ...segment,
    translatedText: overrides[segment.id]?.trim() || segment.translatedText,
  }))
}

export function applyTranslationOverridesToHtml(
  html: string,
  segments: WebsiteTranslationSegment[],
  overrides: Record<string, string> = {},
) {
  return buildTranslationSegmentsWithOverrides(segments, overrides).reduce((acc, segment) => {
    const nextValue = overrides[segment.id]?.trim()
    return nextValue ? applyTranslationOverrideToHtml(acc, segment, nextValue) : acc
  }, String(html || ""))
}

export function getLanguageVariantEffectiveHtml(variant?: ProjectLanguageVariant | null) {
  if (!variant) return ""
  if (variant.baseHtml && variant.segments?.length && variant.overrides && Object.keys(variant.overrides).length) {
    return applyTranslationOverridesToHtml(variant.baseHtml, variant.segments as WebsiteTranslationSegment[], variant.overrides)
  }
  return String(variant.html || variant.baseHtml || "")
}

export function buildLocalAudit(html: string, loadedUrl: string, source: EditorAudit["source"], remoteAudit?: {
  scores?: Record<string, number>
  metrics?: Record<string, string>
  opportunities?: Array<{ title: string; value: string }>
}) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(
    /<html[\s>]/i.test(html) ? html : `<!doctype html><html><body>${html}</body></html>`,
    "text/html",
  )
  if (source === "seo") {
    const title = doc.querySelector("title")?.textContent?.trim() || ""
    const description = doc.querySelector("meta[name='description']")?.getAttribute("content")?.trim() || ""
    const h1Count = doc.querySelectorAll("h1").length
    const missingAlt = Array.from(doc.querySelectorAll("img")).filter((img) => !(img.getAttribute("alt") || "").trim()).length
    const items = [
      !title ? "Add a page title." : title.length > 70 ? "Shorten the title below 70 characters." : `Title looks present (${title.length} chars).`,
      !description ? "Add a meta description." : description.length > 160 ? "Shorten the meta description below 160 characters." : `Meta description looks present (${description.length} chars).`,
      h1Count === 0 ? "Add a single H1 heading on the page." : h1Count > 1 ? "Reduce multiple H1 headings to one clear primary headline." : "Primary H1 structure looks valid.",
      missingAlt > 0 ? `${missingAlt} image${missingAlt === 1 ? "" : "s"} still need alt text.` : "All detected images have alt text.",
    ]
    const scoreBadges = remoteAudit?.scores
      ? Object.entries(remoteAudit.scores).map(([key, value]) => `${titleCaseFallback(key)} ${value}`)
      : []
    const summary = loadedUrl
      ? `SEO review for ${loadedUrl.replace(/^https?:\/\//, "")}`
      : "SEO review for the current page"
    if (remoteAudit?.opportunities?.length) {
      items.push(...remoteAudit.opportunities.slice(0, 3).map((item) => `${item.title}: ${item.value}`))
    }
    return {
      source,
      headline: "SEO audit",
      summary,
      items,
      scoreBadges,
    } satisfies EditorAudit
  }

  if (source === "accessibility") {
    const missingAlt = Array.from(doc.querySelectorAll("img")).filter((img) => !(img.getAttribute("alt") || "").trim()).length
    const unlabeledFields = Array.from(doc.querySelectorAll("input, textarea, select")).filter((field) => {
      if ((field.getAttribute("type") || "").toLowerCase() === "hidden") return false
      const id = field.getAttribute("id")
      if (id && doc.querySelector(`label[for="${id}"]`)) return false
      return !(field.getAttribute("aria-label") || field.getAttribute("placeholder") || "").trim()
    }).length
    const buttonIssues = Array.from(doc.querySelectorAll("button, a")).filter((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim()
      return !text && !node.querySelector("img[alt]")
    }).length
    return {
      source,
      headline: "Accessibility audit",
      summary: "Quick structural review of alt text, labels, and interactive copy.",
      items: [
        missingAlt > 0 ? `${missingAlt} image${missingAlt === 1 ? "" : "s"} are missing alt text.` : "Image alt text coverage looks complete.",
        unlabeledFields > 0 ? `${unlabeledFields} form field${unlabeledFields === 1 ? "" : "s"} need labels or aria-labels.` : "Form fields look labelled.",
        buttonIssues > 0 ? `${buttonIssues} interactive element${buttonIssues === 1 ? "" : "s"} need visible or accessible text.` : "Interactive elements look labelled.",
      ],
    } satisfies EditorAudit
  }

  const ctas = Array.from(doc.querySelectorAll("a, button")).filter((node) =>
    /(start|get|book|buy|contact|talk|demo|trial|quote|apply|join|learn)/i.test((node.textContent || "").trim()),
  ).length
  const headings = Array.from(doc.querySelectorAll("h1, h2")).map((node) => (node.textContent || "").trim()).filter(Boolean)
  return {
    source,
    headline: "CRO audit",
    summary: "Checks for a clear headline, CTA coverage, and section flow.",
    items: [
      headings[0] ? `Primary headline: "${shortenText(headings[0], 82)}".` : "Add a stronger primary headline above the fold.",
      ctas === 0 ? "No clear CTA found. Add a primary CTA near the top of the page." : `${ctas} CTA element${ctas === 1 ? "" : "s"} detected across the page.`,
      headings.length < 3 ? "Add clearer section hierarchy to guide the visitor through the offer." : "Section hierarchy looks present.",
    ],
  } satisfies EditorAudit
}


export const shortenText = (text: string, length: number): string => {
  if (!text || text.length <= length) return text;
  return text.substring(0, length) + "...";
};

export const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};
