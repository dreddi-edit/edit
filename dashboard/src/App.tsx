import { apiMe, type User } from "./api/auth"
import { apiGetPlan } from "./api/credits"
import { apiFetch } from "./api/client"
import {
  apiGetProject,
  apiGetProjectWorkflowHistory,
  apiSaveProject,
  apiSetProjectWorkflowStage,
  type ExportWarning,
  type PlatformGuide,
  type Project,
  type WorkflowEvent,
  type WorkflowStage,
} from "./api/projects"
import AuthScreen from "./components/AuthScreen"
import ResetPasswordScreen from "./components/ResetPasswordScreen"
import ProjectDashboard from "./components/ProjectDashboard"
import { toast, ToastContainer } from "./components/Toast"
import { useRef, useState, useEffect, type CSSProperties } from 'react';
import BlockOverlay from "./components/BlockOverlay";
import { ENDPOINTS } from './config';
import { COMPONENT_LIBRARY, COMPONENT_CATEGORIES } from './components/ComponentLibrary';
import { useTranslation } from "./i18n/useTranslation"
import { detectSitePlatform, getPlatformMeta, normalizePlatform, type SitePlatform } from "./utils/sitePlatform"

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
const structureMoveButtonStyle: CSSProperties = {
  height: 28,
  width: 28,
  borderRadius: 8,
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(255,255,255,0.04)",
  color: "white",
  fontSize: 12,
  fontWeight: 800,
  cursor: "pointer",
}

