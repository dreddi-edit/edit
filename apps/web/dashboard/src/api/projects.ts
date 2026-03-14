import { apiFetch } from "./client"
import type { SitePlatform } from "../utils/sitePlatform"

const BASE = ""

export type WorkflowStage = "draft" | "internal_review" | "client_review" | "approved" | "shipped"
export type DeliveryStatus = "not_exported" | "export_ready" | "exported" | "handed_off" | "shipped"
export type ProjectVersionSource = "autosave" | "manual" | "translate" | "ai_block" | "ai_page" | "ai_prompt" | "restore" | "export"

export type PlatformGuide = {
  platform: SitePlatform
  label: string
  safeEditScope: string
  exportNotes: string
  riskyAreas: string[]
}

export type ExportWarning = {
  code: string
  level: "info" | "warning"
  message: string
  detail?: string
}

export type LatestExport = {
  id: number
  version_id?: number | null
  export_mode: string
  platform: SitePlatform
  readiness: "ready" | "guarded"
  warning_count: number
  manifest?: {
    warnings?: ExportWarning[]
    guide?: PlatformGuide
  }
  created_at: string
}

export type WorkflowEvent = {
  id: number
  from_stage?: WorkflowStage | null
  to_stage: WorkflowStage
  comment?: string
  created_at: string
  user_id?: number
  name?: string
  email?: string
}

export type ProjectActivityEntry = {
  id: string
  type: "workflow" | "version" | "export" | "share"
  label: string
  detail?: string
  pageId?: string
  created_at: string
}

export type ProjectAssignee = {
  email: string
  name?: string
  role?: string
  status?: string
  source?: string
}

export type ProjectAsset = {
  id: string
  type: "image" | "font"
  url: string
  label: string
  mimeType?: string
  createdAt?: string
}

export type ProjectTranslationSegment = {
  id: string
  kind: "text" | "attr"
  selector: string
  attr?: string
  textIndex?: number
  sourceText: string
  translatedText: string
}

export type ProjectLanguageVariant = {
  html: string
  baseHtml?: string
  updatedAt?: string
  detectedSourceLanguage?: string
  translatedCount?: number
  overrides?: Record<string, string>
  segments?: ProjectTranslationSegment[]
}

export type ProjectPageSeo = {
  title?: string
  description?: string
  canonical?: string
  robots?: string
  og?: Record<string, string>
}

export type ProjectPageSemanticLink = {
  label: string
  href: string
}

export type ProjectPageSemantic = {
  forms?: Array<{ action: string; method: "get" | "post"; fields: number }>
  ctas?: Array<{ label: string; href?: string; tag?: string }>
  sections?: Array<{ signature: string; label: string }>
  primaryNav?: ProjectPageSemanticLink[]
  footerNav?: ProjectPageSemanticLink[]
  fidelityScore?: number
  fidelity?: Record<string, unknown>
}

export type ProjectPage = {
  id: string
  name: string
  title?: string
  path: string
  url: string
  html?: string
  seo?: ProjectPageSeo
  semantic?: ProjectPageSemantic
  languageVariants?: Record<string, ProjectLanguageVariant>
  updatedAt?: string
  scannedAt?: string
}

export type ProjectImportEntry = {
  name: string
  mimeType?: string
  contentBase64: string
}

export type ProjectImportAnalysis = {
  projectType: string
  platform: SitePlatform
  confidence: "low" | "medium" | "high"
  homepageFile?: string
  homepagePath?: string
  overview?: string
  warnings: string[]
  pageCandidates: string[]
  supportFiles: string[]
  contentSources: string[]
  localeFiles?: string[]
  styleFiles?: string[]
  scriptFiles?: string[]
  assetFiles?: string[]
  fileCount: number
  pageCount: number
  styleCount: number
  scriptCount: number
  assetCount: number
  repeatedSections?: Array<{ signature: string; label: string; count: number; pages: string[] }>
  navStructure?: {
    primary?: ProjectPageSemanticLink[]
    footer?: ProjectPageSemanticLink[]
  }
  formsCount?: number
  ctaCount?: number
  seoCoverage?: {
    total: number
    withTitle: number
    withDescription: number
    withOg: number
  }
  fidelityScore?: number
  localizedAssets?: {
    count: number
    totalBytes: number
    byType: Record<string, number>
  }
}

export type ProjectImportPreview = {
  name: string
  url: string
  html: string
  pages: ProjectPage[]
  platform?: SitePlatform
  summary?: string
  analysis?: ProjectImportAnalysis
}

