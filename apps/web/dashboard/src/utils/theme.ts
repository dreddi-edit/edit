export type ThemeMode = "dark" | "light"

const THEME_STORAGE_KEY = "se_theme"
const THEME_EXPLICIT_STORAGE_KEY = "se_theme_explicit"

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "dark" || value === "light"
}

export function getSystemTheme(): ThemeMode {
  if (typeof window === "undefined") return "dark"
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function hasExplicitThemePreference() {
  if (typeof window === "undefined") return false
  return localStorage.getItem(THEME_EXPLICIT_STORAGE_KEY) === "1"
}

export function getStoredThemePreference(): ThemeMode | null {
  if (typeof window === "undefined") return null
  const stored = localStorage.getItem(THEME_STORAGE_KEY)
  return isThemeMode(stored) ? stored : null
}

export function resolveThemePreference(): ThemeMode {
  if (typeof document !== "undefined") {
    const bodyTheme = document.body.getAttribute("data-theme")
    if (isThemeMode(bodyTheme)) return bodyTheme
  }
  if (hasExplicitThemePreference()) {
    return getStoredThemePreference() || "dark"
  }
  return getSystemTheme()
}

export function applyThemeToDocument(theme: ThemeMode) {
  if (typeof document === "undefined") return
  document.body.setAttribute("data-theme", theme)
}

export function persistThemeChoice(theme: ThemeMode) {
  if (typeof window === "undefined") return
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  localStorage.setItem(THEME_EXPLICIT_STORAGE_KEY, "1")
}

export function clearThemeChoice() {
  if (typeof window === "undefined") return
  localStorage.removeItem(THEME_STORAGE_KEY)
  localStorage.removeItem(THEME_EXPLICIT_STORAGE_KEY)
}
