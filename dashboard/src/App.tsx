import { useCallback, useRef, useState, useEffect, type CSSProperties } from 'react';

import {  readSavedTheme, DEFAULT_CHROME_BACKGROUND, DEFAULT_CHROME_BORDER, VIEWPORT_PRESETS, EXPORT_MODE_OPTIONS, WORKFLOW_STAGE_OPTIONS, PROJECT_VERSION_SOURCE_LABELS, DEFAULT_GLOBAL_STYLE_OVERRIDES, BLOCK_FILTER_OPTIONS, EDIT_RAIL_EXPANDED_WIDTH, EDIT_RAIL_COLLAPSED_WIDTH, titleCaseFallback, formatEditorDateTime, pickEditorChromeFromDocument, getDownloadFilename, collectProjectAssets, mergeAssetLibraries, collectCssVariables, applyGlobalStylesToHtml, applyTranslationOverridesToHtml, getLanguageVariantEffectiveHtml, buildLocalAudit, buildDiffPreview, readFileAsDataUrl, buildTranslationSegmentsWithOverrides  } from "./editorHelpers";
import { useAdmin } from "./hooks/useAdmin";
import { apiMe, type User } from "./api/auth"
import { apiFetch, fetchWithAuth } from "./api/client"
import { EditorSidebar } from "./components/EditorSidebar";
import { EditorModals } from "./components/EditorModals";
import {
  apiCreateProjectShare,
  apiCreateProjectPage,
  apiCreatePublishPreview,
  apiCreateProjectVersion,
  apiDeleteProjectPage,
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
  apiUpdateProjectPage,
  type ExportWarning,
  type PlatformGuide,
  type PublishDeployment,
  type PublishTarget,
  type PublishTargetInfo,
  type Project,
  type ProjectAsset,
  type ProjectPage,
  type ProjectShare,
  type ProjectVersion,
  type ProjectVersionDetail,
  type ProjectVersionSource,
  type WorkflowEvent,
  type WorkflowStage,
} from "./api/projects"
import AuthScreen from "./components/AuthScreen"
import LandingPage from "./components/LandingPage"
import LearnPage from "./components/LearnPage"
import ResetPasswordScreen from "./components/ResetPasswordScreen"
import ProjectDashboard from "./components/ProjectDashboard"
import AssistantWidget from "./components/AssistantWidget"
import KeyboardShortcuts from "./components/KeyboardShortcuts"
import { toast, ToastContainer } from "./components/Toast"

import BlockOverlay from "./components/BlockOverlay";
import { ENDPOINTS } from './config';
import { COMPONENT_LIBRARY } from './components/ComponentLibrary';
import { useShortcuts } from "./hooks/useShortcuts"
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

