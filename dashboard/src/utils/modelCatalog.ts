export type ModelCategoryId = "chat" | "image" | "video" | "code" | "extras"

export type ModelCategory = {
  id: ModelCategoryId
  label: string
  description: string
}

export type ModelCatalogEntry = {
  id: string
  label: string
  provider: string
  category: ModelCategoryId
}

export const MODEL_CATEGORIES: ModelCategory[] = [
  { id: "chat", label: "Chat", description: "Reasoning, drafting, agents, and long-context conversations." },
  { id: "image", label: "Image", description: "Image generation, vision analysis, OCR, and visual edits." },
  { id: "video", label: "Video", description: "Video generation, live multimodal work, and clip understanding." },
  { id: "code", label: "Code", description: "Coding, refactors, debugging, and repository-scale changes." },
  { id: "extras", label: "Extras", description: "Embeddings, speech, research, safety, and operator tools." },
]

export const MODEL_CATALOG: ModelCatalogEntry[] = [
  { id: "chat:claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", category: "chat" },
  { id: "chat:claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", category: "chat" },
  { id: "chat:claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic", category: "chat" },
  { id: "chat:gemini-3-1-pro-preview", label: "Gemini 3.1 Pro Preview", provider: "Google", category: "chat" },
  { id: "chat:gemini-3-flash", label: "Gemini 3 Flash", provider: "Google", category: "chat" },
  { id: "chat:gemini-3-1-flash-lite", label: "Gemini 3.1 Flash-Lite", provider: "Google", category: "chat" },
  { id: "chat:gemini-2-5-pro", label: "Gemini 2.5 Pro", provider: "Google", category: "chat" },
  { id: "chat:gemini-2-5-flash", label: "Gemini 2.5 Flash", provider: "Google", category: "chat" },
  { id: "chat:groq-compound", label: "Groq Compound", provider: "Groq", category: "chat" },
  { id: "chat:groq-compound-mini", label: "Groq Compound Mini", provider: "Groq", category: "chat" },
  { id: "chat:llama-3-3-70b-versatile", label: "Llama 3.3 70B Versatile", provider: "Groq", category: "chat" },
  { id: "chat:llama-3-1-8b-instant", label: "Llama 3.1 8B Instant", provider: "Groq", category: "chat" },
  { id: "chat:gpt-oss-120b", label: "GPT-OSS 120B", provider: "OpenRouter", category: "chat" },
  { id: "chat:kimi-k2-0905", label: "Kimi K2 0905", provider: "OpenRouter", category: "chat" },
  { id: "chat:qwen3-32b", label: "Qwen3-32B", provider: "OpenRouter", category: "chat" },

  { id: "image:imagen-4", label: "Imagen 4", provider: "Vertex", category: "image" },
  { id: "image:gpt-5-image", label: "GPT-5 Image", provider: "OpenRouter", category: "image" },
  { id: "image:nano-banana-2", label: "Nano Banana 2", provider: "Google", category: "image" },
  { id: "image:nano-banana-pro", label: "Nano Banana Pro", provider: "Google", category: "image" },
  { id: "image:nano-banana", label: "Nano Banana", provider: "Google", category: "image" },
  { id: "image:gemini-3-1-pro-preview", label: "Gemini 3.1 Pro Preview", provider: "Google", category: "image" },
  { id: "image:gemini-3-flash", label: "Gemini 3 Flash", provider: "Google", category: "image" },
  { id: "image:gemini-2-5-pro", label: "Gemini 2.5 Pro", provider: "Google", category: "image" },
  { id: "image:gemini-2-5-flash", label: "Gemini 2.5 Flash", provider: "Google", category: "image" },
  { id: "image:claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", category: "image" },
  { id: "image:claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", category: "image" },
  { id: "image:gemini-2-5-pro-vision", label: "Gemini 2.5 Pro Vision", provider: "Vertex", category: "image" },
  { id: "image:gemini-2-5-flash-vision", label: "Gemini 2.5 Flash Vision", provider: "Vertex", category: "image" },
  { id: "image:gemini-3-1-pro-vision", label: "Gemini 3.1 Pro Vision", provider: "Vertex", category: "image" },
  { id: "image:cloud-vision-ocr", label: "Cloud Vision OCR", provider: "Google Cloud", category: "image" },

  { id: "video:veo-3-1-preview", label: "Veo 3.1 Preview", provider: "Vertex", category: "video" },
  { id: "video:veo-3-preview", label: "Veo 3 Preview", provider: "Vertex", category: "video" },
  { id: "video:gemini-2-5-flash-live-preview", label: "Gemini 2.5 Flash Live Preview", provider: "Google", category: "video" },
  { id: "video:gemini-2-5-pro-live", label: "Gemini 2.5 Pro Live", provider: "Vertex", category: "video" },
  { id: "video:gemini-3-flash-live", label: "Gemini 3 Flash Live", provider: "Google", category: "video" },
  { id: "video:gemini-3-1-pro-preview", label: "Gemini 3.1 Pro Preview", provider: "Google", category: "video" },
  { id: "video:gemini-3-flash", label: "Gemini 3 Flash", provider: "Google", category: "video" },
  { id: "video:gemini-2-5-pro", label: "Gemini 2.5 Pro", provider: "Google", category: "video" },
  { id: "video:gemini-2-5-flash", label: "Gemini 2.5 Flash", provider: "Google", category: "video" },
  { id: "video:claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", category: "video" },
  { id: "video:claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", category: "video" },
  { id: "video:cloud-video-intelligence", label: "Cloud Video Intelligence", provider: "Google Cloud", category: "video" },
  { id: "video:gemini-2-5-pro-vision", label: "Gemini 2.5 Pro Vision", provider: "Vertex", category: "video" },
  { id: "video:gemini-3-1-pro-vision", label: "Gemini 3.1 Pro Vision", provider: "Vertex", category: "video" },
  { id: "video:youtube-analysis", label: "YouTube Analysis", provider: "Google Cloud", category: "video" },

  { id: "code:claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", category: "code" },
  { id: "code:claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", category: "code" },
  { id: "code:claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic", category: "code" },
  { id: "code:gemini-3-1-pro-preview", label: "Gemini 3.1 Pro Preview", provider: "Google", category: "code" },
  { id: "code:gemini-2-5-pro", label: "Gemini 2.5 Pro", provider: "Google", category: "code" },
  { id: "code:gemini-3-flash", label: "Gemini 3 Flash", provider: "Google", category: "code" },
  { id: "code:gpt-oss-120b", label: "GPT-OSS 120B", provider: "OpenRouter", category: "code" },
  { id: "code:gpt-oss-20b", label: "GPT-OSS 20B", provider: "OpenRouter", category: "code" },
  { id: "code:qwen3-32b", label: "Qwen3-32B", provider: "OpenRouter", category: "code" },
  { id: "code:kimi-k2-0905", label: "Kimi K2 0905", provider: "OpenRouter", category: "code" },
  { id: "code:llama-4-scout", label: "Llama 4 Scout 17B 16E Instruct", provider: "OpenRouter", category: "code" },
  { id: "code:llama-3-3-70b-versatile", label: "Llama 3.3 70B Versatile", provider: "Groq", category: "code" },
  { id: "code:llama-3-1-8b-instant", label: "Llama 3.1 8B Instant", provider: "Groq", category: "code" },
  { id: "code:ollama-qwen2-5-coder-7b", label: "Ollama Qwen 2.5 Coder 7B", provider: "Ollama", category: "code" },
  { id: "code:claude-sonnet-4", label: "Claude Sonnet 4", provider: "Anthropic", category: "code" },

  { id: "extras:gemini-deep-research-preview", label: "Gemini Deep Research Preview", provider: "Google", category: "extras" },
  { id: "extras:computer-use-preview", label: "Computer Use Preview", provider: "Anthropic", category: "extras" },
  { id: "extras:gemini-embedding-2-preview", label: "Gemini Embedding 2 Preview", provider: "Google", category: "extras" },
  { id: "extras:gemini-embedding", label: "Gemini Embedding", provider: "Google", category: "extras" },
  { id: "extras:gemini-robotics-preview", label: "Gemini Robotics Preview", provider: "Google", category: "extras" },
  { id: "extras:lyria-experimental", label: "Lyria Experimental", provider: "Google", category: "extras" },
  { id: "extras:whisper-large-v3", label: "Whisper Large V3", provider: "Groq", category: "extras" },
  { id: "extras:whisper-large-v3-turbo", label: "Whisper Large V3 Turbo", provider: "Groq", category: "extras" },
  { id: "extras:gemini-2-5-flash-tts-preview", label: "Gemini 2.5 Flash TTS Preview", provider: "Google", category: "extras" },
  { id: "extras:gemini-2-5-pro-tts-preview", label: "Gemini 2.5 Pro TTS Preview", provider: "Google", category: "extras" },
  { id: "extras:canopy-orpheus-english", label: "Canopy Orpheus V1 English", provider: "OpenRouter", category: "extras" },
  { id: "extras:canopy-orpheus-arabic-saudi", label: "Canopy Orpheus Arabic Saudi", provider: "OpenRouter", category: "extras" },
  { id: "extras:llama-prompt-guard-2-22m", label: "Llama Prompt Guard 2 22M", provider: "OpenRouter", category: "extras" },
  { id: "extras:llama-prompt-guard-2-86m", label: "Llama Prompt Guard 2 86M", provider: "OpenRouter", category: "extras" },
  { id: "extras:gpt-oss-safeguard-20b", label: "GPT-OSS Safeguard 20B", provider: "OpenRouter", category: "extras" },
]

export function getCategoryModels(category: ModelCategoryId) {
  return MODEL_CATALOG.filter(model => model.category === category)
}

export function getTopActiveModelsByCategory(disabledModels: string[], limit = 3) {
  const disabled = new Set(disabledModels)
  return MODEL_CATEGORIES.map(category => {
    const activeModels = getCategoryModels(category.id).filter(model => !disabled.has(model.id))
    return {
      ...category,
      activeCount: activeModels.length,
      models: activeModels.slice(0, limit),
    }
  })
}
