const BASE = "http://localhost:8787"

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
