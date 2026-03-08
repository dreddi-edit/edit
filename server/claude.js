
function extractJsonFromText(text) {
  if (!text) return text;
  const s = String(text).trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const inner = (m ? m[1] : s).trim();
  return inner;
}

function stripJsonFences(input) {
  return String(input || "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}


function safeJsonParse(input) {
  const cleaned = stripJsonFences(input);
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON parse error:", e);
    return null;
  }
}


export async function claudeRewriteBlock({ html, instruction, systemHint = "", model = "claude-sonnet-4-6" }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set")

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

  const resp = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content: user }]
    })
  })

  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`Anthropic error ${resp.status}: ${t}`)
  }

  const data = await resp.json()
  const text = (data?.content || [])
    .map((c) => (c?.type === "text" ? c.text : ""))
    .join("")
    .trim()

  return { html: text, usage: data.usage || null }
}
