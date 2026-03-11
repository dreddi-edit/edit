import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { deductCredits, hasEnoughCredits } from "./credits.js"

const ASSISTANT_MODELS_BY_PLAN = {
  basis: ["claude-haiku-4-5-20251001"],
  starter: ["claude-haiku-4-5-20251001", "gemini-2.5-flash"],
  pro: [
    "claude-haiku-4-5-20251001",
    "gemini-2.5-flash",
    "claude-sonnet-4-6",
    "gemini-2.5-pro",
  ],
  scale: [
    "claude-haiku-4-5-20251001",
    "gemini-2.5-flash",
    "claude-sonnet-4-6",
    "gemini-2.5-pro",
    "groq:llama-3.3-70b-versatile",
  ],
}

function getUserPlan(userId) {
  const row = db.prepare("SELECT plan FROM user_settings WHERE user_id = ?").get(userId)
  return row?.plan || "basis"
}

function estimateTokensFromText(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 4))
}

function normalizeMessages(rawMessages) {
  if (!Array.isArray(rawMessages)) return []
  return rawMessages
    .map((entry) => ({
      role: entry?.role === "assistant" ? "assistant" : "user",
      content: String(entry?.content || "").trim(),
    }))
    .filter((entry) => entry.content)
    .slice(-12)
}

function buildSystemPrompt(context, plan) {
  const surface = String(context?.surface || "dashboard")
  const workspace = String(context?.workspace || "").trim()
  const projectName = String(context?.projectName || "").trim()
  const projectUrl = String(context?.projectUrl || "").trim()
  const platform = String(context?.platform || "").trim()
  const exportMode = String(context?.exportMode || "").trim()
  const selectedBlock = String(context?.selectedBlock || "").trim()
  const warnings = Array.isArray(context?.warnings)
    ? context.warnings.map((warning) => String(warning || "").trim()).filter(Boolean).slice(0, 6)
    : []

  return [
    "You are the built-in Site Editor assistant.",
    "Be practical, concise, and specific to the current app context.",
    "Do not invent capabilities that the software does not visibly have.",
    "If a user asks for a feature that is plan-locked, explain the unlock plan briefly.",
    "The assistant widget itself is plan-limited, but other AI tools in the product may use their own model logic.",
    `Current user plan: ${plan}`,
    `Current surface: ${surface}`,
    workspace ? `Current workspace: ${workspace}` : "",
    projectName ? `Current project: ${projectName}` : "",
    projectUrl ? `Current URL: ${projectUrl}` : "",
    platform ? `Current platform: ${platform}` : "",
    exportMode ? `Current export mode: ${exportMode}` : "",
    selectedBlock ? `Selected block: ${selectedBlock}` : "",
    warnings.length ? `Current warnings: ${warnings.join(" | ")}` : "Current warnings: none",
  ]
    .filter(Boolean)
    .join("\n")
}

async function callAnthropicChat({ model, messages, system }) {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error("ANTHROPIC_API_KEY is not set")

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1200,
      temperature: 0.4,
      system,
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Anthropic error ${response.status}`)
  }

  return {
    provider: "anthropic",
    reply: (data?.content || [])
      .map((chunk) => (chunk?.type === "text" ? chunk.text : ""))
      .join("")
      .trim(),
    usage: data?.usage
      ? {
          input_tokens: Number(data.usage.input_tokens || 0),
          output_tokens: Number(data.usage.output_tokens || 0),
          total_tokens: Number(data.usage.input_tokens || 0) + Number(data.usage.output_tokens || 0),
        }
      : null,
  }
}

async function callGeminiChat({ model, messages, system }) {
  const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
  if (!key) throw new Error("GEMINI_API_KEY not set")

  const parts = []
  if (system) parts.push({ text: system })
  messages.forEach((message) => {
    parts.push({ text: `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}` })
  })

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1200,
        },
      }),
    }
  )

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini error ${response.status}`)
  }

  return {
    provider: "google",
    reply: data?.candidates?.[0]?.content?.parts?.map((part) => part?.text || "").join("").trim() || "",
    usage: data?.usageMetadata
      ? {
          input_tokens: Number(data.usageMetadata.promptTokenCount || 0),
          output_tokens: Number(data.usageMetadata.candidatesTokenCount || 0),
          total_tokens: Number(data.usageMetadata.totalTokenCount || 0),
        }
      : null,
  }
}

