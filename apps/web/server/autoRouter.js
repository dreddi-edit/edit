import { ollamaHealth } from "./ollama.js"

const COSTS = {
  "claude-sonnet-4-6": { input: 3.6, output: 18 },
  "claude-sonnet-4-5-20250929": { input: 3.6, output: 18 },
  "claude-haiku-4-5-20251001": { input: 0.3, output: 1.5 },
  "gemini-2.5-flash": { input: 0.09, output: 0.36 },
  "gemini-2.5-flash-lite": { input: 0.06, output: 0.24 },
  "gemini-2.5-pro": { input: 1.44, output: 4.32 },
  "groq:llama-3.1-8b-instant": { input: 0.12, output: 0.24 },
  "groq:llama-3.3-70b-versatile": { input: 0.9, output: 1.8 },
  "ollama:qwen2.5-coder:7b": { input: 0, output: 0 },
}

export function estimateCost(model, inputTokens, outputTokens) {
  const c = COSTS[model] || COSTS["claude-sonnet-4-6"]
  const raw = ((inputTokens / 1_000_000) * c.input) + ((outputTokens / 1_000_000) * c.output)
  if (raw <= 0) return 0
  return Math.max(0.01, raw)
}

export function estimateTokens(html, instruction) {
  const h = String(html || "")
  const i = String(instruction || "")
  const inputTokens = Math.max(120, Math.ceil((h.length + i.length + 400) / 4))
  const outputTokens = Math.max(120, Math.ceil(h.length / 5))
  return { inputTokens, outputTokens }
}

function classifyTask(html, instruction) {
  const prompt = String(instruction || "").toLowerCase()
  const htmlSize = String(html || "").length

  const veryComplex =
    htmlSize > 60000 ||
    /komplette seite|ganze seite|full page|landingpage|hero section|pricing section|faq section|rebuild|restruktur|komplett umbauen/.test(prompt)

  const mediumComplex =
    htmlSize > 18000 ||
    /layout|section|columns|column|grid|navbar|navigation|header|footer|hero|cta|testimonial|pricing|faq/.test(prompt)

  const tinyEdit =
    htmlSize < 6000 &&
    /text|copy|headline|heading|button|cta|label|link|farbe|color|spacing|padding|margin|font/.test(prompt)

  return { htmlSize, veryComplex, mediumComplex, tinyEdit }
}

export async function resolveModel(html, instruction) {
  const { inputTokens, outputTokens } = estimateTokens(html, instruction)
  const task = classifyTask(html, instruction)

  const health = await ollamaHealth()
  const models = Array.isArray(health?.models) ? health.models : []
  const ollamaAvailable = health.ok && models.some((m) => String(m).includes("qwen2.5-coder:7b"))

  if (ollamaAvailable && !task.veryComplex && task.htmlSize <= 40000) {
    return {
      model: "ollama:qwen2.5-coder:7b",
      needsApproval: false,
      provider: "ollama",
      inputTokens,
      outputTokens,
      estCost: 0,
      reason: "Local Ollama available"
    }
  }

  let model = "gemini-2.5-flash-lite"
  let provider = "gemini"

  if (task.veryComplex) {
    model = "claude-sonnet-4-6"
    provider = "claude"
  } else if (task.mediumComplex) {
    model = "gemini-2.5-flash"
    provider = "gemini"
  } else if (task.tinyEdit) {
    model = "gemini-2.5-flash-lite"
    provider = "gemini"
  } else {
    model = "claude-haiku-4-5-20251001"
    provider = "claude"
  }

  const estCost = estimateCost(model, inputTokens, outputTokens)

  return {
    model,
    needsApproval: true,
    provider,
    inputTokens,
    outputTokens,
    estCost: Number(estCost.toFixed(4)),
    reason: ollamaAvailable ? "Task too large/complex for Ollama" : "No local Ollama available"
  }
}
