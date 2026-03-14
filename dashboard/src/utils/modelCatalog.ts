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
