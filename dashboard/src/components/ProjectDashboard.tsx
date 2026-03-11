import { useEffect, useRef, useState } from "react"
import { apiGetProjects, apiCreateProject, apiDeleteProject, type Project } from "../api/projects"
import { apiGetPlan, apiGetBalance, apiGetCreditsTransactions } from "../api/credits"
import { apiFetch } from "../api/client"
import CreditsPanel from "./CreditsPanel"
import SettingsPanel from "./SettingsPanel"
import ReferralInvite from "./ReferralInvite"
import CommandPalette from "./CommandPalette"
import KeyboardShortcuts from "./KeyboardShortcuts"
import { apiLogout, type User } from "../api/auth"
import type { CreditTransaction } from "../api/types"
import { toast } from "./Toast"
import { useTranslation } from "../i18n/useTranslation"
import { errMsg } from "../utils/errMsg"
import { getPlatformMeta, type SitePlatform } from "../utils/sitePlatform"
import "./project-dashboard-dark.css"

const BASE = ""
const CHECKLIST_KEY = "pd_dashboard_checklist_v1"
const NOTES_KEY = "pd_dashboard_notes_v1"

type DashboardStage = "all" | "draft" | "review" | "approved" | "shipped"
type Plan = "basis" | "starter" | "pro" | "scale"
type WorkspaceView = "projects" | "templates" | "exports"
type TemplateFilter = "all" | "wordpress" | "shopify" | "webflow" | "other"
type ExportFilter = "all" | "wp-placeholder" | "html-clean" | "ready" | "guarded"
type SpendRange = "1h" | "24h" | "7d" | "30d"
type UsageMode = "model" | "task"
type Template = { id: number; name: string; url?: string; platform?: SitePlatform; thumbnail?: string; created_at: string }
type ChecklistItem = { id: string; label: string; done: boolean }
type NoteItem = { id: string; text: string; done: boolean }
type SpendBreakdownItem = { label: string; amount: number; percent: number }

const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: "create", label: "Create first project", done: false },
  { id: "load", label: "Load a URL", done: false },
  { id: "ai", label: "Try AI block rewrite", done: false },
  { id: "export", label: "Export to ZIP", done: false },
  { id: "invite", label: "Invite a team member", done: false },
  { id: "domain", label: "Connect custom domain", done: false },
]

const MOCK_ACTIVITY = [
  { dot: "green", text: "<strong>Eastside Coffee</strong> exported as ZIP", time: "12 min ago" },
  { dot: "blue", text: "AI rewrite on <strong>Marktplatz</strong> hero section", time: "1h ago" },
  { dot: "amber", text: "<strong>Nordlicht Reisen</strong> moved to approved", time: "3h ago" },
  { dot: "", text: "<strong>Keramik Studio</strong> project created", time: "Yesterday" },
]

const DEFAULT_NOTES: NoteItem[] = [
  { id: "follow-up", text: "Follow up on guarded exports", done: false },
  { id: "review-copy", text: "Review AI spend before next export", done: false },
]

function loadChecklist(): ChecklistItem[] {
  try {
    const raw = localStorage.getItem(CHECKLIST_KEY)
    if (!raw) return DEFAULT_CHECKLIST.map(item => ({ ...item }))
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_CHECKLIST.map(item => ({ ...item }))
    return DEFAULT_CHECKLIST.map(item => {
      const saved = parsed.find((candidate: ChecklistItem) => candidate.id === item.id)
      return saved ? { ...item, done: Boolean(saved.done) } : { ...item }
    })
  } catch {
    return DEFAULT_CHECKLIST.map(item => ({ ...item }))
  }
}

function saveChecklist(items: ChecklistItem[]) {
  try {
    localStorage.setItem(CHECKLIST_KEY, JSON.stringify(items))
  } catch {}
}

function loadNotes(): NoteItem[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY)
    if (!raw) return DEFAULT_NOTES.map(item => ({ ...item }))
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return DEFAULT_NOTES.map(item => ({ ...item }))
    return parsed
      .filter((item): item is NoteItem => typeof item?.id === "string" && typeof item?.text === "string")
      .map(item => ({ id: item.id, text: item.text, done: Boolean(item.done) }))
      .slice(0, 8)
  } catch {
    return DEFAULT_NOTES.map(item => ({ ...item }))
  }
}

function saveNotes(items: NoteItem[]) {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(items))
  } catch {}
}

function formatExportDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
}

