import { getProviderApiKey } from "./providerKeys.js"

export async function geminiRewriteBlock({ html, instruction, systemHint = "", model = "gemini-2.5-flash", userId = null, apiKey = "" }) {
  const key = String(apiKey || "").trim() || getProviderApiKey("gemini", { userId })
  if (!key) throw new Error("GEMINI_API_KEY is not set")

  const system = [
    "You are an HTML editor.",
    "Return ONLY valid HTML (no markdown, no explanations).",
    "Preserve structure as much as possible.",
    "Do not remove scripts/styles unless asked.",
    systemHint || ""
  ].filter(Boolean).join("\n")

  const user = [
    "INSTRUCTION:",
    instruction || "",
    "",
    "HTML:",
    html || ""
  ].join("\n")

  const resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: user }]
        }
      ],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 1200
      }
    })
  })

  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`Gemini error ${resp.status}: ${t}`)
  }

  const data = await resp.json()
  const text = (((data || {}).candidates || [])[0]?.content?.parts || [])
    .map((p) => p?.text || "")
    .join("")
    .trim()

  const usage = data?.usageMetadata
    ? {
        input_tokens: Number(data.usageMetadata.promptTokenCount || 0),
        output_tokens: Number(data.usageMetadata.candidatesTokenCount || 0),
        total_tokens: Number(data.usageMetadata.totalTokenCount || 0)
      }
    : null

  return { html: text, usage }
}