function titleCaseFallback(value: string): string {
  return String(value || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (match) => match.toUpperCase())
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

  const activePlanMeta = demoPlanMeta[demoPlan]
  const [exportMode, setExportMode] = useState<"wp-placeholder" | "html-clean" | "html-raw">("wp-placeholder")
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
  fetch(`/api/admin/users/${userId}/set-plan`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ plan })
  }).then(r => r.json()).then(d => {
    if (d.ok) { if (authUser && authUser !== "loading" && authUser.id === userId) setDemoPlan(plan); alert(`✅ Plan "${plan}" saved`) }
    else { alert("Failed: " + d.error) }
  }).catch(() => alert("Network error"))
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
    try {
      const saved = await apiSaveProject(currentProject.id, { html, platform: currentPlatform })
      if (saved) setCurrentProject(prev => (prev && prev.id === saved.id ? { ...prev, ...saved } : saved))
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

  const resetLoadedDocument = (nextUrl = "", nextPlatform: SitePlatform = "unknown") => {
    setUrl(nextUrl)
    setLoadedUrl("")
    setCurrentHtml("")
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

  const handleOpenProject = async (p: Project) => {
    const project = await apiGetProject(p.id).catch(() => p)
    setCurrentProject(project)
    loadWorkflowHistory(project.id).catch(() => {})
    if (view !== "admin") setView("editor")

    const projectHtml = String(project.html ?? "")
    const inlineHtml = projectHtml.trim()

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
      setTimeout(() => load(true, project.url || ""), 100)
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
      a.download = exportMode === "wp-placeholder" ? "site_wp_placeholders.zip" : (exportMode === "html-clean" ? "site_html_clean.zip" : "site_html_raw.zip");
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
    <div style={{ height: "100vh", background: "var(--bg-root)", fontFamily: "var(--font-sans)" }}>

        {/* Drag Grid Overlay */}
        {isEdit && isDraggingBlock && (
          <div
            data-bo-grid-overlay="1"
            style={{
              position: "fixed",
              left: editRailWidth,
              top: 58,
              right: 0,
              bottom: 0,
              zIndex: 99999,
              pointerEvents: "none",
              backgroundImage:
                "linear-gradient(to right, rgba(96,165,250,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(96,165,250,0.14) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              boxShadow: "inset 0 0 0 1px rgba(96,165,250,0.22)",
            }}
          >
            <div style={{
              position: "absolute",
              left: 14,
              top: 10,
              padding: "6px 10px",
              borderRadius: 10,
              background: "rgba(9,13,18,0.92)",
              border: "1px solid rgba(96,165,250,0.24)",
              color: "white",
              fontSize: 12,
              fontWeight: 800,
            }}>
              Drop-Grid aktiv
            </div>
          </div>
        )}

      {/* ── Toolbar ── */}
      <div style={{
        position: "fixed", top: 0, left: 0, right: 0, height: 58,
        display: "flex", alignItems: "center", gap: 10, padding: "0 16px",
        background: view === "editor" ? editorChrome.background : "var(--header-bg)",
        borderBottom: view === "editor" ? `1px solid ${editorChrome.border}` : "1px solid var(--border)",
        boxShadow: "0 8px 30px rgba(0,0,0,0.18)",
        zIndex: 80,
        transition: "background 0.3s ease",
      }}>

        {/* Back to Dashboard */}
        <button onClick={() => setView("dashboard")} style={{
          height: 34, padding: "0 12px", borderRadius: 10, flexShrink: 0,
          border: "1px solid var(--border)",
          background: "rgba(255,255,255,0.03)",
          color: "white", cursor: "pointer", fontSize: 12, fontWeight: 800,
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>← Dashboard</button>

        {/* Logo */}
        <div style={{
          fontSize: 16, fontWeight: 800, color: "var(--text-primary)", marginRight: 2,
          letterSpacing: -0.3,
          flexShrink: 0,
        }}>Site Editor</div>

          {/* Active Plan Badge */}
          <div
            style={{
              height: 30,
              padding: "0 10px",
              borderRadius: 999,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 6,
              border: `1px solid ${activePlanMeta.border}`,
              background: activePlanMeta.bg,
              color: "white",
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: activePlanMeta.accent,
                boxShadow: `0 0 10px ${activePlanMeta.accent}`,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: 11, fontWeight: 900, color: activePlanMeta.accent, whiteSpace: "nowrap" }}>
              PLAN · {activePlanMeta.label}
            </span>
          </div>


          {/* Cost Tracker */}
          {(sessionCost > 0 || sessionTokens.input > 0 || sessionTokens.output > 0) && (
            <div
              title={`Input: ${sessionTokens.input.toLocaleString()} / Output: ${sessionTokens.output.toLocaleString()} tokens\nKlicken zum Zurücksetzen`}
              onClick={() => { if(confirm(t("Reset session costs?"))) { setSessionCost(0); setSessionTokens({input:0,output:0}); } }}
              style={{
                minHeight: 36, padding: "6px 12px", borderRadius: 10, flexShrink: 0,
                display: "flex", alignItems: "center", gap: 8,
              border: "1px solid rgba(245,158,11,0.25)",
              background: "rgba(245,158,11,0.1)",
              fontSize: 12, fontWeight: 800, color: "rgba(253,224,71,0.92)",
                cursor: "pointer",
                lineHeight: 1.15,
              }}>
              <span>◈ ${sessionCost.toFixed(4)}</span>
              <span style={{ opacity: 0.8 }}>•</span>
              <span>{sessionTokens.input.toLocaleString()} in / {sessionTokens.output.toLocaleString()} out</span>
            </div>
          )}

        {/* URL Input + Load */}
        <div style={{
          flex: "0 1 430px",
          minWidth: 240,
          height: 38,
          display: "flex",
          alignItems: "center",
          borderRadius: 12,
          border: isEdit ? "1px solid rgba(248,113,113,0.24)" : "1px solid var(--border)",
          background: "rgba(255,255,255,0.03)",
          overflow: "hidden",
        }}>
          <div style={{
            width: 34,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 13,
            color: "rgba(148,163,184,0.5)",
            flexShrink: 0,
          }}>◎</div>
          <input
            value={url} onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === "Enter" && load(true)}
            placeholder="https://..."
            style={{
              flex: 1,
              height: "100%",
              border: "none",
              background: "transparent",
              color: "var(--text-primary)",
              padding: "0 12px 0 0",
              outline: "none",
              fontSize: 13,
              minWidth: 0,
            }}
          />
          <div style={{ width: 1, alignSelf: "stretch", background: "rgba(148,163,184,0.18)" }} />
          <button onClick={() => load(true)}
            onMouseDown={e => (e.currentTarget.style.transform="scale(0.96)")}
            onMouseUp={e => (e.currentTarget.style.transform="scale(1)")}
            onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
            style={{
              height: "100%",
              padding: "0 16px",
              border: "none",
              borderRadius: 0,
              flexShrink: 0,
              background: "rgba(255,255,255,0.04)",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: 13,
              transition: "transform 0.1s, background 0.2s",
            }}>{isLoading ? <span style={{display:"inline-block",animation:"spin 0.7s linear infinite"}}>⟳</span> : "↺"} Load</button>
        </div>

        {/* Status Badge */}
        <div style={{
          height: 36, padding: "0 12px", borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 6,
          border: status === "ok" ? "1px solid rgba(34,197,94,0.4)" : status === "blocked" ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(148,163,184,0.2)",
          background: status === "ok" ? "rgba(34,197,94,0.12)" : status === "blocked" ? "rgba(245,158,11,0.12)" : "rgba(148,163,184,0.08)",
          fontSize: 12, fontWeight: 700, color: "white",
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: "50%",
            background: status === "ok" ? "#22c55e" : status === "blocked" ? "#f59e0b" : "#64748b",
            boxShadow: status === "ok" ? "0 0 6px #22c55e" : status === "blocked" ? "0 0 6px #f59e0b" : "none",
            animation: status === "blocked" ? "pulse 1s infinite" : "none",
          }} />
          {status === "idle" ? "Bereit" : status === "blocked" ? "Lädt…" : "OK"}
        </div>

        <div
          title={currentPlatformGuide?.safeEditScope || currentPlatformMeta.label}
          style={{
          height: 36, padding: "0 12px", borderRadius: 10, flexShrink: 0,
          display: "flex", alignItems: "center", gap: 8,
          border: `1px solid ${currentPlatformMeta.border}`,
          background: currentPlatformMeta.background,
          color: currentPlatformMeta.accent,
          fontSize: 12, fontWeight: 800,
        }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: currentPlatformMeta.accent, boxShadow: `0 0 6px ${currentPlatformMeta.accent}` }} />
          {currentPlatformMeta.label}
        </div>

        {currentProject && (
          <select
            value={currentProject.workflowStage || "draft"}
            onChange={e => changeWorkflowStage(e.target.value as WorkflowStage)}
            title={workflowHistory[0] ? `Last workflow change: ${String(workflowHistory[0].to_stage || "draft").replace(/_/g, " ")}` : "Workflow stage"}
            style={{
              height: 36,
              padding: "0 10px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              color: "white",
              fontWeight: 700,
              fontSize: 12,
              outline: "none",
            }}
          >
            <option value="draft">Draft</option>
            <option value="internal_review">Internal review</option>
            <option value="client_review">Client review</option>
            <option value="approved">Approved</option>
            <option value="shipped">Shipped</option>
          </select>
        )}

        <button
          onClick={() => { const prev = undoPop(); if (prev) setCurrentHtml(prev) }}
          onMouseDown={e => (e.currentTarget.style.transform="scale(0.93)")}
          onMouseUp={e => (e.currentTarget.style.transform="scale(1)")}
          onMouseLeave={e => (e.currentTarget.style.transform="scale(1)")}
          title="Letzte Änderung rückgängig"
          style={{
            height: 36,
            padding: "0 14px",
            borderRadius: 10,
            flexShrink: 0,
            border: "1px solid var(--border)",
            background: "rgba(255,255,255,0.03)",
            color: "white",
            cursor: "pointer",
            fontWeight: 700,
            fontSize: 12,
            transition: "transform 0.1s"
          }}
        >
          Undo
        </button>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: "rgba(148,163,184,0.15)", flexShrink: 0 }} />

        {/* Edit/View Toggle */}
        <button onClick={handleModeSwitch} style={{
          height: 36, padding: "0 16px", borderRadius: 10, flexShrink: 0,
          border: isEdit ? "1px solid rgba(248,113,113,0.22)" : "1px solid rgba(34,197,94,0.24)",
          background: isEdit ? "rgba(127,29,29,0.24)" : "rgba(21,128,61,0.18)",
          color: "white", cursor: "pointer", fontWeight: 700, fontSize: 13,
        }}>{isEdit ? t("↓ Speichern") : t("✐ Bearbeiten")}</button>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <select
              value={exportMode}
              onChange={e => setExportMode(e.target.value as "wp-placeholder" | "html-clean" | "html-raw")}
              title="Download-Format"
              style={{
                height: 36,
                padding: "0 10px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "rgba(255,255,255,0.03)",
                color: "white",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: 12,
                outline: "none"
              }}
            >
              <option value="wp-placeholder">WP Placeholder</option>
              <option value="html-clean">HTML Clean</option>
              <option value="html-raw">HTML Raw</option>
            </select>

            <button
              onClick={handleExport}
              disabled={exporting}
              title="Download"
              aria-busy={exporting ? "true" : undefined}
              onMouseDown={e => { if (!exporting) (e.currentTarget as HTMLElement).style.transform = "scale(0.93)" }}
              onMouseUp={e => (e.currentTarget as HTMLElement).style.transform = "scale(1)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.transform = "scale(1)"}
              style={{
                height: 36,
                padding: "0 14px",
                borderRadius: 10,
                flexShrink: 0,
                border: "1px solid var(--border)",
                background: exporting
                  ? "rgba(96,165,250,0.22)"
                  : exportReadiness === "guarded"
                  ? "rgba(245,158,11,0.12)"
                  : "rgba(255,255,255,0.03)",
                color: "white",
                cursor: exporting ? "wait" : "pointer",
                fontWeight: 700,
                fontSize: 12,
                transition: "transform 0.1s",
                opacity: exporting ? 0.9 : 1,
              }}
            >
              {exporting ? "⟳ …" : "Download"}
            </button>
          </div>

      </div>

      <style>{`
        @keyframes spin { 0%{transform:rotate(0deg)} 100%{transform:rotate(360deg)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes loadingbar { 0%{transform:translateX(-120%)} 100%{transform:translateX(420%)} }
      `}</style>

      {/* Progress Bar */}
      <div style={{ position:"fixed", left:0, right:0, top: 64, height: 2, background:"rgba(148,163,184,0.1)", zIndex:90, overflow:"hidden", opacity:isLoading?1:0, transition:"opacity 120ms" }}>
        <div style={{ height:"100%", width:"40%", background:"linear-gradient(90deg, #38bdf8, #60a5fa)", transform:"translateX(-120%)", animation:isLoading?"loadingbar 800ms ease-in-out infinite":"none" }} />
      </div>

      {currentAiApproval && (
        <div style={{
          position:"fixed",
          right:16,
          bottom:16,
          width:360,
          maxWidth:"calc(100vw - 32px)",
          background:"rgba(8,12,24,0.98)",
          border:"1px solid rgba(245,158,11,0.35)",
          boxShadow:"0 16px 60px rgba(0,0,0,0.45)",
          borderRadius:16,
          padding:14,
          zIndex:140,
          display:"flex",
          flexDirection:"column",
          gap:10
        }}>
          <div style={{ fontSize:12, fontWeight:900, letterSpacing:0.3, color:"rgba(255,255,255,0.95)" }}>
            Cloud Request Approval
          </div>

          <div style={{ display:"grid", gridTemplateColumns:"92px 1fr", gap:6, fontSize:12, color:"rgba(255,255,255,0.82)" }}>
            <div style={{ opacity:0.7 }}>Model</div><div style={{ fontWeight:700 }}>{currentAiApproval.model}</div>
            <div style={{ opacity:0.7 }}>Scope</div><div style={{ fontWeight:700 }}>{currentAiApproval.scope}</div>
            <div style={{ opacity:0.7 }}>Input est.</div><div style={{ fontWeight:700 }}>~{currentAiApproval.estInputTokens.toLocaleString()} tokens</div>
            <div style={{ opacity:0.7 }}>Output est.</div><div style={{ fontWeight:700 }}>~{currentAiApproval.estOutputTokens.toLocaleString()} tokens</div>
          </div>

          <div style={{
            fontSize:12,
            lineHeight:1.45,
            color:"rgba(255,255,255,0.72)",
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.08)",
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
                border:"1px solid rgba(148,163,184,0.22)",
                background:"rgba(255,255,255,0.04)",
                color:"white",
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
                border:"1px solid rgba(245,158,11,0.35)",
                background:"rgba(245,158,11,0.16)",
                color:"white",
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

      {/* Loading Overlay */}
      {isLoading && (
        <div style={{ position:"fixed", top:58, left:0, right:0, bottom:0, background:"rgba(11,18,32,0.97)", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ width:64, height:64, border:"3px solid rgba(99,102,241,0.2)", borderTop:"3px solid #6366f1", borderRadius:"50%", animation:"spin 0.8s linear infinite", marginBottom:20 }} />
          <div style={{ color:"white", fontSize:17, fontWeight:700, marginBottom:8 }}>Website wird geladen…</div>
          <div style={{ color:"rgba(148,163,184,0.7)", fontSize:13, textAlign:"center", maxWidth:280 }}>Seite wird über den Proxy geladen.</div>
        </div>
      )}
      {isEdit && (
        <div style={{
          position: "fixed",
          left: 0,
          top: 58,
          bottom: 0,
          width: editRailWidth,
          overflowY: "auto",
          zIndex: 96,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: isEditRailCollapsed ? "12px 10px 18px" : "14px 14px 20px",
          borderRight: "1px solid rgba(148,163,184,0.14)",
          background: "rgba(4,8,20,0.985)",
          boxShadow: "10px 0 26px rgba(0,0,0,0.14)",
          boxSizing: "border-box",
          transition: "width 0.22s ease, padding 0.22s ease",
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: isEditRailCollapsed ? "center" : "space-between",
            gap: 8,
            paddingBottom: 12,
            borderBottom: "1px solid rgba(148,163,184,0.14)",
          }}>
            <button
              onClick={() => setIsEditRailCollapsed((prev) => !prev)}
              title={isEditRailCollapsed ? "Expand tools" : "Collapse tools"}
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                border: "1px solid rgba(148,163,184,0.18)",
                background: "rgba(255,255,255,0.03)",
                color: "white",
                cursor: "pointer",
                fontSize: 16,
                fontWeight: 900,
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {isEditRailCollapsed ? "›" : "‹"}
            </button>
          </div>

          {isEditRailCollapsed ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: 50,
                height: 50,
                alignSelf: "center",
                borderRadius: 16,
                border: `1px solid ${currentPlatformMeta.border}`,
                background: currentPlatformMeta.background,
                color: currentPlatformMeta.accent,
                fontSize: 11,
                fontWeight: 900,
                textAlign: "center",
                lineHeight: 1.15,
                padding: 6,
                boxSizing: "border-box",
              }}>
                {currentPlatformMeta.label}
              </div>
              <button
                onClick={() => handleAiRescan("block")}
                disabled={aiScanLoading}
                title="AI Block"
                style={{
                  width: 50,
                  height: 40,
                  alignSelf: "center",
                  borderRadius: 12,
                  border: "1px solid rgba(96,165,250,0.3)",
                  background: "rgba(59,130,246,0.14)",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: aiScanLoading ? "wait" : "pointer",
                  opacity: aiScanLoading ? 0.65 : 1,
                }}
              >
                AI
              </button>
              <button
                onClick={() => handleAiRescan("page")}
                disabled={aiScanLoading}
                title="AI Page"
                style={{
                  width: 50,
                  height: 40,
                  alignSelf: "center",
                  borderRadius: 12,
                  border: "1px solid rgba(96,165,250,0.2)",
                  background: "rgba(59,130,246,0.08)",
                  color: "white",
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: aiScanLoading ? "wait" : "pointer",
                  opacity: aiScanLoading ? 0.65 : 1,
                }}
              >
                Page
              </button>
            </div>
          ) : (
            <>
              <div style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                paddingBottom: 12,
                borderBottom: "1px solid rgba(148,163,184,0.14)",
              }}>
                <div style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  alignSelf: "flex-start",
                  padding: "6px 10px",
                  borderRadius: 999,
                  border: `1px solid ${currentPlatformMeta.border}`,
                  background: currentPlatformMeta.background,
                  color: currentPlatformMeta.accent,
                  fontSize: 12,
                  fontWeight: 800,
                }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: currentPlatformMeta.accent }} />
                  {currentPlatformMeta.label}
                </div>
                <div style={{ fontSize: 11, color: "rgba(226,232,240,0.72)", lineHeight: 1.45 }}>
                  {loadedUrl ? loadedUrl.replace(/^https?:\/\//, "") : "No site loaded"}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {blockFamilyChips.map((chip) => {
                    const isActive = chip.value === "all" ? blockFilter === "all" : blockFilter === chip.value
                    return (
                      <button
                        key={`${chip.label}-${chip.value}`}
                        onClick={() => setBlockFilter(chip.value)}
                        style={{
                          height: 28,
                          padding: "0 10px",
                          borderRadius: 999,
                          border: `1px solid ${isActive ? chip.tint : "rgba(148,163,184,0.18)"}`,
                          background: isActive ? chip.background : "rgba(255,255,255,0.03)",
                          color: isActive ? chip.tint : "rgba(226,232,240,0.8)",
                          fontSize: 11,
                          fontWeight: 800,
                          cursor: "pointer",
                        }}
                      >
                        {chip.label}
                      </button>
                    )
                  })}
                </div>
                {exportWarnings.length > 0 && (
                  <div style={{ fontSize: 11, fontWeight: 700, color: "rgba(251,191,36,0.94)" }}>
                    {exportWarnings.length} export warning{exportWarnings.length === 1 ? "" : "s"}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.4, color: "rgba(255,255,255,0.92)" }}>
                  Overlay
                </div>
                <select
                  value={blockFilter}
                  onChange={e => setBlockFilter(e.target.value as BlockFilter)}
                  title="Visible blocks"
                  style={{
                    height: 36,
                    padding: "0 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(5,10,25,0.96)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 12,
                    outline: "none",
                  }}
                >
                  {BLOCK_FILTER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  <button
                    onClick={() => handleAiRescan("block")}
                    disabled={aiScanLoading}
                    style={{
                      height: 34,
                      borderRadius: 10,
                      border: "1px solid rgba(96,165,250,0.3)",
                      background: "rgba(59,130,246,0.14)",
                      color: "white",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: aiScanLoading ? "wait" : "pointer",
                      opacity: aiScanLoading ? 0.65 : 1,
                    }}
                  >
                    {aiScanLoading ? "..." : "AI Block"}
                  </button>
                  <button
                    onClick={() => handleAiRescan("page")}
                    disabled={aiScanLoading}
                    style={{
                      height: 34,
                      borderRadius: 10,
                      border: "1px solid rgba(96,165,250,0.3)",
                      background: "rgba(59,130,246,0.08)",
                      color: "white",
                      fontWeight: 800,
                      fontSize: 12,
                      cursor: aiScanLoading ? "wait" : "pointer",
                      opacity: aiScanLoading ? 0.65 : 1,
                    }}
                  >
                    {aiScanLoading ? "..." : "AI Page"}
                  </button>
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(148,163,184,0.14)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.4, color: "rgba(255,255,255,0.92)" }}>
                  Structure
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 180, overflowY: "auto", paddingRight: 4 }}>
                  {structureItems.length === 0 ? (
                    <div style={{ fontSize: 11, color: "rgba(148,163,184,0.68)", lineHeight: 1.4 }}>
                      Load a site to reorder motherblocks.
                    </div>
                  ) : structureItems.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        padding: 8,
                        borderRadius: 10,
                        border: item.isSelected ? "1px solid rgba(96,165,250,0.34)" : "1px solid rgba(148,163,184,0.14)",
                        background: item.isSelected ? "rgba(37,99,235,0.12)" : "rgba(255,255,255,0.03)",
                        display: "grid",
                        gridTemplateColumns: "1fr auto",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: "white", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {item.displayLabel}
                        </div>
                        <div style={{ fontSize: 10, color: "rgba(148,163,184,0.72)", marginTop: 2 }}>
                          {item.childCount > 0 ? `${item.childCount} child blocks` : titleCaseFallback(item.kind)}
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 28px)", gap: 4 }}>
                        <button onClick={() => moveStructureItem(item.rootId, -2)} style={structureMoveButtonStyle}>⇡</button>
                        <button onClick={() => moveStructureItem(item.rootId, -1)} style={structureMoveButtonStyle}>↑</button>
                        <button onClick={() => moveStructureItem(item.rootId, 1)} style={structureMoveButtonStyle}>↓</button>
                        <button onClick={() => moveStructureItem(item.rootId, 2)} style={structureMoveButtonStyle}>⇣</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ height: 1, background: "rgba(148,163,184,0.14)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.4, color: "rgba(255,255,255,0.92)" }}>
                  Components
                </div>
                <select
                  value={selectedComponent || ""}
                  onChange={e => setSelectedComponent(e.target.value)}
                  title="Professional Components"
                  style={{
                    height: 36,
                    padding: "0 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(5,10,25,0.96)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 12,
                    outline: "none"
                  }}
                >
                  <option value="">Choose component</option>
                  {Object.entries(COMPONENT_LIBRARY).map(([key, comp]) => (
                    <option key={key} value={key}>
                      {COMPONENT_CATEGORIES[comp.category as keyof typeof COMPONENT_CATEGORIES]?.icon} {comp.name}
                    </option>
                  ))}
                </select>

                <button
                  disabled={!selectedComponent}
                  onClick={addSelectedComponent}
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: "1px solid rgba(34,197,94,0.28)",
                    background: selectedComponent ? "rgba(21,128,61,0.16)" : "rgba(255,255,255,0.04)",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: selectedComponent ? "pointer" : "not-allowed",
                    opacity: selectedComponent ? 1 : 0.55,
                  }}
                >
                  Add component
                </button>
              </div>

              <div style={{ height: 1, background: "rgba(148,163,184,0.14)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: 0.4, color: "rgba(255,255,255,0.92)" }}>
                  AI Assistant
                </div>
                <select
                  value={leftAiModel}
                  onChange={e => setLeftAiModel(e.target.value)}
                  title="AI model"
                  style={{
                    height: 36,
                    padding: "0 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(5,10,25,0.96)",
                    color: "white",
                    fontWeight: 700,
                    fontSize: 12,
                    outline: "none"
                  }}
                >
                  {AI_MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>

                <textarea
                  value={leftAiPrompt}
                  onChange={e => setLeftAiPrompt(e.target.value)}
                  placeholder={`Prompt ${AI_MODELS.find(m => m.value === leftAiModel)?.label || leftAiModel}...`}
                  style={{
                    minHeight: 120,
                    resize: "vertical",
                    padding: "10px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(148,163,184,0.25)",
                    background: "rgba(5,10,25,0.96)",
                    color: "white",
                    fontSize: 12,
                    lineHeight: 1.45,
                    outline: "none"
                  }}
                />

                <button
                  data-left-ai-run="1"
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
                  style={{
                    height: 36,
                    borderRadius: 10,
                    border: "1px solid rgba(59,130,246,0.28)",
                    background: "rgba(37,99,235,0.16)",
                    color: "white",
                    fontWeight: 800,
                    fontSize: 12,
                    cursor: leftAiRunning ? "wait" : "pointer",
                    opacity: leftAiRunning ? 0.7 : 1,
                  }}
                >
                  {leftAiRunning ? "Running..." : "Run prompt"}
                </button>
              </div>
            </>
          )}
        </div>
      )}
{/* Main Content */}
      <div style={{ position:"fixed", left: editRailWidth, top:58, right:0, bottom:0, overflow:"hidden", transition: "left 0.22s ease" }}>
        <iframe ref={iframeRef} title="preview" style={{
          position:"absolute", left:0, top:0, width:"100%", height:"100%",
          border:"none", background:"white", display:"block"
        }} sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-top-navigation" />
        <BlockOverlay
          iframeRef={iframeRef}
          enabled={isEdit}
          canvasMode={layoutMode === "canvas"}
          blockFilter={blockFilter}
          onStatus={setStatus}
          onHtmlChange={commitLiveEditorHtml}
        />
      </div>
    <ToastContainer />
    </div>
  );
}
