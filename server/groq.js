export async function groqRewriteBlock({ html, instruction, systemHint = "", model = "llama-3.1-8b-instant" }) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error("GROQ_API_KEY is not set")

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

  const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${key}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user }
      ]
    })
  })

  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`Groq error ${resp.status}: ${t}`)
  }

  const data = await resp.json()
  const text = data?.choices?.[0]?.message?.content?.trim?.() || ""

  const usage = data?.usage
    ? {
        input_tokens: Number(data.usage.prompt_tokens || 0),
        output_tokens: Number(data.usage.completion_tokens || 0),
        total_tokens: Number(data.usage.total_tokens || 0)
      }
    : null

  return { html: text, usage }
}