async function callGroqChat({ model, messages, system }) {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error("GROQ_API_KEY is not set")

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: model.replace(/^groq:/, ""),
      temperature: 0.4,
      messages: [
        { role: "system", content: system },
        ...messages.map((message) => ({ role: message.role, content: message.content })),
      ],
    }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(data?.error?.message || `Groq error ${response.status}`)
  }

  return {
    provider: "groq",
    reply: data?.choices?.[0]?.message?.content?.trim?.() || "",
    usage: data?.usage
      ? {
          input_tokens: Number(data.usage.prompt_tokens || 0),
          output_tokens: Number(data.usage.completion_tokens || 0),
          total_tokens: Number(data.usage.total_tokens || 0),
        }
      : null,
  }
}

async function runAssistantModel({ model, messages, system }) {
  if (model.startsWith("claude-")) return callAnthropicChat({ model, messages, system })
  if (model.startsWith("gemini-")) return callGeminiChat({ model, messages, system })
  if (model.startsWith("groq:")) return callGroqChat({ model, messages, system })
  throw new Error("Unsupported assistant model")
}

export function registerAssistantRoutes(app, { aiRateLimit }) {
  app.post("/api/assistant/chat", authMiddleware, aiRateLimit, async (req, res) => {
    try {
      const plan = getUserPlan(req.user.id)
      const messages = normalizeMessages(req.body?.messages)
      const requestedModel = String(req.body?.model || ASSISTANT_MODELS_BY_PLAN[plan][0]).trim()
      const context = req.body?.context && typeof req.body.context === "object" ? req.body.context : {}

      if (!messages.length) {
        return res.status(400).json({ ok: false, error: "Missing messages" })
      }

      if (!ASSISTANT_MODELS_BY_PLAN[plan].includes(requestedModel)) {
        return res.status(403).json({
          ok: false,
          error: `Model not available on ${plan}`,
        })
      }

      const system = buildSystemPrompt(context, plan)
      const tokenInputEstimate = estimateTokensFromText(
        `${system}\n${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}`
      )
      const tokenOutputEstimate = requestedModel === "claude-haiku-4-5-20251001" ? 800 : 1200
      const creditCheck = hasEnoughCredits(req.user.id, requestedModel, tokenInputEstimate, tokenOutputEstimate)
      if (!creditCheck.ok) {
        return res.status(402).json({
          ok: false,
          error: "Nicht genug Credits",
          code: "INSUFFICIENT_CREDITS",
          balance_eur: creditCheck.balance,
          needed_eur: creditCheck.needed,
        })
      }

      const result = await runAssistantModel({
        model: requestedModel,
        messages,
        system,
      })

      const usage = result.usage || {
        input_tokens: tokenInputEstimate,
        output_tokens: Math.min(tokenOutputEstimate, estimateTokensFromText(result.reply)),
        total_tokens: tokenInputEstimate + Math.min(tokenOutputEstimate, estimateTokensFromText(result.reply)),
      }

      let deducted = 0
      if (req.user?.id) {
        deducted = deductCredits(
          req.user.id,
          requestedModel,
          Number(usage.input_tokens || 0),
          Number(usage.output_tokens || 0),
          "Assistant widget"
        )
      }

      res.json({
        ok: true,
        model: requestedModel,
        provider: result.provider,
        reply: result.reply,
        usage,
        cost_eur: deducted,
      })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Assistant request failed" })
    }
  })
}
