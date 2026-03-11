/**
 * User-friendly message for API 4xx/5xx. Prefer server d.error; else fallback by status.
 */
export function apiErrorMessage(status: number, bodyError?: string | null): string {
  if (bodyError && String(bodyError).trim()) return String(bodyError).trim();
  if (status === 401) return "Session expired or invalid credentials.";
  if (status === 403) return "Access denied.";
  if (status === 404) return "Not found.";
  if (status >= 500) return "Server error. Please try again.";
  return `Request failed (${status}).`;
}

/**
 * Fetch, parse JSON, and throw with user-friendly message if !res.ok.
 * Callers should catch and toast.error(e.message).
 */
export async function apiFetch<T = unknown>(
  url: string,
  opts: RequestInit = {}
): Promise<T> {
  const res = await fetch(url, { credentials: "include", ...opts });
  const text = await res.text();
  let bodyError: string | null = null;
  try {
    const d = text ? JSON.parse(text) : {};
    bodyError = d?.error ?? d?.message ?? null;
  } catch {
    // non-JSON response
  }
  if (!res.ok) {
    throw new Error(apiErrorMessage(res.status, bodyError));
  }
  return text ? JSON.parse(text) : (null as T);
}
