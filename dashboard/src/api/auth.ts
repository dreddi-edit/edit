const BASE = ""

export type User = { id: number; email: string; name: string }

export async function apiLogin(email: string, password: string): Promise<User> {
  const r = await fetch(`${BASE}/api/auth/login`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password })
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
  return d.user
}

export async function apiRegister(email: string, password: string, name: string): Promise<User> {
  const r = await fetch(`${BASE}/api/auth/register`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name })
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
  return d.user
}

export async function apiLogout() {
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" })
}

export async function apiMe(): Promise<User | null> {
  try {
    const r = await fetch(`${BASE}/api/auth/me`, { credentials: "include" })
    const d = await r.json()
    return d.ok ? d.user : null
  } catch { return null }
}

export async function apiForgotPassword(email: string): Promise<void> {
  const r = await fetch(`${BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email })
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
}

export async function apiResetPassword(token: string, password: string): Promise<void> {
  const r = await fetch(`${BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password })
  })
  const d = await r.json()
  if (!d.ok) throw new Error(d.error)
}
