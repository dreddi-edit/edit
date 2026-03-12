export type ModelCategoryId = "creative" | "coding" | "fast"

export interface ModelCategory {
  id: ModelCategoryId
  label: string
  description: string
}

export interface Model {
  id: string
  label: string
  provider: "anthropic" | "gemini" | "groq"
  tier: "basis" | "starter" | "pro" | "enterprise" | "scale" | "studio"
  category: ModelCategoryId
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
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5", provider: "anthropic", tier: "starter", category: "fast" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "gemini", tier: "enterprise", category: "creative" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "gemini", tier: "pro", category: "fast" },
  { id: "groq:llama-3.3-70b-versatile", label: "Groq Llama 3.3 70B", provider: "groq", tier: "scale", category: "fast" },
]

export function getCategoryModels(categoryId: ModelCategoryId): Model[] {
  return MODELS.filter((model) => model.category === categoryId)
}

export function getTopActiveModelsByCategory(disabledModels: string[] = [], top = 3) {
  const disabled = new Set((disabledModels || []).map((value) => String(value || "").trim()).filter(Boolean))
  return MODEL_CATEGORIES.map((category) => {
    const categoryModels = getCategoryModels(category.id)
    const activeModels = categoryModels.filter((model) => !disabled.has(model.id))
    return {
      ...category,
      activeCount: categoryModels.length,
      models: activeModels.slice(0, Math.max(1, top)),
    }
  })
}
