import { GoogleAuth } from "google-auth-library"
import db from "./db.js"
import { authMiddleware } from "./auth.js"

const VERTEX_MODELS = [
  { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro Preview", family: "gemini", modality: "text", stage: "preview", integration: "vertex", priority: "p0", notes: "Top reasoning wishlist model" },
  { id: "gemini-3.1-flash-lite-preview", label: "Gemini 3.1 Flash Lite Preview", family: "gemini", modality: "text", stage: "preview", integration: "vertex", priority: "p0", notes: "High-throughput low-cost" },
  { id: "gemini-3.1-flash-image-preview", label: "Gemini 3.1 Flash Image Preview", family: "gemini", modality: "image", stage: "preview", integration: "vertex", priority: "p1", notes: "Conversational image editing" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", family: "gemini", modality: "text", stage: "ready", integration: "vertex", priority: "p0", notes: "Primary Vertex text runtime" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", family: "gemini", modality: "text", stage: "ready", integration: "vertex", priority: "p0", notes: "Fast text and multimodal runtime" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", family: "gemini", modality: "text", stage: "ready", integration: "vertex", priority: "p0", notes: "High-throughput low-cost runtime" },
  { id: "gemini-live-2.5-flash-native-audio", label: "Gemini Live 2.5 Flash Native Audio", family: "gemini-live", modality: "audio", stage: "ready", integration: "vertex", priority: "p1", notes: "Live audio model confirmed reachable" },

  { id: "imagen-4.0-generate-001", label: "Imagen 4 Standard", family: "imagen", modality: "image", stage: "ready", integration: "vertex", priority: "p0", notes: "Default image generation target" },
  { id: "imagen-4.0-fast-generate-001", label: "Imagen 4 Fast", family: "imagen", modality: "image", stage: "ready", integration: "vertex", priority: "p1", notes: "Fast image generation target" },
  { id: "imagen-4.0-ultra-generate-001", label: "Imagen 4 Ultra", family: "imagen", modality: "image", stage: "ready", integration: "vertex", priority: "p1", notes: "High-fidelity image generation target" },
  { id: "veo-2.0-generate-001", label: "Veo 2", family: "veo", modality: "video", stage: "ready", integration: "vertex", priority: "p1", notes: "Async video generation model confirmed reachable" },
  { id: "veo-3.1-generate-preview", label: "Veo 3.1", family: "veo", modality: "video", stage: "preview", integration: "vertex", priority: "p0", notes: "Resolved to discovered SKU" },
  { id: "chirp-3", label: "Chirp 3", family: "chirp", modality: "audio", stage: "preview", integration: "vertex", priority: "p0", notes: "Base Chirp SKU confirmed reachable" },
  { id: "lyria-002", label: "Lyria", family: "lyria", modality: "audio", stage: "preview", integration: "vertex", priority: "p1", resolved_alias: "lyria", notes: "Resolved to discovered SKU" },

  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", family: "claude", modality: "text", stage: "wishlist", integration: "vertex-maas", priority: "p0", notes: "Requested high-priority coding model" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", family: "claude", modality: "text", stage: "wishlist", integration: "vertex-maas", priority: "p0", notes: "Requested high-priority reasoning model" },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", family: "claude", modality: "text", stage: "wishlist", integration: "vertex-maas", priority: "p1", notes: "Fallback candidate" },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", family: "claude", modality: "text", stage: "wishlist", integration: "vertex-maas", priority: "p1", notes: "Fallback candidate" },

  { id: "text-translation", label: "Translation LLM", family: "translation", modality: "text", stage: "preview", integration: "vertex", priority: "p1", resolved_alias: "translation-llm", notes: "Resolved to discovered translation SKU" },
  { id: "mistral-large-3", label: "Mistral Large", family: "mistral", modality: "text", stage: "preview", integration: "vertex-maas", priority: "p1", resolved_alias: "mistral-large", notes: "Resolved to discovered Mistral SKU" },
  { id: "mistral-small-2503", label: "Mistral Small", family: "mistral", modality: "text", stage: "preview", integration: "vertex-maas", priority: "p2", resolved_alias: "mistral-small", notes: "Resolved to discovered Mistral SKU" },
]

function clean(value) {
  return String(value || "").trim()
}

function tryParseCredentialJson(candidate) {
  try {
    return JSON.parse(candidate)
  } catch {
    return null
  }
}

function parseCredentials(raw) {
  const text = clean(raw)
  if (!text) return { value: null, error: null }

  const candidates = [text]
  if (!text.startsWith("{") && text.includes('"type"') && text.includes('"private_key"')) {
    candidates.push(`{${text}}`)
  }

  if (
    text.length >= 32 &&
    /^[A-Za-z0-9+/=\s]+$/.test(text) &&
    text.length % 4 === 0
  ) {
    try {
      const decoded = Buffer.from(text, "base64").toString("utf8").trim()
      if (decoded) {
        candidates.push(decoded)
        if (!decoded.startsWith("{") && decoded.includes('"type"') && decoded.includes('"private_key"')) {
          candidates.push(`{${decoded}}`)
        }
      }
    } catch {
      // ignore invalid base64 candidate
    }
  }

  for (const candidate of candidates) {
    const parsed = tryParseCredentialJson(candidate)
    if (parsed && typeof parsed === "object") {
      return { value: parsed, error: null }
    }
  }

  return {
    value: null,
    error: "Vertex service account JSON is invalid. Check VERTEX_SERVICE_ACCOUNT_JSON / GOOGLE_SERVICE_ACCOUNT_JSON.",
  }
}

