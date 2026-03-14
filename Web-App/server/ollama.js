const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434"

export async function ollamaHealth() {
  try {
    const resp = await fetch(`${OLLAMA_URL}/api/tags`, {
      method: "GET",
      headers: { "content-type": "application/json" }
    })
    if (!resp.ok) return { ok: false, models: [] }
    const data = await resp.json()
    const models = Array.isArray(data?.models) ? data.models.map((m) => String(m?.name || "")).filter(Boolean) : []
    return { ok: true, models }
  } catch {
    return { ok: false, models: [] }
  }
}

export async function ollamaRewriteBlock({ html, instruction, systemHint = "", model = "qwen2.5-coder:7b" }) {
  const system = [
    "You are an HTML editor.",
    "Return ONLY valid HTML (no markdown, no explanations).",
    "Preserve structure as much as possible.",
    "Do not remove scripts/styles unless asked.",
    systemHint || ""
  ].filter(Boolean).join("\n")

  const prompt = [
    system,
    "",
    "INSTRUCTION:",
    instruction || "",
    "",
    "HTML:",
    html || ""
  ].join("\n")

  const resp = await fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      prompt,
      stream: false
    })
  })

  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`Ollama error ${resp.status}: ${t}`)
  }

  const data = await resp.json()
  let text = String(data?.response || "").trim()
  text = text
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  const usage = data?.prompt_eval_count != null || data?.eval_count != null
    ? {
        input_tokens: Number(data?.prompt_eval_count || 0),
        output_tokens: Number(data?.eval_count || 0),
        total_tokens: Number((data?.prompt_eval_count || 0) + (data?.eval_count || 0))
      }
    : null

  return { html: text, usage }
}
