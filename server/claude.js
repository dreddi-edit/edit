
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


export async function claudeGenerateLandingCopy({ name, description = "", audience = "", language = "english", model = "claude-sonnet-4-6" }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set")

  const system = [
    "You are an elite SaaS copywriter and product marketer.",
    "Write premium, high-conversion landing page copy.",
    "Improve weak wording aggressively.",
    "Do not repeat the raw input verbatim unless it is already excellent.",
    "Return ONLY raw JSON. No markdown. No backticks.",
    "Keep the tone premium, modern, credible and conversion-focused.",
    "The language must exactly match the requested language.",
    'Return this exact JSON schema:',
    '{"badge":"","headline":"","subheadline":"","stat1":"","stat1Label":"","stat2":"","stat2Label":"","stat3":"","stat3Label":"","featuresTitle":"","featuresText":"","feature1Title":"","feature1Text":"","feature2Title":"","feature2Text":"","feature3Title":"","feature3Text":"","productTitle":"","productText":"","bullet1Title":"","bullet1Text":"","bullet2Title":"","bullet2Text":"","bullet3Title":"","bullet3Text":"","useTitle":"","use1Title":"","use1Text":"","use2Title":"","use2Text":"","use3Title":"","use3Text":"","pricingTitle":"","pricingText":"","priceNote1":"","priceNote2":"","priceNote3":"","ctaTitle":"","ctaText":"","ctaPrimary":"","ctaSecondary":"","navFeatures":"","navProduct":"","navUseCases":"","navPricing":"","startTrial":"","seeProduct":"","pricingStarter":"","pricingPro":"","pricingScale":"","footer":""}'
  ].join("\n")

  const user = [
    `Language: ${language}`,
    `Product name: ${name || ""}`,
    `Description: ${description || ""}`,
    `Target audience: ${audience || ""}`,
    "",
    "Requirements:",
    "- Make the copy significantly better than the raw input.",
    "- The headline must feel premium and polished.",
    "- The subheadline must clearly explain the value proposition.",
    "- Feature titles should be concise and strong.",
    "- Feature texts should sound useful and believable.",
    "- Pricing text should sound like a real SaaS landing page.",
    "- CTA text should feel persuasive.",
    "- Avoid buzzword spam and obvious filler.",
    "- Output JSON only."
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
      max_tokens: 1800,
      temperature: 0.7,
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

  const parsed = safeJsonParse(extractJsonFromText(text))
  if (!parsed) {
    throw new Error("Claude landing copy parse failed")
  }

  return { copy: parsed, usage: data.usage || null }
}

export async function claudeGenerateLandingHtml({ name, description = "", audience = "", language = "english", model = "claude-sonnet-4-6" }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set")

  const system = [
    "You are an elite startup designer, frontend engineer and SaaS copywriter.",
    "Return ONLY a complete production-looking HTML document.",
    "No markdown. No backticks. No explanations.",
    "The output must be one single self-contained HTML file with embedded CSS and minimal embedded JavaScript.",
    "The page must look like a premium real startup website, not a toy template.",
    "Use a dark modern aesthetic inspired by Linear, Stripe and Framer.",
    "Include strong hierarchy, premium spacing, gradients, glassmorphism, believable marketing copy and polished sections.",
    "Include multiple visually rich sections, not just text blocks.",
    "Include inline SVG charts, dashboard mockups, metric cards, trust/logo strip, pricing cards, FAQ accordion, CTA section, footer and hoverable buttons.",
    "Buttons should feel reactive with hover states.",
    "Use realistic product marketing wording in the requested language.",
    "Do not use placeholder lorem ipsum.",
    "Do not mention that the page was AI-generated.",
    "Do not output JSON."
  ].join("\n")

  const user = [
    `Language: ${language}`,
    `Product name: ${name || ""}`,
    `Description: ${description || ""}`,
    `Target audience: ${audience || ""}`,
    "",
    "Build a visually impressive full landing page that feels like a finished premium SaaS website.",
    "Requirements:",
    "- Full HTML document only",
    "- Embedded CSS only",
    "- Minimal embedded JS only if useful for interactions like FAQ or tabs",
    "- Include a very strong hero section",
    "- Include product visual/dashboard mockup",
    "- Include inline SVG charts/diagrams",
    "- Include at least 3 premium feature cards",
    "- Include a metrics/stats section",
    "- Include use cases section",
    "- Include pricing section",
    "- Include FAQ accordion",
    "- Include final CTA section",
    "- Make it look presentation-ready and impressive",
    "- Improve the raw input aggressively into strong marketing copy",
    "- Output HTML only"
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
      max_tokens: 8000,
      temperature: 0.8,
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
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
  const isComplete = text.includes("</html>") || text.includes("</body>")
  if (!isComplete) {
    console.error("Claude HTML truncated, length:", text.length)
    throw new Error("Generated HTML was truncated. Please try again.")
  }
  return { html: text, usage: data.usage || null }

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
