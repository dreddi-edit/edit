import db from "./db.js"

const PROVIDER_ENV_KEYS = {
  anthropic: ["ANTHROPIC_API_KEY"],
  gemini: ["GEMINI_API_KEY", "GOOGLE_API_KEY"],
  groq: ["GROQ_API_KEY"],
}

const PROVIDER_USER_SETTINGS_COLUMNS = {
  anthropic: "anthropic_key",
  gemini: "gemini_key",
  groq: "groq_key",
}

const PROVIDER_USER_API_ALIASES = {
  anthropic: ["anthropic"],
  gemini: ["gemini", "google"],
  groq: ["groq"],
}

function normalizeProvider(value) {
  const key = String(value || "").trim().toLowerCase()
  if (key === "google") return "gemini"
  return key
}

function cleanKey(value) {
  return String(value || "").trim()
}

function normalizeUserId(userId) {
  const numeric = Number(userId)
  if (!Number.isFinite(numeric) || numeric <= 0) return null
  return numeric
}

function getEnvKey(provider) {
  const normalized = normalizeProvider(provider)
  const envNames = PROVIDER_ENV_KEYS[normalized] || []
  for (const envName of envNames) {
    const key = cleanKey(process.env[envName] || "")
    if (key) return key
  }
  return ""
}

function getUserSettingsKey(provider, userId) {
  const normalized = normalizeProvider(provider)
  const column = PROVIDER_USER_SETTINGS_COLUMNS[normalized]
  if (!column) return ""
  const normalizedUserId = normalizeUserId(userId)
  if (!normalizedUserId) return ""
  
  try {
    const row = db.prepare(`SELECT ${column} AS key_value FROM user_settings WHERE user_id = ?`).get(normalizedUserId)
    return cleanKey(row?.key_value || "")
  } catch (error) {
    // If column or table is missing, swallow the error and fallback
    return ""
  }
}

function getUserApiKey(provider, userId) {
  const normalized = normalizeProvider(provider)
  const normalizedUserId = normalizeUserId(userId)
  if (!normalizedUserId) return ""
  const aliases = PROVIDER_USER_API_ALIASES[normalized] || [normalized]
  if (!aliases.length) return ""
  const placeholders = aliases.map(() => "?").join(", ")
  
  try {
    const row = db
      .prepare(
        `SELECT key_value
         FROM user_api_keys
         WHERE user_id = ? AND active = 1 AND provider IN (${placeholders})
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT 1`,
      )
      .get(normalizedUserId, ...aliases)
    return cleanKey(row?.key_value || "")
  } catch (error) {
    // If table is missing, swallow the error and fallback
    return ""
  }
}

export function getProviderApiKey(provider, { userId = null, allowEnvFallback = true } = {}) {
  const normalized = normalizeProvider(provider)
  if (!normalized) return ""
  
  const fromApiKeys = getUserApiKey(normalized, userId)
  if (fromApiKeys) return fromApiKeys
  
  const fromSettings = getUserSettingsKey(normalized, userId)
  if (fromSettings) return fromSettings
  
  if (!allowEnvFallback) return ""
  return getEnvKey(normalized)
}
