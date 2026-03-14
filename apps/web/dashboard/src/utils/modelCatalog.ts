export type ModelCategoryId = "creative" | "coding" | "fast"

export interface ModelCategory {
  id: ModelCategoryId
  label: string
  description: string
}

export interface Model {
  id: string
  label: string
  provider: "anthropic" | "gemini" | "groq" | "openai" | "openrouter" | "ollama"
  tier: "basis" | "starter" | "pro" | "enterprise" | "scale" | "studio"
  category: ModelCategoryId
}

export interface DetectedModel {
  value: string
  label?: string
  provider?: string
}

export const MODEL_CATEGORIES: ModelCategory[] = [
  {
    id: "creative",
    label: "Creative & Writing",
    description: "Campaign ideation, positioning, copy, and storytelling",
  },
  {
    id: "coding",
    label: "Coding & Logic",
    description: "Structured reasoning, debugging, and implementation work",
  },
  {
    id: "fast",
    label: "Fast & Efficient",
    description: "Lower-latency general tasks and quick iteration loops",
  },
]

export const MODELS: Model[] = [
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic", tier: "pro", category: "coding" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5", provider: "anthropic", tier: "pro", category: "coding" },
  { id: "claude-opus-4-1-20250805", label: "Claude Opus 4.1", provider: "anthropic", tier: "enterprise", category: "creative" },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4", provider: "anthropic", tier: "enterprise", category: "creative" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", tier: "starter", category: "fast" },
  { id: "claude-3-7-sonnet-latest", label: "Claude 3.7 Sonnet", provider: "anthropic", tier: "pro", category: "coding" },
  { id: "claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet", provider: "anthropic", tier: "starter", category: "coding" },
  { id: "claude-3-5-haiku-latest", label: "Claude 3.5 Haiku", provider: "anthropic", tier: "starter", category: "fast" },

  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", tier: "enterprise", category: "creative" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", tier: "pro", category: "fast" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "gemini", tier: "starter", category: "fast" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", provider: "gemini", tier: "starter", category: "fast" },
  { id: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Exp", provider: "gemini", tier: "pro", category: "coding" },
  { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro", provider: "gemini", tier: "pro", category: "creative" },
  { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash", provider: "gemini", tier: "starter", category: "fast" },

  { id: "groq:llama-3.3-70b-versatile", label: "Groq Llama 3.3 70B", provider: "groq", tier: "scale", category: "fast" },
  { id: "groq:llama-3.1-8b-instant", label: "Groq Llama 3.1 8B", provider: "groq", tier: "starter", category: "fast" },
  { id: "groq:mixtral-8x7b-32768", label: "Groq Mixtral 8x7B", provider: "groq", tier: "starter", category: "coding" },
  { id: "groq:qwen-qwq-32b", label: "Groq Qwen QwQ 32B", provider: "groq", tier: "pro", category: "coding" },
  { id: "groq:deepseek-r1-distill-llama-70b", label: "Groq DeepSeek R1 Distill 70B", provider: "groq", tier: "pro", category: "coding" },

  { id: "gpt-4.1", label: "GPT-4.1", provider: "openai", tier: "enterprise", category: "coding" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 mini", provider: "openai", tier: "pro", category: "fast" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai", tier: "pro", category: "creative" },
  { id: "gpt-4o-mini", label: "GPT-4o mini", provider: "openai", tier: "starter", category: "fast" },
  { id: "o3", label: "OpenAI o3", provider: "openai", tier: "enterprise", category: "coding" },
  { id: "o3-mini", label: "OpenAI o3 mini", provider: "openai", tier: "pro", category: "coding" },

  { id: "openrouter:anthropic/claude-3.7-sonnet", label: "OpenRouter Claude 3.7 Sonnet", provider: "openrouter", tier: "pro", category: "coding" },
  { id: "openrouter:google/gemini-2.0-flash-001", label: "OpenRouter Gemini 2.0 Flash", provider: "openrouter", tier: "starter", category: "fast" },
  { id: "openrouter:openai/gpt-4o", label: "OpenRouter GPT-4o", provider: "openrouter", tier: "pro", category: "creative" },

  { id: "ollama:qwen2.5-coder:7b", label: "Ollama Qwen 2.5 Coder 7B", provider: "ollama", tier: "starter", category: "coding" },
  { id: "ollama:llama3.1:8b", label: "Ollama Llama 3.1 8B", provider: "ollama", tier: "starter", category: "fast" },
]

const EXECUTABLE_PROVIDERS = new Set<Model["provider"]>(["anthropic", "gemini", "groq", "ollama"])
const KNOWN_PROVIDERS = new Set<Model["provider"]>(["anthropic", "gemini", "groq", "openai", "openrouter", "ollama"])
const KNOWN_MODEL_MAP = new Map(MODELS.map((model) => [model.id, model] as const))

function normalizeModelId(value: string) {
  return String(value || "").trim()
}

export function isExecutableProvider(provider: string): provider is Model["provider"] {
  return EXECUTABLE_PROVIDERS.has(String(provider || "").trim().toLowerCase() as Model["provider"])
}

function isKnownProvider(provider: string): provider is Model["provider"] {
  return KNOWN_PROVIDERS.has(String(provider || "").trim().toLowerCase() as Model["provider"])
}

export function inferModelProvider(value: string, explicitProvider = ""): Model["provider"] | null {
  const normalizedExplicit = String(explicitProvider || "").trim().toLowerCase()
  if (isKnownProvider(normalizedExplicit)) return normalizedExplicit

  const normalized = normalizeModelId(value).toLowerCase()
  if (!normalized) return null
  if (normalized.startsWith("claude-")) return "anthropic"
  if (normalized.startsWith("gemini-")) return "gemini"
  if (normalized.startsWith("groq:")) return "groq"
  if (normalized.startsWith("ollama:")) return "ollama"
  if (normalized.startsWith("openrouter:")) return "openrouter"
  if (/^(gpt-|o\d|chatgpt|text-)/i.test(normalized)) return "openai"
  return null
}

function inferModelCategory(value: string, provider: Model["provider"]): ModelCategoryId {
  const normalized = normalizeModelId(value).toLowerCase()
  const known = KNOWN_MODEL_MAP.get(normalized)
  if (known) return known.category

  if (provider === "anthropic") {
    if (normalized.includes("haiku")) return "fast"
    if (normalized.includes("opus")) return "creative"
    return "coding"
  }

  if (provider === "gemini") {
    if (normalized.includes("flash")) return "fast"
    if (normalized.includes("exp") || normalized.includes("thinking")) return "coding"
    if (normalized.includes("pro")) return "creative"
    return "fast"
  }

  if (provider === "groq") {
    if (normalized.includes("mixtral") || normalized.includes("qwen") || normalized.includes("deepseek")) return "coding"
    return "fast"
  }

  if (provider === "openai") {
    if (normalized.startsWith("o3") || normalized.startsWith("o1")) return "coding"
    if (normalized.includes("mini")) return "fast"
    if (normalized.startsWith("gpt-4o")) return "creative"
    return "coding"
  }

  if (provider === "openrouter") {
    if (normalized.includes("claude") || normalized.includes("gpt") || normalized.includes("deepseek")) return "coding"
    if (normalized.includes("flash") || normalized.includes("mini")) return "fast"
    return "creative"
  }

  if (normalized.includes("coder") || normalized.includes("code") || normalized.includes("qwen")) return "coding"
  return "fast"
}

function inferModelTier(value: string, provider: Model["provider"]): Model["tier"] {
  const normalized = normalizeModelId(value).toLowerCase()
  const known = KNOWN_MODEL_MAP.get(normalized)
  if (known) return known.tier

  if (provider === "anthropic") {
    if (normalized.includes("opus")) return "enterprise"
    if (normalized.includes("haiku")) return "starter"
    return "pro"
  }

  if (provider === "gemini") {
    if (normalized.includes("pro")) return "enterprise"
    if (normalized.includes("lite") || normalized.includes("1.5-flash") || normalized.includes("2.0-flash")) return "starter"
    return "pro"
  }

  if (provider === "groq") {
    if (normalized.includes("70b")) return "scale"
    if (normalized.includes("8b") || normalized.includes("mixtral")) return "starter"
    return "pro"
  }

  if (provider === "openai") {
    if (normalized.startsWith("o3") || normalized.startsWith("o1") || normalized === "gpt-4.1") return "enterprise"
    if (normalized.includes("mini")) return "starter"
    return "pro"
  }

  if (provider === "openrouter") {
    if (normalized.includes("opus") || normalized.includes("o3") || normalized.includes("gpt-5")) return "enterprise"
    if (normalized.includes("flash") || normalized.includes("mini")) return "starter"
    return "pro"
  }

  return "starter"
}

function humanizeModelLabel(value: string, provider: Model["provider"]): string {
  const known = KNOWN_MODEL_MAP.get(normalizeModelId(value))
  if (known) return known.label

  const normalized = normalizeModelId(value)
  const withoutProvider = normalized
    .replace(/^groq:/i, "")
    .replace(/^ollama:/i, "")
    .replace(/^openrouter:/i, "")

  const cleaned = withoutProvider
    .replace(/[-_]+/g, " ")
    .replace(/\b([a-z])(\d)/gi, "$1 $2")
    .replace(/\b(\d)([a-z])/gi, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()

  const titled = cleaned
    .split(" ")
    .map((part) => (part ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join(" ")

  if (provider === "groq") return `Groq ${titled}`
  if (provider === "ollama") return `Ollama ${titled}`
  if (provider === "openrouter") return `OpenRouter ${titled}`
  if (provider === "openai") return titled
  return titled || normalized
}

function toAvailableModel(candidate: DetectedModel, executableOnly: boolean): Model | null {
  const id = normalizeModelId(candidate.value)
  if (!id) return null

  const known = KNOWN_MODEL_MAP.get(id)
  if (known) {
    if (executableOnly && !isExecutableProvider(known.provider)) return null
    return known
  }

  const provider = inferModelProvider(id, candidate.provider)
  if (!provider || (executableOnly && !isExecutableProvider(provider))) return null

  return {
    id,
    label: String(candidate.label || "").trim() || humanizeModelLabel(id, provider),
    provider,
    tier: inferModelTier(id, provider),
    category: inferModelCategory(id, provider),
  }
}

function sortModels(models: Model[]) {
  return models.sort((left, right) => {
    const categoryDelta = MODEL_CATEGORIES.findIndex((category) => category.id === left.category)
      - MODEL_CATEGORIES.findIndex((category) => category.id === right.category)
    if (categoryDelta !== 0) return categoryDelta
    return left.label.localeCompare(right.label)
  })
}

export function buildAvailableModels(detectedModels: DetectedModel[] = []): Model[] {
  const merged = new Map<string, Model>(MODELS.map((model) => [model.id, model] as const))

  for (const detectedModel of detectedModels) {
    const normalized = toAvailableModel(detectedModel, false)
    if (!normalized) continue
    merged.set(normalized.id, normalized)
  }

  return sortModels(Array.from(merged.values()))
}

export function buildAvailableExecutableModels(detectedModels: DetectedModel[] = []): Model[] {
  const merged = new Map<string, Model>(
    MODELS.filter((model) => isExecutableProvider(model.provider)).map((model) => [model.id, model] as const),
  )

  for (const detectedModel of detectedModels) {
    const normalized = toAvailableModel(detectedModel, true)
    if (!normalized) continue
    merged.set(normalized.id, normalized)
  }

  return sortModels(Array.from(merged.values()))
}

export function getCategoryModels(categoryId: ModelCategoryId): Model[] {
  return MODELS.filter((model) => model.category === categoryId)
}

export function getActiveModelsByCategory(availableModels: Model[], disabledModels: string[] = []) {
  const disabled = new Set((disabledModels || []).map((value) => String(value || "").trim()).filter(Boolean))
  return MODEL_CATEGORIES.map((category) => {
    const categoryModels = availableModels.filter((model) => model.category === category.id)
    const activeModels = categoryModels.filter((model) => !disabled.has(model.id))
    return {
      ...category,
      activeCount: categoryModels.length,
      models: activeModels,
    }
  })
}

export function getTopActiveModelsByCategory(disabledModels: string[] = [], top = 3) {
  return getActiveModelsByCategory(buildAvailableExecutableModels(), disabledModels).map((category) => ({
    ...category,
    models: category.models.slice(0, Math.max(1, top)),
  }))
}
