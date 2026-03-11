import { apiMe, type User } from "./api/auth"
import { apiGetPlan } from "./api/credits"
import { apiFetch } from "./api/client"
import {
  apiGetProject,
  apiLoadProjectPage,
  apiGetProjectWorkflowHistory,
  apiScanProjectPages,
  apiSaveProject,
  apiSetProjectWorkflowStage,
  type ExportWarning,
  type PlatformGuide,
  type Project,
  type ProjectPage,
  type WorkflowEvent,
  type WorkflowStage,
} from "./api/projects"
import AuthScreen from "./components/AuthScreen"
import ResetPasswordScreen from "./components/ResetPasswordScreen"
import ProjectDashboard from "./components/ProjectDashboard"
import AssistantWidget from "./components/AssistantWidget"
import { toast, ToastContainer } from "./components/Toast"
import { useRef, useState, useEffect, type CSSProperties } from 'react';
import BlockOverlay from "./components/BlockOverlay";
import { ENDPOINTS } from './config';
import { COMPONENT_LIBRARY, COMPONENT_CATEGORIES } from './components/ComponentLibrary';
import { useTranslation } from "./i18n/useTranslation"
import { detectSitePlatform, getPlatformMeta, normalizePlatform, type SitePlatform } from "./utils/sitePlatform"
import { TOP_TRANSLATION_LANGUAGES, translateWebsiteHtml } from "./utils/htmlTranslation"
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
  | "email-newsletter"
  | "markdown-content"
  | "pdf-print"

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
  const [currentPlatform, setCurrentPlatform] = useState<SitePlatform>("unknown")
  const [currentPlatformGuide, setCurrentPlatformGuide] = useState<PlatformGuide | null>(null)
  const [exportWarnings, setExportWarnings] = useState<ExportWarning[]>([])
  const [exportReadiness, setExportReadiness] = useState<"ready" | "guarded">("ready")
  const [workflowHistory, setWorkflowHistory] = useState<WorkflowEvent[]>([])
  const [aiScanLoading, setAiScanLoading] = useState(false)
  const [sessionCost, setSessionCost] = useState(0)
  const [sessionTokens, setSessionTokens] = useState({input: 0, output: 0})
  const [editorChrome, setEditorChrome] = useState({
    background: DEFAULT_CHROME_BACKGROUND,
    border: DEFAULT_CHROME_BORDER,
  })
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
  const [loadingProjectPageId, setLoadingProjectPageId] = useState<string | null>(null)
  const [selectedComponent, setSelectedComponent] = useState<string>("")
  
  // Simple undo history
  const [undoHistory, setUndoHistory] = useState<string[]>([])
  
  const undoPush = (html: string) => {
    setUndoHistory(prev => [...prev.slice(-9), html]) // Keep last 10
  }
  
  const undoPop = () => {
    setUndoHistory(prev => {
      if (prev.length <= 1) return prev
      const newList = prev.slice(0, -1)
      return newList
    })
    return undoHistory[undoHistory.length - 2] || null
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
  const [showExportWarnings, setShowExportWarnings] = useState(false)

  const demoPlanMeta: Record<"basis" | "starter" | "pro" | "scale", {
    label: string
    price: string
    users: string
    projects: string
    team: string
    accent: string
    bg: string
    border: string
  }> = {
    basis: {
      label: "Basis",
      price: "€9/mo",
      users: "1 user",
      projects: "3 projects",
      team: "No team",
      accent: "rgba(99,102,241,0.95)",
      bg: "rgba(99,102,241,0.12)",
      border: "rgba(99,102,241,0.35)",
    },
    starter: {
      label: "Starter",
      price: "€29/mo",
      users: "1 user",
      projects: "10 projects",
      team: "2 team members",
      accent: "rgba(34,197,94,0.95)",
      bg: "rgba(34,197,94,0.12)",
      border: "rgba(34,197,94,0.35)",
    },
    pro: {
      label: "Pro",
      price: "€79/mo",
      users: "3 users",
      projects: "30 projects",
      team: "10 team members",
      accent: "rgba(168,85,247,0.95)",
      bg: "rgba(168,85,247,0.12)",
      border: "rgba(168,85,247,0.35)",
    },
    scale: {
      label: "Scale",
      price: "€149/mo",
      users: "10 users",
      projects: "100 projects",
      team: "50 team members",
      accent: "rgba(245,158,11,0.95)",
      bg: "rgba(245,158,11,0.12)",
      border: "rgba(245,158,11,0.35)",
    },
  }

  const [exportMode, setExportMode] = useState<ExportMode>("wp-placeholder")
  const [exporting, setExporting] = useState(false)
  const [leftAiPrompt, setLeftAiPrompt] = useState("")
  const [leftAiModel, setLeftAiModel] = useState("auto")
  const [leftAiRunning, setLeftAiRunning] = useState(false)
  // Auto-save Projekt
  
const loadAdminUsers = async () => {
  setAdminLoading(true)
  try {
    const r = await fetch("/api/admin/users", { credentials: "include" })
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
    const r = await fetch(`/api/admin/users/${userId}`, { 
      method: "DELETE", 
      credentials: "include" 
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
    const r = await fetch(`/api/admin/users/${userId}/add-credits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credits: Number(Number(credits) * 100) }), // Convert dollars to cents
      credentials: "include"
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
    const r = await fetch("/api/admin/send-reset", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId }),
      credentials: "include"
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
    const response = await fetch(`/api/admin/users/${userId}/set-plan`, {
      method: "POST",
      credentials: "include",
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
    const r = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({...newUser, credits: Number(newUser.credits * 100)}), // Convert dollars to cents
      credentials: "include"
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
    const nextPages = activePageId
      ? projectPages.map((page) =>
          page.id === activePageId
            ? { ...page, html, updatedAt: new Date().toISOString() }
            : page
        )
      : projectPages
    if (activePageId) setProjectPages(nextPages)
    try {
      const saved = await apiSaveProject(currentProject.id, {
        html,
        platform: currentPlatform,
        pages: nextPages.length ? nextPages : undefined,
      })
      if (saved) {
        setCurrentProject(prev => (prev && prev.id === saved.id ? { ...prev, ...saved } : saved))
        if (saved.pages) setProjectPages(saved.pages)
      }
    } catch { /* autosave failure is non-fatal */ }
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

  const commitLiveEditorHtml = (html: string) => {
    const nextHtml = String(html || "")
    const prevHtml = currentHtmlRef.current
    if (prevHtml && prevHtml !== nextHtml) undoPush(prevHtml)
    skipNextLiveIframeSyncRef.current = true
    setCurrentHtml(nextHtml)
    autoSave(nextHtml)
  }

  useEffect(() => {
    if (view !== "editor") return
    if (skipNextLiveIframeSyncRef.current && mode === "edit") {
      skipNextLiveIframeSyncRef.current = false
      return
    }
    renderToIframe(currentHtml)
  }, [currentHtml, mode, view]);

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
    setActivePageId(page.id)
    setUrl(page.url || project.url || "")
    setLoadedUrl(page.url || project.url || "")
    setCurrentHtml(pageHtml)
    setTranslationInfo(null)
    setCurrentPlatform(resolvePlatform(project.platform, page.url || project.url, pageHtml))
    setCurrentPlatformGuide(project.platformGuide ?? null)
    setExportWarnings(project.latestExport?.manifest?.warnings || [])
    setExportReadiness(project.latestExport?.readiness || "ready")
    renderToIframe(pageHtml)
    setStatus("ok")
  }

  const loadScannedProjectPage = async (project: Project, page: ProjectPage) => {
    if (!project.id) return
    if (page.html && hasMeaningfulProjectHtml(page.html)) {
      applyProjectPage(project, page)
      return
    }
    setLoadingProjectPageId(page.id)
    try {
      const response = await apiLoadProjectPage(project.id, page.id)
      const nextProject = response.project
      const nextPage = response.page || nextProject.pages?.find((entry) => entry.id === page.id) || page
      setCurrentProject(nextProject)
      setProjectPages(nextProject.pages || [])
      applyProjectPage(nextProject, nextPage)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Page could not be loaded.")
    } finally {
      setLoadingProjectPageId(null)
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
    setUrl(nextUrl)
    setLoadedUrl("")
    setCurrentHtml("")
    setProjectPages([])
    setActivePageId(null)
    setTranslationInfo(null)
    setCurrentPlatform(nextPlatform)
    setCurrentPlatformGuide(null)
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
      const r = await fetch(`${ENDPOINTS.proxy}?url=${encodeURIComponent(targetUrl)}`, { credentials: "include" });
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
      setCurrentHtml(html)
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
    setCurrentProject(project)
    setTranslationInfo(null)
    setProjectPages(project.pages || [])
    setActivePageId(null)
    loadWorkflowHistory(project.id).catch(() => {})
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
      setCurrentHtml(inlineHtml)
      setCurrentPlatform(resolvePlatform(project.platform, project.url, inlineHtml))
      setCurrentPlatformGuide(project.platformGuide ?? null)
      setExportWarnings(project.latestExport?.manifest?.warnings || [])
      setExportReadiness(project.latestExport?.readiness || "ready")
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
      setCurrentHtml(projectHtml)
      setCurrentPlatform(resolvePlatform(project.platform, project.url, projectHtml))
      setCurrentPlatformGuide(project.platformGuide ?? null)
      setExportWarnings(project.latestExport?.manifest?.warnings || [])
      setExportReadiness(project.latestExport?.readiness || "ready")
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
    if (mode === "view") { setMode("edit"); if (currentHtml) setStatus("ok"); }
    else {
      if (confirm("Änderungen speichern und zum View-Modus wechseln?")) {
        setMode("view"); if (currentHtml) setStatus("ok");
      }
    }
  };

  const handleExport = async () => {
    if (!currentHtml) { toast.warning("Bitte lade zuerst eine Website"); return; }
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
        body: JSON.stringify({ html: currentHtml, url: loadedUrl, mode: exportMode, platform: currentPlatform })
      })
      setCurrentPlatformGuide(validation.guide)
      setCurrentPlatform(validation.platform || currentPlatform)
      setExportWarnings(validation.warnings || [])
      setExportReadiness(validation.readiness || "ready")
      if ((validation.warnings || []).length) {
        toast.warning(`${validation.warnings.length} delivery warning${validation.warnings.length === 1 ? "" : "s"} added to manifest`)
      }

      const r = await fetch("/api/export", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          html: currentHtml,
          url: loadedUrl,
          mode: exportMode,
          platform: currentPlatform,
          project_id: currentProject?.id,
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
      a.download = getDownloadFilename(r, exportMode);
      document.body.appendChild(a); a.click(); a.remove();
      if (currentProject?.id) {
        const refreshed = await apiGetProject(currentProject.id).catch(() => null)
        if (refreshed) {
          setCurrentProject(refreshed)
          await loadWorkflowHistory(refreshed.id)
        }
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  const handleTranslateSite = async () => {
    if (!currentHtml.trim()) {
      toast.warning("Load a site before translating it")
      return
    }

    const targetLanguage =
      TOP_TRANSLATION_LANGUAGES.find((language) => language.code === translationTargetLanguage)?.code ||
      "de"

    setIsTranslatingSite(true)
    try {
      const result = await translateWebsiteHtml(currentHtml, targetLanguage)
      commitLiveEditorHtml(result.html)
      setTranslationInfo({
        targetLanguage,
        detectedSourceLanguage: result.detectedSourceLanguage,
        translatedCount: result.translatedCount,
      })
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
    localStorage.setItem("se_translate_lang", translationTargetLanguage)
    setTranslationInfo(null)
  }, [translationTargetLanguage])

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
  }, [view, currentHtml, loadedUrl, mode])

  const handleAiRescan = (mode: "block" | "page") => {
    setAiScanLoading(true);
    window.dispatchEvent(new CustomEvent("blockoverlay:rescan", { detail: { mode } }));
    setTimeout(() => setAiScanLoading(false), 4000);
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


  const isEdit = mode === "edit";
  const isLoading = status === "blocked";
  const currentPlatformMeta = getPlatformMeta(currentPlatform);
  const editRailWidth = isEdit ? (isEditRailCollapsed ? EDIT_RAIL_COLLAPSED_WIDTH : EDIT_RAIL_EXPANDED_WIDTH) : 0
  const blockFamilyChips = [
    { label: currentPlatformMeta.label, tint: currentPlatformMeta.accent, background: currentPlatformMeta.background, value: "all" as BlockFilter },
    { label: "HTML", tint: "rgba(148,163,184,0.92)", background: "rgba(148,163,184,0.12)", value: "content" as BlockFilter },
    { label: "Layout", tint: "rgba(249,115,22,0.92)", background: "rgba(249,115,22,0.12)", value: "container" as BlockFilter },
    { label: "Media", tint: "rgba(45,212,191,0.92)", background: "rgba(45,212,191,0.12)", value: "image" as BlockFilter },
    { label: "Form", tint: "rgba(56,189,248,0.92)", background: "rgba(56,189,248,0.12)", value: "form" as BlockFilter },
    { label: "CTA", tint: "rgba(168,85,247,0.92)", background: "rgba(168,85,247,0.12)", value: "button" as BlockFilter },
  ]
  const selectedExportMode = EXPORT_MODE_OPTIONS.find(option => option.value === exportMode) || EXPORT_MODE_OPTIONS[0]
  const selectedTranslationLanguage =
    TOP_TRANSLATION_LANGUAGES.find((language) => language.code === translationTargetLanguage) ||
    TOP_TRANSLATION_LANGUAGES[0]
  const selectedProjectPage =
    projectPages.find((page) => page.id === activePageId) ||
    findDefaultProjectPage(projectPages)
  const selectedStructureItem =
    structureItems.find((item) => item.rootId === selectedRootId) ||
    structureItems.find((item) => item.isSelected) ||
    null
  const editorShellStyle: CSSProperties = {
    height: "100vh",
    ["--editor-topbar-height" as string]: "58px",
    ["--editor-rail-width" as string]: `${editRailWidth}px`,
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
              title={workflowHistory[0] ? `Last workflow change: ${String(workflowHistory[0].to_stage || "draft").replace(/_/g, " ")}` : "Workflow stage"}
            >
              {WORKFLOW_STAGE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}

          <button
            className="editor-btn"
            onClick={() => {
              const prev = undoPop()
              if (prev) setCurrentHtml(prev)
            }}
            title="Undo latest change"
          >
            Undo
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

          <button
            className={`editor-btn editor-btn--primary ${isEdit ? "is-saving" : ""}`}
            onClick={handleModeSwitch}
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
              disabled={exporting}
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
                    <button
                      className={`editor-btn editor-btn--panel editor-btn--translate ${isTranslatingSite ? "is-loading" : ""}`}
                      onClick={handleTranslateSite}
                      disabled={isTranslatingSite || !currentHtml}
                    >
                      {isTranslatingSite ? "Translating..." : "Translate site"}
                    </button>
                  </div>
                  <div className="editor-panel__note">
                    Translates the loaded page copy while preserving structure, exports, and block overlay markup.
                  </div>
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
                </div>
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
                    disabled={aiScanLoading}
                  >
                    {aiScanLoading ? "..." : "AI Block"}
                  </button>
                  <button
                    className="editor-btn editor-btn--panel editor-btn--panel-muted"
                    onClick={() => handleAiRescan("page")}
                    disabled={aiScanLoading}
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

                <textarea
                  className="editor-textarea"
                  value={leftAiPrompt}
                  onChange={e => setLeftAiPrompt(e.target.value)}
                  placeholder={`Prompt ${AI_MODELS.find(model => model.value === leftAiModel)?.label || leftAiModel}...`}
                />

                <button
                  data-left-ai-run="1"
                  className={`editor-btn editor-btn--panel editor-btn--accent ${leftAiRunning ? "is-loading" : ""}`}
                  onClick={() => {
                    if (!leftAiPrompt.trim()) {
                      toast.warning(t("Please enter an AI prompt first"))
                      return
                    }
                    setLeftAiRunning(true)
                    window.dispatchEvent(new CustomEvent("bo:left-ai-run", {
                      detail: {
                        model: leftAiModel === "auto" ? "claude-sonnet-4-6" : leftAiModel,
                        prompt: leftAiPrompt
                      }
                    }))
                  }}
                >
                  {leftAiRunning ? "Running..." : "Run prompt"}
                </button>
              </section>
            </div>
          )}
        </aside>
      )}

      <div className="editor-viewport">
        <iframe
          ref={iframeRef}
          title="preview"
          className="editor-viewport__frame"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation"
        />
        <BlockOverlay
          iframeRef={iframeRef}
          enabled={isEdit}
          canvasMode={layoutMode === "canvas"}
          blockFilter={blockFilter}
          onStatus={setStatus}
          onHtmlChange={commitLiveEditorHtml}
        />
      </div>
      <AssistantWidget
        plan={demoPlan}
        avoidOverlay={Boolean(currentAiApproval)}
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
