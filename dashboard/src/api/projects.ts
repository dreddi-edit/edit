const BASE = "http://localhost:8787"

export type Project = {
  id: number
  name: string
  url: string
  html?: string
  thumbnail?: string
  updated_at: string
  created_at: string
}

export async function apiGetProjects(): Promise<Project[]> {
  const r = await fetch(`${BASE}/api/projects`, { credentials: "include" })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
  return d.projects
}

export async function apiGetProject(id: number): Promise<Project> {
  const r = await fetch(`${BASE}/api/projects/${id}`, { credentials: "include" })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
  return d.project
}

export async function apiCreateProject(name: string, url: string, html: string): Promise<number> {
  const r = await fetch(`${BASE}/api/projects`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, url, html })
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
  return d.id
}

export async function apiSaveProject(id: number, data: Partial<Project>) {
  const r = await fetch(`${BASE}/api/projects/${id}`, {
    method: "PUT", credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
}

export async function apiDeleteProject(id: number) {
  const r = await fetch(`${BASE}/api/projects/${id}`, {
    method: "DELETE", credentials: "include"
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
}