function getUserVertexSettings(userId) {
  const normalized = Number(userId)
  if (!Number.isFinite(normalized) || normalized <= 0) return null
  try {
    return db.prepare("SELECT vertex_project_id, vertex_location FROM user_settings WHERE user_id = ?").get(normalized)
  } catch {
    return null
  }
}

export function getVertexRuntimeConfig({ userId = null } = {}) {
  const row = getUserVertexSettings(userId)
  const credentialsText = clean(process.env.VERTEX_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_JSON)
  const parsedCredentials = credentialsText ? parseCredentials(credentialsText) : { value: null, error: null }
  const credentials = parsedCredentials.value
  const projectId =
    clean(row?.vertex_project_id) ||
    clean(process.env.VERTEX_PROJECT_ID) ||
    clean(process.env.GOOGLE_PROJECT_ID) ||
    clean(credentials?.project_id)
  const location = clean(row?.vertex_location) || clean(process.env.VERTEX_LOCATION) || "us-central1"
  const adcPath = clean(process.env.GOOGLE_APPLICATION_CREDENTIALS)

  return {
    projectId,
    location,
    credentials,
    credentialsError: parsedCredentials.error,
    configured: Boolean(projectId),
    hasCredentials: Boolean(credentialsText || adcPath),
    authMode: credentials
      ? "service-account-json"
      : adcPath
      ? "adc-file"
      : parsedCredentials.error
      ? "invalid-service-account-json"
      : "application-default-credentials",
  }
}

function getVertexAuth(config) {
  return new GoogleAuth({
    credentials: config.credentials || undefined,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  })
}

async function getAccessToken(config) {
  const auth = getVertexAuth(config)
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  if (!clean(token?.token)) {
    throw new Error("Could not obtain Vertex access token")
  }
  return token.token
}

function summarizeModels() {
  const byFamily = {}
  const byModality = {}
  const byIntegration = {}
  const byStage = {}
  for (const model of VERTEX_MODELS) {
    byFamily[model.family] = Number(byFamily[model.family] || 0) + 1
    byModality[model.modality] = Number(byModality[model.modality] || 0) + 1
    byIntegration[model.integration] = Number(byIntegration[model.integration] || 0) + 1
    byStage[model.stage] = Number(byStage[model.stage] || 0) + 1
  }
  return { byFamily, byModality, byIntegration, byStage, total: VERTEX_MODELS.length }
}

function buildResolvedModelMap() {
  return VERTEX_MODELS.map((entry) => ({
    requested_id: clean(entry.resolved_alias) || entry.id,
    resolved_id: clean(entry.resolved_id) || entry.id,
    label: entry.label,
    family: entry.family,
    modality: entry.modality,
    stage: entry.stage,
    availability: clean(entry.availability) || "found",
  }))
}

export function registerVertexRoutes(app) {
  app.get("/api/vertex/status", authMiddleware, async (req, res) => {
    try {
      const config = getVertexRuntimeConfig({ userId: req.user?.id })
      let authOk = false
      let authError = config.credentialsError || ""

      if (config.configured && !config.credentialsError) {
        try {
          await getAccessToken(config)
          authOk = true
        } catch (error) {
          authError = error?.message || "Vertex authentication failed"
        }
      }

      res.json({
        ok: true,
        status: {
          configured: config.configured,
          auth_ok: authOk,
          auth_error: authError || null,
          project_id: config.projectId || "",
          location: config.location,
          has_credentials: config.hasCredentials,
          auth_mode: config.authMode,
          models: summarizeModels(),
        },
      })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Vertex status failed" })
    }
  })

  app.get("/api/vertex/models", authMiddleware, (req, res) => {
    try {
      const config = getVertexRuntimeConfig({ userId: req.user?.id })
      res.json({
        ok: true,
        project_id: config.projectId || "",
        location: config.location,
        models: VERTEX_MODELS,
      })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Vertex models failed" })
    }
  })

  app.get("/api/vertex/models/resolved", authMiddleware, (_req, res) => {
    res.json({
      ok: true,
      models: buildResolvedModelMap(),
    })
  })

  app.get("/api/vertex/capabilities", authMiddleware, (_req, res) => {
    const families = [...new Set(VERTEX_MODELS.map((entry) => entry.family))].sort()
    res.json({
      ok: true,
      capabilities: {
        text: ["gemini"],
        image: ["imagen"],
        audio: ["chirp"],
        video: ["veo"],
        families,
      },
      models: Object.fromEntries(families.map((family) => [family, VERTEX_MODELS.filter((entry) => entry.family === family)])),
    })
  })

  app.get("/api/vertex/wishlist", authMiddleware, (_req, res) => {
    res.json({
      ok: true,
      summary: summarizeModels(),
      models: VERTEX_MODELS,
    })
  })

  app.post("/api/vertex/test-auth", authMiddleware, async (req, res) => {
    try {
      const config = getVertexRuntimeConfig({ userId: req.user?.id })
      if (config.credentialsError) {
        return res.status(400).json({ ok: false, error: config.credentialsError })
      }
      if (!config.configured) {
        return res.status(400).json({ ok: false, error: "Vertex project is not configured" })
      }
      const token = await getAccessToken(config)
      res.json({
        ok: true,
        status: {
          project_id: config.projectId,
          location: config.location,
          auth_mode: config.authMode,
          token_preview: `${String(token).slice(0, 8)}...`,
        },
      })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Vertex authentication failed" })
    }
  })
}