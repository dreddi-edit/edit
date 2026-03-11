import { apiFetch } from "./client"
import type { SitePlatform } from "../utils/sitePlatform"

const BASE = ""

export type WorkflowStage = "draft" | "internal_review" | "client_review" | "approved" | "shipped"
export type DeliveryStatus = "not_exported" | "export_ready" | "exported" | "handed_off" | "shipped"

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

export type ProjectAssignee = {
  email: string
  name?: string
  role?: string
  status?: string
  source?: string
}

export type ProjectPage = {
  id: string
  name: string
  title?: string
  path: string
  url: string
  html?: string
  updatedAt?: string
  scannedAt?: string
}

export type Project = {
  id: number
  name: string
  url: string
  html?: string
  pages?: ProjectPage[]
  platform?: SitePlatform
  thumbnail?: string
  pinned?: number
  clientName?: string
  ownerUserId?: number
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

type ProjectsRes = { ok: boolean; error?: string; projects: Project[] }
type ProjectRes = { ok: boolean; error?: string; project: Project; latestExport?: LatestExport | null }
type CreateProjectRes = { ok: boolean; error?: string; id: number; project?: Project }
type PageProjectRes = { ok: boolean; error?: string; project: Project; page?: ProjectPage }

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
  extras: Partial<Pick<Project, "clientName" | "workflowStage" | "deliveryStatus" | "dueAt" | "assignees">> = {}
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
    platform,
    updated_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
  }
}

export async function apiSaveProject(id: number, data: Partial<Project>) {
  const d = await apiFetch<{ ok: boolean; error?: string; project?: Project }>(`${BASE}/api/projects/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  })
  if (!d?.ok) throw new Error((d as { error?: string })?.error || "Failed to save.")
  return d.project
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
