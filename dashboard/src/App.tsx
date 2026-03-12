import { apiMe, type User } from "./api/auth"
import { apiGetPlan } from "./api/credits"
import { apiFetch, fetchWithAuth } from "./api/client"
import {
  apiCreateProjectShare,
  apiCreatePublishPreview,
  apiCreateProjectVersion,
  apiDeleteProjectShare,
  apiGetCustomDomainGuide,
  apiGetProject,
  apiGetPublishHistory,
  apiGetPublishTargets,
  apiGetProjectShares,
  apiGetProjectVersion,
  apiGetProjectVersions,
  apiLoadProjectPage,
  apiPublishProject,
  apiRollbackDeployment,
  apiGetProjectWorkflowHistory,
  apiRestoreProjectVersion,
  apiScanProjectPages,
  apiSaveProject,
  apiSetProjectWorkflowStage,
  type ExportWarning,
  type PlatformGuide,
  type PublishDeployment,
  type PublishTarget,
  type PublishTargetInfo,
  type Project,
  type ProjectAsset,
  type ProjectLanguageVariant,
  type ProjectPage,
  type ProjectShare,
  type ProjectVersion,
  type ProjectVersionDetail,
  type ProjectVersionSource,
  type WorkflowEvent,
  type WorkflowStage,
} from "./api/projects"
import AuthScreen from "./components/AuthScreen"
import ResetPasswordScreen from "./components/ResetPasswordScreen"
import ProjectDashboard from "./components/ProjectDashboard"
import AssistantWidget from "./components/AssistantWidget"
import { toast, ToastContainer } from "./components/Toast"
import { useCallback, useRef, useState, useEffect, type CSSProperties } from 'react';
import BlockOverlay from "./components/BlockOverlay";
import { ENDPOINTS } from './config';
import { COMPONENT_LIBRARY, COMPONENT_CATEGORIES } from './components/ComponentLibrary';
import { useTranslation } from "./i18n/useTranslation"
import { detectSitePlatform, getPlatformMeta, normalizePlatform, type SitePlatform } from "./utils/sitePlatform"
import {
  TOP_TRANSLATION_LANGUAGES,
  translateWebsiteHtml,
  type WebsiteTranslationSegment,
} from "./utils/htmlTranslation"
import "./components/editor-viewer-dark.css"

type BlockFilter =
  | "all"
  | "button"
  | "heading"
  | "image"
  | "form"
  | "navigation"
  | "container"
  | "list"
  | "content"

type StructureSnapshotItem = {
  id: string
  rootId: string
  displayLabel: string
  label: string
  kind: string
  childCount: number
  isExpanded: boolean
  isSelected: boolean
}

type ExportMode =
  | "wp-placeholder"
  | "html-clean"
  | "html-raw"
  | "shopify-section"
  | "wp-theme"
  | "wp-block"
  | "web-component"
  | "react-component"
  | "webflow-json"
  | "email-newsletter"
  | "markdown-content"
  | "pdf-print"

type ViewportPreset = "desktop" | "tablet" | "mobile"

type EditorAudit = {
  source: "seo" | "cro" | "accessibility"
  headline: string
  summary: string
  items: string[]
  scoreBadges?: string[]
}

type AiDiffState = {
  id: string
  scope: "block" | "page"
  beforeHtml: string
  afterHtml: string
  beforeDocumentHtml: string
}

type TranslationReviewState = {
  targetLanguage: string
  detectedSourceLanguage: string
  translatedCount: number
  segments: WebsiteTranslationSegment[]
}

type AssetEntry = ProjectAsset

type GlobalStyleOverrides = {
  fontFamily: string
  textColor: string
  backgroundColor: string
  accentColor: string
}

