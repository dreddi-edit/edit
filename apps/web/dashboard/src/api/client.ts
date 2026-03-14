/**
 * User-friendly message for API 4xx/5xx. Prefer server d.error; else fallback by status.
 */
export function apiErrorMessage(status: number, bodyError?: string | null): string {
  if (bodyError && String(bodyError).trim()) return String(bodyError).trim()
  if (status === 401) return "Session expired or invalid credentials."
  if (status === 403) return "Access denied."
  if (status === 404) return "Not found."
  if (status >= 500) return "Server error. Please try again."
  return `Request failed (${status}).`
}

type ParsedResponse<T> = {
  ok: boolean
  status: number
  payload: T | null
  bodyError: string | null
}

async function parseResponse<T>(response: Response): Promise<ParsedResponse<T>> {
  const text = await response.text()
  let payload: T | null = null
  let bodyError: string | null = null

  try {
    payload = text ? JSON.parse(text) : null
    bodyError = (payload as { error?: string; message?: string } | null)?.error
      ?? (payload as { error?: string; message?: string } | null)?.message
      ?? null
  } catch {
    payload = null
    bodyError = null
  }

  return {
    ok: response.ok,
    status: response.status,
    payload,
    bodyError,
  }
}

function shouldAttemptRefresh(url: string): boolean {
  const base = typeof window !== "undefined" ? window.location.origin : "http://localhost"
  const pathname = new URL(url, base).pathname
  if (pathname === "/api/auth/refresh") return false
  return ![
    "/api/auth/login",
    "/api/auth/login/2fa",
    "/api/auth/register",
    "/api/auth/logout",
    "/api/auth/forgot-password",
    "/api/auth/reset-password",
    "/api/auth/verify-email",
  ].includes(pathname)
}

let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshSession(): Promise<boolean> {
  // If a refresh is already in progress, wait for it instead of starting a new one
  if (refreshPromise) return refreshPromise;
  
  refreshPromise = (async () => {
    try {
      const response = await fetch("/api/auth/refresh", {
        method: "POST",
        credentials: "include",
        headers: { "x-csrf-token": getCsrfToken() }
      });
      return response.ok;
    } catch {
      return false;
    } finally {
      refreshPromise = null; // Clear lock when done
    }
  })();
  
  return refreshPromise;
}

// Helper to grab the CSRF token from cookies
function getCsrfToken(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(^| )csrf_token=([^;]+)"));
  return match ? match[2] : "";
}

export async function fetchWithAuth(url: string, opts: RequestInit = {}): Promise<Response> {
  opts.headers = { ...opts.headers, "x-csrf-token": getCsrfToken() };
  const execute = () => fetch(url, { credentials: "include", ...opts })
  let response = await execute()
  if (response.status === 401 && shouldAttemptRefresh(url)) {
    const refreshed = await tryRefreshSession()
    if (refreshed) {
      response = await execute()
    }
  }
  return response
}

/**
 * Fetch, parse JSON, and throw with user-friendly message if !res.ok.
 * Callers should catch and toast.error(e.message).
 */
export async function apiFetch<T = unknown>(
  url: string,
  opts: RequestInit = {}
): Promise<T> {
  const parsed = await parseResponse<T>(await fetchWithAuth(url, opts))

  if (!parsed.ok) {
    throw new Error(apiErrorMessage(parsed.status, parsed.bodyError))
  }

  return parsed.payload as T
}