function formatUpdatedDate(value: string) {
  return new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

function workflowLabel(stage?: string) {
  return String(stage || "draft").replace(/_/g, " ")
}

function workflowClass(stage?: string) {
  if (stage === "internal_review" || stage === "client_review") return "review"
  if (stage === "approved") return "approved"
  if (stage === "shipped") return "shipped"
  return "draft"
}

function matchesStage(filter: DashboardStage, stage?: string) {
  if (filter === "all") return true
  if (filter === "review") return stage === "internal_review" || stage === "client_review"
  return (stage || "draft") === filter
}

function mockSeoScore(project: Project) {
  if (!project.url && !project.thumbnail) return null
  if ((project.id + (project.name?.length || 0)) % 4 === 0) return null
  return 34 + ((project.id * 17) % 62)
}

function gradientFromName(name: string) {
  const first = name.charCodeAt(0) || 77
  const second = name.charCodeAt(1) || 65
  const hue = (first * 11 + second * 7) % 360
  return `linear-gradient(135deg, hsl(${hue}, 26%, 12%) 0%, hsl(${(hue + 22) % 360}, 28%, 8%) 100%)`
}

function platformDistribution(projects: Project[]) {
  const counts = new Map<string, number>()
  for (const project of projects) {
    const meta = getPlatformMeta(project.platform)
    counts.set(meta.shortLabel, (counts.get(meta.shortLabel) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
}

function templateDistribution(templates: Template[]) {
  const counts = new Map<string, number>()
  for (const template of templates) {
    const meta = getPlatformMeta(template.platform)
    counts.set(meta.shortLabel, (counts.get(meta.shortLabel) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
}

function exportDistribution(projects: Project[]) {
  const counts = new Map<string, number>()
  for (const project of projects) {
    const label = exportModeLabel(project.lastExportMode)
    counts.set(label, (counts.get(label) || 0) + 1)
  }
  return Array.from(counts.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
}

function exportModeLabel(mode?: string) {
  if (mode === "wp-placeholder") return "WP"
  if (mode === "html-clean") return "HTML"
  if (mode === "html-raw") return "RAW"
  return "ZIP"
}

function exportReadiness(project: Project) {
  return Number(project.lastExportWarningCount || 0) > 0 ? "guarded" : "ready"
}

function matchesTemplateFilter(filter: TemplateFilter, template: Template) {
  if (filter === "all") return true
  const platform = String(template.platform || "unknown")
  if (filter === "other") return !["wordpress", "shopify", "webflow"].includes(platform)
  return platform === filter
}

function matchesExportFilter(filter: ExportFilter, project: Project) {
  if (filter === "all") return true
  if (filter === "ready" || filter === "guarded") return exportReadiness(project) === filter
  return String(project.lastExportMode || "") === filter
}

function rangeDuration(range: SpendRange) {
  if (range === "1h") return 60 * 60 * 1000
  if (range === "24h") return 24 * 60 * 60 * 1000
  if (range === "7d") return 7 * 24 * 60 * 60 * 1000
  return 30 * 24 * 60 * 60 * 1000
}

function isSpendInRange(transaction: CreditTransaction, range: SpendRange) {
  const createdAt = new Date(transaction.created_at).getTime()
  if (!Number.isFinite(createdAt)) return false
  return createdAt >= Date.now() - rangeDuration(range)
}

function normalizeModelLabel(raw: string) {
  const model = String(raw || "").trim()
  if (!model) return "Unknown"
  if (model === "claude-sonnet-4-6") return "Claude Sonnet 4.6"
  if (model === "claude-haiku-4-5-20251001") return "Claude Haiku 4.5"
  if (model === "gemini-2.5-flash") return "Gemini 2.5 Flash"
  if (model === "gemini-2.5-pro") return "Gemini 2.5 Pro"
  if (model === "ollama:qwen2.5-coder:7b") return "Ollama Qwen 2.5"
  if (model.startsWith("groq:")) return model.replace(/^groq:/, "")
  return model
}

function parseSpendTransaction(transaction: CreditTransaction) {
  const description = String(transaction.description || "")
  const taskModelMatch = description.match(/^AI:\s*([^|]+?)\s*\|\s*([^(]+?)\s*\(/i)
  if (taskModelMatch) {
    return {
      task: taskModelMatch[1].trim(),
      model: normalizeModelLabel(taskModelMatch[2].trim()),
    }
  }
  const legacyMatch = description.match(/^AI:\s*([^(]+?)\s*\(/i)
  if (legacyMatch) {
    return {
      task: "AI usage",
      model: normalizeModelLabel(legacyMatch[1].trim()),
    }
  }
  return {
    task: transaction.type === "topup" ? "Top up" : "Other",
    model: normalizeModelLabel(description || transaction.type || "unknown"),
  }
}

function buildSpendBreakdown(transactions: CreditTransaction[], mode: UsageMode): SpendBreakdownItem[] {
  const totals = new Map<string, number>()
  const spendTransactions = transactions.filter(transaction => Number(transaction.amount_eur || 0) < 0)
  for (const transaction of spendTransactions) {
    const amount = Math.abs(Number(transaction.amount_eur || 0))
    const parsed = parseSpendTransaction(transaction)
    const key = mode === "model" ? parsed.model : parsed.task
    totals.set(key, (totals.get(key) || 0) + amount)
  }
  const total = Array.from(totals.values()).reduce((sum, value) => sum + value, 0)
  if (!total) return []
  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label,
      amount,
      percent: Math.round((amount / total) * 100),
    }))
    .sort((left, right) => right.amount - left.amount)
}

function buildSpendBuckets(transactions: CreditTransaction[], range: SpendRange) {
  const bucketCount = 12
  const values = new Array(bucketCount).fill(0)
  const duration = rangeDuration(range)
  const bucketSize = duration / bucketCount
  const rangeStart = Date.now() - duration

  for (const transaction of transactions) {
    const amount = Math.abs(Number(transaction.amount_eur || 0))
    if (!amount) continue
    const createdAt = new Date(transaction.created_at).getTime()
    if (!Number.isFinite(createdAt) || createdAt < rangeStart) continue
    const index = Math.min(bucketCount - 1, Math.max(0, Math.floor((createdAt - rangeStart) / bucketSize)))
    values[index] += amount
  }

  const peak = Math.max(...values, 0)
  if (peak <= 0) return values.map(() => 18)
  return values.map(value => Math.max(18, Math.round((value / peak) * 100)))
}

function ProjectCard({
  project,
  onOpen,
  onDelete,
}: {
  project: Project
  onOpen: () => void
  onDelete: () => void
}) {
  const platformMeta = getPlatformMeta(project.platform)
  const initials = project.name.slice(0, 2).toUpperCase()
  const seoScore = mockSeoScore(project)
  const seoClass = seoScore == null ? "" : seoScore > 85 ? "" : seoScore > 60 ? "mid" : "low"

  return (
    <article
      className="pd-card"
      onClick={onOpen}
      onKeyDown={event => event.key === "Enter" && onOpen()}
      tabIndex={0}
      role="button"
      aria-label={`Open project ${project.name}`}
    >
      <div
        className="pd-card-thumb"
        style={{
          background: project.thumbnail
            ? `url(${project.thumbnail}) center/cover`
            : gradientFromName(project.name),
        }}
      >
        {!project.thumbnail ? (
          <span className="pd-card-initials" style={{ color: platformMeta.accent }}>
            {initials}
          </span>
        ) : null}
        <button
          className="pd-card-delete"
          onClick={event => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete ${project.name}`}
        >
          X
        </button>
        <span className="pd-card-platform">{platformMeta.label}</span>
        {seoScore != null ? (
          <div className="pd-card-seo">
            <div className={`pd-seo-ring ${seoClass}`}>{seoScore}</div>
          </div>
        ) : null}
      </div>
      <div className="pd-card-body">
        <div className="pd-card-name">{project.name}</div>
        <div className="pd-card-url">{(project.url || "local-project").replace(/^https?:\/\//, "")}</div>
        <div className="pd-card-tags">
          <span className={`pd-tag ${workflowClass(project.workflowStage)}`}>{workflowLabel(project.workflowStage)}</span>
          {project.clientName ? <span className="pd-tag">Client · {project.clientName}</span> : null}
        </div>
        <div className="pd-card-date">
          {project.lastExportAt ? `Last export · ${formatExportDate(project.lastExportAt)}` : `Updated ${formatUpdatedDate(project.updated_at)}`}
        </div>
      </div>
    </article>
  )
}

function TemplateCard({
  template,
  onUse,
  onDelete,
}: {
  template: Template
  onUse: () => void
  onDelete: () => void
}) {
  const platformMeta = getPlatformMeta(template.platform)
  const initials = template.name.slice(0, 2).toUpperCase()

  return (
    <article
      className="pd-card"
      onClick={onUse}
      onKeyDown={event => event.key === "Enter" && onUse()}
      tabIndex={0}
      role="button"
      aria-label={`Use template ${template.name}`}
    >
      <div
        className="pd-card-thumb"
        style={{
          background: template.thumbnail
            ? `url(${template.thumbnail}) center/cover`
            : gradientFromName(template.name),
        }}
      >
        {!template.thumbnail ? (
          <span className="pd-card-initials" style={{ color: platformMeta.accent }}>
            {initials}
          </span>
        ) : null}
        <button
          className="pd-card-delete"
          onClick={event => {
            event.stopPropagation()
            onDelete()
          }}
          aria-label={`Delete template ${template.name}`}
        >
          X
        </button>
        <span className="pd-card-platform">{platformMeta.label}</span>
      </div>
      <div className="pd-card-body">
        <div className="pd-card-name">{template.name}</div>
        <div className="pd-card-url">{(template.url || "saved-template").replace(/^https?:\/\//, "")}</div>
        <div className="pd-card-tags">
          <span className="pd-tag">Template</span>
          <span className="pd-tag">{platformMeta.shortLabel}</span>
        </div>
        <div className="pd-card-date">Saved {formatUpdatedDate(template.created_at)}</div>
      </div>
    </article>
  )
}

function ExportCard({
  project,
  downloading,
  onDownload,
}: {
  project: Project
  downloading: boolean
  onDownload: () => void
}) {
  const platformMeta = getPlatformMeta(project.platform)
  const modeLabel = exportModeLabel(project.lastExportMode)
  const readiness = exportReadiness(project)
  const initials = project.name.slice(0, 2).toUpperCase()

  return (
    <article
      className="pd-card"
      onClick={onDownload}
      onKeyDown={event => event.key === "Enter" && onDownload()}
      tabIndex={0}
      role="button"
      aria-label={`Download export for ${project.name}`}
    >
      <div
        className="pd-card-thumb"
        style={{
          background: project.thumbnail
            ? `url(${project.thumbnail}) center/cover`
            : gradientFromName(project.name),
        }}
      >
        {!project.thumbnail ? (
          <span className="pd-card-initials" style={{ color: platformMeta.accent }}>
            {initials}
          </span>
        ) : null}
        <button
          className="pd-card-delete pd-card-action"
          onClick={event => {
            event.stopPropagation()
            onDownload()
          }}
          aria-label={`Download export for ${project.name}`}
        >
          {downloading ? "..." : "D"}
        </button>
        <span className="pd-card-platform">{platformMeta.label}</span>
      </div>
      <div className="pd-card-body">
        <div className="pd-card-name">{project.name}</div>
        <div className="pd-card-url">{(project.url || "local-export").replace(/^https?:\/\//, "")}</div>
        <div className="pd-card-tags">
          <span className="pd-tag">{modeLabel}</span>
          <span className={`pd-tag ${readiness}`}>{readiness}</span>
        </div>
        <div className="pd-card-date">
          Exported {project.lastExportAt ? formatExportDate(project.lastExportAt) : formatUpdatedDate(project.updated_at)}
        </div>
      </div>
    </article>
  )
}

export default function ProjectDashboard({ user, onOpen, onLogout }: { user: User; onOpen: (p: Project) => void; onLogout: () => void }) {
  const { t } = useTranslation()
  const exportSectionRef = useRef<HTMLDivElement | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [transactions, setTransactions] = useState<CreditTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [balance, setBalance] = useState<number | null>(null)
  const [plan, setPlan] = useState<Plan>("basis")
  const [theme, setTheme] = useState<"dark" | "light">(
    (localStorage.getItem("se_theme") as "dark" | "light") || "dark"
  )
  const [stageFilter, setStageFilter] = useState<DashboardStage>("all")
  const [templateFilter, setTemplateFilter] = useState<TemplateFilter>("all")
  const [exportFilter, setExportFilter] = useState<ExportFilter>("all")
  const [spendRange, setSpendRange] = useState<SpendRange>("24h")
  const [usageMode, setUsageMode] = useState<UsageMode>("model")
  const [projectSearch, setProjectSearch] = useState("")
  const [activeWorkspace, setActiveWorkspace] = useState<WorkspaceView>("projects")
  const [exportSectionOpen, setExportSectionOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [showCredits, setShowCredits] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showInvite, setShowInvite] = useState(false)
  const [showNewProject, setShowNewProject] = useState(false)
  const [showLandingGenerator, setShowLandingGenerator] = useState(false)
  const [showTemplateExtract, setShowTemplateExtract] = useState(false)
  const [creatingProject, setCreatingProject] = useState(false)
  const [landingGenerating, setLandingGenerating] = useState(false)
  const [templateExtracting, setTemplateExtracting] = useState(false)
  const [downloadingExportId, setDownloadingExportId] = useState<number | null>(null)
  const [templateExtractFeedback, setTemplateExtractFeedback] = useState("")
  const [applyingTemplateId, setApplyingTemplateId] = useState<number | null>(null)
  const [newName, setNewName] = useState("")
  const [newUrl, setNewUrl] = useState("")
  const [newClientName, setNewClientName] = useState("")
  const [newDueAt, setNewDueAt] = useState("")
  const [landingName, setLandingName] = useState("")
  const [landingDesc, setLandingDesc] = useState("")
  const [landingAudience, setLandingAudience] = useState("")
  const [landingLang, setLandingLang] = useState<"english" | "german">("english")
  const [templateUrl, setTemplateUrl] = useState("")
  const [templateName, setTemplateName] = useState("")
  const [ollamaStatus, setOllamaStatus] = useState<"checking" | "running" | "offline">("checking")
  const [checklist, setChecklist] = useState<ChecklistItem[]>(loadChecklist)
  const [notes, setNotes] = useState<NoteItem[]>(loadNotes)
  const [newNote, setNewNote] = useState("")

  useEffect(() => {
    saveChecklist(checklist)
  }, [checklist])

  useEffect(() => {
    saveNotes(notes)
  }, [notes])

  useEffect(() => {
    setChecklist(prev =>
      prev.map(item => (item.id === "create" && projects.length > 0 ? { ...item, done: true } : item))
    )
  }, [projects.length])

  useEffect(() => {
    loadDashboard()
    checkOllama()
  }, [])

  useEffect(() => {
    localStorage.setItem("se_theme", theme)
    document.body.setAttribute("data-theme", theme)
  }, [theme])

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        setCommandPaletteOpen(open => !open)
      }
      if (event.key === "?" && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const target = event.target as HTMLElement
        if (target.tagName !== "INPUT" && target.tagName !== "TEXTAREA" && target.tagName !== "SELECT") {
          event.preventDefault()
          setShortcutsOpen(open => !open)
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  const planMeta: Record<Plan, { label: string; price: string; projects: string }> = {
    basis: { label: "Basic", price: "EUR9/mo", projects: "3 projects" },
    starter: { label: "Starter", price: "EUR29/mo", projects: "10 projects" },
    pro: { label: "Pro", price: "EUR79/mo", projects: "30 projects" },
    scale: { label: "Scale", price: "EUR149/mo", projects: "100 projects" },
  }

  const currentPlanMeta = planMeta[plan]
  const normalizedProjects = projects
  const filteredProjects = normalizedProjects.filter(project => {
    const query = projectSearch.trim().toLowerCase()
    const matchesQuery =
      !query ||
      project.name.toLowerCase().includes(query) ||
      (project.url || "").toLowerCase().includes(query)
    return matchesQuery && matchesStage(stageFilter, project.workflowStage)
  })
  const filteredTemplates = templates.filter(template => {
    const query = projectSearch.trim().toLowerCase()
    const matchesQuery =
      !query ||
      template.name.toLowerCase().includes(query) ||
      (template.url || "").toLowerCase().includes(query)
    return matchesQuery && matchesTemplateFilter(templateFilter, template)
  })
  const exportedProjects = [...normalizedProjects]
    .filter(project => project.lastExportAt)
    .sort((left, right) => String(right.lastExportAt).localeCompare(String(left.lastExportAt)))
  const filteredExports = exportedProjects.filter(project => {
    const query = projectSearch.trim().toLowerCase()
    const matchesQuery =
      !query ||
      project.name.toLowerCase().includes(query) ||
      (project.url || "").toLowerCase().includes(query)
    return matchesQuery && matchesExportFilter(exportFilter, project)
  })

  const counts = {
    all: normalizedProjects.length,
    draft: normalizedProjects.filter(project => matchesStage("draft", project.workflowStage)).length,
    review: normalizedProjects.filter(project => matchesStage("review", project.workflowStage)).length,
    approved: normalizedProjects.filter(project => matchesStage("approved", project.workflowStage)).length,
    shipped: normalizedProjects.filter(project => matchesStage("shipped", project.workflowStage)).length,
  }

  const recentExports = exportedProjects.slice(0, 5)
  const templateCounts = {
    all: templates.length,
    wordpress: templates.filter(template => matchesTemplateFilter("wordpress", template)).length,
    shopify: templates.filter(template => matchesTemplateFilter("shopify", template)).length,
    webflow: templates.filter(template => matchesTemplateFilter("webflow", template)).length,
    other: templates.filter(template => matchesTemplateFilter("other", template)).length,
  }
  const exportCounts = {
    all: exportedProjects.length,
    "wp-placeholder": exportedProjects.filter(project => matchesExportFilter("wp-placeholder", project)).length,
    "html-clean": exportedProjects.filter(project => matchesExportFilter("html-clean", project)).length,
    ready: exportedProjects.filter(project => matchesExportFilter("ready", project)).length,
    guarded: exportedProjects.filter(project => matchesExportFilter("guarded", project)).length,
  }
  const activeItemsCount =
    activeWorkspace === "projects"
      ? filteredProjects.length
      : activeWorkspace === "templates"
      ? filteredTemplates.length
      : filteredExports.length
  const workspaceTitle =
    activeWorkspace === "projects" ? "Projects" : activeWorkspace === "templates" ? "Templates" : "Exports"
  const workspaceSummaryValue =
    activeWorkspace === "projects"
      ? normalizedProjects.length
      : activeWorkspace === "templates"
      ? templates.length
      : exportedProjects.length
  const workspaceSummaryChips =
    activeWorkspace === "projects"
      ? platformDistribution(normalizedProjects)
      : activeWorkspace === "templates"
      ? templateDistribution(templates)
      : exportDistribution(exportedProjects)
  const spendTransactions = transactions.filter(
    transaction => Number(transaction.amount_eur || 0) < 0 && isSpendInRange(transaction, spendRange)
  )
  const totalSpend = spendTransactions.reduce((sum, transaction) => sum + Math.abs(Number(transaction.amount_eur || 0)), 0)
  const spendBuckets = buildSpendBuckets(spendTransactions, spendRange)
  const usageBreakdown = buildSpendBreakdown(spendTransactions, usageMode).slice(0, 4)
  const workspacePipeline =
    activeWorkspace === "projects"
      ? ([
          ["all", "All", counts.all, "var(--pd-text-3)", () => setStageFilter("all")],
          ["draft", "Draft", counts.draft, "var(--pd-text-3)", () => setStageFilter("draft")],
          ["review", "Review", counts.review, "var(--pd-amber)", () => setStageFilter("review")],
          ["approved", "Approved", counts.approved, "var(--pd-blue)", () => setStageFilter("approved")],
          ["shipped", "Shipped", counts.shipped, "var(--pd-green)", () => setStageFilter("shipped")],
        ] as const)
      : activeWorkspace === "templates"
      ? ([
          ["all", "All", templateCounts.all, "var(--pd-text-3)", () => setTemplateFilter("all")],
          ["wordpress", "WordPress", templateCounts.wordpress, "var(--pd-blue)", () => setTemplateFilter("wordpress")],
          ["shopify", "Shopify", templateCounts.shopify, "var(--pd-green)", () => setTemplateFilter("shopify")],
          ["webflow", "Webflow", templateCounts.webflow, "var(--pd-amber)", () => setTemplateFilter("webflow")],
          ["other", "Other", templateCounts.other, "var(--pd-text-2)", () => setTemplateFilter("other")],
        ] as const)
      : ([
          ["all", "All", exportCounts.all, "var(--pd-text-3)", () => setExportFilter("all")],
          ["wp-placeholder", "WP", exportCounts["wp-placeholder"], "var(--pd-blue)", () => setExportFilter("wp-placeholder")],
          ["html-clean", "HTML", exportCounts["html-clean"], "var(--pd-green)", () => setExportFilter("html-clean")],
          ["ready", "Ready", exportCounts.ready, "var(--pd-green)", () => setExportFilter("ready")],
          ["guarded", "Guarded", exportCounts.guarded, "var(--pd-amber)", () => setExportFilter("guarded")],
        ] as const)

  const updateChecklist = (id: string, done = true) => {
    setChecklist(prev => prev.map(item => (item.id === id ? { ...item, done } : item)))
  }

  const loadTemplates = async () => {
    try {
      const response = await apiFetch<{ ok: boolean; templates?: Template[] }>("/api/templates")
      if (response.ok) {
        setTemplates(
          (response.templates ?? []).map(template => ({
            ...template,
            thumbnail: template.thumbnail
              ? template.thumbnail.startsWith("http")
                ? template.thumbnail
                : `${BASE}${template.thumbnail}`
              : undefined,
          }))
        )
      }
    } catch {
      setTemplates([])
    }
  }

  const loadDashboard = async () => {
    setLoading(true)
    try {
      const [projectData, currentBalance, currentPlan, creditTransactions] = await Promise.all([
        apiGetProjects(),
        apiGetBalance().catch(() => null),
        apiGetPlan().catch(() => null),
        apiGetCreditsTransactions().catch(() => ({ ok: false, transactions: [] as CreditTransaction[] })),
      ])
      setProjects(
        projectData.map(project => ({
          ...project,
          thumbnail: project.thumbnail
            ? project.thumbnail.startsWith("http")
              ? project.thumbnail
              : `${BASE}${project.thumbnail}`
            : undefined,
        }))
      )
      setBalance(currentBalance)
      if (currentPlan) setPlan(currentPlan)
      if (creditTransactions.ok) setTransactions(creditTransactions.transactions ?? [])
      await loadTemplates()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setLoading(false)
    }
  }

  const checkOllama = async () => {
    setOllamaStatus("checking")
    try {
      const response = await fetch("/api/ai/ollama-health", {
        credentials: "include",
        signal: AbortSignal.timeout(5000),
      })
      const data = await response.json()
      setOllamaStatus(data?.ok ? "running" : "offline")
    } catch {
      setOllamaStatus("offline")
    }
  }

  const handleOpenProject = (project: Project) => {
    updateChecklist("load", true)
    onOpen(project)
  }

  const createProject = async () => {
    if (!newName.trim()) {
      toast.warning(t("Project name required"))
      return
    }
    setCreatingProject(true)
    try {
      const project = await apiCreateProject(newName.trim(), newUrl.trim(), "", undefined, {
        clientName: newClientName.trim() || "",
        dueAt: newDueAt || "",
      })
      updateChecklist("create", true)
      if (newUrl.trim()) updateChecklist("load", true)
      setProjects(prev => [project, ...prev.filter(candidate => candidate.id !== project.id)])
      setShowNewProject(false)
      setNewName("")
      setNewUrl("")
      setNewClientName("")
      setNewDueAt("")
      toast.success(t("Project created"))
      await loadDashboard()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setCreatingProject(false)
    }
  }

  const deleteProject = async (id: number, name: string) => {
    if (!window.confirm(`Delete project "${name}"?`)) return
    try {
      await apiDeleteProject(id)
      setProjects(prev => prev.filter(project => project.id !== id))
      toast.success(t("Project deleted"))
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const generateLandingPage = async () => {
    if (!landingName.trim()) {
      toast.warning(t("Product name required"))
      return
    }
    setLandingGenerating(true)
    try {
      const data = await apiFetch<{
        ok?: boolean
        error?: string
        html?: string
        platform?: SitePlatform
      }>("/api/ai/demo-landing-copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: landingName.trim(),
          description: landingDesc.trim() || "AI-powered workflow platform",
          audience: landingAudience.trim() || "modern teams",
          language: landingLang,
          complexity: 5,
        }),
      })

      if (!data?.ok || !data.html) {
        throw new Error(data?.error || t("Landing Page could not be generated"))
      }

      const createdProject = await apiCreateProject(
        landingName.trim(),
        "",
        String(data.html || ""),
        data.platform || "static"
      )

      updateChecklist("ai", true)
      setShowLandingGenerator(false)
      setLandingName("")
      setLandingDesc("")
      setLandingAudience("")
      setLandingLang("english")
      toast.success(t("Landing Page created"))
      await loadDashboard()
      handleOpenProject(createdProject)
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setLandingGenerating(false)
    }
  }

  const extractTemplate = async () => {
    if (!templateUrl.trim()) {
      toast.warning(t("URL required"))
      return
    }
    setTemplateExtracting(true)
    setTemplateExtractFeedback("Loading website and preparing editor-safe HTML...")
    try {
      let fallbackName = templateUrl.trim()
      try {
        fallbackName = new URL(templateUrl.trim()).hostname
      } catch {}
      const response = await apiFetch<{
        ok: boolean
        error?: string
        template?: { id: number; name: string; url?: string; platform?: SitePlatform }
      }>("/api/templates/extract", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          url: templateUrl.trim(),
          name: templateName.trim() || fallbackName,
        }),
      })
      if (!response.ok || !response.template) {
        throw new Error(response.error || "Template extraction failed")
      }
      toast.success("Template saved")
      setShowTemplateExtract(false)
      setTemplateUrl("")
      setTemplateName("")
      setTemplateExtractFeedback("")
      await loadTemplates()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setTemplateExtracting(false)
    }
  }

  const applyTemplate = async (templateId: number) => {
    const projectName = window.prompt("Project name for this template:")
    if (!projectName) return
    setApplyingTemplateId(templateId)
    try {
      const response = await apiFetch<{ ok: boolean; error?: string }>("/api/templates/apply", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ template_id: templateId, name: projectName }),
      })
      if (!response?.ok) throw new Error(response?.error || "Template apply failed")
      toast.success("Project created from template")
      await loadDashboard()
      setActiveWorkspace("projects")
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setApplyingTemplateId(null)
    }
  }

  const deleteTemplate = async (id: number) => {
    if (!window.confirm("Delete template?")) return
    try {
      await fetch(`/api/templates/${id}`, { method: "DELETE", credentials: "include" })
      await loadTemplates()
    } catch (error) {
      toast.error(errMsg(error))
    }
  }

  const addNote = () => {
    if (!newNote.trim()) return
    setNotes(previous => [
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, text: newNote.trim(), done: false },
      ...previous,
    ].slice(0, 8))
    setNewNote("")
  }

  const toggleNote = (id: string) => {
    setNotes(previous => previous.map(note => (note.id === id ? { ...note, done: !note.done } : note)))
  }

  const deleteNote = (id: string) => {
    setNotes(previous => previous.filter(note => note.id !== id))
  }

  const downloadExport = async (project: Project) => {
    setDownloadingExportId(project.id)
    try {
      const response = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          html: project.html,
          url: project.url,
          mode: project.lastExportMode || "html-clean",
          platform: project.platform,
          project_id: project.id,
        }),
      })

      if (!response.ok) {
        const text = await response.text()
        let message = "Export download failed"
        try {
          const data = JSON.parse(text)
          if (data?.error) message = data.error
        } catch {}
        throw new Error(message)
      }

      const blob = await response.blob()
      const fileUrl = URL.createObjectURL(blob)
      const anchor = document.createElement("a")
      anchor.href = fileUrl
      anchor.download =
        project.lastExportMode === "wp-placeholder"
          ? "site_wp_placeholders.zip"
          : project.lastExportMode === "html-clean"
          ? "site_html_clean.zip"
          : "site_html_raw.zip"
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(fileUrl)

      updateChecklist("export", true)
      await loadDashboard()
    } catch (error) {
      toast.error(errMsg(error))
    } finally {
      setDownloadingExportId(null)
    }
  }

  const openExports = () => {
    setActiveWorkspace("exports")
    setExportSectionOpen(true)
  }

  const logout = async () => {
    await apiLogout()
    onLogout()
  }

  const aiModelRows = [
    { name: "Gemini 2.5 Flash", on: true },
    { name: "Gemini 2.5 Pro", on: true },
    { name: "Claude Sonnet 4.6", on: true },
    { name: "Claude Opus 4.6", on: false },
    { name: "GPT-4o", on: false },
    { name: "GPT-4o mini", on: false },
    { name: "Mistral Large", on: false },
    { name: "Llama 3.3 70B", on: false },
    { name: "Ollama (local)", on: ollamaStatus === "running" },
  ]

  return (
    <div className="pd-shell">
      <header className="pd-header">
        <div className="pd-logo">
          <div className="pd-logo-mark">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <rect x="1" y="1" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.9" />
              <rect x="6.5" y="1" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.45" />
              <rect x="1" y="6.5" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.45" />
              <rect x="6.5" y="6.5" width="4.5" height="4.5" rx="1" fill="#efefed" opacity="0.2" />
            </svg>
          </div>
          Site Editor
        </div>

        <div className="pd-header-spacer" />

        <div className="pd-header-right">
          <div className="pd-team-stack" title="Team members">
            <div className="pd-team-avatar" style={{ background: "#1a2332" }}>EB</div>
            <div className="pd-team-avatar" style={{ background: "#2a1a20" }}>LK</div>
            <div className="pd-team-avatar" style={{ background: "#1a2a1a" }}>MR</div>
            <div className="pd-team-more">+2</div>
          </div>
          <div className="pd-divider" />

          <div className="pd-studio-split" title="Switch workspace">
            <button className="pd-studio-half" type="button">
              <span className="pd-studio-dot" />
              Studio
            </button>
            <button className="pd-studio-half" type="button">Privat</button>
          </div>

          <div className="pd-divider" />

          <div className="pd-badge pd-badge-pro">
            <span className="pd-badge-dot" />
            {currentPlanMeta.label}
          </div>

          <button className="pd-btn" type="button" onClick={() => setShowCredits(true)} title="Credits remaining">
            <span className="pd-btn-icon">+</span>
            <span className="pd-btn-strong">EUR{balance === null ? "..." : balance.toFixed(2)}</span>
            <span className="pd-btn-muted">left</span>
          </button>

          <div className="pd-divider" />

          <button className="pd-btn" type="button" onClick={() => setShowSettings(true)}>{t("Settings")}</button>
          <button
            className="pd-btn"
            type="button"
            onClick={() => {
              updateChecklist("invite", true)
              setShowInvite(true)
            }}
          >
            {t("Invite")}
          </button>
          <button className="pd-btn" type="button" onClick={logout} title="Sign out">
            {(user.email || "account").replace(/(.{12}).+/, "$1...")} v
          </button>
        </div>
      </header>

      <div className="pd-body">
        <aside className="pd-sidebar">
          <div className="pd-sidebar-section">Workspace</div>
          <div className="pd-scroll-box">
            <button
              className={`pd-sidebar-item ${activeWorkspace === "projects" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveWorkspace("projects")}
            >
              <span className="pd-sidebar-icon">[]</span>
              Projects
              <span className="pd-sidebar-pill">{projects.length}</span>
            </button>
            <button
              className={`pd-sidebar-item ${activeWorkspace === "templates" ? "is-active" : ""}`}
              type="button"
              onClick={() => setActiveWorkspace("templates")}
            >
              <span className="pd-sidebar-icon">[]</span>
              Templates
              <span className="pd-sidebar-pill">{templates.length}</span>
            </button>
            <button
              className={`pd-sidebar-item ${activeWorkspace === "exports" ? "is-active" : ""}`}
              type="button"
              onClick={openExports}
            >
              <span className="pd-sidebar-icon">D</span>
              Exports
              <span className="pd-sidebar-pill">{exportedProjects.length}</span>
            </button>
          </div>

          <div className="pd-sidebar-divider" />

          <div className="pd-sidebar-section">Create</div>
          <div className="pd-scroll-box">
            <button className="pd-sidebar-item" type="button" onClick={() => setShowNewProject(true)}>
              <span className="pd-sidebar-icon">+</span>
              New project
            </button>
            <button className="pd-sidebar-item" type="button" onClick={() => setShowLandingGenerator(true)}>
              <span className="pd-sidebar-icon">*</span>
              AI generator
            </button>
            <button className="pd-sidebar-item" type="button" onClick={() => toast.warning("SEO optimizer is currently in beta")}>
              <span className="pd-sidebar-icon">SEO</span>
              SEO optimizer
              <span className="pd-sidebar-pill">beta</span>
            </button>
            <button className="pd-sidebar-item" type="button" onClick={() => toast.warning("Hosting is currently in beta")}>
              <span className="pd-sidebar-icon">C</span>
              Hosting
              <span className="pd-sidebar-pill">beta</span>
            </button>
          </div>

          <div className="pd-sidebar-divider" />

          <div className="pd-sidebar-section">AI models</div>
          <div className="pd-scroll-box">
            {aiModelRows.map(model => (
              <div key={model.name} className="pd-ai-row">
                <span className="pd-ai-name">{model.name}</span>
                <span className={`pd-ai-status ${model.on ? "is-on" : "is-off"}`}>
                  <span className={`pd-dot ${model.on ? "is-on" : "is-off"}`} />
                  {model.on ? "On" : "Off"}
                </span>
              </div>
            ))}
          </div>

          <div className="pd-sidebar-divider" />

          <div className="pd-sidebar-section">Get started</div>
          <div className="pd-scroll-box pd-scroll-box-tall">
            {checklist.map(item => (
              <button
                key={item.id}
                className="pd-checklist-item"
                type="button"
                onClick={() => updateChecklist(item.id, !item.done)}
              >
                <div className={`pd-checklist-box ${item.done ? "is-done" : ""}`}>{item.done ? "v" : ""}</div>
                <span className={`pd-checklist-text ${item.done ? "is-done" : ""}`}>{item.label}</span>
              </button>
            ))}
          </div>

          <div className="pd-sidebar-divider" />

          <div className="pd-sidebar-section">Activity</div>
          <div className="pd-scroll-box pd-scroll-box-tall">
            {MOCK_ACTIVITY.map((item, index) => (
              <div key={`${item.time}-${index}`} className="pd-feed-item">
                <div className={`pd-feed-dot ${item.dot || ""}`} />
                {index < MOCK_ACTIVITY.length - 1 ? <div className="pd-feed-line" /> : null}
                <div className="pd-feed-body">
                  <div className="pd-feed-text" dangerouslySetInnerHTML={{ __html: item.text }} />
                  <div className="pd-feed-time">{item.time}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="pd-sidebar-footer">
            <div className="pd-sidebar-divider" />
            <button className="pd-sidebar-item" type="button" onClick={logout}>
              <span className="pd-sidebar-icon">&lt;-</span>
              {t("Sign out")}
            </button>
          </div>
        </aside>

        <main className="pd-main">
          <div className="pd-pipeline">
            {workspacePipeline.map(([value, label, count, color, onSelect]) => (
              <button
                key={value}
                className={`pd-pipe-stage ${
                  activeWorkspace === "projects"
                    ? stageFilter === value
                      ? "is-active"
                      : ""
                    : activeWorkspace === "templates"
                    ? templateFilter === value
                      ? "is-active"
                      : ""
                    : exportFilter === value
                    ? "is-active"
                    : ""
                }`}
                type="button"
                onClick={onSelect}
              >
                <span className="pd-pipe-dot" style={{ background: color }} />
                <span className="pd-pipe-label">{label}</span>
                <span className="pd-pipe-count">{count}</span>
              </button>
            ))}
          </div>

          <div className="pd-toolbar">
            <span className="pd-toolbar-title">{workspaceTitle}</span>
            <span className="pd-toolbar-count">{activeItemsCount} items</span>
            <div className="pd-toolbar-spacer" />
            <input
              className="pd-filter-input"
              placeholder="Filter..."
              value={projectSearch}
              onChange={event => setProjectSearch(event.target.value)}
            />
            {activeWorkspace === "projects" ? (
              <button className="pd-btn pd-btn-primary" type="button" onClick={() => setShowNewProject(true)}>
                + New project
              </button>
            ) : activeWorkspace === "templates" ? (
              <button className="pd-btn pd-btn-primary" type="button" onClick={() => setShowTemplateExtract(true)}>
                + Extract template
              </button>
            ) : (
              <button className="pd-btn pd-btn-primary" type="button" onClick={() => setActiveWorkspace("projects")}>
                Projects
              </button>
            )}
          </div>

          <div className="pd-stats">
            <section className="pd-stat">
              <span className="pd-stat-label">{workspaceTitle}</span>
              <span className="pd-stat-value">{workspaceSummaryValue}</span>
              <div className="pd-plat-dist">
                {workspaceSummaryChips.length > 0 ? (
                  workspaceSummaryChips.map(([label, count]) => (
                    <span key={label} className="pd-plat-chip">
                      {count} {label}
                    </span>
                  ))
                ) : (
                  <span className="pd-plat-chip">0 {workspaceTitle.toLowerCase()}</span>
                )}
              </div>
            </section>

            <section className="pd-stat">
              <span className="pd-stat-label">Spending</span>
              <span className="pd-stat-value">EUR{totalSpend.toFixed(2)}</span>
              <div className="pd-spend-tabs">
                {(["1h", "24h", "7d", "30d"] as SpendRange[]).map(range => (
                  <button
                    key={range}
                    className={`pd-spend-tab ${spendRange === range ? "is-active" : ""}`}
                    type="button"
                    onClick={() => setSpendRange(range)}
                  >
                    {range}
                  </button>
                ))}
              </div>
              <div className="pd-sparkline">
                {spendBuckets.map((height, index) => (
                  <div
                    key={`${height}-${index}`}
                    className={`pd-spark-bar ${height === Math.max(...spendBuckets) && totalSpend > 0 ? "is-hi" : ""}`}
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </section>

            <section className="pd-stat">
              <span className="pd-stat-label">Usage</span>
              <div className="pd-usage-toggle-row">
                <button
                  className={`pd-usage-toggle ${usageMode === "model" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setUsageMode("model")}
                >
                  By model
                </button>
                <button
                  className={`pd-usage-toggle ${usageMode === "task" ? "is-active" : ""}`}
                  type="button"
                  onClick={() => setUsageMode("task")}
                >
                  By task
                </button>
              </div>
              <div className="pd-usage-list">
                {usageBreakdown.length > 0 ? (
                  usageBreakdown.map(item => (
                    <div key={item.label} className="pd-usage-row">
                      <div className="pd-usage-head">
                        <span className="pd-usage-label">{item.label}</span>
                        <span className="pd-usage-percent">{item.percent}%</span>
                      </div>
                      <div className="pd-usage-track">
                        <div className="pd-usage-fill" style={{ width: `${Math.max(item.percent, 6)}%` }} />
                      </div>
                      <div className="pd-usage-amount">EUR{item.amount.toFixed(2)}</div>
                    </div>
                  ))
                ) : (
                  <div className="pd-usage-empty">No AI spend yet in this range.</div>
                )}
              </div>
            </section>

            <section className="pd-stat pd-stat-notes">
              <span className="pd-stat-label">Notes</span>
              <div className="pd-notes-list">
                {notes.length > 0 ? (
                  notes.map(note => (
                    <div key={note.id} className="pd-note-row">
                      <button className={`pd-note-check ${note.done ? "is-done" : ""}`} type="button" onClick={() => toggleNote(note.id)}>
                        {note.done ? "v" : ""}
                      </button>
                      <span className={`pd-note-text ${note.done ? "is-done" : ""}`}>{note.text}</span>
                      <button className="pd-note-delete" type="button" onClick={() => deleteNote(note.id)}>
                        X
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="pd-usage-empty">No notes yet.</div>
                )}
              </div>
              <div className="pd-note-input-row">
                <input
                  className="pd-note-input"
                  value={newNote}
                  onChange={event => setNewNote(event.target.value)}
                  onKeyDown={event => {
                    if (event.key === "Enter") {
                      event.preventDefault()
                      addNote()
                    }
                  }}
                  placeholder="Add a note..."
                />
                <button className="pd-note-add" type="button" onClick={addNote}>
                  +
                </button>
              </div>
            </section>
          </div>

          <div className="pd-projects-area">
            {loading ? (
              <div className="pd-projects-grid">
                {[1, 2, 3, 4, 5, 6].map(index => (
                  <div key={index} className="pd-card pd-card-skeleton" />
                ))}
              </div>
            ) : activeWorkspace === "projects" && filteredProjects.length > 0 ? (
              <div className="pd-projects-grid">
                {filteredProjects.map(project => (
                  <ProjectCard
                    key={project.id}
                    project={project}
                    onOpen={() => handleOpenProject(project)}
                    onDelete={() => deleteProject(project.id, project.name)}
                  />
                ))}
              </div>
            ) : activeWorkspace === "templates" && filteredTemplates.length > 0 ? (
              <div className="pd-projects-grid">
                {filteredTemplates.map(template => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onUse={() => applyTemplate(template.id)}
                    onDelete={() => deleteTemplate(template.id)}
                  />
                ))}
              </div>
            ) : activeWorkspace === "exports" && filteredExports.length > 0 ? (
              <div className="pd-projects-grid">
                {filteredExports.map(project => (
                  <ExportCard
                    key={project.id}
                    project={project}
                    downloading={downloadingExportId === project.id}
                    onDownload={() => downloadExport(project)}
                  />
                ))}
              </div>
            ) : (
              <div className="pd-empty-state">
                <div className="pd-empty-title">No {workspaceTitle.toLowerCase()} yet</div>
                <div className="pd-empty-copy">
                  {activeWorkspace === "projects"
                    ? "Create a new project or use the AI generator to get started."
                    : activeWorkspace === "templates"
                    ? "Extract a site into a reusable template to fill this workspace."
                    : "Export a project from the editor and it will show up here."}
                </div>
                <div className="pd-empty-actions">
                  {activeWorkspace === "projects" ? (
                    <>
                      <button className="pd-btn pd-btn-primary" type="button" onClick={() => setShowNewProject(true)}>
                        + New project
                      </button>
                      <button className="pd-btn" type="button" onClick={() => setShowLandingGenerator(true)}>
                        AI generator
                      </button>
                    </>
                  ) : activeWorkspace === "templates" ? (
                    <button className="pd-btn pd-btn-primary" type="button" onClick={() => setShowTemplateExtract(true)}>
                      + Extract template
                    </button>
                  ) : (
                    <button className="pd-btn pd-btn-primary" type="button" onClick={() => setActiveWorkspace("projects")}>
                      Open projects
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeWorkspace === "projects" ? (
              <div
                ref={exportSectionRef}
                className={`pd-export-section ${exportSectionOpen ? "is-open" : ""}`}
              >
                <button
                  className="pd-export-section-label"
                  type="button"
                  onClick={() => setExportSectionOpen(open => !open)}
                >
                  Recent exports
                  <span className="pd-export-arrow">v</span>
                </button>
                <div className="pd-export-table">
                  {recentExports.length > 0 ? (
                    recentExports.map(project => (
                      <div key={project.id} className="pd-export-row">
                        <span className="pd-export-icon">D</span>
                        <span className="pd-export-name">{project.name}</span>
                        <span className="pd-export-type">{project.platform ? getPlatformMeta(project.platform).shortLabel : "ZIP"}</span>
                        <span className="pd-export-date">
                          {project.lastExportAt ? new Date(project.lastExportAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }) : "--"}
                        </span>
                        <button
                          className="pd-export-download"
                          type="button"
                          onClick={() => downloadExport(project)}
                        >
                          {downloadingExportId === project.id ? "..." : "D Download"}
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="pd-export-empty">No exports yet.</div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </main>
      </div>

      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        projects={projects}
        onOpenProject={handleOpenProject}
        onNewProject={() => setShowNewProject(true)}
        onCredits={() => setShowCredits(true)}
        onSettings={() => setShowSettings(true)}
        onInvite={() => {
          updateChecklist("invite", true)
          setShowInvite(true)
        }}
        onSignOut={logout}
        theme={theme}
      />

      <KeyboardShortcuts open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} theme={theme} />
      {showCredits ? <CreditsPanel onClose={() => { setShowCredits(false); loadDashboard() }} /> : null}
      {showSettings ? <SettingsPanel onClose={() => setShowSettings(false)} onThemeChange={value => setTheme(value as "dark" | "light")} /> : null}
      {showInvite ? <ReferralInvite theme={theme} userEmail={user.email} onClose={() => setShowInvite(false)} /> : null}

      {showNewProject ? (
        <div className="pd-modal-backdrop" onClick={() => setShowNewProject(false)}>
          <div className="pd-modal" onClick={event => event.stopPropagation()}>
            <div className="pd-modal-header">
              <div>
                <div className="pd-modal-eyebrow">Create</div>
                <div className="pd-modal-title">New project</div>
              </div>
              <button className="pd-modal-close" type="button" onClick={() => setShowNewProject(false)}>X</button>
            </div>
            <div className="pd-modal-body">
              <div className="pd-field-grid">
                <label className="pd-field-label">
                  Project name
                  <input className="pd-field-input" value={newName} onChange={event => setNewName(event.target.value)} />
                </label>
                <label className="pd-field-label">
                  Website URL
                  <input className="pd-field-input" value={newUrl} onChange={event => setNewUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label className="pd-field-label">
                  Client name
                  <input className="pd-field-input" value={newClientName} onChange={event => setNewClientName(event.target.value)} />
                </label>
                <label className="pd-field-label">
                  Due date
                  <input className="pd-field-input" value={newDueAt} onChange={event => setNewDueAt(event.target.value)} type="date" />
                </label>
              </div>
            </div>
            <div className="pd-modal-actions">
              <button className="pd-btn" type="button" onClick={() => setShowNewProject(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" type="button" onClick={createProject} disabled={creatingProject}>
                {creatingProject ? "Creating..." : "Create project"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showLandingGenerator ? (
        <div className="pd-modal-backdrop" onClick={() => setShowLandingGenerator(false)}>
          <div className="pd-modal" onClick={event => event.stopPropagation()}>
            <div className="pd-modal-header">
              <div>
                <div className="pd-modal-eyebrow">AI generator</div>
                <div className="pd-modal-title">Generate landing page</div>
              </div>
              <button className="pd-modal-close" type="button" onClick={() => setShowLandingGenerator(false)}>X</button>
            </div>
            <div className="pd-modal-body">
              <div className="pd-field-grid">
                <label className="pd-field-label">
                  Product name
                  <input className="pd-field-input" value={landingName} onChange={event => setLandingName(event.target.value)} />
                </label>
                <label className="pd-field-label">
                  Target audience
                  <input className="pd-field-input" value={landingAudience} onChange={event => setLandingAudience(event.target.value)} />
                </label>
                <label className="pd-field-label pd-field-label-full">
                  Description
                  <textarea className="pd-field-textarea" value={landingDesc} onChange={event => setLandingDesc(event.target.value)} />
                </label>
                <label className="pd-field-label">
                  Language
                  <select className="pd-field-select" value={landingLang} onChange={event => setLandingLang(event.target.value as "english" | "german")}>
                    <option value="english">English</option>
                    <option value="german">German</option>
                  </select>
                </label>
              </div>
            </div>
            <div className="pd-modal-actions">
              <button className="pd-btn" type="button" onClick={() => setShowLandingGenerator(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" type="button" onClick={generateLandingPage} disabled={landingGenerating}>
                {landingGenerating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showTemplateExtract ? (
        <div className="pd-modal-backdrop" onClick={() => setShowTemplateExtract(false)}>
          <div className="pd-modal" onClick={event => event.stopPropagation()}>
            <div className="pd-modal-header">
              <div>
                <div className="pd-modal-eyebrow">Templates</div>
                <div className="pd-modal-title">Extract template</div>
              </div>
              <button className="pd-modal-close" type="button" onClick={() => setShowTemplateExtract(false)}>X</button>
            </div>
            <div className="pd-modal-body">
              <div className="pd-field-grid">
                <label className="pd-field-label">
                  Website URL
                  <input className="pd-field-input" value={templateUrl} onChange={event => setTemplateUrl(event.target.value)} placeholder="https://..." />
                </label>
                <label className="pd-field-label">
                  Template name
                  <input className="pd-field-input" value={templateName} onChange={event => setTemplateName(event.target.value)} placeholder="Optional" />
                </label>
              </div>
              {templateExtractFeedback ? <div className="pd-helper-copy">{templateExtractFeedback}</div> : null}
            </div>
            <div className="pd-modal-actions">
              <button className="pd-btn" type="button" onClick={() => setShowTemplateExtract(false)}>Cancel</button>
              <button className="pd-btn pd-btn-primary" type="button" onClick={extractTemplate} disabled={templateExtracting}>
                {templateExtracting ? "Extracting..." : "Save template"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