export default function App() {
  const {
    adminUsers,
    adminUserPlans,
    adminLoading,
    loadAdminUsers,
    deleteUser,
    addCredits,
    resetPassword,
    assignPlan,
    banUser,
    unbanUser,
    createUser,
  } = useAdmin();

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
  const [aiScanLoading, setAiScanLoading] = useState(false)
  const [versionPreview, setVersionPreview] = useState<ProjectVersionDetail | null>(null)
  const [versionCompare, setVersionCompare] = useState<ProjectVersionDetail | null>(null)
  const [aiDiff, setAiDiff] = useState<AiDiffState | null>(null)
  const [aiApprovalQueue, setAiApprovalQueue] = useState<AiApprovalItem[]>([])
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
    apiFetch("/api/orgs/accept-invite", { method: "POST" }).catch(() => null)
    apiMe().then(user => {
      if (user) { setAuthUser(user); setView("dashboard") }
      else { setAuthUser(null); setView("landing") }
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
  const [view, setView] = useState<"auth" | "landing" | "learn" | "dashboard" | "editor" | "admin">("landing")
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [projectPages, setProjectPages] = useState<ProjectPage[]>([])
  const [activePageId, setActivePageId] = useState<string | null>(null)
  const [scanningPages, setScanningPages] = useState(false)
  const [savingPageMutation, setSavingPageMutation] = useState(false)
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
  
  const enqueue = (item: AiApprovalItem) => {
    setAiApprovalQueue((prev: AiApprovalItem[]) => [...prev, item])
  }
  
  const dequeue = () => {
    setAiApprovalQueue((prev: AiApprovalItem[]) => prev.slice(1))
    return aiApprovalQueue[0] || null
  }

  const currentAiApproval = aiApprovalQueue.length ? aiApprovalQueue[0] : aiApproval

type AdminUser = {
  id: number
  email: string
  name?: string
  credits?: number
  created_at?: string
  plan_status?: string
}
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [newUser, setNewUser] = useState({ email: "", password: "", name: "", credits: 0 })
  const [demoPlan, setDemoPlan] = useState<"basis" | "starter" | "pro" | "scale">("basis")
  const [blockFilter, setBlockFilter] = useState<BlockFilter>("all")
  const [isEditRailCollapsed, setIsEditRailCollapsed] = useState(true)
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
  const [translationAppliedOverrides, setTranslationAppliedOverrides] = useState<Record<string, string>>({})
  const [activeTranslationSegmentId, setActiveTranslationSegmentId] = useState<string | null>(null)
  const [activeLanguageVariant, setActiveLanguageVariant] = useState<string>("base")
  const [showTranslationSplitView, setShowTranslationSplitView] = useState(false)
  const [showExportWarnings, setShowExportWarnings] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)

  const [exportMode, setExportMode] = useState<ExportMode>("wp-placeholder")
  const [exporting, setExporting] = useState(false)
  const [aiConfig, setAiConfig] = useState({ prompt: "", model: "auto", tone: "neutral", running: false, batchRunning: false })
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
  const [globalStyleOverrides, setGlobalStyleOverrides] = useState<GlobalStyleOverrides>(DEFAULT_GLOBAL_STYLE_OVERRIDES)
  const [cssVariableOverrides, setCssVariableOverrides] = useState<Record<string, string>>({})
  const [selectedFontAssetId, setSelectedFontAssetId] = useState<string | null>(null)
  const [assetLibraryQuery, setAssetLibraryQuery] = useState("")
  const leftAiModel = aiConfig.model
  const leftAiTone = aiConfig.tone
  const leftAiPrompt = aiConfig.prompt
  const leftAiRunning = aiConfig.running
  const batchAiRunning = aiConfig.batchRunning
  const setLeftAiModel = (value: string) => setAiConfig((previous) => ({ ...previous, model: value }))
  const setLeftAiTone = (value: string) => setAiConfig((previous) => ({ ...previous, tone: value }))
  const setLeftAiPrompt = (value: string) => setAiConfig((previous) => ({ ...previous, prompt: value }))
  const setLeftAiRunning = (value: boolean) => setAiConfig((previous) => ({ ...previous, running: value }))
  const setBatchAiRunning = (value: boolean) => setAiConfig((previous) => ({ ...previous, batchRunning: value }))
  const lastSignificantSnapshotRef = useRef<{ html: string; createdAt: number }>({ html: "", createdAt: 0 })
  // Auto-save Projekt
  
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
      const refreshedProject = await apiGetProject(projectId).catch(() => null)
      if (refreshedProject) {
        setCurrentProject(refreshedProject)
      }
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
      const refreshedProject = await apiGetProject(currentProject.id).catch(() => null)
      if (refreshedProject) {
        setCurrentProject(refreshedProject)
      }
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
      setTranslationReview(null)
      setTranslationOverrideDrafts({})
      setTranslationAppliedOverrides({})
      setActiveTranslationSegmentId(null)
      return
    }
    const activePage = projectPages.find((page) => page.id === activePageId)
    if (!activePage) {
      setTranslationReview(null)
      setTranslationOverrideDrafts({})
      setTranslationAppliedOverrides({})
      setActiveTranslationSegmentId(null)
      return
    }
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
    setTranslationAppliedOverrides(variant === "base" ? {} : { ...(storedVariant?.overrides || {}) })
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
    const nextOverrides = { ...(currentVariant?.overrides || translationAppliedOverrides), [segmentId]: trimmedValue }
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
    setTranslationAppliedOverrides(nextOverrides)
    setTranslationOverrideDrafts((previous) => ({ ...previous, [segmentId]: trimmedValue }))
    toast.success("Translation override applied")
  }

  const resetTranslationOverride = async (segmentId: string) => {
    const segment = translationReview?.segments.find((entry) => entry.id === segmentId)
    if (!segment || activeLanguageVariant === "base") return
    const activePage = activePageId ? projectPages.find((page) => page.id === activePageId) || null : null
    const currentVariant =
      activePage && activeLanguageVariant !== "base"
        ? activePage.languageVariants?.[activeLanguageVariant] || null
        : null
    const sourceSegments = (currentVariant?.segments as WebsiteTranslationSegment[] | undefined) || translationReview?.segments || []
    const baseHtml = String(currentVariant?.baseHtml || currentVariant?.html || currentHtmlRef.current || "")
    const nextOverrides = { ...(currentVariant?.overrides || translationAppliedOverrides) }
    delete nextOverrides[segmentId]
    const nextHtml = applyTranslationOverridesToHtml(baseHtml, sourceSegments, nextOverrides)
    const nextSegments = buildTranslationSegmentsWithOverrides(sourceSegments, nextOverrides)
    const revertedSegment = nextSegments.find((entry) => entry.id === segmentId)

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
        toast.error(error instanceof Error ? error.message : "Translation reset save failed")
      }
    } else {
      commitLiveEditorHtml(nextHtml)
    }

    setTranslationAppliedOverrides(nextOverrides)
    setTranslationReview((previous) =>
      previous
        ? {
            ...previous,
            segments: nextSegments,
          }
        : previous
    )
    setTranslationOverrideDrafts((previous) => ({
      ...previous,
      [segmentId]: revertedSegment?.translatedText || segment.translatedText,
    }))
    toast.success("Override reset")
  }

  const resetAllTranslationOverrides = async () => {
    if (!translationReview?.segments.length || activeLanguageVariant === "base") return
    const activePage = activePageId ? projectPages.find((page) => page.id === activePageId) || null : null
    const currentVariant =
      activePage && activeLanguageVariant !== "base"
        ? activePage.languageVariants?.[activeLanguageVariant] || null
        : null
    const sourceSegments = (currentVariant?.segments as WebsiteTranslationSegment[] | undefined) || translationReview.segments
    const baseHtml = String(currentVariant?.baseHtml || currentVariant?.html || currentHtmlRef.current || "")
    const nextOverrides: Record<string, string> = {}
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
        toast.error(error instanceof Error ? error.message : "Translation reset save failed")
      }
    } else {
      commitLiveEditorHtml(nextHtml)
    }

    setTranslationAppliedOverrides({})
    setTranslationReview((previous) =>
      previous
        ? {
            ...previous,
            segments: nextSegments,
          }
        : previous
    )
    setTranslationOverrideDrafts(Object.fromEntries(nextSegments.map((entry) => [entry.id, entry.translatedText])))
    toast.success("All overrides reset")
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
    const baseHtml = String(activePage?.html || "")
    if (!baseHtml.trim()) {
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
                html: baseHtml,
                updatedAt: nowIso,
                detectedSourceLanguage: "",
                translatedCount: 0,
              },
            },
            updatedAt: nowIso,
          }
        : page
    )
    await persistProjectPagesState(nextPages, baseHtml)
    setTranslationInfo({
      targetLanguage: activeLanguageVariant,
      detectedSourceLanguage: "",
      translatedCount: 0,
    })
    setTranslationReview(null)
    setTranslationOverrideDrafts({})
    setTranslationAppliedOverrides({})
    setActiveTranslationSegmentId(null)
    applyEditorHtml(baseHtml, { resetHistory: true })
    renderToIframe(baseHtml)
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
    const baseHtml = String(activePage.html || "")
    await persistProjectPagesState(nextPages, baseHtml)
    setActiveLanguageVariant("base")
    setTranslationInfo(null)
    setTranslationReview(null)
    setTranslationOverrideDrafts({})
    setTranslationAppliedOverrides({})
    setActiveTranslationSegmentId(null)
    setShowTranslationSplitView(false)
    applyEditorHtml(baseHtml, { resetHistory: true })
    renderToIframe(baseHtml)
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

  const updateGlobalStyleOverride = (key: keyof GlobalStyleOverrides, value: string) => {
    setGlobalStyleOverrides((previous) => ({ ...previous, [key]: value }))
  }

  const updateCssVariableOverride = (name: string, value: string) => {
    setCssVariableOverrides((previous) => ({ ...previous, [name]: value }))
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

  const activePage = activePageId ? projectPages.find((page) => page.id === activePageId) || null : null
  const comparisonBaseHtml = activeLanguageVariant !== "base" ? String(activePage?.html || "") : ""

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
    setTranslationAppliedOverrides({})
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

  const createManualProjectPage = async (payload: {
    name: string
    title?: string
    path?: string
    slug?: string
    url?: string
    html?: string
    seo?: ProjectPage["seo"]
  }) => {
    if (!currentProject?.id) {
      toast.warning("Open a saved project before adding pages")
      return
    }
    setSavingPageMutation(true)
    try {
      const response = await apiCreateProjectPage(currentProject.id, payload)
      const nextProject = response.project
      const nextPages = nextProject.pages || []
      const nextPage = response.page || nextPages[nextPages.length - 1] || null
      setCurrentProject(nextProject)
      setProjectPages(nextPages)
      if (nextPage) {
        applyProjectPage(nextProject, nextPage)
      }
      await loadWorkflowHistory(nextProject.id)
      toast.success(`Page "${payload.name}" created`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Page creation failed")
    } finally {
      setSavingPageMutation(false)
    }
  }

  const updateProjectPageMetadata = async (
    pageId: string,
    payload: {
      name?: string
      title?: string
      path?: string
      slug?: string
      url?: string
      html?: string
      seo?: ProjectPage["seo"]
    },
  ) => {
    if (!currentProject?.id) {
      toast.warning("Open a saved project before editing page metadata")
      return
    }
    setSavingPageMutation(true)
    try {
      const response = await apiUpdateProjectPage(currentProject.id, pageId, payload)
      const nextProject = response.project
      const nextPages = nextProject.pages || []
      const updatedPage = response.page || nextPages.find((page) => page.id === pageId) || nextPages[0] || null
      setCurrentProject(nextProject)
      setProjectPages(nextPages)
      if (updatedPage && activePageId === pageId) {
        applyProjectPage(nextProject, updatedPage)
      }
      await loadWorkflowHistory(nextProject.id)
      toast.success("Page metadata updated")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Page metadata update failed")
    } finally {
      setSavingPageMutation(false)
    }
  }

  const deleteProjectPage = async (pageId: string) => {
    if (!currentProject?.id) {
      toast.warning("Open a saved project before deleting pages")
      return
    }
    const page = projectPages.find((entry) => entry.id === pageId)
    const confirmed = window.confirm(`Delete page "${page?.name || pageId}"?`)
    if (!confirmed) return

    setSavingPageMutation(true)
    try {
      const nextProject = await apiDeleteProjectPage(currentProject.id, pageId)
      const nextPages = nextProject.pages || []
      setCurrentProject(nextProject)
      setProjectPages(nextPages)
      if (activePageId === pageId) {
        const nextActive = nextPages.find((entry) => entry.path === "/") || nextPages[0] || null
        if (nextActive) {
          applyProjectPage(nextProject, nextActive)
        } else {
          setActivePageId(null)
          applyEditorHtml(nextProject.html || "", { resetHistory: true })
          renderToIframe(nextProject.html || "")
        }
      }
      await loadWorkflowHistory(nextProject.id)
      toast.success("Page deleted")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Page deletion failed")
    } finally {
      setSavingPageMutation(false)
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
    setTranslationAppliedOverrides({})
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
    const targetUrl = String(requestedUrl ?? url).trim()
    if (!targetUrl) return
    if (!forceReload && loadedUrl === targetUrl && currentHtml) return
    const requestId = ++loadRequestRef.current
    resetLoadedDocument(targetUrl)
    setStatus("blocked")

    try {
      const r = await fetchWithAuth(`${ENDPOINTS.proxy}?url=${encodeURIComponent(targetUrl)}`)
      if (!r.ok) {
        const text = await r.text()
        let msg = "Page could not be loaded."
        try {
          const d = JSON.parse(text)
          if (d?.error) msg = d.error
        } catch {
          /* ignore */
        }
        if (requestId !== loadRequestRef.current) return
        toast.error(msg)
        setStatus("idle")
        return
      }

      const html = await r.text()
      if (requestId !== loadRequestRef.current) return
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
      setStatus("ok")
    } catch (e) {
      if (requestId !== loadRequestRef.current) return
      setStatus("idle")
      toast.error(e instanceof Error ? e.message : "Page could not be loaded.")
    }
  }

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
    if (mode === "view") {
      setMode("edit")
      return
    }
    if (window.confirm("Änderungen speichern und zum View-Modus wechseln?")) {
      setMode("view")
    }
  }

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
      setTranslationAppliedOverrides({})
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
    setTranslationAppliedOverrides({})
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

  useShortcuts([
    {
      key: "?",
      handler: () => {
        if (view === "editor") setShortcutsOpen((previous) => !previous)
      },
    },
    {
      key: "e",
      modifiers: ["meta"],
      handler: () => {
        if (view === "editor") handleModeSwitch()
      },
    },
    {
      key: "e",
      modifiers: ["ctrl"],
      handler: () => {
        if (view === "editor") handleModeSwitch()
      },
    },
    {
      key: "p",
      modifiers: ["meta", "shift"],
      handler: () => {
        if (view === "editor") openFullPreview()
      },
    },
    {
      key: "p",
      modifiers: ["ctrl", "shift"],
      handler: () => {
        if (view === "editor") openFullPreview()
      },
    },
    {
      key: "s",
      modifiers: ["meta", "shift"],
      handler: () => {
        if (view === "editor") void handleManualSnapshot()
      },
    },
    {
      key: "s",
      modifiers: ["ctrl", "shift"],
      handler: () => {
        if (view === "editor") void handleManualSnapshot()
      },
    },
    {
      key: "/",
      modifiers: ["meta"],
      handler: () => {
        if (view === "editor") window.dispatchEvent(new CustomEvent("assistant:open"))
      },
    },
    {
      key: "/",
      modifiers: ["ctrl"],
      handler: () => {
        if (view === "editor") window.dispatchEvent(new CustomEvent("assistant:open"))
      },
    },
    {
      key: "1",
      modifiers: ["meta"],
      handler: () => {
        if (view === "editor") setViewportPreset("desktop")
      },
    },
    {
      key: "2",
      modifiers: ["meta"],
      handler: () => {
        if (view === "editor") setViewportPreset("tablet")
      },
    },
    {
      key: "3",
      modifiers: ["meta"],
      handler: () => {
        if (view === "editor") setViewportPreset("mobile")
      },
    },
    {
      key: "1",
      modifiers: ["ctrl"],
      handler: () => {
        if (view === "editor") setViewportPreset("desktop")
      },
    },
    {
      key: "2",
      modifiers: ["ctrl"],
      handler: () => {
        if (view === "editor") setViewportPreset("tablet")
      },
    },
    {
      key: "3",
      modifiers: ["ctrl"],
      handler: () => {
        if (view === "editor") setViewportPreset("mobile")
      },
    },
    {
      key: "Escape",
      allowInInput: true,
      handler: () => {
        if (view !== "editor") return
        if (shortcutsOpen) setShortcutsOpen(false)
        if (versionCompare) clearVersionCompare()
      },
    },
  ])

  const isEdit = mode === "edit";
  const isLoading = status === "blocked";
  const currentPlatformMeta = getPlatformMeta(currentPlatform);
  const showEditorRail = view === "editor"
  const editRailWidth = showEditorRail ? (isEditRailCollapsed ? EDIT_RAIL_COLLAPSED_WIDTH : EDIT_RAIL_EXPANDED_WIDTH) : 0
  const viewportConfig = VIEWPORT_PRESETS[viewportPreset]
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
  const editorIdentityLabel =
    currentProject?.name || loadedUrl.replace(/^https?:\/\//i, "") || url.replace(/^https?:\/\//i, "") || "Unsaved page"
  const editorShortcutSections = [
    {
      title: "Editor",
      items: [
        { keys: "⌘E", desc: "Toggle edit and save mode" },
        { keys: "⌘⇧P", desc: "Open clean preview" },
        { keys: "⌘⇧S", desc: "Save a snapshot" },
        { keys: "⌘1 / ⌘2 / ⌘3", desc: "Switch viewport device" },
      ],
    },
    {
      title: "Workflow",
      items: [
        { keys: "⌘Z", desc: "Undo latest change" },
        { keys: "⌘⇧Z", desc: "Redo latest change" },
        { keys: "⌘/", desc: "Open editor assistant" },
        { keys: "?", desc: "Show keyboard shortcuts" },
        { keys: "Esc", desc: "Close compare or shortcut help" },
      ],
    },
  ]
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

  if (view === "landing") return (
    <>
      <LandingPage
        onEnter={() => setView("auth")}
        onLearn={() => setView("learn")}
      />
      <ToastContainer />
    </>
  )

  if (view === "learn") return (
    <>
      <LearnPage onBack={() => setView("landing")} />
      <ToastContainer />
    </>
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
    const statusPalette: Record<string, { bg: string; border: string; color: string }> = {
      active: { bg: "#10b9811a", border: "#10b98140", color: "#34d399" },
      canceled: { bg: "#64748b1a", border: "#64748b40", color: "#94a3b8" },
      banned: { bg: "#ef44441a", border: "#ef444440", color: "#f87171" },
    }
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
            <div style={{ display: "grid", gridTemplateColumns: "48px 1fr 140px 110px 110px 100px 260px", padding: "10px 20px", background: "#0f172a", borderBottom: "1px solid #1e293b", fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: 0.8 }}>
              <div>ID</div><div>User</div><div>Plan</div><div>Status</div><div>Credits</div><div>Joined</div><div style={{ textAlign: "right" }}>Actions</div>
            </div>
            {adminUsers.map((u: AdminUser) => {
              const plan = adminUserPlans[u.id] || "basis"
              const color = planColors[plan] || "#6366f1"
              const status = String(u.plan_status || "active").toLowerCase()
              const statusStyle = statusPalette[status] || statusPalette.active
              return (
                <div key={u.id} style={{ display: "grid", gridTemplateColumns: "48px 1fr 140px 110px 110px 100px 260px", padding: "14px 20px", borderBottom: "1px solid #0f172a", alignItems: "center" }}>
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
                  <div>
                    <span style={{ display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: statusStyle.bg, border: `1px solid ${statusStyle.border}`, color: statusStyle.color }}>
                      {status}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>€{Number(u.credits || 0).toFixed(2)}</div>
                  <div style={{ fontSize: 11, color: "#475569" }}>{(u.created_at || "").slice(0, 10)}</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                    <button onClick={() => addCredits(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #10b98130", background: "#10b98115", color: "#10b981", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Credits</button>
                    <button onClick={() => assignPlan(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #6366f130", background: "#6366f115", color: "#818cf8", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Plan</button>
                    <button onClick={() => resetPassword(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #f59e0b30", background: "#f59e0b15", color: "#fbbf24", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>PW</button>
                    {status === "banned" ? (
                      <button onClick={() => unbanUser(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #22c55e30", background: "#22c55e15", color: "#4ade80", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Unban</button>
                    ) : (
                      <button onClick={() => banUser(u.id, u.email)} style={{ padding: "5px 10px", borderRadius: 6, border: "1px solid #ef444430", background: "#ef444415", color: "#f87171", cursor: "pointer", fontSize: 11, fontWeight: 600 }}>Ban</button>
                    )}
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
                <button
                  onClick={async () => {
                    const created = await createUser(newUser)
                    if (created) {
                      setShowCreateUser(false)
                      setNewUser({ email: "", password: "", name: "", credits: 0 })
                    }
                  }}
                  style={{ padding:"8px 16px", borderRadius:8, border:"none", background:"#6366f1", color:"white", cursor:"pointer", fontSize:13, fontWeight:700 }}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className={`editor-shell ${theme === "light" ? "theme-light" : ""} ${isEdit ? "is-editing" : ""}`} style={editorShellStyle}>

      <header className="editor-toolbar" role="banner">
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
            <nav className="editor-breadcrumbs" aria-label="Editor breadcrumb">
              <span className="editor-breadcrumbs__item">Workspace</span>
              <span className="editor-breadcrumbs__sep" aria-hidden="true">/</span>
              <span className="editor-breadcrumbs__item">{editorIdentityLabel}</span>
              {activePage ? (
                <>
                  <span className="editor-breadcrumbs__sep" aria-hidden="true">/</span>
                  <span className="editor-breadcrumbs__item" aria-current={versionPreview ? undefined : "page"}>
                    {activePage.name}
                  </span>
                </>
              ) : null}
              {versionPreview ? (
                <>
                  <span className="editor-breadcrumbs__sep" aria-hidden="true">/</span>
                  <span className="editor-breadcrumbs__item editor-breadcrumbs__item--current">Snapshot</span>
                </>
              ) : null}
            </nav>
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
              aria-label="Page URL"
            />
            <button
              type="button"
              className="editor-urlbar__load"
              onClick={() => load(true)}
              aria-label="Load page URL"
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
                type="button"
                className={`editor-btn editor-btn--compact ${viewportPreset === preset ? "editor-btn--primary" : ""}`}
                onClick={() => setViewportPreset(preset)}
                title={`${VIEWPORT_PRESETS[preset].label} preview`}
              >
                {VIEWPORT_PRESETS[preset].label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="editor-btn"
            onClick={openFullPreview}
            disabled={!currentHtml}
            title="Open a clean no-chrome preview"
          >
            Preview
          </button>

          <button
            type="button"
            className="editor-btn"
            onClick={applyUndo}
            title="Undo latest change"
            disabled={!undoHistory.length || Boolean(versionPreview)}
          >
            Undo
          </button>
          <button
            type="button"
            className="editor-btn"
            onClick={applyRedo}
            title="Redo latest change"
            disabled={!redoHistory.length || Boolean(versionPreview)}
          >
            Redo
          </button>
          <button
            type="button"
            className="editor-btn"
            onClick={() => setShortcutsOpen(true)}
            title="Show editor shortcuts"
            aria-label="Show editor shortcuts"
          >
            ?
          </button>
        </div>

        <div className="editor-toolbar__spacer" />

        <div className="editor-toolbar__cluster editor-toolbar__cluster--tight">
          {(sessionCost > 0 || sessionTokens.input > 0 || sessionTokens.output > 0) && (
            <div
              className="editor-cost-chip"
              title={`Input: ${sessionTokens.input.toLocaleString()} / Output: ${sessionTokens.output.toLocaleString()} tokens\nClick to reset`}
              role="button"
              tabIndex={0}
              onClick={() => {
                if (confirm(t("Reset session costs?"))) {
                  setSessionCost(0)
                  setSessionTokens({ input: 0, output: 0 })
                }
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return
                event.preventDefault()
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
                type="button"
                className="editor-btn"
                onClick={() => exitVersionPreview(true)}
              >
                Exit preview
              </button>
              <button
                type="button"
                className="editor-btn editor-btn--primary"
                onClick={() => restoreProjectVersion(versionPreview.id)}
                disabled={activeVersionActionId === versionPreview.id}
              >
                {activeVersionActionId === versionPreview.id ? "Restoring..." : "Restore snapshot"}
              </button>
            </>
          )}

          <button
            type="button"
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
              aria-label="Export format"
            >
              {EXPORT_MODE_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`editor-btn editor-btn--export ${exportReadiness === "guarded" ? "is-guarded" : ""}`}
              onClick={() => { void handleExport() }}
              disabled={exporting || Boolean(versionPreview)}
              title="Export"
              aria-busy={exporting ? "true" : undefined}
            >
              {exporting ? "Exporting..." : "Export"}
            </button>
          </div>

        </div>
      </header>

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg) } 100% { transform: rotate(360deg) } }
        @keyframes pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }
        @keyframes loadingbar { 0% { transform: translateX(-120%) } 100% { transform: translateX(420%) } }
      `}</style>

      <div className={`editor-progress ${isLoading ? "is-visible" : ""}`}>
        <div className="editor-progress__bar" />
      </div>

      {showEditorRail ? (
        <EditorSidebar
          isEditRailCollapsed={isEditRailCollapsed}
          setIsEditRailCollapsed={setIsEditRailCollapsed}
          isEditMode={isEdit}
          currentPlatformMeta={currentPlatformMeta}
          currentPlatformGuide={currentPlatformGuide}
          handleAiRescan={handleAiRescan}
          aiScanLoading={aiScanLoading}
          exportReadiness={exportReadiness}
          exportWarnings={exportWarnings}
          showExportWarnings={showExportWarnings}
          setShowExportWarnings={setShowExportWarnings}
          currentProject={currentProject}
          loadedUrl={loadedUrl}
          titleCaseFallback={titleCaseFallback}
          workflowHistory={workflowHistory}
          projectPages={projectPages}
          activePageId={activePageId}
          scanningPages={scanningPages}
          savingPageMutation={savingPageMutation}
          scanProjectPages={() => {
            if (currentProject) void scanProjectPages(currentProject)
          }}
          openProjectPage={(page) => {
            if (currentProject) void loadScannedProjectPage(currentProject, page)
          }}
          createProjectPage={createManualProjectPage}
          updateProjectPageMetadata={updateProjectPageMetadata}
          deleteProjectPage={deleteProjectPage}
          versionPreview={versionPreview}
          previewVersionTitle={previewVersionTitle}
          versionMetaFor={versionMetaFor}
          projectVersions={projectVersions}
          versionTitleFor={versionTitleFor}
          activeVersionActionId={activeVersionActionId}
          previewProjectVersion={previewProjectVersion}
          compareProjectVersion={compareProjectVersion}
          restoreProjectVersion={restoreProjectVersion}
          versionCompare={versionCompare}
          clearVersionCompare={clearVersionCompare}
          exitVersionPreview={exitVersionPreview}
          handleManualSnapshot={handleManualSnapshot}
          savingSnapshot={savingSnapshot}
          loadingVersions={loadingVersions}
          currentHtml={currentHtml}
          runEditorAudit={runEditorAudit}
          runningAudit={runningAudit}
          editorAudit={editorAudit}
          blockFilter={blockFilter}
          setBlockFilter={(filter) => setBlockFilter(filter as BlockFilter)}
          BLOCK_FILTER_OPTIONS={BLOCK_FILTER_OPTIONS}
          structureItems={structureItems}
          moveStructureItem={moveStructureItem}
          leftAiModel={leftAiModel}
          setLeftAiModel={setLeftAiModel}
          leftAiTone={leftAiTone}
          setLeftAiTone={setLeftAiTone}
          leftAiPrompt={leftAiPrompt}
          setLeftAiPrompt={setLeftAiPrompt}
          AI_MODELS={AI_MODELS}
          leftAiRunning={leftAiRunning}
          batchAiRunning={batchAiRunning}
          runLeftAiPrompt={runLeftAiPrompt}
          runBatchAiAcrossPages={runBatchAiAcrossPages}
          translationTargetLanguage={translationTargetLanguage}
          setTranslationTargetLanguage={setTranslationTargetLanguage}
          translationLanguages={TOP_TRANSLATION_LANGUAGES}
          availableLanguageVariants={availableLanguageVariants}
          activeLanguageVariant={activeLanguageVariant}
          switchLanguageVariant={switchLanguageVariant}
          handleTranslateSite={() => {
            void handleTranslateSite()
          }}
          isTranslatingSite={isTranslatingSite}
          translationInfo={translationInfo}
          translationReview={translationReview}
          translationOverrideDrafts={translationOverrideDrafts}
          translationAppliedOverrides={translationAppliedOverrides}
          activeTranslationSegmentId={activeTranslationSegmentId}
          selectTranslationSegment={(id) => setActiveTranslationSegmentId(id)}
          updateTranslationOverrideDraft={(id, value) =>
            setTranslationOverrideDrafts((previous) => ({ ...previous, [id]: value }))
          }
          applyTranslationOverride={applyTranslationOverride}
          resetTranslationOverride={resetTranslationOverride}
          resetAllTranslationOverrides={resetAllTranslationOverrides}
          storeCurrentAsLanguageVariant={storeCurrentAsLanguageVariant}
          resetLanguageVariantFromBase={resetLanguageVariantFromBase}
          deleteLanguageVariant={deleteLanguageVariant}
          showTranslationSplitView={showTranslationSplitView}
          toggleTranslationSplitView={() => setShowTranslationSplitView((previous) => !previous)}
          selectedComponent={selectedComponent}
          setSelectedComponent={setSelectedComponent}
          addSelectedComponent={addSelectedComponent}
          shareEmail={shareEmail}
          setShareEmail={setShareEmail}
          createSharePreview={createSharePreview}
          sharingPreview={sharingPreview}
          loadingShares={loadingShares}
          projectShares={projectShares}
          copySharePreviewUrl={copySharePreviewUrl}
          revokeSharePreview={revokeSharePreview}
          publishDraft={publishDraft}
          updatePublishDraft={updatePublishDraft}
          selectedPublishTargetInfo={selectedPublishTargetInfo}
          publishTargets={publishTargets}
          loadingPublishTargets={loadingPublishTargets}
          createPublishPreview={createPublishPreview}
          creatingPublishPreview={creatingPublishPreview}
          lastPublishPreview={lastPublishPreview}
          publishCurrentProject={publishCurrentProject}
          publishingTarget={publishingTarget}
          loadCustomDomainGuide={loadCustomDomainGuide}
          customDomainGuide={customDomainGuide}
          loadingPublishHistory={loadingPublishHistory}
          recentPublishHistory={recentPublishHistory}
          rollbackPublishedDeployment={rollbackPublishedDeployment}
          rollingBackDeploymentId={rollingBackDeploymentId}
          assetLibraryQuery={assetLibraryQuery}
          setAssetLibraryQuery={setAssetLibraryQuery}
          filteredAssetLibrary={filteredAssetLibrary}
          selectedFontAssetId={selectedFontAssetId}
          setSelectedFontAssetId={setSelectedFontAssetId}
          handleAssetLibraryUpload={handleAssetLibraryUpload}
          globalStyleOverrides={globalStyleOverrides}
          updateGlobalStyleOverride={updateGlobalStyleOverride}
          cssVariableOverrides={cssVariableOverrides}
          updateCssVariableOverride={updateCssVariableOverride}
          applyGlobalStyleOverridesNow={applyGlobalStyleOverridesNow}
          selectedFontAsset={selectedFontAsset}
        />
      ) : null}

      {isDraggingBlock ? (
        <div className="editor-shell__drag-grid" style={{ left: editRailWidth }}>
          <div className="editor-shell__drag-grid-label">Drag blocks to reorder them</div>
        </div>
      ) : null}

      <main className="editor-viewport" aria-label="Editor canvas">
        <div className={`editor-viewport__canvas ${showComparisonViewport ? "editor-viewport__canvas--split" : ""}`}>
          {showComparisonViewport ? (
            <div className="editor-viewport__split">
              <div className={`editor-viewport__device editor-viewport__device--${viewportPreset}`}>
                <div className="editor-viewport__device-meta">
                  {availableLanguageVariants.find((variant) => variant.code === activeLanguageVariant)?.label ||
                    activeLanguageVariant.toUpperCase()}
                </div>
                <iframe
                  ref={iframeRef}
                  className="editor-viewport__frame"
                  title="Localized page preview"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
                {isEdit && !versionPreview ? (
                  <BlockOverlay
                    canvasMode={layoutMode === "canvas"}
                    iframeRef={iframeRef}
                    enabled
                    blockFilter={blockFilter}
                    onStatus={setStatus}
                    onHtmlChange={commitLiveEditorHtml}
                  />
                ) : null}
              </div>

              <div className={`editor-viewport__device editor-viewport__device--${viewportPreset}`}>
                <div className="editor-viewport__device-meta">Original</div>
                <iframe
                  ref={comparisonIframeRef}
                  className="editor-viewport__frame"
                  title="Base page comparison"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                />
              </div>
            </div>
          ) : (
            <div className={`editor-viewport__device editor-viewport__device--${viewportPreset}`}>
              <div className="editor-viewport__device-meta">
                {versionPreview
                  ? `Snapshot · ${previewVersionTitle || "Preview"}`
                  : `${viewportConfig.label} · ${editorIdentityLabel}`}
              </div>
              <iframe
                ref={iframeRef}
                className="editor-viewport__frame"
                title="Editor preview"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
              {!currentHtml.trim() && !versionPreview && !isLoading ? (
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    textAlign: "center",
                    padding: 32,
                    color: theme === "light" ? "#475569" : "rgba(226,232,240,0.78)",
                    background: theme === "light" ? "rgba(255,255,255,0.72)" : "rgba(2,6,23,0.22)",
                    pointerEvents: "none",
                  }}
                >
                  Load a live URL or open a saved project to start editing, versioning, sharing, and publishing.
                </div>
              ) : null}
              {isEdit && !versionPreview ? (
                <BlockOverlay
                  canvasMode={layoutMode === "canvas"}
                  iframeRef={iframeRef}
                  enabled
                  blockFilter={blockFilter}
                  onStatus={setStatus}
                  onHtmlChange={commitLiveEditorHtml}
                />
              ) : null}
            </div>
          )}
        </div>
      </main>

      <EditorModals
        aiDiff={aiDiff}
        theme={theme}
        acceptAiDiff={acceptAiDiff}
        rejectAiDiff={rejectAiDiff}
        buildDiffPreview={buildDiffPreview}
        isLoading={isLoading}
      />

      <KeyboardShortcuts
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
        theme={theme}
        title="Editor shortcuts"
        sections={editorShortcutSections}
      />

      <AssistantWidget
        plan={demoPlan}
        context={{
          surface: "editor",
          plan: demoPlan,
          workspace: currentProject?.name || "Editor",
          projectId: currentProject?.id,
          projectName: currentProject?.name || editorIdentityLabel,
          projectUrl: loadedUrl || currentProject?.url || "",
          platform: currentPlatform,
          exportMode,
          selectedBlock: selectedStructureItem?.displayLabel || undefined,
          warnings: exportWarnings.slice(0, 4).map((warning) => warning.message),
        }}
        avoidOverlay
        onUsage={trackUsage}
        onAction={handleAssistantEditorAction}
      />

      <ToastContainer />

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
    </div>
  );
};
