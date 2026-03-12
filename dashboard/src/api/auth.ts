import { apiFetch } from "./client"

const BASE = ""

export type NotificationPrefs = {
  email_updates?: boolean
  team_mentions?: boolean
}

export type User = {
  id: number
  email: string
  name: string
  avatar_url?: string
  email_verified?: boolean
  totp_enabled?: boolean
  plan_id?: string
  plan_status?: string
  created_at?: string
  notification_prefs?: NotificationPrefs
}

export type LoginTwoFactorChallenge = {
  requires_2fa: true
  session_token: string
}

export type LoginResult = User | LoginTwoFactorChallenge

function isTwoFactorChallenge(value: unknown): value is LoginTwoFactorChallenge {
  return Boolean(
    value &&
    typeof value === "object" &&
    (value as LoginTwoFactorChallenge).requires_2fa === true &&
    typeof (value as LoginTwoFactorChallenge).session_token === "string"
  )
}

export async function apiLogin(email: string, password: string): Promise<LoginResult> {
  const d = await apiFetch<{
    ok: boolean
    error?: string
    user?: User
    requires_2fa?: boolean
    session_token?: string
  }>(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  })
  if (!d?.ok) throw new Error(d?.error || "Login failed.")
  if (d.requires_2fa && d.session_token) {
    return { requires_2fa: true, session_token: d.session_token }
  }
  if (!d.user) throw new Error("Login failed.")
  return d.user
}

export async function apiLogin2FA(sessionToken: string, code: string): Promise<User> {
  const d = await apiFetch<{ ok: boolean; error?: string; user?: User }>(`${BASE}/api/auth/login/2fa`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ session_token: sessionToken, code }),
  })
  if (!d?.ok || !d.user) throw new Error(d?.error || "Two-factor login failed.")
  return d.user
}

export async function apiRegister(email: string, password: string, name: string): Promise<User> {
  const d = await apiFetch<{ ok: boolean; error?: string; user?: User }>(`${BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  })
  if (!d?.ok || !d.user) throw new Error(d?.error || "Registration failed.")
  return d.user
}

export async function apiLogout() {
  await fetch(`${BASE}/api/auth/logout`, { method: "POST", credentials: "include" })
}

export async function apiMe(): Promise<User | null> {
  try {
    const d = await apiFetch<{ ok: boolean; user?: User }>(`${BASE}/api/auth/me`)
    return d?.ok && d.user ? d.user : null
  } catch {
    return null
  }
}

export async function apiForgotPassword(email: string): Promise<void> {
  const d = await apiFetch<{ ok?: boolean; error?: string }>(`${BASE}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email }),
  })
  if (d && !d.ok) throw new Error(d.error || "Request failed.")
}

export async function apiResetPassword(token: string, password: string): Promise<void> {
  const d = await apiFetch<{ ok?: boolean; error?: string }>(`${BASE}/api/auth/reset-password`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token, password }),
  })
  if (d && !d.ok) throw new Error(d.error || "Reset failed.")
}

export { isTwoFactorChallenge }