export type Project = {
  id: number
  name: string
  url: string
  html?: string
  pages?: ProjectPage[]
  assetLibrary?: ProjectAsset[]
  tags?: string[]
  platform?: SitePlatform
  thumbnail?: string
  pinned?: number
  clientName?: string
  ownerUserId?: number
  approvalStatus?: "draft" | "pending_review" | "approved" | "rejected"
  brandContext?: string
  workflowStage?: WorkflowStage
  deliveryStatus?: DeliveryStatus
  dueAt?: string
  lastActivityAt?: string
  lastExportAt?: string
  lastExportMode?: string
  lastExportWarningCount?: number
  platformGuide?: PlatformGuide
  latestExport?: LatestExport | null
  assignees?: ProjectAssignee[]
  updated_at: string
  created_at: string
}

export type ProjectVersion = {
  id: number
  projectId: number
  label?: string
  source: ProjectVersionSource
  pageId?: string
  created_at: string
}

export type ProjectVersionDetail = ProjectVersion & {
  html: string
}

export type ProjectShare = {
  id: number
  token: string
  url: string
  pageId?: string
  languageVariant?: string
  created_at: string
}

type ProjectsRes = { ok: boolean; error?: string; projects: Project[] }
type ProjectRes = { ok: boolean; error?: string; project: Project; latestExport?: LatestExport | null }
type CreateProjectRes = { ok: boolean; error?: string; id: number; project?: Project }
type PageProjectRes = { ok: boolean; error?: string; project: Project; page?: ProjectPage }
type ImportPreviewRes = { ok: boolean; error?: string; preview: ProjectImportPreview }
type ImportPreviewQueuedRes = { ok: boolean; queued: boolean; jobId: string; statusUrl: string }
type ImportPreviewJobStatusRes = {
  ok: boolean
  error?: string
  job?: {
    id: string
    status: "queued" | "running" | "completed" | "failed"
    result?: { ok: boolean; preview?: ProjectImportPreview; error?: string } | null
    error?: string | null
  }
}
type ProjectVersionsRes = { ok: boolean; error?: string; versions: ProjectVersion[] }
type ProjectVersionRes = { ok: boolean; error?: string; version: ProjectVersionDetail }
type ProjectShareRow = ProjectShare & {
  page_id?: string
  language_variant?: string
}
type ProjectSharesRes = { ok: boolean; error?: string; shares: ProjectShareRow[] }
type RestoreProjectVersionRes = {
  ok: boolean
  error?: string
  html: string
  platform: SitePlatform
  pageId?: string
  project?: Project
  version?: ProjectVersion
}
type ProjectActivityRes = { ok: boolean; error?: string; activity: ProjectActivityEntry[] }

export async function apiGetProjects(): Promise<Project[]> {
  const d = await apiFetch<ProjectsRes>(`${BASE}/api/projects`)
  if (!d?.ok) throw new Error((d as ProjectsRes)?.error || "Failed to load projects.")
  return (d as ProjectsRes).projects
}

export async function apiGetProject(id: number): Promise<Project> {
  const d = await apiFetch<ProjectRes>(`${BASE}/api/projects/${id}`)
  if (!d?.ok) throw new Error((d as ProjectRes)?.error || "Project not found.")
  return { ...(d as ProjectRes).project, latestExport: (d as ProjectRes).latestExport ?? null }
}