const BLOCK_FILTER_OPTIONS: Array<{ value: BlockFilter; label: string }> = [
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

const EDIT_RAIL_EXPANDED_WIDTH = 272
const EDIT_RAIL_COLLAPSED_WIDTH = 72
const DEFAULT_CHROME_BACKGROUND = "rgba(5, 12, 24, 0.96)"
const DEFAULT_CHROME_BORDER = "rgba(96, 165, 250, 0.18)"
const EXPORT_FILENAME_MAP: Record<ExportMode, string> = {
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
const EXPORT_MODE_OPTIONS: Array<{ value: ExportMode; label: string }> = [
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
const WORKFLOW_STAGE_OPTIONS: Array<{ value: WorkflowStage; label: string }> = [
  { value: "draft", label: "Draft" },
  { value: "internal_review", label: "Internal review" },
  { value: "client_review", label: "Client review" },
  { value: "approved", label: "Approved" },
  { value: "shipped", label: "Shipped" },
]
const PROJECT_VERSION_SOURCE_LABELS: Record<ProjectVersionSource, string> = {
  autosave: "Autosave",
  manual: "Manual snapshot",
  translate: "Before translation",
  ai_block: "Before AI block",
  ai_page: "Before AI page",
  ai_prompt: "Before AI prompt",
  restore: "Restore backup",
  export: "Before export",
}
const VIEWPORT_PRESETS: Record<ViewportPreset, { label: string; width: number | null }> = {
  desktop: { label: "Desktop", width: null },
  tablet: { label: "Tablet", width: 820 },
  mobile: { label: "Mobile", width: 390 },
}
const DEFAULT_GLOBAL_STYLE_OVERRIDES: GlobalStyleOverrides = {
  fontFamily: "",
  textColor: "",
  backgroundColor: "",
  accentColor: "",
}

function titleCaseFallback(value: string): string {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

function shortenText(value: string, max = 92): string {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
  if (normalized.length <= max) return normalized
  return `${normalized.slice(0, max - 1).trimEnd()}…`
}

function formatEditorDateTime(value: string): string {
  if (!value) return "Unknown date"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed)
}

function parseRgbChannels(color: string): [number, number, number] | null {
  const match = String(color || "").match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
  if (!match) return null
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function getColorBrightness(color: string): number | null {
  const channels = parseRgbChannels(color)
  if (!channels) return null
  const [r, g, b] = channels
  return (r * 299 + g * 587 + b * 114) / 1000
}

function pickEditorChromeFromDocument(doc: Document | null): { background: string; border: string } {
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

function getDownloadFilename(response: Response, mode: ExportMode): string {
  const disposition = response.headers.get("Content-Disposition") || ""
  const match = disposition.match(/filename="?([^"]+)"?/i)
  if (match?.[1]) return match[1]
  return EXPORT_FILENAME_MAP[mode]
}

function readSavedTheme(): "dark" | "light" {
  if (typeof window === "undefined") return "dark"
  const bodyTheme = document.body.getAttribute("data-theme")
  if (bodyTheme === "light" || bodyTheme === "dark") return bodyTheme
  return localStorage.getItem("se_theme") === "light" ? "light" : "dark"
}

function serializeEditorHtml(doc: Document, inputIsDocument: boolean) {
  const doctype = doc.doctype
    ? `<!DOCTYPE ${doc.doctype.name}${doc.doctype.publicId ? ` PUBLIC "${doc.doctype.publicId}"` : ""}${
        doc.doctype.systemId ? ` "${doc.doctype.systemId}"` : ""
      }>`
    : ""
  return inputIsDocument
    ? `${doctype ? `${doctype}\n` : ""}${doc.documentElement.outerHTML}`
    : doc.body.innerHTML
}

function stripHtmlForPreview(value: string) {
  return String(value || "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildDiffPreview(value: string, max = 420) {
  return shortenText(stripHtmlForPreview(value), max)
}

function collectProjectAssets(currentHtml: string, pages: ProjectPage[]) {
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

function mergeAssetLibraries(primary: AssetEntry[], secondary: AssetEntry[]) {
  const seen = new Set<string>()
  return [...primary, ...secondary].filter((asset, index) => {
    const key = `${asset.type}:${asset.url || asset.id || index}`
    if (!asset.url || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error || new Error("File read failed"))
    reader.onload = () => resolve(String(reader.result || ""))
    reader.readAsDataURL(file)
  })
}

function collectCssVariables(html: string) {
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

function applyGlobalStylesToHtml(
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

function applyTranslationOverrideToHtml(
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

function buildTranslationSegmentsWithOverrides(
  segments: WebsiteTranslationSegment[],
  overrides: Record<string, string> = {},
) {
  return segments.map((segment) => ({
    ...segment,
    translatedText: overrides[segment.id]?.trim() || segment.translatedText,
  }))
}

function applyTranslationOverridesToHtml(
  html: string,
  segments: WebsiteTranslationSegment[],
  overrides: Record<string, string> = {},
) {
  return buildTranslationSegmentsWithOverrides(segments, overrides).reduce((acc, segment) => {
    const nextValue = overrides[segment.id]?.trim()
    return nextValue ? applyTranslationOverrideToHtml(acc, segment, nextValue) : acc
  }, String(html || ""))
}

function getLanguageVariantEffectiveHtml(variant?: ProjectLanguageVariant | null) {
  if (!variant) return ""
  if (variant.baseHtml && variant.segments?.length && variant.overrides && Object.keys(variant.overrides).length) {
    return applyTranslationOverridesToHtml(variant.baseHtml, variant.segments as WebsiteTranslationSegment[], variant.overrides)
  }
  return String(variant.html || variant.baseHtml || "")
}

function buildLocalAudit(html: string, loadedUrl: string, source: EditorAudit["source"], remoteAudit?: {
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

export default function App() {
  const { t } = useTranslation();
  const resolvePlatform = (platform?: string | null, pageUrl?: string, html?: string): SitePlatform => {
    const normalized = normalizePlatform(platform)
    return normalized !== "unknown" ? normalized : detectSitePlatform(pageUrl, html)
  }
  const AI_MODELS = [
    { value: "auto", label: "Auto" },
    { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
    { value: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
    { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
    { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
    { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
    { value: "groq:llama-3.1-8b-instant", label: "Groq Llama 3.1 8B Instant" },
    { value: "groq:llama-3.3-70b-versatile", label: "Groq Llama 3.3 70B Versatile" },
    { value: "ollama:qwen2.5-coder:7b", label: "Ollama Qwen 2.5 Coder 7B" },
  ]

  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const comparisonIframeRef = useRef<HTMLIFrameElement | null>(null)
  const currentHtmlRef = useRef("")
  const skipNextLiveIframeSyncRef = useRef(false)
  const loadRequestRef = useRef(0)
  const [theme, setTheme] = useState<"dark" | "light">(readSavedTheme)
  const [url, setUrl] = useState("")
  const [mode, setMode] = useState<"view" | "edit">("view")
  const [layoutMode] = useState<"flow" | "canvas">("flow")

  const [status, setStatus] = useState<"idle" | "blocked" | "ok">("idle")
  const [currentHtml, setCurrentHtml] = useState<string>("")
  const [loadedUrl, setLoadedUrl] = useState<string>("")
  const [viewportPreset, setViewportPreset] = useState<ViewportPreset>("desktop")
  const [currentPlatform, setCurrentPlatform] = useState<SitePlatform>("unknown")
  const [currentPlatformGuide, setCurrentPlatformGuide] = useState<PlatformGuide | null>(null)
  const [exportWarnings, setExportWarnings] = useState<ExportWarning[]>([])
  const [exportReadiness, setExportReadiness] = useState<"ready" | "guarded">("ready")
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowEvent[]>([])
  const [projectVersions, setProjectVersions] = useState<ProjectVersion[]>([])
  const [projectShares, setProjectShares] = useState<ProjectShare[]>([])
  const [publishTargets, setPublishTargets] = useState<PublishTargetInfo[]>([])
  const [publishHistory, setPublishHistory] = useState<PublishDeployment[]>([])
  const [loadingVersions, setLoadingVersions] = useState(false)
  const [loadingShares, setLoadingShares] = useState(false)
  const [loadingPublishTargets, setLoadingPublishTargets] = useState(false)
  const [loadingPublishHistory, setLoadingPublishHistory] = useState(false)
  const [savingSnapshot, setSavingSnapshot] = useState(false)
  const [sharingPreview, setSharingPreview] = useState(false)
  const [creatingPublishPreview, setCreatingPublishPreview] = useState(false)
  const [publishingTarget, setPublishingTarget] = useState<PublishTarget | null>(null)
  const [rollingBackDeploymentId, setRollingBackDeploymentId] = useState<number | null>(null)
  const [activeVersionActionId, setActiveVersionActionId] = useState<number | null>(null)
  const [versionPreview, setVersionPreview] = useState<ProjectVersionDetail | null>(null)
  const [versionCompare, setVersionCompare] = useState<ProjectVersionDetail | null>(null)
  const [aiScanLoading, setAiScanLoading] = useState(false)
  const [sessionCost, setSessionCost] = useState(0)
  const [sessionTokens, setSessionTokens] = useState({input: 0, output: 0})
  const [editorChrome, setEditorChrome] = useState({
    background: DEFAULT_CHROME_BACKGROUND,
    border: DEFAULT_CHROME_BORDER,
  })
  const versionPreviewReturnModeRef = useRef<"view" | "edit">("view")
  const [aiApproval] = useState<null | {
    id: string
    model: string
    scope: string
    estInputTokens: number
    estOutputTokens: number
    prompt: string
  }>(null)

  // Auth check beim Start
  useEffect(() => {
    apiGetPlan().then(p => p != null && setDemoPlan(p))
    apiMe().then(user => {
      if (user) { setAuthUser(user); setView("dashboard") }
      else { setAuthUser(null); setView("auth") }
    })
  }, [])










  const trackUsage = (payload: unknown) => {
    if (!payload || typeof payload !== "object") return;
    const p = payload as Record<string, unknown>;
    const usage = (p?.usage || p) as Record<string, unknown> | null;
    const inp = Number(usage?.input_tokens ?? 0)
    const out = Number(usage?.output_tokens ?? 0)
    const explicitCost = Number(p?.cost_eur ?? 0)

    let fallbackCost = 0
    const model = String(p?.model ?? "")

    const pricing: Record<string, { input: number; output: number }> = {
      "claude-sonnet-4-6": { input: 3.6, output: 18 },
      "claude-sonnet-4-5-20250929": { input: 3.6, output: 18 },
      "claude-haiku-4-5-20251001": { input: 0.3, output: 1.5 },
      "gemini-2.5-flash": { input: 0.09, output: 0.36 },
      "gemini-2.5-flash-lite": { input: 0.06, output: 0.24 },
      "gemini-2.5-pro": { input: 1.44, output: 4.32 },
      "groq:llama-3.1-8b-instant": { input: 0.12, output: 0.24 },
      "groq:llama-3.3-70b-versatile": { input: 0.9, output: 1.8 },
      "ollama:qwen2.5-coder:7b": { input: 0, output: 0 },
    }

    const c = pricing[model] || pricing["claude-sonnet-4-6"]
    const raw = ((inp / 1_000_000) * c.input) + ((out / 1_000_000) * c.output)
    if (raw > 0) fallbackCost = Math.max(0.01, raw)

    const finalCost = explicitCost > 0 ? explicitCost : fallbackCost

    if (inp > 0 || out > 0) {
      setSessionTokens(prev => ({ input: prev.input + inp, output: prev.output + out }))
    }
    if (finalCost > 0) {
      setSessionCost(prev => prev + finalCost)
    }
  };


  const [isDraggingBlock, setIsDraggingBlock] = useState(false)
  const [authUser, setAuthUser] = useState<User | null | "loading">("loading")
  const [view, setView] = useState<"auth" | "dashboard" | "editor" | "admin">("auth")
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [projectPages, setProjectPages] = useState<ProjectPage[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [scanningPages, setScanningPages] = useState(false)
  const [selectedComponent, setSelectedComponent] = useState<string>("")
  
  const [undoHistory, setUndoHistory] = useState<string[]>([])
  const [redoHistory, setRedoHistory] = useState<string[]>([])
  const undoHistoryRef = useRef<string[]>([])
  const redoHistoryRef = useRef<string[]>([])

  const syncEditorHistory = () => {
    setUndoHistory([...undoHistoryRef.current])
    setRedoHistory([...redoHistoryRef.current])
  }

  const pushUndoState = (html: string) => {
    const nextUndo = [...undoHistoryRef.current.slice(-19), html]
    undoHistoryRef.current = nextUndo
    redoHistoryRef.current = []
    syncEditorHistory()
  }

  const resetEditorHistory = () => {
    undoHistoryRef.current = []
    redoHistoryRef.current = []
    syncEditorHistory()
  }
  
  // AI approval queue
  type AiApprovalItem = { id: string; model: string; scope: string; estInputTokens: number; estOutputTokens: number; prompt: string }
  const [aiApprovalQueue, setAiApprovalQueue] = useState<AiApprovalItem[]>([])
  
  const enqueue = (item: AiApprovalItem) => {
    setAiApprovalQueue((prev: AiApprovalItem[]) => [...prev, item])
  }
  
  const dequeue = () => {
    setAiApprovalQueue((prev: AiApprovalItem[]) => prev.slice(1))
    return aiApprovalQueue[0] || null
  }

  const currentAiApproval = aiApprovalQueue.length ? aiApprovalQueue[0] : aiApproval

type AdminUser = { id: number; email: string; name?: string; credits?: number; created_at?: string }
const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
const [adminUserPlans, setAdminUserPlans] = useState<Record<number, "basis" | "starter" | "pro" | "scale">>({})
const [adminLoading, setAdminLoading] = useState(false)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", credits: 0 })
  const [demoPlan, setDemoPlan] = useState<"basis" | "starter" | "pro" | "scale">("basis")
  const [blockFilter, setBlockFilter] = useState<BlockFilter>("all")
  const [isEditRailCollapsed, setIsEditRailCollapsed] = useState(false)
  const [structureItems, setStructureItems] = useState<StructureSnapshotItem[]>([])
  const [selectedRootId, setSelectedRootId] = useState<string | null>(null)
  const [translationTargetLanguage, setTranslationTargetLanguage] = useState<string>(
    () => localStorage.getItem("se_translate_lang") || "de"
  )
  const [isTranslatingSite, setIsTranslatingSite] = useState(false)
  const [translationInfo, setTranslationInfo] = useState<{
    targetLanguage: string
    detectedSourceLanguage: string
    translatedCount: number
  } | null>(null)
  const [translationReview, setTranslationReview] = useState<TranslationReviewState | null>(null)
  const [translationOverrideDrafts, setTranslationOverrideDrafts] = useState<Record<string, string>>({})
  const [activeTranslationSegmentId, setActiveTranslationSegmentId] = useState<string | null>(null)
  const [activeLanguageVariant, setActiveLanguageVariant] = useState<string>("base")
  const [showTranslationSplitView, setShowTranslationSplitView] = useState(false)
  const [showExportWarnings, setShowExportWarnings] = useState(false)

  const [exportMode, setExportMode] = useState<ExportMode>("wp-placeholder")
  const [exporting, setExporting] = useState(false)
  const [leftAiPrompt, setLeftAiPrompt] = useState("")
  const [leftAiModel, setLeftAiModel] = useState("auto")
  const [leftAiTone, setLeftAiTone] = useState("neutral")
  const [leftAiRunning, setLeftAiRunning] = useState(false)
  const [batchAiRunning, setBatchAiRunning] = useState(false)
  const [editorAudit, setEditorAudit] = useState<EditorAudit | null>(null)
  const [runningAudit, setRunningAudit] = useState<EditorAudit["source"] | null>(null)
  const [shareEmail, setShareEmail] = useState("")
  const [lastPublishPreview, setLastPublishPreview] = useState<{
    previewUrl: string
    expiresAt: string
    token: string
  } | null>(null)
  const [publishDraft, setPublishDraft] = useState<{
    target: PublishTarget
    firebaseSiteId: string
    netlifySiteId: string
    netlifyToken: string
    vercelToken: string
    wpUrl: string
    wpUser: string
    wpAppPassword: string
    wpPageId: string
    shopDomain: string
    shopAccessToken: string
    shopThemeId: string
    customDomain: string
  }>({
    target: "firebase",
    firebaseSiteId: "",
    netlifySiteId: "",
    netlifyToken: "",
    vercelToken: "",
    wpUrl: "",
    wpUser: "",
    wpAppPassword: "",
    wpPageId: "",
    shopDomain: "",
    shopAccessToken: "",
    shopThemeId: "",
    customDomain: "",
  })
  const [customDomainGuide, setCustomDomainGuide] = useState<{
    domain: string
    target: string
    guide: { steps: string[]; recordType: string; recordValue: string }
  } | null>(null)
  const [aiDiff, setAiDiff] = useState<AiDiffState | null>(null)
  const [globalStyleOverrides, setGlobalStyleOverrides] = useState<GlobalStyleOverrides>(DEFAULT_GLOBAL_STYLE_OVERRIDES)
  const [cssVariableOverrides, setCssVariableOverrides] = useState<Record<string, string>>({})
  const [selectedFontAssetId, setSelectedFontAssetId] = useState<string | null>(null)
  const [assetLibraryQuery, setAssetLibraryQuery] = useState("")
  const lastSignificantSnapshotRef = useRef<{ html: string; createdAt: number }>({ html: "", createdAt: 0 })
  // Auto-save Projekt
  
const loadAdminUsers = async () => {
  setAdminLoading(true)
  try {
    const r = await fetchWithAuth("/api/admin/users")
    const d = await r.json()
    if (d.ok) {
      setAdminUsers(d.users || [])
      const plans: Record<number, "basis" | "starter" | "pro" | "scale"> = {}
      for (const u of d.users || []) { plans[u.id] = u.plan || "basis" }
      setAdminUserPlans(plans)
    } else alert(d.error || t("Admin load failed"))
  } catch { alert(t("Admin load failed")) } finally { setAdminLoading(false) }
}
const deleteUser = async (userId: number, userEmail: string) => {
  if (!confirm(`Are you sure you want to delete user "${userEmail}"? This will also delete all their projects.`)) {
    return
  }
  
  try {
    const r = await fetchWithAuth(`/api/admin/users/${userId}`, { 
      method: "DELETE", 
    })
    const d = await r.json()
    if (d.ok) {
      alert("User deleted successfully")
      loadAdminUsers()
    } else {
      alert(d.error || t("Delete failed"))
    }
  } catch {
    alert(t("Delete failed"))
  }
}

const addCredits = async (userId: number, userEmail: string) => {
  const credits = prompt(`How many dollars in credits to add to "${userEmail}"?\n\nExample: 25 = $25.00 credits`)
  if (!credits || isNaN(Number(credits)) || Number(credits) <= 0) {
    if (credits !== null) alert(t("Please enter a valid positive number"))
    return
  }
  
  try {
    const r = await fetchWithAuth(`/api/admin/users/${userId}/add-credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: Number(Number(credits) * 100) }), // Convert dollars to cents
    })
    const d = await r.json()
    if (d.ok) {
      alert(`✅ Successfully added $${Number(credits).toFixed(2)} credits to ${userEmail}`)
      loadAdminUsers()
    } else {
      alert(`❌ Failed to add credits: ${d.error || "Unknown error"}`)
    }
  } catch {
    alert("❌ Failed to add credits - network error")
  }
}

const resetPassword = async (userId: number, userEmail: string) => {
  if (!confirm(`Send password reset link to "${userEmail}"?`)) {
    return
  }
  
  try {
    const r = await fetchWithAuth("/api/admin/send-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
    })
    const d = await r.json()
    if (d.ok) {
      alert(`Password reset link sent to ${userEmail}`)
    } else {
      alert(`Failed to send reset: ${d.error || "Unknown error"}`)
    }
  } catch {
    alert("Failed to send reset - network error")
  }
}
const assignPlan = async (userId: number, userEmail: string) => {
  const current = adminUserPlans[userId] || "basis"
  const next = prompt(`Assign plan to "${userEmail}"\n\nOptions: basis, starter, pro, scale`, current)
  if (!next) return
  const normalized = String(next).trim().toLowerCase()
  if (!["basis", "starter", "pro", "scale"].includes(normalized)) { alert("Invalid plan"); return }
  const plan = normalized as "basis" | "starter" | "pro" | "scale"
  setAdminUserPlans(prev => ({ ...prev, [userId]: plan }))
  try {
    const response = await fetchWithAuth(`/api/admin/users/${userId}/set-plan`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ plan }),
    })
    const data = await response.json()
    if (!data.ok) {
      setAdminUserPlans(prev => ({ ...prev, [userId]: current }))
      alert("Failed: " + data.error)
      return
    }

    await loadAdminUsers()

    if (authUser && authUser !== "loading" && authUser.id === userId) {
      const refreshedPlan = await apiGetPlan().catch(() => null)
      setDemoPlan(refreshedPlan || plan)
    }

    alert(`✅ Plan "${plan}" saved`)
  } catch {
    setAdminUserPlans(prev => ({ ...prev, [userId]: current }))
    alert("Network error")
  }
}

const createUser = async () => {
  if (!newUser.email || !newUser.password) {
    alert("Email and password required")
    return
  }
  
  try {
    const r = await fetchWithAuth("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...newUser, credits: Number(newUser.credits * 100)}), // Convert dollars to cents
    })
    const d = await r.json()
    if (d.ok) {
      alert("User created successfully")
      setShowCreateUser(false)
      setNewUser({ email: "", password: "", name: "", credits: 0 })
      loadAdminUsers()
    } else {
      alert(d.error || "Create user failed")
    }
  } catch {
    alert("Create user failed")
  }
}

const autoSave = async (html: string) => {
    if (!currentProject) return
    const nowIso = new Date().toISOString()
    const nextPages = activePageId
      ? projectPages.map((page) =>
          page.id === activePageId
            ? {
                ...page,
                html: activeLanguageVariant === "base" ? html : page.html,
                languageVariants:
                  activeLanguageVariant === "base"
                    ? page.languageVariants
                    : {
                        ...(page.languageVariants || {}),
                        [activeLanguageVariant]: {
                          ...(page.languageVariants?.[activeLanguageVariant] || {}),
                          html,
                          updatedAt: nowIso,
                        },
                      },
                updatedAt: nowIso,
              }
            : page
        )
      : projectPages
    if (activePageId) setProjectPages(nextPages)
    const activeBasePage = activePageId
      ? nextPages.find((page) => page.id === activePageId) || null
      : null
    const projectHtmlForSave =
      activeLanguageVariant === "base"
        ? html
        : String(activeBasePage?.html || currentProject.html || currentHtmlRef.current || "")
    try {
      const saved = await apiSaveProject(currentProject.id, {
        html: projectHtmlForSave,
        platform: currentPlatform,
        pages: nextPages.length ? nextPages : undefined,
        pageId: activePageId || undefined,
      })
      if (saved) {
        setCurrentProject(prev => (prev && prev.id === saved.id ? { ...prev, ...saved } : saved))
        if (saved.pages) setProjectPages(saved.pages)
      }
    } catch { /* autosave failure is non-fatal */ }
  }

  const saveAssetLibrary = async (assets: AssetEntry[]) => {
    if (!currentProject) return
    try {
      const saved = await apiSaveProject(currentProject.id, {
        html: currentHtmlRef.current,
        platform: currentPlatform,
        pages: projectPages.length ? projectPages : undefined,
        pageId: activePageId || undefined,
        assetLibrary: assets,
      })
      if (saved) {
        setCurrentProject(saved)
        if (saved.pages) setProjectPages(saved.pages)
      } else {
        setCurrentProject((previous) => (previous ? { ...previous, assetLibrary: assets } : previous))
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Asset library save failed")
    }
  }

  const handleAssetLibraryUpload = async (files: FileList | null) => {
    if (!files?.length) return
    const uploads = await Promise.all(
      Array.from(files)
        .slice(0, 12)
        .map(async (file, index) => ({
          id: `asset-${Date.now()}-${index}`,
          type: /^font\//i.test(file.type) || /\.(woff2?|ttf|otf|eot)$/i.test(file.name) ? "font" as const : "image" as const,
          url: await readFileAsDataUrl(file),
          label: file.name,
          mimeType: file.type || "",
          createdAt: new Date().toISOString(),
        })),
    )
    const nextAssets = mergeAssetLibraries(currentProject?.assetLibrary || [], uploads)
    setCurrentProject((previous) => (previous ? { ...previous, assetLibrary: nextAssets } : previous))
    await saveAssetLibrary(nextAssets)
    toast.success(`${uploads.length} asset${uploads.length === 1 ? "" : "s"} added to the project library`)
  }

  useEffect(() => {
    currentHtmlRef.current = currentHtml
  }, [currentHtml])

  const loadWorkflowHistory = async (projectId: number) => {
    try {
      const events = await apiGetProjectWorkflowHistory(projectId)
      setWorkflowHistory(events)
    } catch {
      setWorkflowHistory([])
    }
  }

  const loadProjectVersions = async (projectId: number) => {
    setLoadingVersions(true)
    try {
      const versions = await apiGetProjectVersions(projectId)
      setProjectVersions(versions)
    } catch {
      setProjectVersions([])
    } finally {
      setLoadingVersions(false)
    }
  }

  const loadProjectShares = async (projectId: number) => {
    setLoadingShares(true)
    try {
      const shares = await apiGetProjectShares(projectId)
      setProjectShares(shares)
    } catch {
      setProjectShares([])
    } finally {
      setLoadingShares(false)
    }
  }

  const loadPublishTargets = async () => {
    setLoadingPublishTargets(true)
    try {
      const targets = await apiGetPublishTargets()
      setPublishTargets(targets)
    } catch {
      setPublishTargets([])
    } finally {
      setLoadingPublishTargets(false)
    }
  }

  const loadPublishHistory = async (projectId: number) => {
    setLoadingPublishHistory(true)
    try {
      const deployments = await apiGetPublishHistory(projectId)
      setPublishHistory(deployments)
    } catch {
      setPublishHistory([])
    } finally {
      setLoadingPublishHistory(false)
    }
  }

  const exitVersionPreview = (restoreMode = false) => {
    setVersionPreview(null)
    if (restoreMode && versionPreviewReturnModeRef.current === "edit") {
      setMode("edit")
    }
  }

  const clearVersionCompare = () => {
    setVersionCompare(null)
  }

  const prependProjectVersion = (version: ProjectVersion) => {
    setProjectVersions((prev) => [version, ...prev.filter((entry) => entry.id !== version.id)].slice(0, 50))
  }

  const createVersionSnapshot = useCallback(
    async (
      options: {
        label?: string
        source?: ProjectVersionSource
        html?: string
        pageId?: string
        silent?: boolean
      } = {},
    ) => {
      if (!currentProject?.id) return null
      const snapshotHtml = String(options.html ?? currentHtmlRef.current)
      if (!snapshotHtml.trim()) {
        if (!options.silent) toast.warning("Load a page before creating a snapshot")
        return null
      }
      try {
        const version = await apiCreateProjectVersion(currentProject.id, {
          html: snapshotHtml,
          label: options.label,
          source: options.source,
          pageId: options.pageId ?? activePageId ?? undefined,
        })
        prependProjectVersion(version)
        return version
      } catch (error) {
        if (!options.silent) {
          toast.error(error instanceof Error ? error.message : "Snapshot could not be created")
        }
        return null
      }
    },
    [activePageId, currentProject?.id],
  )

  const handleManualSnapshot = async () => {
    if (!currentProject) {
      toast.warning("Open a saved project before creating snapshots")
      return
    }
    const label = window.prompt("Snapshot label (optional):", "")
    if (label === null) return
    setSavingSnapshot(true)
    try {
      const version = await createVersionSnapshot({
        label: label.trim(),
        source: "manual",
      })
      if (version) {
        toast.success(label.trim() ? `Snapshot "${label.trim()}" saved` : "Snapshot saved")
      }
    } finally {
      setSavingSnapshot(false)
    }
  }

  const previewProjectVersion = async (versionId: number) => {
    if (!currentProject?.id) return
    setActiveVersionActionId(versionId)
    try {
      const version = await apiGetProjectVersion(currentProject.id, versionId)
      versionPreviewReturnModeRef.current = mode
      if (mode === "edit") setMode("view")
      setVersionPreview(version)
      setStatus("ok")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Snapshot preview failed")
    } finally {
      setActiveVersionActionId(null)
    }
  }

  const restoreProjectVersion = async (versionId: number) => {
    if (!currentProject?.id) return
    const confirmed = window.confirm("Restore this snapshot? The current editor state will be backed up first.")
    if (!confirmed) return
    setActiveVersionActionId(versionId)
    try {
      const restored = await apiRestoreProjectVersion(currentProject.id, versionId, {
        pageId: activePageId || undefined,
      })
      exitVersionPreview(false)
      const nextProject = restored.project || null
      if (nextProject) {
        setCurrentProject(nextProject)
        setProjectPages(nextProject.pages || [])
        const restoredPage = restored.pageId
          ? (nextProject.pages || []).find((page) => page.id === restored.pageId) || null
          : null
        if (restoredPage) {
          applyProjectPage(nextProject, restoredPage)
        } else {
          setUrl(nextProject.url || "")
          setLoadedUrl(nextProject.url || "")
          applyEditorHtml(restored.html, { resetHistory: true })
          setCurrentPlatform(resolvePlatform(nextProject.platform, nextProject.url, restored.html))
          setCurrentPlatformGuide(nextProject.platformGuide ?? null)
          setExportWarnings(nextProject.latestExport?.manifest?.warnings || [])
          setExportReadiness(nextProject.latestExport?.readiness || "ready")
          lastSignificantSnapshotRef.current = { html: restored.html, createdAt: Date.now() }
          renderToIframe(restored.html)
          setStatus("ok")
        }
      } else {
        applyEditorHtml(restored.html, { resetHistory: true })
        setCurrentPlatform(restored.platform)
        lastSignificantSnapshotRef.current = { html: restored.html, createdAt: Date.now() }
        renderToIframe(restored.html)
        setStatus("ok")
      }
      await loadProjectVersions(currentProject.id)
      toast.success("Snapshot restored")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Snapshot restore failed")
    } finally {
      setActiveVersionActionId(null)
    }
  }

  const composeAiPromptWithTone = (prompt: string) => {
    const trimmed = String(prompt || "").trim()
    if (!trimmed) return ""
    if (!leftAiTone || leftAiTone === "neutral") return trimmed
    const toneLabel = titleCaseFallback(leftAiTone)
    return `Rewrite with a ${toneLabel.toLowerCase()} tone.\n\n${trimmed}`
  }

  const openFullPreview = () => {
    const previewHtml = String(versionPreview?.html || currentHtmlRef.current || "")
    if (!previewHtml.trim()) {
      toast.warning("Load a page before opening a clean preview")
      return
    }
    const popup = window.open("", "_blank", "noopener,noreferrer")
    if (!popup) {
      toast.error("Popup blocked. Allow popups to open the clean preview.")
      return
    }
    popup.document.open()
    popup.document.write(previewHtml)
    popup.document.close()
  }

  const createSharePreview = async () => {
    if (!currentProject?.id) {
      toast.warning("Open a saved project before creating share previews")
      return
    }
    setSharingPreview(true)
    try {
      await autoSave(currentHtmlRef.current)
      await apiCreateProjectShare(currentProject.id, {
        email: shareEmail.trim() || undefined,
        html: currentHtmlRef.current,
        pageId: activePageId || undefined,
        languageVariant: activeLanguageVariant !== "base" ? activeLanguageVariant : undefined,
      })
      await loadProjectShares(currentProject.id)
      setShareEmail("")
      toast.success("Share preview ready")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Share preview failed")
    } finally {
      setSharingPreview(false)
    }
  }

  const revokeSharePreview = async (shareId: number) => {
    if (!currentProject?.id) return
    try {
      await apiDeleteProjectShare(currentProject.id, shareId)
      await loadProjectShares(currentProject.id)
      toast.success("Share preview revoked")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Share revoke failed")
    }
  }

  const copyTextValue = async (value: string, successMessage: string, promptLabel: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value)
        toast.success(successMessage)
        return
      }
    } catch {
      // fall back below
    }
    window.prompt(promptLabel, value)
  }

  const copySharePreviewUrl = async (shareUrl: string) => {
    await copyTextValue(shareUrl, "Share link copied", "Copy this share link")
  }

  const updatePublishDraft = <K extends keyof typeof publishDraft>(key: K, value: (typeof publishDraft)[K]) => {
    setPublishDraft((previous) => ({ ...previous, [key]: value }))
  }

  const getPublishOptions = (target: PublishTarget, mode: "publish" | "rollback" = "publish") => {
    const options: Record<string, string> = {}
    if (mode === "publish") options.exportMode = exportMode

    if (target === "firebase") {
      if (publishDraft.firebaseSiteId.trim()) options.siteId = publishDraft.firebaseSiteId.trim()
      return options
    }

    if (target === "netlify") {
      if (publishDraft.netlifySiteId.trim()) options.siteId = publishDraft.netlifySiteId.trim()
      if (publishDraft.netlifyToken.trim()) options.token = publishDraft.netlifyToken.trim()
      return options
    }

    if (target === "vercel") {
      if (publishDraft.vercelToken.trim()) options.token = publishDraft.vercelToken.trim()
      return options
    }

    if (target === "wordpress") {
      if (!publishDraft.wpUrl.trim() || !publishDraft.wpUser.trim() || !publishDraft.wpAppPassword.trim()) {
        throw new Error("WordPress publish needs site URL, username, and application password.")
      }
      options.wpUrl = publishDraft.wpUrl.trim()
      options.wpUser = publishDraft.wpUser.trim()
      options.wpAppPassword = publishDraft.wpAppPassword.trim()
      if (publishDraft.wpPageId.trim()) options.pageId = publishDraft.wpPageId.trim()
      return options
    }

    if (target === "shopify") {
      if (!publishDraft.shopDomain.trim() || !publishDraft.shopAccessToken.trim()) {
        throw new Error("Shopify publish needs shop domain and access token.")
      }
      options.shopDomain = publishDraft.shopDomain.trim()
      options.accessToken = publishDraft.shopAccessToken.trim()
      if (publishDraft.shopThemeId.trim()) options.themeId = publishDraft.shopThemeId.trim()
      return options
    }

    return options
  }

  const ensureProjectReadyForPublish = async () => {
    if (versionPreview) throw new Error("Exit snapshot preview before publishing")
    if (!currentProject?.id) throw new Error("Open a saved project before publishing")
    if (!currentHtmlRef.current.trim()) throw new Error("Load a page before publishing")
    await autoSave(currentHtmlRef.current)
    return currentProject.id
  }

  const createPublishPreview = async () => {
    try {
      const projectId = await ensureProjectReadyForPublish()
      setCreatingPublishPreview(true)
      const preview = await apiCreatePublishPreview(projectId, { html: currentHtmlRef.current })
      setLastPublishPreview(preview)
      toast.success("Pre-publish preview ready")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Pre-publish preview failed")
    } finally {
      setCreatingPublishPreview(false)
    }
  }

  const publishCurrentProject = async () => {
    const target = publishDraft.target
    try {
      const projectId = await ensureProjectReadyForPublish()
      setPublishingTarget(target)
      const result = await apiPublishProject(projectId, target, {
        ...getPublishOptions(target, "publish"),
        html: currentHtmlRef.current,
      })
      await loadPublishHistory(projectId)
      toast.success(result.deployUrl ? `Published to ${target}` : `Deployment queued for ${target}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed")
    } finally {
      setPublishingTarget(null)
    }
  }

  const rollbackPublishedDeployment = async (deployment: PublishDeployment) => {
    if (!currentProject?.id) return
    const confirmed = window.confirm(`Rollback to deployment #${deployment.id} on ${deployment.target}?`)
    if (!confirmed) return
    try {
      setRollingBackDeploymentId(deployment.id)
      const result = await apiRollbackDeployment(
        currentProject.id,
        deployment.id,
        getPublishOptions(deployment.target, "rollback"),
      )
      await loadPublishHistory(currentProject.id)
      toast.success(result.deployUrl ? "Rollback deployed" : "Rollback completed")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Rollback failed")
    } finally {
      setRollingBackDeploymentId(null)
    }
  }

  const loadCustomDomainGuide = async () => {
    if (!currentProject?.id) {
      toast.warning("Open a saved project before requesting a custom domain guide")
      return
    }
    if (!publishDraft.customDomain.trim()) {
      toast.warning("Enter a custom domain first")
      return
    }
    try {
      const nextGuide = await apiGetCustomDomainGuide(
        currentProject.id,
        publishDraft.customDomain.trim(),
        publishDraft.target,
      )
      setCustomDomainGuide(nextGuide)
      toast.success("Domain guide ready")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Custom domain guide failed")
    }
  }

  const compareProjectVersion = async (versionId: number) => {
    if (!currentProject?.id) return
    setActiveVersionActionId(versionId)
    try {
      const version = await apiGetProjectVersion(currentProject.id, versionId)
      setVersionCompare(version)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Version compare failed")
    } finally {
      setActiveVersionActionId(null)
    }
  }

  const runEditorAudit = async (source: EditorAudit["source"]) => {
    if (!currentHtmlRef.current.trim()) {
      toast.warning("Load a page before running an audit")
      return
    }
    setRunningAudit(source)
    try {
      let remoteAudit:
        | {
            scores?: Record<string, number>
            metrics?: Record<string, string>
            opportunities?: Array<{ title: string; value: string }>
          }
        | undefined

      if (source === "seo" && /^https?:\/\//i.test(loadedUrl || "")) {
        try {
          const data = await apiFetch<{
            ok: boolean
            url: string
            scores: Record<string, number>
            metrics: Record<string, string>
            opportunities: Array<{ title: string; value: string }>
          }>("/api/seo/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: loadedUrl }),
          })
          if (data?.ok) {
            remoteAudit = {
              scores: data.scores,
              metrics: data.metrics,
              opportunities: data.opportunities,
            }
          }
        } catch {
          remoteAudit = undefined
        }
      }

      setEditorAudit(buildLocalAudit(currentHtmlRef.current, loadedUrl, source, remoteAudit))
    } finally {
      setRunningAudit(null)
    }
  }

  const persistProjectPagesState = async (nextPages: ProjectPage[], nextHtml = currentHtmlRef.current) => {
    if (!currentProject?.id) return null
    const savedProject = await apiSaveProject(currentProject.id, {
      html: nextHtml,
      pages: nextPages,
      platform: currentPlatform,
      pageId: activePageId || undefined,
    })
    if (savedProject) {
      setCurrentProject(savedProject)
      setProjectPages(savedProject.pages || nextPages)
    } else {
      setProjectPages(nextPages)
    }
    return savedProject
  }

  const switchLanguageVariant = (variant: string) => {
    if (!activePageId) {
      setActiveLanguageVariant("base")
      return
    }
    const activePage = projectPages.find((page) => page.id === activePageId)
    if (!activePage) return
    const storedVariant = variant === "base" ? null : activePage.languageVariants?.[variant] || null
    const nextHtml =
      variant === "base"
        ? String(activePage.html || "")
        : getLanguageVariantEffectiveHtml(storedVariant)
    if (!nextHtml.trim()) {
      toast.warning("That language variant is not stored yet for this page")
      return
    }
    setActiveLanguageVariant(variant)
    if (variant === "base") setShowTranslationSplitView(false)
    const storedSegments =
      storedVariant?.segments?.length
        ? buildTranslationSegmentsWithOverrides(storedVariant.segments as WebsiteTranslationSegment[], storedVariant.overrides || {})
        : []
    setTranslationReview(
      variant === "base" || !storedSegments.length
        ? null
        : {
            targetLanguage: variant,
            detectedSourceLanguage: storedVariant?.detectedSourceLanguage || "",
            translatedCount: Number(storedVariant?.translatedCount || storedSegments.length || 0),
            segments: storedSegments,
          }
    )
    setTranslationOverrideDrafts(
      storedSegments.length
        ? Object.fromEntries(
            storedSegments.map((segment) => [segment.id, storedVariant?.overrides?.[segment.id] || segment.translatedText])
          )
        : {}
    )
    setActiveTranslationSegmentId(storedSegments[0]?.id || null)
    setTranslationInfo(
      variant === "base"
        ? null
        : {
            targetLanguage: variant,
            detectedSourceLanguage: storedVariant?.detectedSourceLanguage || "",
            translatedCount: Number(storedVariant?.translatedCount || 0),
          }
    )
    applyEditorHtml(nextHtml, { resetHistory: true })
    renderToIframe(nextHtml)
    setStatus("ok")
  }

  const applyTranslationOverride = async (segmentId: string) => {
    const segment = translationReview?.segments.find((entry) => entry.id === segmentId)
    const nextValue = translationOverrideDrafts[segmentId]
    if (!segment || !nextValue?.trim()) return
    const trimmedValue = nextValue.trim()
    const activePage = activePageId ? projectPages.find((page) => page.id === activePageId) || null : null
    const currentVariant =
      activeLanguageVariant !== "base" && activePage
        ? activePage.languageVariants?.[activeLanguageVariant] || null
        : null
    const sourceSegments = (currentVariant?.segments as WebsiteTranslationSegment[] | undefined) || translationReview?.segments || []
    const nextOverrides = {
      ...(currentVariant?.overrides || {}),
      [segmentId]: trimmedValue,
    }
    const baseHtml = String(currentVariant?.baseHtml || currentVariant?.html || currentHtmlRef.current || "")
    const nextHtml = applyTranslationOverridesToHtml(baseHtml, sourceSegments, nextOverrides)
    const nextSegments = buildTranslationSegmentsWithOverrides(sourceSegments, nextOverrides)

    if (currentProject?.id && activePage) {
      applyEditorHtml(nextHtml, { recordUndo: true })
      renderToIframe(nextHtml)
      const nowIso = new Date().toISOString()
      const nextPages = projectPages.map((page) =>
        page.id === activePage.id
          ? {
              ...page,
              languageVariants: {
                ...(page.languageVariants || {}),
                [activeLanguageVariant]: {
                  ...(page.languageVariants?.[activeLanguageVariant] || {}),
                  html: nextHtml,
                  baseHtml,
                  updatedAt: nowIso,
                  overrides: nextOverrides,
                  segments: sourceSegments,
                },
              },
              updatedAt: nowIso,
            }
          : page
      )
      setProjectPages(nextPages)
      setCurrentProject((previous) => (previous ? { ...previous, pages: nextPages } : previous))

      try {
        const savedProject = await apiSaveProject(currentProject.id, {
          html: String(activePage.html || currentProject.html || ""),
          pages: nextPages,
          platform: currentPlatform,
          pageId: activePage.id,
        })
        if (savedProject) {
          setCurrentProject(savedProject)
          setProjectPages(savedProject.pages || nextPages)
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Translation override save failed")
      }
    } else {
      commitLiveEditorHtml(nextHtml)
    }

    setTranslationReview((previous) =>
      previous
        ? {
            ...previous,
            segments: nextSegments,
          }
        : previous
    )
    setTranslationOverrideDrafts((previous) => ({ ...previous, [segmentId]: trimmedValue }))
    toast.success("Translation override applied")
  }

  const storeCurrentAsLanguageVariant = async () => {
    if (!currentProject?.id || !activePageId) {
      toast.warning("Open a saved project page before creating language variants")
      return
    }
    if (!translationTargetLanguage || translationTargetLanguage === "base") {
      toast.warning("Choose a target language first")
      return
    }
    const activePage = projectPages.find((page) => page.id === activePageId)
    if (!activePage) return
    const nowIso = new Date().toISOString()
    const nextPages = projectPages.map((page) =>
      page.id === activePageId
        ? {
            ...page,
            languageVariants: {
              ...(page.languageVariants || {}),
              [translationTargetLanguage]: {
                html: currentHtmlRef.current,
                updatedAt: nowIso,
                detectedSourceLanguage:
                  activeLanguageVariant === "base"
                    ? translationInfo?.detectedSourceLanguage || ""
                    : activeLanguageVariant,
                translatedCount: Number(translationInfo?.translatedCount || 0),
              },
            },
            updatedAt: nowIso,
          }
        : page
    )
    await persistProjectPagesState(nextPages)
    setActiveLanguageVariant(translationTargetLanguage)
    toast.success(`Saved current page as ${selectedTranslationLanguage.label}`)
  }

  const resetLanguageVariantFromBase = async () => {
    if (!currentProject?.id || !activePageId || activeLanguageVariant === "base") return
    const activePage = projectPages.find((page) => page.id === activePageId)
    if (!activePage?.html?.trim()) {
      toast.warning("Base page is empty, so there is nothing to restore")
      return
    }
    const nowIso = new Date().toISOString()
    const nextPages = projectPages.map((page) =>
      page.id === activePageId
        ? {
            ...page,
            languageVariants: {
              ...(page.languageVariants || {}),
              [activeLanguageVariant]: {
                html: activePage.html,
                updatedAt: nowIso,
                detectedSourceLanguage: "",
                translatedCount: 0,
              },
            },
            updatedAt: nowIso,
          }
        : page
    )
    await persistProjectPagesState(nextPages, activePage.html)
    setTranslationInfo({
      targetLanguage: activeLanguageVariant,
      detectedSourceLanguage: "",
      translatedCount: 0,
    })
    setTranslationReview(null)
    setTranslationOverrideDrafts({})
    setActiveTranslationSegmentId(null)
    applyEditorHtml(activePage.html, { resetHistory: true })
    renderToIframe(activePage.html)
    toast.success(`Reset ${activeLanguageVariant.toUpperCase()} to the base page`)
  }

  const deleteLanguageVariant = async () => {
    if (!currentProject?.id || !activePageId || activeLanguageVariant === "base") return
    const confirmed = window.confirm(`Delete the stored ${activeLanguageVariant.toUpperCase()} variant for this page?`)
    if (!confirmed) return
    const activePage = projectPages.find((page) => page.id === activePageId)
    if (!activePage) return
    const nextPages = projectPages.map((page) => {
      if (page.id !== activePageId) return page
      const nextVariants = { ...(page.languageVariants || {}) }
      delete nextVariants[activeLanguageVariant]
      return {
        ...page,
        languageVariants: nextVariants,
        updatedAt: new Date().toISOString(),
      }
    })
    await persistProjectPagesState(nextPages, activePage.html)
    setActiveLanguageVariant("base")
    setTranslationInfo(null)
    setTranslationReview(null)
    setTranslationOverrideDrafts({})
    setActiveTranslationSegmentId(null)
    setShowTranslationSplitView(false)
    applyEditorHtml(activePage.html, { resetHistory: true })
    renderToIframe(activePage.html)
    toast.success("Language variant deleted")
  }

  const applyGlobalStyleOverridesNow = () => {
    if (!currentHtmlRef.current.trim()) {
      toast.warning("Load a page before applying site-wide style overrides")
      return
    }
    const nextHtml = applyGlobalStylesToHtml(
      currentHtmlRef.current,
      globalStyleOverrides,
      cssVariableOverrides,
      selectedFontAsset,
    )
    commitLiveEditorHtml(nextHtml)
    toast.success("Global style overrides applied")
  }

  const runBatchAiAcrossPages = async () => {
    if (versionPreview) {
      toast.warning("Exit snapshot preview before running AI prompts")
      return
    }
    if (!currentProject?.id || projectPages.length < 2) {
      toast.warning("Open a multi-page project before running batch AI")
      return
    }
    if (!leftAiPrompt.trim()) {
      toast.warning("Enter an AI prompt first")
      return
    }
    setBatchAiRunning(true)
    try {
      await createVersionSnapshot({
        source: "ai_page",
        label: "Before batch AI across pages",
        silent: true,
      })

      const nextPages: ProjectPage[] = []
      const resolvedModel = leftAiModel === "auto" ? "claude-sonnet-4-6" : leftAiModel
      const composedPrompt = composeAiPromptWithTone(leftAiPrompt)
      for (const page of projectPages) {
        const hydratedPage =
          page.html && page.html.trim()
            ? page
            : (await apiLoadProjectPage(currentProject.id, page.id)).page || page
        const pageHtml = String(hydratedPage.html || "")
        if (!pageHtml.trim()) {
          nextPages.push(hydratedPage)
          continue
        }
        const response = await fetchWithAuth(ENDPOINTS.rewrite, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            html: pageHtml,
            instruction: composedPrompt,
            systemHint: "Return only valid HTML.",
            model: resolvedModel,
            approved: 1,
          }),
        })
        const data = await response.json()
        if (!data?.ok || !data?.html) {
          throw new Error(data?.error || `AI rewrite failed for ${page.name || page.id}`)
        }
        if (data.usage || data.cost_eur != null) trackUsage(data)
        nextPages.push({
          ...hydratedPage,
          html: data.html,
          updatedAt: new Date().toISOString(),
        })
      }

      const activePage = nextPages.find((page) => page.id === activePageId) || null
      const saved = await apiSaveProject(currentProject.id, {
        html: activePage?.html || currentHtmlRef.current,
        pages: nextPages,
        platform: currentPlatform,
        pageId: activePageId || undefined,
      })
      if (saved) {
        setCurrentProject(saved)
        setProjectPages(saved.pages || nextPages)
      } else {
        setProjectPages(nextPages)
      }
      if (activePage?.html && activeLanguageVariant === "base") {
        applyEditorHtml(activePage.html, { resetHistory: true })
        renderToIframe(activePage.html)
      }
      await loadProjectVersions(currentProject.id)
      toast.success(`Batch AI updated ${nextPages.length} pages`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Batch AI failed")
    } finally {
      setBatchAiRunning(false)
    }
  }

  const inferAssistantEditorAction = (value: string) => {
    const raw = String(value || "").trim()
    if (!raw) return null
    if (raw.startsWith("/")) return raw

    const normalized = raw.toLowerCase()
    const findLanguageCode = () => {
      const directMatch = TOP_TRANSLATION_LANGUAGES.find((language) => {
        const label = language.label.toLowerCase()
        return (
          normalized.includes(` ${language.code.toLowerCase()} `) ||
          normalized.endsWith(` ${language.code.toLowerCase()}`) ||
          normalized.includes(label)
        )
      })
      return directMatch?.code || null
    }
    const findExportMode = () => {
      const matched = EXPORT_MODE_OPTIONS.find((option) => {
        const slug = option.value.toLowerCase()
        const label = option.label.toLowerCase()
        return normalized.includes(slug) || normalized.includes(label)
      })
      return matched?.value || null
    }

    if (/\b(open|show|launch)\b.*\bpreview\b/.test(normalized) || /^preview\b/.test(normalized)) {
      return "/preview"
    }

    if (
      /\b(create|make|generate|send|share)\b.*\bshare\b/.test(normalized) ||
      /\bshare\b.*\b(link|preview)\b/.test(normalized)
    ) {
      return "/share"
    }

    if (
      /\b(a11y|accessibility)\b/.test(normalized) ||
      /\bseo\b/.test(normalized) ||
      /\bcro\b/.test(normalized) ||
      /\baudit\b/.test(normalized)
    ) {
      if (/\b(a11y|accessibility)\b/.test(normalized)) return "/audit accessibility"
      if (/\bcro\b/.test(normalized)) return "/audit cro"
      return "/audit seo"
    }

    if (/\btranslate\b|\blocali[sz]e\b/.test(normalized)) {
      return `/translate ${findLanguageCode() || translationTargetLanguage}`
    }

    if (/\bexport\b|\bdownload\b/.test(normalized)) {
      return `/export ${findExportMode() || exportMode}`
    }

    return null
  }

  const handleAssistantEditorAction = async (command: string) => {
    const inferred = inferAssistantEditorAction(command)
    if (!inferred) return null

    const normalized = inferred.trim().replace(/^\/+/, "")
    const [verbRaw, ...rest] = normalized.split(/\s+/)
    const verb = String(verbRaw || "").toLowerCase()

    if (!verb) return null

    if (verb === "preview") {
      openFullPreview()
      return "Opened a clean preview."
    }

    if (verb === "share") {
      await createSharePreview()
      return "Created a share preview from the current saved state."
    }

    if (verb === "audit") {
      const requested = String(rest[0] || "seo").toLowerCase()
      const source: EditorAudit["source"] =
        requested === "cro" ? "cro" : requested === "accessibility" || requested === "a11y" ? "accessibility" : "seo"
      await runEditorAudit(source)
      return `Ran the ${source} audit in the editor.`
    }

    if (verb === "translate") {
      const language = String(rest[0] || translationTargetLanguage).trim()
      await handleTranslateSite(language)
      return `Translated the current page to ${language.toUpperCase()}.`
    }

    if (verb === "export") {
      const requestedMode = String(rest[0] || exportMode).trim() as ExportMode
      const validMode = EXPORT_MODE_OPTIONS.some((option) => option.value === requestedMode)
        ? requestedMode
        : exportMode
      await handleExport(validMode)
      return `Started export in ${validMode}.`
    }

    return null
  }

  const acceptAiDiff = () => {
    setAiDiff(null)
  }

  const rejectAiDiff = () => {
    if (!aiDiff?.beforeDocumentHtml) {
      setAiDiff(null)
      return
    }
    applyEditorHtml(aiDiff.beforeDocumentHtml, { resetHistory: true, save: true })
    renderToIframe(aiDiff.beforeDocumentHtml)
    setAiDiff(null)
    toast.success("AI change reverted")
  }

  const changeWorkflowStage = async (stage: WorkflowStage) => {
    if (!currentProject) return
    const currentStage = currentProject.workflowStage || "draft"
    if (currentStage === stage) return
    const comment = window.prompt(`Workflow note for ${stage.replace(/_/g, " ")}:`, "") || ""
    try {
      const project = await apiSetProjectWorkflowStage(currentProject.id, stage, comment)
      setCurrentProject(project)
      setExportWarnings([])
      await loadWorkflowHistory(project.id)
      toast.success(`Workflow moved to ${stage.replace(/_/g, " ")}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Workflow update failed")
    }
  }

  const renderToIframe = (html: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.srcdoc = html || "<!doctype html><html><head></head><body></body></html>";
  };

  const renderToComparisonIframe = (html: string) => {
    const iframe = comparisonIframeRef.current
    if (!iframe) return
    iframe.srcdoc = html || "<!doctype html><html><head></head><body></body></html>"
  }

  const applyEditorHtml = (
    html: string,
    options: { recordUndo?: boolean; resetHistory?: boolean; save?: boolean } = {},
  ) => {
    const nextHtml = String(html || "")
    const prevHtml = currentHtmlRef.current
    if (options.resetHistory) {
      resetEditorHistory()
    } else if (options.recordUndo && prevHtml && prevHtml !== nextHtml) {
      pushUndoState(prevHtml)
    }
    skipNextLiveIframeSyncRef.current = true
    currentHtmlRef.current = nextHtml
    setCurrentHtml(nextHtml)
    if (options.save) autoSave(nextHtml)
  }

  const commitLiveEditorHtml = (html: string) => {
    applyEditorHtml(html, { recordUndo: true, save: true })
  }

  const applyUndo = () => {
    const previous = undoHistoryRef.current[undoHistoryRef.current.length - 1]
    if (!previous) return
    const current = currentHtmlRef.current
    undoHistoryRef.current = undoHistoryRef.current.slice(0, -1)
    if (current) {
      redoHistoryRef.current = [...redoHistoryRef.current.slice(-19), current]
    }
    syncEditorHistory()
    applyEditorHtml(previous, { save: true })
  }

  const applyRedo = () => {
    const next = redoHistoryRef.current[redoHistoryRef.current.length - 1]
    if (!next) return
    const current = currentHtmlRef.current
    redoHistoryRef.current = redoHistoryRef.current.slice(0, -1)
    if (current) {
      undoHistoryRef.current = [...undoHistoryRef.current.slice(-19), current]
    }
    syncEditorHistory()
    applyEditorHtml(next, { save: true })
  }

  useEffect(() => {
    if (view !== "editor") return
    if (versionPreview) {
      renderToIframe(versionPreview.html)
      return
    }
    if (skipNextLiveIframeSyncRef.current && mode === "edit") {
      skipNextLiveIframeSyncRef.current = false
      return
    }
    renderToIframe(currentHtml)
  }, [currentHtml, mode, view, versionPreview]);

  useEffect(() => {
    if (view !== "editor") return
    if (!showTranslationSplitView || activeLanguageVariant === "base") {
      renderToComparisonIframe("")
      return
    }
    renderToComparisonIframe(comparisonBaseHtml)
  }, [activeLanguageVariant, comparisonBaseHtml, showTranslationSplitView, view])

  const hasMeaningfulProjectHtml = (html: string) => {
    const raw = String(html || "").trim()
    if (!raw) return false
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i)
    const body = bodyMatch ? bodyMatch[1] : raw
    const withoutNonVisual = body
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<!--[\s\S]*?-->/g, "")
      .trim()
    const text = withoutNonVisual.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    const structure = withoutNonVisual.match(/<(main|section|article|div|header|footer|nav|form|img|figure|h1|h2|h3|p|ul|ol|li|button|a)\b/gi) || []
    return text.length >= 40 || structure.length >= 4
  }

  const findDefaultProjectPage = (pages: ProjectPage[]) => {
    return pages.find((page) => page.path === "/") || pages[0] || null
  }

  const applyProjectPage = (project: Project, page: ProjectPage) => {
    const pageHtml = String(page.html || "")
    exitVersionPreview(false)
    clearVersionCompare()
    setActivePageId(page.id)
    setActiveLanguageVariant("base")
    setShowTranslationSplitView(false)
    setUrl(page.url || project.url || "")
    setLoadedUrl(page.url || project.url || "")
    applyEditorHtml(pageHtml, { resetHistory: true })
    setTranslationInfo(null)
    setTranslationReview(null)
    setTranslationOverrideDrafts({})
    setActiveTranslationSegmentId(null)
    setEditorAudit(null)
    setCurrentPlatform(resolvePlatform(project.platform, page.url || project.url, pageHtml))
    setCurrentPlatformGuide(project.platformGuide ?? null)
    setExportWarnings(project.latestExport?.manifest?.warnings || [])
    setExportReadiness(project.latestExport?.readiness || "ready")
    lastSignificantSnapshotRef.current = { html: pageHtml, createdAt: Date.now() }
    renderToIframe(pageHtml)
    setStatus("ok")
  }

  const loadScannedProjectPage = async (project: Project, page: ProjectPage) => {
    if (!project.id) return
    if (page.html && hasMeaningfulProjectHtml(page.html)) {
      applyProjectPage(project, page)
      return
    }
    try {
      const response = await apiLoadProjectPage(project.id, page.id)
      const nextProject = response.project
      const nextPage = response.page || nextProject.pages?.find((entry) => entry.id === page.id) || page
      setCurrentProject(nextProject)
      setProjectPages(nextProject.pages || [])
      applyProjectPage(nextProject, nextPage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Page could not be loaded.")
    }
  }

  const scanProjectPages = async (project: Project, openFirstPage = false) => {
    if (!project.id || !project.url || scanningPages) return
    setScanningPages(true)
    try {
      const nextProject = await apiScanProjectPages(project.id)
      const nextPages = nextProject.pages || []
      setCurrentProject(nextProject)
      setProjectPages(nextPages)
      if (openFirstPage && nextPages.length) {
        applyProjectPage(nextProject, findDefaultProjectPage(nextPages) || nextPages[0])
      }
      toast.success(nextPages.length ? `Found ${nextPages.length} internal pages` : "No internal pages found")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Page scan failed")
    } finally {
      setScanningPages(false)
    }
  }

  const resetLoadedDocument = (nextUrl = "", nextPlatform: SitePlatform = "unknown") => {
    exitVersionPreview(false)
    clearVersionCompare()
    setUrl(nextUrl)
    setLoadedUrl("")
    applyEditorHtml("", { resetHistory: true })
    setProjectPages([])
    setProjectVersions([])
    setProjectShares([])
    setAiDiff(null)
    setActivePageId(null)
    setTranslationInfo(null)
    setTranslationReview(null)
    setTranslationOverrideDrafts({})
    setActiveTranslationSegmentId(null)
    setActiveLanguageVariant("base")
    setShowTranslationSplitView(false)
    setCurrentPlatform(nextPlatform)
    setCurrentPlatformGuide(null)
    setEditorAudit(null)
    lastSignificantSnapshotRef.current = { html: "", createdAt: Date.now() }
    setExportWarnings([])
    setExportReadiness("ready")
    renderToIframe("")
  }

  const load = async (forceReload = false, requestedUrl?: string) => {
    const targetUrl = String(requestedUrl ?? url).trim();
    if (!targetUrl) return;
    if (!forceReload && loadedUrl === targetUrl && currentHtml) return;
    const requestId = ++loadRequestRef.current
    try {
      resetLoadedDocument(targetUrl)
      setStatus("blocked");
      const r = await fetchWithAuth(`${ENDPOINTS.proxy}?url=${encodeURIComponent(targetUrl)}`);
      if (!r.ok) {
        const text = await r.text();
        let msg = "Page could not be loaded.";
        try { const d = JSON.parse(text); if (d?.error) msg = d.error; } catch { /* ignore */ }
        if (requestId !== loadRequestRef.current) return;
        toast.error(msg);
        setStatus("idle");
        return;
      }
      const html = await r.text();
      if (requestId !== loadRequestRef.current) return;
      if (!html.trim()) {
        throw new Error("The loaded page returned empty HTML.")
      }
      const resolvedUrl = r.headers.get("x-site-url") || targetUrl
      const headerPlatform = normalizePlatform(r.headers.get("x-site-platform"))
      const detectedPlatform = headerPlatform !== "unknown" ? headerPlatform : detectSitePlatform(resolvedUrl, html)
      setUrl(resolvedUrl)
      setLoadedUrl(resolvedUrl)
      applyEditorHtml(html, { resetHistory: true })
      setCurrentPlatform(detectedPlatform)
      renderToIframe(html)
      setStatus("ok");
    } catch (e) {
      if (requestId !== loadRequestRef.current) return;
      setStatus("idle");
      toast.error(e instanceof Error ? e.message : "Page could not be loaded.");
    }
  };

  const handleOpenProject = async (p: Project, initialPageId?: string | null) => {
    const project = await apiGetProject(p.id).catch(() => p)
    exitVersionPreview(false)
    clearVersionCompare()
    setAiDiff(null)
    setCurrentProject(project)
    setTranslationInfo(null)
    setProjectPages(project.pages || [])
    setActivePageId(null)
    setActiveLanguageVariant("base")
    setLastPublishPreview(null)
    setCustomDomainGuide(null)
    loadWorkflowHistory(project.id).catch(() => {})
    loadProjectVersions(project.id).catch(() => {})
    loadProjectShares(project.id).catch(() => {})
    loadPublishTargets().catch(() => {})
    loadPublishHistory(project.id).catch(() => {})
    if (view !== "admin") setView("editor")

    const projectHtml = String(project.html ?? "")
    const inlineHtml = projectHtml.trim()
    const requestedPage =
      initialPageId
        ? (project.pages || []).find((page) => page.id === initialPageId) || null
        : null
    const defaultPage = requestedPage || findDefaultProjectPage(project.pages || [])

    if (defaultPage) {
      await loadScannedProjectPage(project, defaultPage)
      return
    }

    if (inlineHtml && hasMeaningfulProjectHtml(inlineHtml)) {
      setUrl(project.url || "")
      setLoadedUrl(project.url || "")
      applyEditorHtml(inlineHtml, { resetHistory: true })
      setCurrentPlatform(resolvePlatform(project.platform, project.url, inlineHtml))
      setCurrentPlatformGuide(project.platformGuide ?? null)
      setExportWarnings(project.latestExport?.manifest?.warnings || [])
      setExportReadiness(project.latestExport?.readiness || "ready")
      lastSignificantSnapshotRef.current = { html: inlineHtml, createdAt: Date.now() }
      renderToIframe(inlineHtml)
      setStatus("ok")
      if (project.url) {
        void scanProjectPages(project)
      }
      return
    }

    if (project.url) setUrl(project.url)
    if (!project.url && projectHtml) {
      setUrl("")
      setLoadedUrl("")
      applyEditorHtml(projectHtml, { resetHistory: true })
      setCurrentPlatform(resolvePlatform(project.platform, project.url, projectHtml))
      setCurrentPlatformGuide(project.platformGuide ?? null)
      setExportWarnings(project.latestExport?.manifest?.warnings || [])
      setExportReadiness(project.latestExport?.readiness || "ready")
      lastSignificantSnapshotRef.current = { html: projectHtml, createdAt: Date.now() }
      renderToIframe(projectHtml)
      setStatus("ok")
      return
    }
    if (project.url) {
      setExportWarnings([])
      setExportReadiness("ready")
      void scanProjectPages(project, true)
    }
  }

  const handleModeSwitch = () => {
    if (versionPreview) {
      toast.warning("Exit snapshot preview before editing")
      return
    }
    if (mode === "view") { setMode("edit"); if (currentHtml) setStatus("ok"); }
    else {
      if (confirm("Änderungen speichern und zum View-Modus wechseln?")) {
        setMode("view"); if (currentHtml) setStatus("ok");
      }
    }
  };

  const handleExport = async (modeOverride?: ExportMode) => {
    if (versionPreview) {
      toast.warning("Exit snapshot preview before exporting")
      return
    }
    if (!currentHtml) { toast.warning("Bitte lade zuerst eine Website"); return; }
    const nextExportMode = modeOverride || exportMode
    if (modeOverride && modeOverride !== exportMode) setExportMode(modeOverride)
    setExporting(true);
    try {
      const validation = await apiFetch<{
        ok: boolean
        platform: SitePlatform
        readiness: "ready" | "guarded"
        warnings: ExportWarning[]
        guide: PlatformGuide
        url: string
      }>("/api/export/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: currentHtml, url: loadedUrl, mode: nextExportMode, platform: currentPlatform })
      })
      setCurrentPlatformGuide(validation.guide)
      setCurrentPlatform(validation.platform || currentPlatform)
      setExportWarnings(validation.warnings || [])
      setExportReadiness(validation.readiness || "ready")
      if ((validation.warnings || []).length) {
        toast.warning(`${validation.warnings.length} delivery warning${validation.warnings.length === 1 ? "" : "s"} added to manifest`)
      }

      const r = await fetchWithAuth("/api/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: currentHtml,
          url: loadedUrl,
          mode: nextExportMode,
          platform: currentPlatform,
          project_id: currentProject?.id,
          pageId: activePageId || undefined,
          languageVariant: activeLanguageVariant !== "base" ? activeLanguageVariant : undefined,
          pages: projectPages.length ? projectPages : undefined,
        })
      });
      if (!r.ok) {
        const text = await r.text();
        let msg = "Export fehlgeschlagen";
        try { const d = JSON.parse(text); if (d?.error) msg = d.error; } catch { /* ignore */ }
        throw new Error(msg);
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(await r.blob());
      a.download = getDownloadFilename(r, nextExportMode);
      document.body.appendChild(a); a.click(); a.remove();
      if (currentProject?.id) {
        const refreshed = await apiGetProject(currentProject.id).catch(() => null)
        if (refreshed) {
          setCurrentProject(refreshed)
          await loadWorkflowHistory(refreshed.id)
          await loadProjectVersions(refreshed.id)
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  const handleTranslateSite = async (targetLanguageOverride?: string) => {
    if (versionPreview) {
      toast.warning("Exit snapshot preview before translating")
      return
    }
    if (!currentHtml.trim()) {
      toast.warning("Load a site before translating it")
      return
    }

    const targetLanguage =
      TOP_TRANSLATION_LANGUAGES.find((language) => language.code === (targetLanguageOverride || translationTargetLanguage))?.code ||
      "de"

    setIsTranslatingSite(true)
    try {
      await createVersionSnapshot({
        source: "translate",
        label: `Before translation to ${targetLanguage.toUpperCase()}`,
        silent: true,
      })
      const result = await translateWebsiteHtml(currentHtml, targetLanguage)
      if (currentProject?.id && activePageId) {
        const nextPages = projectPages.map((page) =>
          page.id === activePageId
            ? {
                ...page,
                languageVariants: {
                  ...(page.languageVariants || {}),
                  [targetLanguage]: {
                    html: result.html,
                    baseHtml: result.html,
                    updatedAt: new Date().toISOString(),
                    detectedSourceLanguage: result.detectedSourceLanguage,
                    translatedCount: result.translatedCount,
                    overrides: {},
                    segments: result.segments,
                  },
                },
                updatedAt: new Date().toISOString(),
              }
            : page
        )
        setProjectPages(nextPages)
        const savedProject = await apiSaveProject(currentProject.id, {
          html: currentHtmlRef.current,
          pages: nextPages,
          platform: currentPlatform,
          pageId: activePageId,
        })
        if (savedProject) {
          setCurrentProject(savedProject)
          setProjectPages(savedProject.pages || nextPages)
        }
        setActiveLanguageVariant(targetLanguage)
        applyEditorHtml(result.html, { resetHistory: true })
        renderToIframe(result.html)
      } else {
        commitLiveEditorHtml(result.html)
      }
      setTranslationInfo({
        targetLanguage,
        detectedSourceLanguage: result.detectedSourceLanguage,
        translatedCount: result.translatedCount,
      })
      setTranslationReview({
        targetLanguage,
        detectedSourceLanguage: result.detectedSourceLanguage,
        translatedCount: result.translatedCount,
        segments: result.segments,
      })
      setTranslationOverrideDrafts(
        Object.fromEntries(result.segments.map((segment) => [segment.id, segment.translatedText]))
      )
      setActiveTranslationSegmentId(result.segments[0]?.id || null)
      const targetLabel =
        TOP_TRANSLATION_LANGUAGES.find((language) => language.code === targetLanguage)?.label || targetLanguage
      toast.success(
        result.translatedCount > 0
          ? `Translated ${result.translatedCount} text blocks to ${targetLabel}`
          : `No translatable text found for ${targetLabel}`
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Site translation failed")
    } finally {
      setIsTranslatingSite(false)
    }
  }

  useEffect(() => {
    if (!currentPlatform || currentPlatform === "unknown") {
      setCurrentPlatformGuide(null)
      return
    }
    if (currentProject?.platformGuide && currentProject.platform === currentPlatform) {
      setCurrentPlatformGuide(currentProject.platformGuide)
      return
    }
    apiFetch<{ ok: boolean; guide: PlatformGuide }>(`/api/platforms/${currentPlatform}`)
      .then((data) => setCurrentPlatformGuide(data.guide))
      .catch(() => setCurrentPlatformGuide(null))
  }, [currentPlatform, currentProject?.id, currentProject?.platform, currentProject?.platformGuide])

  useEffect(() => {
    if (loadedUrl) localStorage.setItem("se_last_loaded_url", loadedUrl)
    if (currentPlatform) localStorage.setItem("se_last_site_platform", currentPlatform)
  }, [loadedUrl, currentPlatform])

  useEffect(() => {
    if (!exportWarnings.length) {
      setShowExportWarnings(false)
    }
  }, [exportWarnings])

  useEffect(() => {
    setAssetLibraryQuery("")
  }, [currentProject?.id])

  useEffect(() => {
    localStorage.setItem("se_translate_lang", translationTargetLanguage)
    setTranslationInfo(null)
    setTranslationReview(null)
    setTranslationOverrideDrafts({})
    setActiveTranslationSegmentId(null)
  }, [translationTargetLanguage])

  useEffect(() => {
    const variableNames = collectCssVariables(currentHtml)
    setCssVariableOverrides((previous) => {
      const next: Record<string, string> = {}
      variableNames.forEach((name) => {
        next[name] = previous[name] || ""
      })
      return next
    })
  }, [currentHtml])

  useEffect(() => {
    const syncTheme = () => {
      const nextTheme = readSavedTheme()
      setTheme((prev) => (prev === nextTheme ? prev : nextTheme))
      if (document.body.getAttribute("data-theme") !== nextTheme) {
        document.body.setAttribute("data-theme", nextTheme)
      }
    }

    syncTheme()
    const observer = new MutationObserver(syncTheme)
    observer.observe(document.body, { attributes: true, attributeFilter: ["data-theme"] })
    window.addEventListener("storage", syncTheme)
    return () => {
      observer.disconnect()
      window.removeEventListener("storage", syncTheme)
    }
  }, [])

  useEffect(() => {
    const onStructure = (event: Event) => {
      const detail = (event as CustomEvent).detail as { items?: StructureSnapshotItem[]; selectedRootId?: string | null } | null
      setStructureItems(detail?.items || [])
      setSelectedRootId(detail?.selectedRootId || null)
    }
    window.addEventListener("bo:structure", onStructure as EventListener)
    return () => window.removeEventListener("bo:structure", onStructure as EventListener)
  }, [])

  useEffect(() => {
    if (view !== "editor") return
    const timer = window.setTimeout(() => {
      const doc = iframeRef.current?.contentDocument || null
      setEditorChrome(pickEditorChromeFromDocument(doc))
    }, 80)
    return () => window.clearTimeout(timer)
  }, [view, currentHtml, loadedUrl, mode, versionPreview])

  const handleAiRescan = async (mode: "block" | "page") => {
    if (versionPreview) {
      toast.warning("Exit snapshot preview before running AI actions")
      return
    }
    setAiScanLoading(true)
    await createVersionSnapshot({
      source: mode === "block" ? "ai_block" : "ai_page",
      label: `Before AI ${mode} pass`,
      silent: true,
    })
    window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode } }))
    setTimeout(() => setAiScanLoading(false), 4000)
  };

  const moveStructureItem = (rootId: string, delta: number) => {
    window.dispatchEvent(new CustomEvent("bo:move-root", { detail: { rootId, delta } }))
  }

  const addSelectedComponent = () => {
    const component = COMPONENT_LIBRARY[selectedComponent as keyof typeof COMPONENT_LIBRARY]
    if (!component) return
    window.dispatchEvent(new CustomEvent("bo:insert-component", {
      detail: {
        html: component.template,
        targetRootId: selectedRootId || structureItems[structureItems.length - 1]?.rootId || null,
      }
    }))
    toast.success(`${component.name} added successfully!`)
  }

  const runLeftAiPrompt = async () => {
    if (versionPreview) {
      toast.warning("Exit snapshot preview before running AI prompts")
      return
    }
    if (!leftAiPrompt.trim()) {
      toast.warning(t("Please enter an AI prompt first"))
      return
    }
    setLeftAiRunning(true)
    await createVersionSnapshot({
      source: "ai_prompt",
      label: "Before AI prompt",
      silent: true,
    })
    window.dispatchEvent(new CustomEvent("bo:left-ai-run", {
      detail: {
        model: leftAiModel === "auto" ? "claude-sonnet-4-6" : leftAiModel,
        prompt: composeAiPromptWithTone(leftAiPrompt),
      }
    }))
  }

  useEffect(() => {
    const handler = (e: Event) => trackUsage((e as CustomEvent).detail ?? null)
    window.addEventListener("bo:ai-usage", handler)
    return () => window.removeEventListener("bo:ai-usage", handler)
  }, [])

  useEffect(() => {
    const onDone = () => setLeftAiRunning(false)
    window.addEventListener("bo:left-ai-done", onDone)
    return () => window.removeEventListener("bo:left-ai-done", onDone)
  }, [])

  useEffect(() => {
    const onReq = (e: Event) => {
      const d = (e as CustomEvent).detail ?? {}
      enqueue({
        id: String(d.id || ""),
        model: String(d.model || "unknown"),
        scope: String(d.scope || "unknown"),
        estInputTokens: Number(d.estInputTokens || 0),
        estOutputTokens: Number(d.estOutputTokens || 0),
        prompt: String(d.prompt || "")
      })
    }
    window.addEventListener("bo:ai-approval-request", onReq)
    return () => window.removeEventListener("bo:ai-approval-request", onReq)
  }, [])

  useEffect(() => {
    const onDiffReady = (event: Event) => {
      const detail = (event as CustomEvent).detail ?? {}
      const afterHtml = String(detail.newHtml || "").trim()
      if (!afterHtml) return
      setAiDiff({
        id: `diff-${Date.now()}`,
        scope: detail.blockId ? "block" : "page",
        beforeHtml: String(detail.oldHtml || ""),
        afterHtml,
        beforeDocumentHtml: currentHtmlRef.current,
      })
    }
    window.addEventListener("bo:diff-ready", onDiffReady as EventListener)
    return () => window.removeEventListener("bo:diff-ready", onDiffReady as EventListener)
  }, [])

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument || null
    if (!doc) return
    const markerId = "se-translation-review-style"
    if (!doc.getElementById(markerId)) {
      const style = doc.createElement("style")
      style.id = markerId
      style.textContent = `
        [data-se-translation-focus="1"] {
          outline: 2px solid rgba(16, 185, 129, 0.92) !important;
          outline-offset: 3px !important;
          box-shadow: 0 0 0 6px rgba(16, 185, 129, 0.16) !important;
        }
      `
      doc.head?.appendChild(style)
    }
    Array.from(doc.querySelectorAll("[data-se-translation-focus='1']")).forEach((node) =>
      node.removeAttribute("data-se-translation-focus")
    )
    if (!activeTranslationSegmentId || !translationReview) return
    const segment = translationReview.segments.find((entry) => entry.id === activeTranslationSegmentId)
    if (!segment) return
    const element = doc.querySelector(segment.selector) as HTMLElement | null
    if (!element) return
    element.setAttribute("data-se-translation-focus", "1")
    try {
      element.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
    } catch {
      element.scrollIntoView()
    }
  }, [activeTranslationSegmentId, currentHtml, translationReview])

  useEffect(() => {
    if (!currentProject?.id || !currentHtml.trim() || versionPreview || mode !== "edit") return
    const previous = lastSignificantSnapshotRef.current
    if (!previous.html) {
      lastSignificantSnapshotRef.current = { html: currentHtml, createdAt: Date.now() }
      return
    }
    const changedEnough =
      previous.html !== currentHtml &&
      Math.abs(previous.html.length - currentHtml.length) >= 160
    const waitedLongEnough = Date.now() - previous.createdAt >= 60_000
    if (!changedEnough || !waitedLongEnough) return
    const timer = window.setTimeout(() => {
      void createVersionSnapshot({
        source: "autosave",
        label: "Autosave significant edit",
        html: currentHtml,
        pageId: activePageId || undefined,
        silent: true,
      })
      lastSignificantSnapshotRef.current = { html: currentHtml, createdAt: Date.now() }
    }, 1200)
    return () => window.clearTimeout(timer)
  }, [activePageId, createVersionSnapshot, currentHtml, currentProject?.id, mode, versionPreview])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (view !== "editor") return
      if (versionPreview) return
      const meta = event.metaKey || event.ctrlKey
      if (!meta || event.altKey) return
      const key = event.key.toLowerCase()
      if (key !== "z") return
      event.preventDefault()
      if (event.shiftKey) {
        applyRedo()
        return
      }
      applyUndo()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [versionPreview, view])


  const isEdit = mode === "edit";
  const isLoading = status === "blocked";
  const currentPlatformMeta = getPlatformMeta(currentPlatform);
  const editRailWidth = isEdit ? (isEditRailCollapsed ? EDIT_RAIL_COLLAPSED_WIDTH : EDIT_RAIL_EXPANDED_WIDTH) : 0
  const viewportConfig = VIEWPORT_PRESETS[viewportPreset]
  const activePage = activePageId ? projectPages.find((page) => page.id === activePageId) || null : null
  const comparisonBaseHtml = activeLanguageVariant !== "base" ? String(activePage?.html || "") : ""
  const availableLanguageVariants = [
    { code: "base", label: "Original" },
    ...Object.keys(activePage?.languageVariants || {}).map((code) => ({
      code,
      label: TOP_TRANSLATION_LANGUAGES.find((language) => language.code === code)?.label || code.toUpperCase(),
    })),
  ]
  const assetLibrary = mergeAssetLibraries(currentProject?.assetLibrary || [], collectProjectAssets(currentHtml, projectPages))
  const filteredAssetLibrary = assetLibrary.filter((asset) => {
    const query = assetLibraryQuery.trim().toLowerCase()
    if (!query) return true
    return `${asset.label} ${asset.type} ${asset.url}`.toLowerCase().includes(query)
  })
  const selectedFontAsset = assetLibrary.find((asset) => asset.id === selectedFontAssetId) || null
  const cssVariableNames = Object.keys(cssVariableOverrides)
  const blockFamilyChips = [
    { label: currentPlatformMeta.label, tint: currentPlatformMeta.accent, background: currentPlatformMeta.background, value: "all" as BlockFilter },
    { label: "HTML", tint: "rgba(148,163,184,0.92)", background: "rgba(148,163,184,0.12)", value: "content" as BlockFilter },
    { label: "Layout", tint: "rgba(249,115,22,0.92)", background: "rgba(249,115,22,0.12)", value: "container" as BlockFilter },
    { label: "Media", tint: "rgba(45,212,191,0.92)", background: "rgba(45,212,191,0.12)", value: "image" as BlockFilter },
    { label: "Form", tint: "rgba(56,189,248,0.92)", background: "rgba(56,189,248,0.12)", value: "form" as BlockFilter },
    { label: "CTA", tint: "rgba(168,85,247,0.92)", background: "rgba(168,85,247,0.12)", value: "button" as BlockFilter },
  ]
  const selectedExportMode = EXPORT_MODE_OPTIONS.find(option => option.value === exportMode) || EXPORT_MODE_OPTIONS[0]
  const selectedPublishTargetInfo = publishTargets.find((target) => target.id === publishDraft.target) || null
  const recentPublishHistory = publishHistory.slice(0, 4)
  const selectedTranslationLanguage =
    TOP_TRANSLATION_LANGUAGES.find((language) => language.code === translationTargetLanguage) ||
    TOP_TRANSLATION_LANGUAGES[0]
  const showComparisonViewport =
    !versionPreview && showTranslationSplitView && activeLanguageVariant !== "base" && Boolean(comparisonBaseHtml)
  const selectedStructureItem =
    structureItems.find((item) => item.rootId === selectedRootId) ||
    structureItems.find((item) => item.isSelected) ||
    null
  const versionPageLabelFor = (pageId?: string) => {
    if (!pageId) return "Project"
    return projectPages.find((page) => page.id === pageId)?.name || pageId
  }
  const versionTitleFor = (version?: ProjectVersion | ProjectVersionDetail | null) => {
    if (!version) return ""
    return version.label?.trim() || PROJECT_VERSION_SOURCE_LABELS[version.source] || titleCaseFallback(version.source)
  }
  const versionMetaFor = (version?: ProjectVersion | ProjectVersionDetail | null) => {
    if (!version) return ""
    const parts = [formatEditorDateTime(version.created_at)]
    if (version.pageId) parts.push(versionPageLabelFor(version.pageId))
    return parts.join(" · ")
  }
  const previewVersionTitle = versionTitleFor(versionPreview)
  const editorShellStyle: CSSProperties = {
    height: "100vh",
    ["--editor-topbar-height" as string]: "58px",
    ["--editor-rail-width" as string]: `${editRailWidth}px`,
    ["--editor-viewport-device-width" as string]: viewportConfig.width ? `${viewportConfig.width}px` : "100%",
    ["--editor-chrome-bg" as string]:
      theme === "light" ? "rgba(255,255,255,0.96)" : editorChrome.background,
    ["--editor-chrome-border" as string]:
      theme === "light" ? "rgba(203,213,225,0.95)" : editorChrome.border,
  }
  
  useEffect(() => {
    const onSignal = (e: Event) => {
      try {
        const d = (e as CustomEvent).detail ?? {};
        if (typeof (d as { dragging?: boolean }).dragging === "boolean") setIsDraggingBlock((d as { dragging: boolean }).dragging);
      } catch { /* ignore malformed event */ }
    };
    const onDragEnd = () => setIsDraggingBlock(false);

    window.addEventListener("bo:dragging", onSignal);
    window.addEventListener("dragend", onDragEnd);
    window.addEventListener("drop", onDragEnd);
    return () => {
      window.removeEventListener("bo:dragging", onSignal);
      window.removeEventListener("dragend", onDragEnd);
      window.removeEventListener("drop", onDragEnd);
    };
  }, []);

useEffect(() => {
    if (isLoading) { const t = setTimeout(() => setStatus("idle"), 30000); return () => clearTimeout(t); }
  }, [isLoading]);

  // Auth loading
  const resetToken = new URLSearchParams(window.location.search).get("token")
  if (resetToken) return <ResetPasswordScreen token={resetToken} onDone={() => window.location.replace("/")} />

  if (authUser === "loading") return (
    <div style={{
      height: "100vh", background: "var(--bg-root)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "var(--font-sans)",
    }}>
      <div style={{
        color: "var(--text-muted)", fontSize: 15,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span style={{ animation: "spin 0.8s linear infinite" }}>⟳</span>
        Laden…
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  // Auth screen
  if (view === "auth") return (
    <>
      <AuthScreen onAuth={user => { setAuthUser(user); setView("dashboard") }} />

<ToastContainer />
    </>
  )

  // Dashboard
  if (view === "dashboard") return (
    <>
      <ProjectDashboard
        user={authUser as User}
        plan={demoPlan}
        onPlanChange={setDemoPlan}
        onOpen={handleOpenProject}
        onLogout={() => { setAuthUser(null); setView("auth") }}
      />

      {view === "dashboard" && authUser?.email === "edgar@mailbaumann.de" && (
        <button
          onClick={() => setView("admin")}
          style={{
            position: "fixed",
            right: 20,
            bottom: 20,
            zIndex: 999,
            padding: "12px 16px",
            borderRadius: 999,
            border: "1px solid #334155",
            background: "#111827",
            color: "white",
            cursor: "pointer",
            fontWeight: 800,
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)"
          }}
        >
          Go to Admin
        </button>
      )}

      <ToastContainer />
    </>
  )

  if (view === "admin") {
    const planColors: Record<string, string> = { basis: "#6366f1", starter: "#22c55e", pro: "#a855f7", scale: "#f59e0b" }
    return (
      <div style={{ minHeight: "100vh", background: "#060b14", color: "white", fontFamily: "system-ui, sans-serif", padding: "32px 40px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>Admin Console</div>
              <div style={{ fontSize: 12, color: "#475569", marginTop: 4 }}>{adminUsers.length} users · internal only</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowCreateUser(true)} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f172a", color: "white", cursor: "pointer", fontSize: 13, fontWeight: 600 }}>+ New User</button>
              <button onClick={loadAdminUsers} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f172a", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>{adminLoading ? "Loading…" : t("↻ Refresh")}</button>
              <button onClick={() => setView("dashboard")} style={{ height: 36, padding: "0 16px", borderRadius: 8, border: "1px solid #1e293b", background: "#0f172a", color: "#94a3b8", cursor: "pointer", fontSize: 13 }}>← Back</button>
            </div>
          </div>
          <div style={{ background: "#0d1525", border: "1px solid #1e293b", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 140px 100px 100px 160px", padding: "10px 20px", background: "#0f172a", borderBottom: "1px solid #1e293b", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>
              <div>ID</div><div>User</div><div>Plan</div><div>Credits</div><div>Joined</div><div style={{ textAlign: "right" }}>Actions</div>
            </div>
            {adminUsers.map((u: AdminUser) => {
              const plan = adminUserPlans[u.id] || "basis"
              const color = planColors[plan] || "#6366f1"
              return (
                <div key={u.id} style={{ display: "grid", gridTemplateColumns: "48px 1fr 140px 100px 100px 160px", padding: "14px 20px", borderBottom: "1px solid #0f172a", alignItems: "center" }}>
                  <div style={{ fontSize: 12, color: "#334155", fontWeight: 700 }}>#{u.id}</div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{u.email}</div>
                    <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{u.name || "—"}</div>
                  </div>
                  <div>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: `${color}18`, border: `1px solid ${color}40`, color }}>
                      {plan.charAt(0).toUpperCase() + plan.slice(1)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>€{Number(u.credits || 0).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{(u.created_at || "").slice(0, 10)}</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => addCredits(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #10b98130", background: "#10b98115", color: "#10b981", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Credits</button>
                    <button onClick={() => assignPlan(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #6366f130", background: "#6366f115", color: "#818cf8", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Plan</button>
                    <button onClick={() => resetPassword(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #f59e0b30", background: "#f59e0b15", color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>PW</button>
                    <button onClick={() => deleteUser(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ef444430", background: "#ef444415", color: "#f87171", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Del</button>
                  </div>
                </div>
              )
            })}
            {!adminLoading && adminUsers.length === 0 && (
              <div style={{ padding: 32, color: "#334155", textAlign: "center", fontSize: 13 }}>No users yet. Click Refresh.</div>
            )}
          </div>
        </div>
        {showCreateUser && (
          <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
            <div style={{ background: "#0d1525", padding: 28, borderRadius: 14, border: "1px solid #1e293b", width: 400 }}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Create User</div>
              {(["email","password","name"] as const).map(f => (<input key={f} placeholder={f} type={f==="password"?"password":"text"} value={newUser[f]} onChange={e => setNewUser(p => ({...p,[f]:e.target.value}))} style={{ display:"block", width:"100%", marginBottom:10, padding:"9px 12px", borderRadius:8, border:"1px solid #1e293b", background:"#060b14", color:"white", fontSize:13, boxSizing:"border-box" }} />))}
              <input placeholder={t("credits (€)")} type="number" value={newUser.credits} onChange={e => setNewUser(p => ({...p,credits:Number(e.target.value)}))} style={{ display:"block", width:"100%", marginBottom:16, padding:"9px 12px", borderRadius:8, border:"1px solid #1e293b", background:"#060b14", color:"white", fontSize:13, boxSizing:"border-box" }} />
              <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
                <button onClick={() => setShowCreateUser(false)} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #1e293b", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:13 }}>Cancel</button>
                <button onClick={createUser} style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"#6366f1", color:"white", cursor:"pointer", fontSize:13, fontWeight:700 }}>Create</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`editor-shell theme-${theme}`} style={editorShellStyle}>
      {isEdit && isDraggingBlock && (
        <div
          data-bo-grid-overlay="1"
          className="editor-shell__drag-grid"
          style={{ left: editRailWidth }}
        >
          <div className="editor-shell__drag-grid-label">Drop grid active</div>
        </div>
      )}

      <div className="editor-toolbar">
        <div className="editor-toolbar__cluster editor-toolbar__cluster--tight">
          <button
            className="editor-btn editor-btn--back"
            onClick={() => setView("dashboard")}
          >
            <span className="editor-btn__icon">&lt;</span>
            Dashboard
          </button>

          <div className="editor-toolbar__identity">
            <div className="editor-toolbar__label">Site Editor</div>
          </div>
        </div>

        <div className="editor-toolbar__divider" />

        <div className="editor-toolbar__cluster editor-toolbar__cluster--url">
          <div className={`editor-urlbar ${isEdit ? "is-editing" : ""}`}>
            <span className="editor-urlbar__icon">O</span>
            <input
              className="editor-urlbar__input"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === "Enter" && load(true)}
              placeholder="https://..."
            />
            <button
              className="editor-urlbar__load"
              onClick={() => load(true)}
            >
              {isLoading ? "..." : "Load"}
            </button>
          </div>
        </div>

        <div className="editor-toolbar__divider editor-toolbar__divider--hide-mobile" />

        <div className="editor-toolbar__cluster editor-toolbar__cluster--meta">
          <div className={`editor-status editor-status--${status}`}>
            <span className="editor-status__dot" />
            {status === "blocked"
              ? t("Loading")
              : status === "ok" && /^https?:\/\//i.test(loadedUrl || url)
              ? t("Online")
              : t("Offline")}
          </div>

          <div
            className="editor-pill"
            title={currentPlatformGuide?.safeEditScope || currentPlatformMeta.label}
            style={{
              borderColor: currentPlatformMeta.border,
              background: currentPlatformMeta.background,
              color: currentPlatformMeta.accent,
            }}
          >
            <span className="editor-pill__dot" style={{ background: currentPlatformMeta.accent }} />
            {currentPlatformMeta.label}
          </div>

          {currentProject && (
            <select
              className="editor-select"
              value={currentProject.workflowStage || "draft"}
              onChange={e => changeWorkflowStage(e.target.value as WorkflowStage)}
              disabled={Boolean(versionPreview)}
              title={workflowHistory[0] ? `Last workflow change: ${String(workflowHistory[0].to_stage || "draft").replace(/_/g, " ")}` : "Workflow stage"}
            >
              {WORKFLOW_STAGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          {versionPreview && (
            <div
              className="editor-pill"
              title={versionMetaFor(versionPreview)}
              style={{
                borderColor: "rgba(245, 158, 11, 0.3)",
                background: "rgba(245, 158, 11, 0.14)",
                color: "#fbbf24",
              }}
            >
              <span className="editor-pill__dot" style={{ background: "#fbbf24" }} />
              Snapshot preview
            </div>
          )}

          <div className="editor-viewport-switcher" role="group" aria-label="Viewport preview">
            {(Object.keys(VIEWPORT_PRESETS) as ViewportPreset[]).map((preset) => (
              <button
                key={preset}
                className={`editor-btn editor-btn--compact ${viewportPreset === preset ? "editor-btn--primary" : ""}`}
                onClick={() => setViewportPreset(preset)}
                title={`${VIEWPORT_PRESETS[preset].label} preview`}
              >
                {VIEWPORT_PRESETS[preset].label}
              </button>
            ))}
          </div>

          <button
            className="editor-btn"
            onClick={openFullPreview}
            disabled={!currentHtml}
            title="Open a clean no-chrome preview"
          >
            Preview
          </button>

          <button
            className="editor-btn"
            onClick={applyUndo}
            title="Undo latest change"
            disabled={!undoHistory.length || Boolean(versionPreview)}
          >
            Undo
          </button>
          <button
            className="editor-btn"
            onClick={applyRedo}
            title="Redo latest change"
            disabled={!redoHistory.length || Boolean(versionPreview)}
          >
            Redo
          </button>
        </div>

        <div className="editor-toolbar__spacer" />

        <div className="editor-toolbar__cluster editor-toolbar__cluster--tight">
          {(sessionCost > 0 || sessionTokens.input > 0 || sessionTokens.output > 0) && (
            <div
              className="editor-cost-chip"
              title={`Input: ${sessionTokens.input.toLocaleString()} / Output: ${sessionTokens.output.toLocaleString()} tokens\nClick to reset`}
              onClick={() => {
                if (confirm(t("Reset session costs?"))) {
                  setSessionCost(0)
                  setSessionTokens({ input: 0, output: 0 })
                }
              }}
            >
              <span>${sessionCost.toFixed(4)}</span>
              <span className="editor-cost-chip__sep" />
              <span>{sessionTokens.input.toLocaleString()} in</span>
              <span>{sessionTokens.output.toLocaleString()} out</span>
            </div>
          )}

          {versionPreview && (
            <>
              <button
                className="editor-btn"
                onClick={() => exitVersionPreview(true)}
              >
                Exit preview
              </button>
              <button
                className="editor-btn editor-btn--primary"
                onClick={() => restoreProjectVersion(versionPreview.id)}
                disabled={activeVersionActionId === versionPreview.id}
              >
                {activeVersionActionId === versionPreview.id ? "Restoring..." : "Restore snapshot"}
              </button>
            </>
          )}

          <button
            className={`editor-btn editor-btn--primary ${isEdit ? "is-saving" : ""}`}
            onClick={handleModeSwitch}
            disabled={Boolean(versionPreview)}
          >
            {isEdit ? "Save" : "Edit"}
          </button>

          <div className="editor-export-picker">
            <select
              className="editor-select editor-select--export"
              value={exportMode}
              onChange={e => setExportMode(e.target.value as ExportMode)}
              title="Export format"
            >
              {EXPORT_MODE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              className={`editor-btn editor-btn--export ${exportReadiness === "guarded" ? "is-guarded" : ""}`}
              onClick={handleExport}
              disabled={exporting || Boolean(versionPreview)}
              title="Export"
              aria-busy={exporting ? "true" : undefined}
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes loadingbar { 0% { transform: translateX(-120%) } 100% { transform: translateX(420%) } }
      `}</style>

      <div className={`editor-progress ${isLoading ? "is-visible" : ""}`}>
        <div className="editor-progress__bar" />
      </div>

      {currentAiApproval && (
        <div style={{
          position:"fixed",
          right:16,
          bottom:16,
          width:360,
          maxWidth:"calc(100vw - 32px)",
          background: theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(8,12,24,0.98)",
          border: theme === "light" ? "1px solid rgba(245,158,11,0.22)" : "1px solid rgba(245,158,11,0.35)",
          boxShadow: theme === "light" ? "0 16px 60px rgba(15,23,42,0.14)" : "0 16px 60px rgba(0,0,0,0.45)",
          borderRadius:16,
          padding:14,
          zIndex:140,
          display:"flex",
          flexDirection:"column",
          gap:10
        }}>
          <div style={{ fontSize:12, fontWeight:900, letterSpacing:0.3, color: theme === "light" ? "#111827" : "rgba(255,255,255,0.95)" }}>
            Cloud Request Approval
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"92px 1fr", gap:6, fontSize:12, color: theme === "light" ? "#334155" : "rgba(255,255,255,0.82)" }}>
            <div style={{ opacity:0.7 }}>Model</div><div style={{ fontWeight:700 }}>{currentAiApproval.model}</div>
            <div style={{ opacity:0.7 }}>Scope</div><div style={{ fontWeight:700 }}>{currentAiApproval.scope}</div>
            <div style={{ opacity:0.7 }}>Input est.</div><div style={{ fontWeight:700 }}>~{currentAiApproval.estInputTokens.toLocaleString()} tokens</div>
            <div style={{ opacity:0.7 }}>Output est.</div><div style={{ fontWeight:700 }}>~{currentAiApproval.estOutputTokens.toLocaleString()} tokens</div>
          </div>

          <div style={{
            fontSize:12,
            lineHeight:1.45,
            color: theme === "light" ? "#475569" : "rgba(255,255,255,0.72)",
            background: theme === "light" ? "rgba(248,250,252,0.96)" : "rgba(255,255,255,0.04)",
            border: theme === "light" ? "1px solid rgba(15,23,42,0.08)" : "1px solid rgba(255,255,255,0.08)",
            borderRadius:10,
            padding:"10px 12px",
            maxHeight:88,
            overflow:"auto"
          }}>
            {currentAiApproval.prompt}
          </div>

          <div style={{ display:"flex", gap:8, justifyContent:"flex-end" }}>
            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("bo:ai-approval-response", { detail: { id: currentAiApproval.id, approved: false } }))
                dequeue()
              }}
              style={{
                height:36,
                padding:"0 12px",
                borderRadius:10,
                border: theme === "light" ? "1px solid rgba(148,163,184,0.28)" : "1px solid rgba(148,163,184,0.22)",
                background: theme === "light" ? "rgba(248,250,252,0.96)" : "rgba(255,255,255,0.04)",
                color: theme === "light" ? "#0f172a" : "white",
                cursor:"pointer",
                fontWeight:700,
                fontSize:12
              }}
            >
              Cancel
            </button>

            <button
              onClick={() => {
                window.dispatchEvent(new CustomEvent("bo:ai-approval-response", { detail: { id: currentAiApproval.id, approved: true } }))
                dequeue()
              }}
              style={{
                height:36,
                padding:"0 12px",
                borderRadius:10,
                border: theme === "light" ? "1px solid rgba(245,158,11,0.28)" : "1px solid rgba(245,158,11,0.35)",
                background: theme === "light" ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.16)",
                color: theme === "light" ? "#92400e" : "white",
                cursor:"pointer",
                fontWeight:800,
                fontSize:12
              }}
            >
              Allow Cloud Request
            </button>
          </div>
        </div>
      )}

      {aiDiff && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(2, 6, 23, 0.72)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 150,
            padding: 18,
          }}
        >
          <div
            style={{
              width: "min(1080px, 100%)",
              maxHeight: "calc(100vh - 48px)",
              overflow: "auto",
              borderRadius: 18,
              border: theme === "light" ? "1px solid rgba(148,163,184,0.28)" : "1px solid rgba(148,163,184,0.18)",
              background: theme === "light" ? "rgba(255,255,255,0.98)" : "rgba(8,12,24,0.98)",
              boxShadow: theme === "light" ? "0 24px 60px rgba(15,23,42,0.2)" : "0 24px 80px rgba(0,0,0,0.55)",
              padding: 18,
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 900, color: theme === "light" ? "#0f172a" : "white" }}>
                  AI diff review
                </div>
                <div style={{ fontSize: 12, color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.86)" }}>
                  {aiDiff.scope === "block" ? "Block-level change" : "Page-level change"} ready for accept or rollback.
                </div>
              </div>
              <button
                className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                onClick={acceptAiDiff}
              >
                Close
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div
                style={{
                  borderRadius: 14,
                  border: theme === "light" ? "1px solid rgba(148,163,184,0.22)" : "1px solid rgba(148,163,184,0.16)",
                  padding: 12,
                  background: theme === "light" ? "rgba(248,250,252,0.96)" : "rgba(255,255,255,0.03)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: theme === "light" ? "#334155" : "#cbd5e1" }}>
                  Before
                </div>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, lineHeight: 1.5, color: theme === "light" ? "#0f172a" : "#f8fafc" }}>
                  {buildDiffPreview(aiDiff.beforeHtml || aiDiff.beforeDocumentHtml)}
                </pre>
              </div>
              <div
                style={{
                  borderRadius: 14,
                  border: "1px solid rgba(34,197,94,0.24)",
                  padding: 12,
                  background: theme === "light" ? "rgba(240,253,244,0.96)" : "rgba(34,197,94,0.08)",
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: theme === "light" ? "#166534" : "#86efac" }}>
                  After
                </div>
                <pre style={{ whiteSpace: "pre-wrap", margin: 0, fontSize: 12, lineHeight: 1.5, color: theme === "light" ? "#14532d" : "#dcfce7" }}>
                  {buildDiffPreview(aiDiff.afterHtml)}
                </pre>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button className="editor-btn editor-btn--panel editor-btn--panel-muted" onClick={rejectAiDiff}>
                Reject and revert
              </button>
              <button className="editor-btn editor-btn--panel editor-btn--success" onClick={acceptAiDiff}>
                Accept change
              </button>
            </div>
          </div>
        </div>
      )}

      {isLoading && (
        <div style={{ position:"fixed", top:58, left:0, right:0, bottom:0, background: theme === "light" ? "rgba(240,244,248,0.97)" : "rgba(11,18,32,0.97)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ width:64, height:64, border:"3px solid rgba(99,102,241,0.2)", borderTop:"3px solid #6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite", marginBottom:20 }} />
          <div style={{ color: theme === "light" ? "#111827" : "white", fontSize:17, fontWeight:700, marginBottom:8 }}>Website wird geladen...</div>
          <div style={{ color: theme === "light" ? "#64748b" : "rgba(148,163,184,0.7)", fontSize:13, textAlign:"center", maxWidth:280 }}>Seite wird ueber den Proxy geladen.</div>
        </div>
      )}

      {isEdit && (
        <aside className={`editor-panel ${isEditRailCollapsed ? "is-collapsed" : ""}`}>
          <button
            className="editor-panel__collapse"
            onClick={() => setIsEditRailCollapsed(prev => !prev)}
            title={isEditRailCollapsed ? "Expand tools" : "Collapse tools"}
          >
            {isEditRailCollapsed ? ">" : "<"}
          </button>

          {isEditRailCollapsed ? (
            <div className="editor-panel__collapsed-stack">
              <div
                className="editor-panel__mini-platform"
                style={{
                  borderColor: currentPlatformMeta.border,
                  background: currentPlatformMeta.background,
                  color: currentPlatformMeta.accent,
                }}
              >
                {currentPlatformMeta.shortLabel}
              </div>

              <button
                className="editor-panel__mini-action"
                onClick={() => handleAiRescan("block")}
                disabled={aiScanLoading}
                title="AI Block"
              >
                AI
              </button>

              <button
                className="editor-panel__mini-action"
                onClick={() => handleAiRescan("page")}
                disabled={aiScanLoading}
                title="AI Page"
              >
                Page
              </button>

              <div className={`editor-panel__mini-readiness ${exportReadiness}`}>
                {exportReadiness === "guarded" ? "!" : "OK"}
              </div>
            </div>
          ) : (
            <div className="editor-panel__scroll">
              <section className="editor-panel__section">
                <div className="editor-panel__label">Page</div>
                <div className="editor-panel__site-card">
                  <div
                    className="editor-panel__site-icon"
                    style={{
                      borderColor: currentPlatformMeta.border,
                      background: currentPlatformMeta.background,
                      color: currentPlatformMeta.accent,
                    }}
                  >
                    {currentPlatformMeta.shortLabel}
                  </div>

                  <div className="editor-panel__site-copy">
                    <div className="editor-panel__site-name">
                      {currentProject?.name || loadedUrl.replace(/^https?:\/\//, "") || "No site loaded"}
                    </div>
                    <div className="editor-panel__site-meta">
                      <span className="editor-panel__site-dot" style={{ background: currentPlatformMeta.accent }} />
                      {currentPlatformMeta.label}
                      {currentProject ? ` · ${titleCaseFallback(currentProject.workflowStage || "draft")}` : ""}
                    </div>
                  </div>
                </div>

                <div className="editor-panel__url">
                  {loadedUrl ? loadedUrl.replace(/^https?:\/\//, "") : "Load a site or open a project"}
                </div>

                <div className="editor-panel__note">
                  {currentPlatformGuide?.safeEditScope || "Live block editing stays inside the current overlay scope."}
                </div>
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Block Types</div>
                <div className="editor-panel__chips">
                  {blockFamilyChips.map(chip => {
                    const isActive = chip.value === "all" ? blockFilter === "all" : blockFilter === chip.value
                    return (
                      <button
                        key={`${chip.label}-${chip.value}`}
                        className={`editor-chip ${isActive ? "is-active" : ""}`}
                        onClick={() => setBlockFilter(chip.value)}
                        style={{
                          borderColor: isActive ? chip.tint : "rgba(148,163,184,0.18)",
                          background: isActive ? chip.background : "rgba(255,255,255,0.03)",
                          color: isActive ? chip.tint : "rgba(226,232,240,0.8)",
                        }}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
                </div>
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Delivery</div>
                <div className="editor-panel__delivery">
                  <div className={`editor-panel__delivery-pill ${exportReadiness}`}>
                    {exportReadiness === "guarded" ? "Guarded export" : "Ready export"}
                  </div>
                  <div className="editor-panel__delivery-mode">{selectedExportMode.label}</div>
                </div>
                {exportWarnings.length > 0 ? (
                  <>
                    <button
                      type="button"
                      className={`editor-panel__warning-toggle ${showExportWarnings ? "is-open" : ""}`}
                      onClick={() => setShowExportWarnings(previous => !previous)}
                    >
                      <span className="editor-panel__warning">
                        {exportWarnings.length} warning{exportWarnings.length === 1 ? "" : "s"} will be written into the manifest.
                      </span>
                      <span className="editor-panel__warning-arrow">{showExportWarnings ? "−" : "+"}</span>
                    </button>
                    {showExportWarnings ? (
                      <div className="editor-panel__warning-list">
                        {exportWarnings.map((warning, index) => (
                          <div key={`${warning.code}-${index}`} className="editor-panel__warning-item" title={warning.detail || warning.message}>
                            <span className="editor-panel__warning-item-code">{warning.level === "warning" ? "!" : "i"}</span>
                            <span className="editor-panel__warning-item-copy">
                              {shortenText(warning.detail || warning.message, 88)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="editor-panel__note">No delivery warnings right now.</div>
                )}
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Preview</div>
                <div className="editor-panel__note">
                  Clean previews open without editor chrome. Share previews use the saved project state.
                </div>
                <div className="editor-panel__two-up">
                  <button
                    className="editor-btn editor-btn--panel"
                    onClick={openFullPreview}
                    disabled={!currentHtml}
                  >
                    Clean preview
                  </button>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted"
                    onClick={createSharePreview}
                    disabled={sharingPreview || !currentProject || Boolean(versionPreview)}
                  >
                    {sharingPreview ? "Sharing..." : "Share link"}
                  </button>
                </div>
                <input
                  className="editor-select editor-select--full"
                  value={shareEmail}
                  onChange={(event) => setShareEmail(event.target.value)}
                  placeholder="Optional client email"
                />
                {currentProject ? (
                  projectShares.length ? (
                    <div className="editor-panel__warning-list">
                      {projectShares.slice(0, 4).map((share) => (
                        <div key={share.url} className="editor-panel__warning-item">
                          <span className="editor-panel__warning-item-code">↗</span>
                          <span className="editor-panel__warning-item-copy">
                            {shortenText(
                              [
                                share.pageId ? versionPageLabelFor(share.pageId) : "",
                                share.languageVariant ? share.languageVariant.toUpperCase() : "",
                                share.url.replace(/^https?:\/\//, ""),
                              ]
                                .filter(Boolean)
                                .join(" · "),
                              56,
                            )}
                          </span>
                          <button
                            className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                            onClick={() => window.open(share.url, "_blank", "noopener,noreferrer")}
                          >
                            Open
                          </button>
                          <button
                            className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                            onClick={() => void copySharePreviewUrl(share.url)}
                          >
                            Copy
                          </button>
                          <button
                            className="editor-btn editor-btn--panel editor-btn--compact"
                            onClick={() => void revokeSharePreview(share.id)}
                          >
                            Revoke
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="editor-panel__note">
                      {loadingShares ? "Loading share previews..." : "No share previews yet."}
                    </div>
                  )
                ) : (
                  <div className="editor-panel__note">Share previews require a saved project.</div>
                )}
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Publish</div>
                <div className="editor-panel__note">
                  Publishes the current editor state. The active page is autosaved before preview or deployment.
                </div>
                <div className="editor-panel__publish-target">
                  <select
                    className="editor-select editor-select--full"
                    value={publishDraft.target}
                    onChange={(event) => {
                      updatePublishDraft("target", event.target.value as PublishTarget)
                      setCustomDomainGuide(null)
                    }}
                    disabled={loadingPublishTargets}
                    title="Publish target"
                  >
                    {(["firebase", "netlify", "vercel", "wordpress", "shopify"] as PublishTarget[]).map((target) => (
                      <option key={target} value={target}>
                        {publishTargets.find((entry) => entry.id === target)?.label || titleCaseFallback(target)}
                      </option>
                    ))}
                  </select>
                  {selectedPublishTargetInfo ? (
                    <div className={`editor-panel__publish-badge ${selectedPublishTargetInfo.configured ? "is-ready" : "is-manual"}`}>
                      {selectedPublishTargetInfo.configured ? "Server ready" : "Needs inline credentials"}
                    </div>
                  ) : null}
                </div>
                {selectedPublishTargetInfo ? (
                  <div className="editor-panel__note">
                    {selectedPublishTargetInfo.configured
                      ? `${selectedPublishTargetInfo.label} can publish with the server environment as-is.`
                      : `${selectedPublishTargetInfo.label} needs values from the fields below unless the server environment is configured.`}
                  </div>
                ) : (
                  <div className="editor-panel__note">
                    {loadingPublishTargets ? "Loading publish targets..." : "Publish targets could not be loaded."}
                  </div>
                )}

                {publishDraft.target === "firebase" ? (
                  <input
                    className="editor-select editor-select--full"
                    value={publishDraft.firebaseSiteId}
                    onChange={(event) => updatePublishDraft("firebaseSiteId", event.target.value)}
                    placeholder="Optional Firebase site id"
                  />
                ) : null}

                {publishDraft.target === "netlify" ? (
                  <div className="editor-panel__publish-grid">
                    <input
                      className="editor-select editor-select--full"
                      value={publishDraft.netlifySiteId}
                      onChange={(event) => updatePublishDraft("netlifySiteId", event.target.value)}
                      placeholder="Optional Netlify site id"
                    />
                    <input
                      className="editor-select editor-select--full"
                      value={publishDraft.netlifyToken}
                      onChange={(event) => updatePublishDraft("netlifyToken", event.target.value)}
                      placeholder="Optional Netlify token"
                      type="password"
                    />
                  </div>
                ) : null}

                {publishDraft.target === "vercel" ? (
                  <input
                    className="editor-select editor-select--full"
                    value={publishDraft.vercelToken}
                    onChange={(event) => updatePublishDraft("vercelToken", event.target.value)}
                    placeholder="Optional Vercel token"
                    type="password"
                  />
                ) : null}

                {publishDraft.target === "wordpress" ? (
                  <>
                    <div className="editor-panel__publish-grid">
                      <input
                        className="editor-select editor-select--full"
                        value={publishDraft.wpUrl}
                        onChange={(event) => updatePublishDraft("wpUrl", event.target.value)}
                        placeholder="WordPress site URL"
                      />
                      <input
                        className="editor-select editor-select--full"
                        value={publishDraft.wpUser}
                        onChange={(event) => updatePublishDraft("wpUser", event.target.value)}
                        placeholder="WP username"
                      />
                    </div>
                    <div className="editor-panel__publish-grid">
                      <input
                        className="editor-select editor-select--full"
                        value={publishDraft.wpAppPassword}
                        onChange={(event) => updatePublishDraft("wpAppPassword", event.target.value)}
                        placeholder="WP app password"
                        type="password"
                      />
                      <input
                        className="editor-select editor-select--full"
                        value={publishDraft.wpPageId}
                        onChange={(event) => updatePublishDraft("wpPageId", event.target.value)}
                        placeholder="Optional page id"
                      />
                    </div>
                  </>
                ) : null}

                {publishDraft.target === "shopify" ? (
                  <>
                    <div className="editor-panel__publish-grid">
                      <input
                        className="editor-select editor-select--full"
                        value={publishDraft.shopDomain}
                        onChange={(event) => updatePublishDraft("shopDomain", event.target.value)}
                        placeholder="Shopify domain"
                      />
                      <input
                        className="editor-select editor-select--full"
                        value={publishDraft.shopAccessToken}
                        onChange={(event) => updatePublishDraft("shopAccessToken", event.target.value)}
                        placeholder="Shopify access token"
                        type="password"
                      />
                    </div>
                    <input
                      className="editor-select editor-select--full"
                      value={publishDraft.shopThemeId}
                      onChange={(event) => updatePublishDraft("shopThemeId", event.target.value)}
                      placeholder="Optional Shopify theme id"
                    />
                  </>
                ) : null}

                <div className="editor-panel__publish-toolbar">
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted"
                    onClick={() => void createPublishPreview()}
                    disabled={creatingPublishPreview || !currentProject || Boolean(versionPreview)}
                  >
                    {creatingPublishPreview ? "Creating..." : "Preview URL"}
                  </button>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--success"
                    onClick={() => void publishCurrentProject()}
                    disabled={!currentProject || !currentHtml || Boolean(versionPreview) || Boolean(publishingTarget)}
                  >
                    {publishingTarget === publishDraft.target ? "Publishing..." : `Publish to ${selectedPublishTargetInfo?.label || titleCaseFallback(publishDraft.target)}`}
                  </button>
                </div>

                {lastPublishPreview ? (
                  <div className="editor-panel__publish-preview">
                    <div className="editor-panel__publish-row">
                      <strong>Latest preview</strong>
                      <span>Expires {formatEditorDateTime(lastPublishPreview.expiresAt)}</span>
                    </div>
                    <div className="editor-panel__publish-url">
                      {shortenText(lastPublishPreview.previewUrl.replace(/^https?:\/\//, ""), 60)}
                    </div>
                    <div className="editor-panel__publish-actions">
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => window.open(lastPublishPreview.previewUrl, "_blank", "noopener,noreferrer")}
                      >
                        Open
                      </button>
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={() => void copyTextValue(lastPublishPreview.previewUrl, "Preview URL copied", "Copy this preview URL")}
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                ) : null}

                <div className="editor-panel__publish-grid">
                  <input
                    className="editor-select editor-select--full"
                    value={publishDraft.customDomain}
                    onChange={(event) => updatePublishDraft("customDomain", event.target.value)}
                    placeholder="Custom domain"
                  />
                  <button
                    className="editor-btn editor-btn--panel editor-btn--accent"
                    onClick={() => void loadCustomDomainGuide()}
                    disabled={!currentProject}
                  >
                    Domain guide
                  </button>
                </div>

                {customDomainGuide ? (
                  <div className="editor-panel__publish-guide">
                    <div className="editor-panel__publish-row">
                      <strong>{customDomainGuide.domain}</strong>
                      <span>{titleCaseFallback(customDomainGuide.target)}</span>
                    </div>
                    <div className="editor-panel__note">
                      {customDomainGuide.guide.recordType} → {customDomainGuide.guide.recordValue}
                    </div>
                    <div className="editor-panel__publish-guide-steps">
                      {customDomainGuide.guide.steps.map((step, index) => (
                        <div key={`${customDomainGuide.domain}-${index}`} className="editor-panel__publish-guide-step">
                          <span>{index + 1}</span>
                          <span>{step}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="editor-panel__version-toolbar">
                  <div className="editor-panel__note">
                    {currentProject
                      ? recentPublishHistory.length
                        ? `${publishHistory.length} deployment${publishHistory.length === 1 ? "" : "s"} tracked for this project.`
                        : "No deployments recorded for this project yet."
                      : "Open a saved project to publish and track deployment history."}
                  </div>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                    onClick={() => currentProject?.id && loadPublishHistory(currentProject.id)}
                    disabled={!currentProject || loadingPublishHistory}
                  >
                    {loadingPublishHistory ? "..." : "Refresh"}
                  </button>
                </div>

                {currentProject && recentPublishHistory.length ? (
                  <div className="editor-panel__publish-history">
                    {recentPublishHistory.map((deployment) => (
                      <div
                        key={deployment.id}
                        className={`editor-panel__publish-item is-${deployment.status}`}
                      >
                        <div className="editor-panel__publish-row">
                          <strong>{titleCaseFallback(deployment.target)}</strong>
                          <span>{formatEditorDateTime(deployment.finished_at || deployment.created_at)}</span>
                        </div>
                        <div className="editor-panel__publish-row">
                          <span>{deployment.status === "success" ? "Live" : deployment.status === "failed" ? "Failed" : "Pending"}</span>
                          <span>{deployment.export_mode || selectedExportMode.label}</span>
                        </div>
                        {deployment.deploy_url ? (
                          <div className="editor-panel__publish-url">
                            {shortenText(deployment.deploy_url.replace(/^https?:\/\//, ""), 60)}
                          </div>
                        ) : null}
                        {deployment.error_message ? (
                          <div className="editor-panel__note">{shortenText(deployment.error_message, 120)}</div>
                        ) : null}
                        <div className="editor-panel__publish-actions">
                          <button
                            className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                            onClick={() => deployment.deploy_url && window.open(deployment.deploy_url, "_blank", "noopener,noreferrer")}
                            disabled={!deployment.deploy_url}
                          >
                            Open
                          </button>
                          <button
                            className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                            onClick={() => deployment.deploy_url && copyTextValue(deployment.deploy_url, "Publish URL copied", "Copy this publish URL")}
                            disabled={!deployment.deploy_url}
                          >
                            Copy
                          </button>
                          <button
                            className="editor-btn editor-btn--panel editor-btn--compact"
                            onClick={() => void rollbackPublishedDeployment(deployment)}
                            disabled={deployment.status !== "success" || rollingBackDeploymentId === deployment.id || Boolean(versionPreview)}
                          >
                            {rollingBackDeploymentId === deployment.id ? "Rolling back..." : "Rollback"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Design System</div>
                <div className="editor-panel__translation-controls">
                  <input
                    className="editor-select editor-select--full"
                    value={globalStyleOverrides.fontFamily}
                    onChange={(event) =>
                      setGlobalStyleOverrides((previous) => ({ ...previous, fontFamily: event.target.value }))
                    }
                    placeholder="Site font-family"
                  />
                </div>
                <div className="editor-panel__two-up">
                  <input
                    className="editor-select editor-select--full"
                    value={globalStyleOverrides.textColor}
                    onChange={(event) =>
                      setGlobalStyleOverrides((previous) => ({ ...previous, textColor: event.target.value }))
                    }
                    placeholder="Text color"
                  />
                  <input
                    className="editor-select editor-select--full"
                    value={globalStyleOverrides.backgroundColor}
                    onChange={(event) =>
                      setGlobalStyleOverrides((previous) => ({ ...previous, backgroundColor: event.target.value }))
                    }
                    placeholder="Background"
                  />
                </div>
                <div className="editor-panel__two-up">
                  <input
                    className="editor-select editor-select--full"
                    value={globalStyleOverrides.accentColor}
                    onChange={(event) =>
                      setGlobalStyleOverrides((previous) => ({ ...previous, accentColor: event.target.value }))
                    }
                    placeholder="Accent color"
                  />
                  <button
                    className="editor-btn editor-btn--panel editor-btn--success"
                    onClick={applyGlobalStyleOverridesNow}
                    disabled={!currentHtml}
                  >
                    Apply styles
                  </button>
                </div>
                {cssVariableNames.length ? (
                  <>
                    <div className="editor-panel__note">CSS variables</div>
                    <div className="editor-panel__warning-list">
                      {cssVariableNames.slice(0, 8).map((name) => (
                        <div key={name} className="editor-panel__warning-item">
                          <span className="editor-panel__warning-item-code">#</span>
                          <span className="editor-panel__warning-item-copy">{name}</span>
                          <input
                            className="editor-select editor-select--full"
                            value={cssVariableOverrides[name] || ""}
                            onChange={(event) =>
                              setCssVariableOverrides((previous) => ({ ...previous, [name]: event.target.value }))
                            }
                            placeholder="override"
                          />
                        </div>
                      ))}
                    </div>
                  </>
                ) : null}
                <div className="editor-panel__note">
                  {assetLibrary.length
                    ? `${assetLibrary.length} project asset${assetLibrary.length === 1 ? "" : "s"} available across this project.`
                    : "No reusable project assets detected yet."}
                </div>
                {assetLibrary.length > 6 ? (
                  <input
                    className="editor-select editor-select--full"
                    value={assetLibraryQuery}
                    onChange={(event) => setAssetLibraryQuery(event.target.value)}
                    placeholder="Search project assets"
                  />
                ) : null}
                <input
                  type="file"
                  multiple
                  accept="image/*,.woff,.woff2,.ttf,.otf,.eot"
                  onChange={(event) => {
                    void handleAssetLibraryUpload(event.target.files)
                    event.currentTarget.value = ""
                  }}
                />
                {assetLibrary.length ? (
                  <div
                    className="editor-panel__warning-list"
                    style={{ maxHeight: 320, overflow: "auto", paddingRight: 4 }}
                  >
                    {filteredAssetLibrary.map((asset) => (
                      <div key={asset.id} className="editor-panel__warning-item" title={asset.url}>
                        <span className="editor-panel__warning-item-code">{asset.type === "image" ? "Img" : "Font"}</span>
                        <span className="editor-panel__warning-item-copy">{shortenText(asset.label, 52)}</span>
                        {asset.type === "image" ? (
                          <button
                            className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                            onClick={() =>
                              window.dispatchEvent(new CustomEvent("bo:prefill-image-src", { detail: { url: asset.url } }))
                            }
                          >
                            Use
                          </button>
                        ) : (
                          <button
                            className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                            onClick={() => {
                              const fontName = String(asset.label || "ProjectFont").replace(/\.[A-Za-z0-9]+$/, "")
                              setSelectedFontAssetId(asset.id)
                              setGlobalStyleOverrides((previous) => ({
                                ...previous,
                                fontFamily: `'${fontName}', system-ui, sans-serif`,
                              }))
                            }}
                          >
                            Set font
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                ) : null}
                {assetLibrary.length && !filteredAssetLibrary.length ? (
                  <div className="editor-panel__note">No assets match the current filter.</div>
                ) : null}
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Localization</div>
                <div className="editor-panel__translation-card">
                  <div className="editor-panel__translation-head">
                    <div className="editor-panel__translation-title">Instant website translation</div>
                    <div className="editor-panel__translation-language">{selectedTranslationLanguage.label}</div>
                  </div>
                  <div className="editor-panel__translation-controls">
                    <select
                      className="editor-select editor-select--full"
                      value={translationTargetLanguage}
                      onChange={e => setTranslationTargetLanguage(e.target.value)}
                      title="Translation target language"
                    >
                      {TOP_TRANSLATION_LANGUAGES.map((language) => (
                        <option key={language.code} value={language.code}>
                          {language.label}
                        </option>
                      ))}
                    </select>
                    {activePage ? (
                      <select
                        className="editor-select editor-select--full"
                        value={activeLanguageVariant}
                        onChange={(event) => switchLanguageVariant(event.target.value)}
                        title="Stored language variants"
                      >
                        {availableLanguageVariants.map((variant) => (
                          <option key={variant.code} value={variant.code}>
                            {variant.label}
                          </option>
                        ))}
                      </select>
                    ) : null}
                    <button
                      className={`editor-btn editor-btn--panel editor-btn--translate ${isTranslatingSite ? "is-loading" : ""}`}
                      onClick={handleTranslateSite}
                      disabled={isTranslatingSite || !currentHtml || Boolean(versionPreview)}
                    >
                      {isTranslatingSite ? "Translating..." : "Translate site"}
                    </button>
                  </div>
                  <div className="editor-panel__note">
                    Translates the loaded page copy while preserving structure, exports, and block overlay markup.
                  </div>
                  <div className="editor-panel__two-up">
                    <button
                      className="editor-btn editor-btn--panel editor-btn--panel-muted"
                      onClick={() => void storeCurrentAsLanguageVariant()}
                      disabled={!currentProject || !activePage || !currentHtml}
                    >
                      Save current as {selectedTranslationLanguage.label}
                    </button>
                    {activeLanguageVariant !== "base" ? (
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted"
                        onClick={() => void resetLanguageVariantFromBase()}
                        disabled={!activePage?.html}
                      >
                        Reset variant from base
                      </button>
                    ) : (
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted"
                        onClick={() => switchLanguageVariant("base")}
                        disabled
                      >
                        Base page active
                      </button>
                    )}
                  </div>
                  {activeLanguageVariant !== "base" ? (
                    <button
                      className="editor-btn editor-btn--panel editor-btn--panel-muted"
                      onClick={() => void deleteLanguageVariant()}
                    >
                      Delete current variant
                    </button>
                  ) : null}
                  {translationInfo ? (
                    <div className="editor-panel__translation-summary">
                      <strong>{translationInfo.translatedCount}</strong> text blocks translated
                      {translationInfo.detectedSourceLanguage ? ` from ${translationInfo.detectedSourceLanguage.toUpperCase()}` : ""}
                    </div>
                  ) : (
                    <div className="editor-panel__note">
                      Choose one of the top 50 languages in the top bar and run Translate site.
                    </div>
                  )}
                  {activeLanguageVariant !== "base" && comparisonBaseHtml ? (
                    <button
                      className="editor-btn editor-btn--panel editor-btn--panel-muted"
                      onClick={() => setShowTranslationSplitView((value) => !value)}
                    >
                      {showTranslationSplitView ? "Hide original side-by-side" : "Show original side-by-side"}
                    </button>
                  ) : null}
                  {translationReview?.segments.length ? (
                    <div className="editor-panel__warning-list">
                      {translationReview.segments.slice(0, 6).map((segment) => (
                        <div
                          key={segment.id}
                          className={`editor-panel__version-item ${activeTranslationSegmentId === segment.id ? "is-active" : ""}`}
                        >
                          <div className="editor-panel__version-copy">
                            <strong>{shortenText(segment.sourceText, 68)}</strong>
                            <span>{shortenText(segment.translatedText, 68)}</span>
                          </div>
                          <textarea
                            className="editor-textarea"
                            value={translationOverrideDrafts[segment.id] ?? segment.translatedText}
                            onChange={(event) =>
                              setTranslationOverrideDrafts((previous) => ({
                                ...previous,
                                [segment.id]: event.target.value,
                              }))
                            }
                          />
                          <div className="editor-panel__version-actions">
                            <button
                              className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                              onClick={() => setActiveTranslationSegmentId(segment.id)}
                            >
                              Focus
                            </button>
                            <button
                              className="editor-btn editor-btn--panel editor-btn--compact"
                              onClick={() => void applyTranslationOverride(segment.id)}
                            >
                              Override
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Versioning</div>

                <div className="editor-panel__version-toolbar">
                  <button
                    className="editor-btn editor-btn--panel"
                    onClick={handleManualSnapshot}
                    disabled={savingSnapshot || !currentProject || !currentHtml || Boolean(versionPreview)}
                  >
                    {savingSnapshot ? "Saving..." : "Save snapshot"}
                  </button>

                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                    onClick={() => currentProject?.id && loadProjectVersions(currentProject.id)}
                    disabled={loadingVersions || !currentProject}
                  >
                    {loadingVersions ? "..." : "Refresh"}
                  </button>
                </div>

                {currentProject ? (
                  <div className="editor-panel__note">
                    {projectVersions.length
                      ? `${projectVersions.length} project snapshot${projectVersions.length === 1 ? "" : "s"} available.`
                      : "Create a named snapshot before major editor, AI, or translation work."}
                  </div>
                ) : (
                  <div className="editor-panel__note">
                    Open a saved project to use project-level snapshots and rollback.
                  </div>
                )}

                {versionPreview ? (
                  <div className="editor-panel__version-preview">
                    <div className="editor-panel__version-preview-title">{previewVersionTitle}</div>
                    <div className="editor-panel__version-preview-meta">{versionMetaFor(versionPreview)}</div>
                  </div>
                ) : null}

                {projectVersions.length > 0 ? (
                  <div className="editor-panel__version-list">
                    {projectVersions.slice(0, 8).map((version) => {
                      const isPreviewing = versionPreview?.id === version.id
                      const isBusy = activeVersionActionId === version.id
                      return (
                        <div
                          key={version.id}
                          className={`editor-panel__version-item ${isPreviewing ? "is-active" : ""}`}
                        >
                          <div className="editor-panel__version-copy">
                            <strong>{versionTitleFor(version)}</strong>
                            <span>{versionMetaFor(version)}</span>
                          </div>

                          <div className="editor-panel__version-actions">
                            <button
                              className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                              onClick={() => {
                                if (isPreviewing) {
                                  exitVersionPreview(true)
                                  return
                                }
                                void previewProjectVersion(version.id)
                              }}
                              disabled={isBusy}
                            >
                              {isPreviewing ? "Exit" : "Preview"}
                            </button>
                            <button
                              className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                              onClick={() => void compareProjectVersion(version.id)}
                              disabled={isBusy}
                            >
                              Compare
                            </button>
                            <button
                              className="editor-btn editor-btn--panel editor-btn--compact"
                              onClick={() => void restoreProjectVersion(version.id)}
                              disabled={isBusy}
                            >
                              {isBusy ? "..." : "Restore"}
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : currentProject ? (
                  <div className="editor-panel__note">
                    {loadingVersions ? "Loading project history..." : "No project snapshots yet."}
                  </div>
                ) : null}
                {versionCompare ? (
                  <div className="editor-panel__version-compare">
                    <div className="editor-panel__version-preview">
                      <div className="editor-panel__version-preview-title">
                        Compare current vs {versionTitleFor(versionCompare)}
                      </div>
                      <div className="editor-panel__version-preview-meta">{versionMetaFor(versionCompare)}</div>
                    </div>
                    <div className="editor-panel__compare-grid">
                      <div className="editor-panel__compare-pane">
                        <div className="editor-panel__compare-label">Current</div>
                        <iframe title="current-version-compare" srcDoc={currentHtml} className="editor-panel__compare-frame" />
                      </div>
                      <div className="editor-panel__compare-pane">
                        <div className="editor-panel__compare-label">Snapshot</div>
                        <iframe title="snapshot-version-compare" srcDoc={versionCompare.html} className="editor-panel__compare-frame" />
                      </div>
                    </div>
                    <div className="editor-panel__version-actions">
                      <button
                        className="editor-btn editor-btn--panel editor-btn--panel-muted editor-btn--compact"
                        onClick={clearVersionCompare}
                      >
                        Close
                      </button>
                      <button
                        className="editor-btn editor-btn--panel editor-btn--compact"
                        onClick={() => void restoreProjectVersion(versionCompare.id)}
                      >
                        Restore snapshot
                      </button>
                    </div>
                  </div>
                ) : null}
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Audits</div>
                <div className="editor-panel__two-up">
                  <button
                    className="editor-btn editor-btn--panel"
                    onClick={() => void runEditorAudit("seo")}
                    disabled={runningAudit !== null}
                  >
                    {runningAudit === "seo" ? "Running..." : "SEO"}
                  </button>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted"
                    onClick={() => void runEditorAudit("cro")}
                    disabled={runningAudit !== null}
                  >
                    {runningAudit === "cro" ? "Running..." : "CRO"}
                  </button>
                </div>
                <button
                  className="editor-btn editor-btn--panel editor-btn--panel-muted"
                  onClick={() => void runEditorAudit("accessibility")}
                  disabled={runningAudit !== null}
                >
                  {runningAudit === "accessibility" ? "Running..." : "Accessibility"}
                </button>
                {editorAudit ? (
                  <div className="editor-panel__version-preview">
                    <div className="editor-panel__version-preview-title">{editorAudit.headline}</div>
                    <div className="editor-panel__version-preview-meta">{editorAudit.summary}</div>
                    {editorAudit.scoreBadges?.length ? (
                      <div className="editor-panel__chips">
                        {editorAudit.scoreBadges.map((badge) => (
                          <span key={badge} className="editor-chip is-active">
                            {badge}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="editor-panel__warning-list">
                      {editorAudit.items.map((item) => (
                        <div key={item} className="editor-panel__warning-item">
                          <span className="editor-panel__warning-item-code">•</span>
                          <span className="editor-panel__warning-item-copy">{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="editor-panel__note">Run an audit to surface page-level SEO, CRO, and accessibility issues here.</div>
                )}
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Overlay</div>
                <select
                  className="editor-select editor-select--full"
                  value={blockFilter}
                  onChange={e => setBlockFilter(e.target.value as BlockFilter)}
                  title="Visible blocks"
                >
                  {BLOCK_FILTER_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <div className="editor-panel__two-up">
                  <button
                    className="editor-btn editor-btn--panel"
                    onClick={() => handleAiRescan("block")}
                    disabled={aiScanLoading || Boolean(versionPreview)}
                  >
                    {aiScanLoading ? "..." : "AI Block"}
                  </button>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted"
                    onClick={() => handleAiRescan("page")}
                    disabled={aiScanLoading || Boolean(versionPreview)}
                  >
                    {aiScanLoading ? "..." : "AI Page"}
                  </button>
                </div>
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Structure</div>
                <div className="editor-structure">
                  {structureItems.length === 0 ? (
                    <div className="editor-panel__note">
                      Load a site to reorder motherblocks.
                    </div>
                  ) : structureItems.map(item => (
                    <div
                      key={item.id}
                      className={`editor-structure__item ${item.isSelected ? "is-selected" : ""}`}
                    >
                      <div className="editor-structure__copy">
                        <div className="editor-structure__title">{item.displayLabel}</div>
                        <div className="editor-structure__meta">
                          {item.childCount > 0 ? `${item.childCount} child blocks` : titleCaseFallback(item.kind)}
                        </div>
                      </div>

                      <div className="editor-structure__actions">
                        <button className="editor-structure__move" onClick={() => moveStructureItem(item.rootId, -2)}>↑↑</button>
                        <button className="editor-structure__move" onClick={() => moveStructureItem(item.rootId, -1)}>↑</button>
                        <button className="editor-structure__move" onClick={() => moveStructureItem(item.rootId, 1)}>↓</button>
                        <button className="editor-structure__move" onClick={() => moveStructureItem(item.rootId, 2)}>↓↓</button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">Components</div>
                <select
                  className="editor-select editor-select--full"
                  value={selectedComponent || ""}
                  onChange={e => setSelectedComponent(e.target.value)}
                  title="Professional components"
                >
                  <option value="">Choose component</option>
                  {Object.entries(COMPONENT_LIBRARY).map(([key, comp]) => (
                    <option key={key} value={key}>
                      {COMPONENT_CATEGORIES[comp.category as keyof typeof COMPONENT_CATEGORIES]?.icon} {comp.name}
                    </option>
                  ))}
                </select>

                <button
                  className={`editor-btn editor-btn--panel editor-btn--success ${selectedComponent ? "" : "is-disabled"}`}
                  disabled={!selectedComponent}
                  onClick={addSelectedComponent}
                >
                  Add component
                </button>
              </section>

              <div className="editor-panel__divider" />

              <section className="editor-panel__section">
                <div className="editor-panel__label">AI Assistant</div>
                <select
                  className="editor-select editor-select--full"
                  value={leftAiModel}
                  onChange={e => setLeftAiModel(e.target.value)}
                  title="AI model"
                >
                  {AI_MODELS.map(model => (
                    <option key={model.value} value={model.value}>
                      {model.label}
                    </option>
                  ))}
                </select>

                <select
                  className="editor-select editor-select--full"
                  value={leftAiTone}
                  onChange={(event) => setLeftAiTone(event.target.value)}
                  title="AI tone preset"
                >
                  <option value="neutral">Neutral tone</option>
                  <option value="professional">Professional</option>
                  <option value="casual">Casual</option>
                  <option value="persuasive">Persuasive</option>
                  <option value="luxury">Luxury</option>
                  <option value="direct">Direct response</option>
                </select>

                <textarea
                  className="editor-textarea"
                  value={leftAiPrompt}
                  onChange={e => setLeftAiPrompt(e.target.value)}
                  placeholder={`Prompt ${AI_MODELS.find(model => model.value === leftAiModel)?.label || leftAiModel}...`}
                />

                <button
                  data-left-ai-run="1"
                  className={`editor-btn editor-btn--panel editor-btn--accent ${leftAiRunning ? "is-loading" : ""}`}
                  onClick={() => void runLeftAiPrompt()}
                  disabled={leftAiRunning || Boolean(versionPreview)}
                >
                  {leftAiRunning ? "Running..." : "Run prompt"}
                </button>

                <button
                  className={`editor-btn editor-btn--panel editor-btn--panel-muted ${batchAiRunning ? "is-loading" : ""}`}
                  onClick={() => void runBatchAiAcrossPages()}
                  disabled={batchAiRunning || leftAiRunning || Boolean(versionPreview)}
                >
                  {batchAiRunning ? "Running..." : "Run across pages"}
                </button>
              </section>
            </div>
          )}
        </aside>
      )}

      <div className="editor-viewport">
        <div className={`editor-viewport__canvas ${showComparisonViewport ? "editor-viewport__canvas--split" : ""}`}>
          {showComparisonViewport ? (
            <div className="editor-viewport__split">
              <div className={`editor-viewport__device editor-viewport__device--${viewportPreset}`}>
                <div className="editor-viewport__device-meta">
                  <span>{viewportConfig.label}</span>
                  <span>Original</span>
                </div>
                <iframe
                  ref={comparisonIframeRef}
                  title="original-preview"
                  className="editor-viewport__frame"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                />
              </div>
              <div className={`editor-viewport__device editor-viewport__device--${viewportPreset}`}>
                <div className="editor-viewport__device-meta">
                  <span>{viewportConfig.label}</span>
                  <span>
                    {TOP_TRANSLATION_LANGUAGES.find((language) => language.code === activeLanguageVariant)?.label || activeLanguageVariant.toUpperCase()}
                  </span>
                </div>
                <iframe
                  ref={iframeRef}
                  title="preview"
                  className="editor-viewport__frame"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
                />
              </div>
            </div>
          ) : (
            <div className={`editor-viewport__device editor-viewport__device--${viewportPreset}`}>
              <div className="editor-viewport__device-meta">
                <span>{viewportConfig.label}</span>
                <span>
                  {activeLanguageVariant === "base"
                    ? "Original"
                    : TOP_TRANSLATION_LANGUAGES.find((language) => language.code === activeLanguageVariant)?.label || activeLanguageVariant.toUpperCase()}
                </span>
              </div>
              <iframe
                ref={iframeRef}
                title="preview"
                className="editor-viewport__frame"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
              />
            </div>
          )}
        </div>
        <BlockOverlay
          iframeRef={iframeRef}
          enabled={isEdit && !versionPreview}
          canvasMode={layoutMode === "canvas"}
          blockFilter={blockFilter}
          onStatus={setStatus}
          onHtmlChange={commitLiveEditorHtml}
        />
      </div>
      <AssistantWidget
        plan={demoPlan}
        avoidOverlay={Boolean(currentAiApproval)}
        onAction={view === "editor" ? handleAssistantEditorAction : undefined}
        context={{
          surface: "editor",
          plan: demoPlan,
          workspace: "Editor",
          projectName: currentProject?.name || "",
          projectUrl: loadedUrl || currentProject?.url || "",
          platform: currentPlatform,
          exportMode,
          selectedBlock: selectedStructureItem?.displayLabel || null,
          warnings: exportWarnings.map((warning) => shortenText(warning.message, 72)),
        }}
        onUsage={trackUsage}
      />
      <ToastContainer />
    </div>
  );
}
