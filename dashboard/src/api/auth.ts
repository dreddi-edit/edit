import { apiFetch } from "./client"

const BASE = ""

export type User = { id: number; email: string; name: string }

export async function apiLogin(email: string, password: string): Promise<User> {
  const d = await apiFetch<{ ok: boolean; error?: string; user: User }>(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  })
  if (!d?.ok) throw new Error((d as { error?: string }).error || "Login failed.")
  return (d as { user: User }).user
}

export async function apiRegister(email: string, password: string, name: string): Promise<User> {
  const d = await apiFetch<{ ok: boolean; error?: string; user: User }>(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name })
  })
  if (!d?.ok) throw new Error((d as { error?: string }).error || "Registration failed.")
  return (d as { user: User }).user
}

export async function apiLogout() {
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" })
}

export async function apiMe(): Promise<User | null> {
  try {
    const d = await apiFetch<{ ok: boolean; user?: User }>(`${BASE}/api/auth/me`)
    return (d?.ok && (d as { user?: User }).user) ? (d as { user: User }).user : null
  } catch {
    return null
  }
}

export async function apiForgotPassword(email: string): Promise<void> {
  const d = await apiFetch<{ ok?: boolean; error?: string }>(`${BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  })
  if (d && !(d as { ok?: boolean }).ok) throw new Error((d as { error?: string }).error || "Request failed.")
}

export async function apiResetPassword(token: string, password: string): Promise<void> {
  const d = await apiFetch<{ ok?: boolean; error?: string }>(`${BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password })
  })
  if (d && !(d as { ok?: boolean }).ok) throw new Error((d as { error?: string }).error || "Reset failed.")
}