export async function apiCreateProject(
  name: string,
  url: string,
  html: string,
  platform?: SitePlatform,
  extras: Partial<Pick<Project, "clientName" | "workflowStage" | "deliveryStatus" | "dueAt" | "assignees" | "pages" | "tags">> = {}
): Promise<Project> {
  const d = await apiFetch<CreateProjectRes>(`${BASE}/api/projects`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, url, html, platform, ...extras })
  })
  if (!d?.ok) throw new Error((d as CreateProjectRes)?.error || "Failed to create project.")
  if ((d as CreateProjectRes).project) return (d as CreateProjectRes).project as Project
  const id = (d as CreateProjectRes).id
  return {
    id,
    name,
    url,
    html,
    tags: extras.tags || [],
    platform,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

export async function apiPreviewProjectImport(payload: {
  kind: "url" | "entries" | "zip" | "brief" | "screenshot"
  mode?: "single" | "crawl" | "sitemap"
  entryMode?: "auto" | "single-file" | "folder" | "zip" | "assets" | "figma-export"
  url?: string
  fileName?: string
  mimeType?: string
  contentBase64?: string
  entries?: ProjectImportEntry[]
  title?: string
  summary?: string
  requestOverrides?: {
    basicAuth?: { username?: string; password?: string }
    cookie?: string
    headers?: Array<{ key?: string; value?: string }>
  }
}): Promise<ProjectImportPreview> {
  const d = await apiFetch<ImportPreviewRes | ImportPreviewQueuedRes>(`${BASE}/api/projects/import-preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!d?.ok) throw new Error((d as ImportPreviewRes)?.error || "Failed to import source.")

  if ((d as ImportPreviewRes).preview) {
    return (d as ImportPreviewRes).preview
  }

  const queued = d as ImportPreviewQueuedRes
  if (!queued.queued || !queued.statusUrl) {
    throw new Error("Import preview did not return data.")
  }

  const timeoutMs = 120_000
  const pollIntervalMs = 1200
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const status = await apiFetch<ImportPreviewJobStatusRes>(`${BASE}${queued.statusUrl}`)
    const job = status?.job
    if (!job) throw new Error("Import preview job not found.")
    if (job.status === "failed") {
      throw new Error(job.error || job.result?.error || "Import preview failed.")
    }
    if (job.status === "completed") {
      const preview = job.result?.preview
      if (!preview) throw new Error("Import preview completed without preview data.")
      return preview
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  }

  throw new Error("Import preview timed out. Please try again.")
}

export async function apiSaveProject(
  id: number,
  data: Partial<Project> & { versionLabel?: string; versionSource?: ProjectVersionSource; pageId?: string }
) {
  const d = await apiFetch<{ ok: boolean; error?: string; project?: Project }>(`${BASE}/api/projects/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to save.")
  return d.project
}

export async function apiGetProjectVersions(id: number): Promise<ProjectVersion[]> {
  const d = await apiFetch<ProjectVersionsRes>(`${BASE}/api/projects/${id}/versions`)
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to load version history.")
  return d.versions || []
}

export async function apiGetProjectVersion(id: number, versionId: number): Promise<ProjectVersionDetail> {
  const d = await apiFetch<ProjectVersionRes>(`${BASE}/api/projects/${id}/versions/${versionId}`)
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to load version preview.")
  return d.version
}

export async function apiCreateProjectVersion(
  id: number,
  payload: { html?: string; label?: string; source?: ProjectVersionSource; pageId?: string } = {}
): Promise<ProjectVersion> {
  const d = await apiFetch<{ ok: boolean; error?: string; version: ProjectVersion }>(`${BASE}/api/projects/${id}/versions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to create version snapshot.")
  return d.version
}

export async function apiRestoreProjectVersion(
  id: number,
  versionId: number,
  payload: { pageId?: string } = {}
): Promise<RestoreProjectVersionRes> {
  const d = await apiFetch<RestoreProjectVersionRes>(`${BASE}/api/projects/${id}/restore/${versionId}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to restore version.")
  return d
}

export async function apiCreateProjectShare(
  id: number,
  payload: { email?: string; html?: string; pageId?: string; languageVariant?: string } = {}
): Promise<ProjectShare> {
  const d = await apiFetch<{
    ok: boolean
    error?: string
    id?: number
    url: string
    token: string
    pageId?: string
    languageVariant?: string
  }>(`${BASE}/api/projects/${id}/share`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to create share preview.")
  return {
    id: d.id || 0,
    token: d.token,
    url: d.url,
    pageId: d.pageId,
    languageVariant: d.languageVariant,
    created_at: new Date().toISOString(),
  }
}

export async function apiGetProjectShares(id: number): Promise<ProjectShare[]> {
  const d = await apiFetch<ProjectSharesRes>(`${BASE}/api/projects/${id}/shares`)
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to load share previews.")
  return (d.shares || []).map((share) => ({
    ...share,
    pageId: share.pageId || share.page_id,
    languageVariant: share.languageVariant || share.language_variant,
  }))
}

export async function apiDeleteProjectShare(id: number, shareId: number) {
  const d = await apiFetch<{ ok: boolean; error?: string }>(`${BASE}/api/projects/${id}/shares/${shareId}`, {
    method: "DELETE",
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to revoke share preview.")
}

export async function apiScanProjectPages(id: number): Promise<Project> {
  const d = await apiFetch<PageProjectRes>(`${BASE}/api/projects/${id}/pages/scan`, {
    method: "POST",
    headers: { "content-type": "application/json" },
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to scan project pages.")
  return d.project
}

export async function apiLoadProjectPage(id: number, pageId: string): Promise<PageProjectRes> {
  const d = await apiFetch<PageProjectRes>(`${BASE}/api/projects/${id}/pages/load`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pageId }),
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to load project page.")
  return d
}

export async function apiCreateProjectPage(
  id: number,
  payload: {
    name: string
    title?: string
    path?: string
    slug?: string
    url?: string
    html?: string
    seo?: ProjectPageSeo
  },
): Promise<PageProjectRes> {
  const d = await apiFetch<PageProjectRes>(`${BASE}/api/projects/${id}/pages`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to create page.")
  return d
}

export async function apiUpdateProjectPage(
  id: number,
  pageId: string,
  payload: {
    id?: string
    name?: string
    title?: string
    path?: string
    slug?: string
    url?: string
    html?: string
    seo?: ProjectPageSeo
  },
): Promise<PageProjectRes> {
  const d = await apiFetch<PageProjectRes>(`${BASE}/api/projects/${id}/pages/${encodeURIComponent(pageId)}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to update page.")
  return d
}

export async function apiDeleteProjectPage(id: number, pageId: string): Promise<Project> {
  const d = await apiFetch<{ ok: boolean; error?: string; project: Project }>(
    `${BASE}/api/projects/${id}/pages/${encodeURIComponent(pageId)}`,
    { method: "DELETE" },
  )
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to delete page.")
  return d.project
}

export async function apiGetProjectActivity(id: number): Promise<ProjectActivityEntry[]> {
  const d = await apiFetch<ProjectActivityRes>(`${BASE}/api/projects/${id}/activity`)
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to load project activity.")
  return d.activity || []
}

export async function apiDeleteProject(id: number) {
  const d = await apiFetch<{ ok: boolean; error?: string }>(`${BASE}/api/projects/${id}`, {
    method: "DELETE"
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to delete.")
}

export async function apiSetProjectWorkflowStage(id: number, stage: WorkflowStage, comment = ""): Promise<Project> {
  const d = await apiFetch<{ ok: boolean; error?: string; project: Project }>(`${BASE}/api/projects/${id}/workflow-stage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ stage, comment })
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to change workflow stage.")
  return d.project
}

export async function apiGetProjectWorkflowHistory(id: number): Promise<WorkflowEvent[]> {
  const d = await apiFetch<{ ok: boolean; error?: string; events: WorkflowEvent[] }>(`${BASE}/api/projects/${id}/workflow-history`)
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to load workflow history.")
  return d.events || []
}

export type PublishTarget = "firebase" | "netlify" | "vercel" | "wordpress" | "shopify"

export type PublishTargetInfo = {
  id: PublishTarget
  label: string
  configured: boolean
  requiredEnv: string[]
  requiredBody: string[]
  optionalEnv?: string[]
}

export type PublishDeployment = {
  id: number
  target: PublishTarget
  status: "pending" | "success" | "failed"
  deploy_url: string | null
  preview_url: string | null
  export_mode: string
  platform: string
  error_message: string | null
  manifest: Record<string, unknown>
  created_at: string
  finished_at: string | null
  deployed_by?: string
}

export async function apiGetPublishTargets(): Promise<PublishTargetInfo[]> {
  const d = await apiFetch<{ ok: boolean; error?: string; targets: PublishTargetInfo[] }>(`${BASE}/api/publish/targets`)
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to load publish targets.")
  return d.targets || []
}

export async function apiCreatePublishPreview(
  projectId: number,
  payload: { html?: string } = {}
): Promise<{
  previewUrl: string
  expiresAt: string
  token: string
}> {
  const d = await apiFetch<{ ok: boolean; error?: string; previewUrl: string; expiresAt: string; token: string }>(
    `${BASE}/api/projects/${projectId}/publish/preview`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }
  )
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to create preview.")
  return { previewUrl: d.previewUrl, expiresAt: d.expiresAt, token: d.token }
}

export async function apiPublishProject(
  projectId: number,
  target: PublishTarget,
  options: Record<string, string> = {}
): Promise<{ deploymentId: number; deployUrl: string | null }> {
  const d = await apiFetch<{ ok: boolean; error?: string; deploymentId: number; deployUrl: string | null }>(
    `${BASE}/api/projects/${projectId}/publish`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ target, ...options }),
    }
  )
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Publish failed.")
  return { deploymentId: d.deploymentId, deployUrl: d.deployUrl }
}

export async function apiGetPublishHistory(projectId: number): Promise<PublishDeployment[]> {
  const d = await apiFetch<{ ok: boolean; error?: string; deployments: PublishDeployment[] }>(
    `${BASE}/api/projects/${projectId}/publish/history`
  )
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to load publish history.")
  return d.deployments || []
}

export async function apiRollbackDeployment(
  projectId: number,
  deploymentId: number,
  options: Record<string, string> = {}
): Promise<{ deploymentId: number; deployUrl: string | null }> {
  const d = await apiFetch<{ ok: boolean; error?: string; deploymentId: number; deployUrl: string | null }>(
    `${BASE}/api/projects/${projectId}/publish/${deploymentId}/rollback`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(options),
    }
  )
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Rollback failed.")
  return { deploymentId: d.deploymentId, deployUrl: d.deployUrl }
}

export async function apiGetCustomDomainGuide(
  projectId: number,
  domain: string,
  target: PublishTarget
): Promise<{
  domain: string
  target: string
  guide: { steps: string[]; recordType: string; recordValue: string }
}> {
  const d = await apiFetch<{
    ok: boolean
    error?: string
    domain: string
    target: string
    guide: { steps: string[]; recordType: string; recordValue: string }
  }>(
    `${BASE}/api/projects/${projectId}/publish/custom-domain`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain, target }),
    }
  )
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to get custom domain guide.")
  return { domain: d.domain, target: d.target, guide: d.guide }
}
