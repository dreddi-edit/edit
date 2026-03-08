import { ollamaHealth } from "./ollama.js"

// Kostenschätzung pro Provider (USD per 1M tokens)
const COSTS = {
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "gemini-2.5-flash":  { input: 0.075, output: 0.30 },
  "groq:llama3-70b":   { input: 0.59, output: 0.79 },
}

export function estimateCost(model, inputTokens, outputTokens) {
  const c = COSTS[model] || { input: 3, output: 15 }
  return ((inputTokens / 1_000_000) * c.input) + ((outputTokens / 1_000_000) * c.output)
}

export function estimateTokens(html, instruction) {
  // Grobe Schätzung: 1 Token ≈ 4 Zeichen
  const inputTokens = Math.ceil((html.length + instruction.length) / 4)
  const outputTokens = Math.ceil(html.length / 4) // Output ≈ Input HTML
  return { inputTokens, outputTokens }
}

export async function resolveModel(html, instruction) {
  const prompt = String(instruction || "").toLowerCase()
  const htmlSize = String(html || "").length

  // Ollama-Check immer zuerst
  const health = await ollamaHealth()
  const ollamaAvailable = health.ok && (health.models || []).includes("qwen2.5-coder:7b")

  // Ollama hat ein Limit – zu große Tasks schafft es nicht sauber
  const tooBigForOllama = htmlSize > 40000

  if (ollamaAvailable && !tooBigForOllama) {
    return { model: "ollama:qwen2.5-coder:7b", needsApproval: false, provider: "ollama" }
  }

  // Fallback zu API – welche?
  const isComplex =
    prompt.includes("ganze seite") ||
    prompt.includes("komplette seite") ||
    prompt.includes("landingpage") ||
    prompt.includes("layout") ||
    prompt.includes("hero") ||
    prompt.includes("section") ||
    htmlSize > 35000

  const apiModel = isComplex ? "claude-sonnet-4-6" : "gemini-2.5-flash"
  const { inputTokens, outputTokens } = estimateTokens(html, instruction)
  const estCost = estimateCost(apiModel, inputTokens, outputTokens)

  return {
    model: apiModel,
    needsApproval: true,
    provider: isComplex ? "claude" : "gemini",
    inputTokens,
    outputTokens,
    estCost: estCost.toFixed(4),
    reason: ollamaAvailable ? "HTML zu groß für Ollama" : "Ollama nicht verfügbar"
  }
}
