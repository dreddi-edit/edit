import db from "./db.js"
import { authMiddleware } from "./auth.js"
import { deductCredits, hasEnoughCredits } from "./credits.js"
import { getProviderApiKey } from "./providerKeys.js"

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
  const row = db.prepare(`
    SELECT COALESCE(NULLIF(u.plan_id, ''), s.plan, 'basis') AS plan
    FROM users u
    LEFT JOIN user_settings s ON s.user_id = u.id
    WHERE u.id = ?
  `).get(userId)
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

function stripJsonFences(value) {
  const text = String(value || "").trim()
  if (!text) return text
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return (fenced ? fenced[1] : text).trim()
}

function parseLooseJson(value, fallback) {
  try {
    return JSON.parse(stripJsonFences(value))
  } catch {
    return fallback
  }
}

function parseStudioRunRow(row) {
  if (!row) return row
  return {
    ...row,
    input_payload: parseLooseJson(row.input_payload, {}),
    output_result: parseLooseJson(row.output_result, {}),
  }
}

async function runAnthropicJsonPrompt({ prompt, system, fallback, userId = null }) {
  const result = await callAnthropicChat({
    model: "claude-haiku-4-5-20251001",
    messages: [{ role: "user", content: prompt }],
    system,
    userId,
  })
  return parseLooseJson(result.reply, fallback)
}

function buildSystemPrompt(context, plan) {
  const surface = String(context?.surface || "dashboard")
  const workspace = String(context?.workspace || "").trim()
  const projectName = String(context?.projectName || "").trim()
  const projectUrl = String(context?.projectUrl || "").trim()
  const platform = String(context?.platform || "").trim()
  const exportMode = String(context?.exportMode || "").trim()
  const brandContext = String(context?.brandContext || "").trim()
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
    brandContext ? `Brand context: ${brandContext}` : "",
    selectedBlock ? `Selected block: ${selectedBlock}` : "",
    warnings.length ? `Current warnings: ${warnings.join(" | ")}` : "Current warnings: none",
  ]
    .filter(Boolean)
    .join("\n")
}

async function callAnthropicChat({ model, messages, system, userId = null, apiKey = "" }) {
  const key = cleanKey(apiKey) || getProviderApiKey("anthropic", { userId })
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

async function callGeminiChat({ model, messages, system, userId = null, apiKey = "" }) {
  const key = cleanKey(apiKey) || getProviderApiKey("gemini", { userId })
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

async function callGroqChat({ model, messages, system, userId = null, apiKey = "" }) {
  const key = cleanKey(apiKey) || getProviderApiKey("groq", { userId })
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

function cleanKey(value) {
  return String(value || "").trim()
}

async function runAssistantModel({ model, messages, system, userId = null }) {
  if (model.startsWith("claude-")) return callAnthropicChat({ model, messages, system, userId })
  if (model.startsWith("gemini-")) return callGeminiChat({ model, messages, system, userId })
  if (model.startsWith("groq:")) return callGroqChat({ model, messages, system, userId })
  throw new Error("Unsupported assistant model")
}

export function registerAssistantRoutes(app, { aiRateLimit }) {
  app.post("/api/assistant/chat", authMiddleware, aiRateLimit, async (req, res) => {
    try {
      const plan = getUserPlan(req.user.id)
      const messages = normalizeMessages(req.body?.messages)
      const requestedModel = String(req.body?.model || ASSISTANT_MODELS_BY_PLAN[plan][0]).trim()
      const context = req.body?.context && typeof req.body.context === "object" ? req.body.context : {}

      if (context?.projectId) {
        const projectId = Number(context.projectId)
        if (Number.isFinite(projectId) && projectId > 0) {
          const project = db.prepare("SELECT brand_context FROM projects WHERE id = ? AND user_id = ?").get(projectId, req.user.id)
          if (project?.brand_context && project.brand_context !== "{}") {
            context.brandContext = project.brand_context
          }
        }
      }

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
        userId: req.user.id,
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

  app.get("/api/studio/runs", authMiddleware, (req, res) => {
    try {
      const rows = db.prepare(
        `SELECT id, tool_name, project_id, status, created_at, input_payload, output_result
         FROM ai_studio_runs
         WHERE user_id = ?
         ORDER BY datetime(created_at) DESC, id DESC
         LIMIT 50`
      ).all(req.user.id)
      res.json({ ok: true, runs: rows.map(parseStudioRunRow) })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to load runs" })
    }
  })

  app.get("/api/studio/runs/:runId", authMiddleware, (req, res) => {
    try {
      const row = db.prepare("SELECT * FROM ai_studio_runs WHERE id = ? AND user_id = ?").get(req.params.runId, req.user.id)
      if (!row) return res.status(404).json({ ok: false, error: "Run not found" })
      res.json({ ok: true, run: parseStudioRunRow(row) })
    } catch (error) {
      res.status(500).json({ ok: false, error: error?.message || "Failed to load run" })
    }
  })

  app.post("/api/studio/runs", authMiddleware, aiRateLimit, async (req, res) => {
    const toolName = String(req.body?.tool_name || "").trim()
    const inputPayload = req.body?.input_payload && typeof req.body.input_payload === "object" ? req.body.input_payload : {}
    const projectId = req.body?.project_id == null || req.body?.project_id === ""
      ? null
      : String(req.body.project_id)

    if (!toolName) {
      return res.status(400).json({ ok: false, error: "tool_name is required" })
    }

    const runId = `run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
    db.prepare(
      `INSERT INTO ai_studio_runs (id, user_id, project_id, tool_name, input_payload, output_result, status)
       VALUES (?, ?, ?, ?, ?, '{}', 'running')`
    ).run(runId, req.user.id, projectId, toolName, JSON.stringify(inputPayload))

    try {
      let outputResult = {}

      if (toolName === "company_in_a_box") {
        const brief = String(inputPayload?.brief || "").trim()
        if (!brief) throw new Error("brief is required for company_in_a_box")

        const brandKit = await runAnthropicJsonPrompt({
          system: "You are a brand designer. Respond only with valid JSON.",
          prompt: `Generate a JSON brand kit for this company brief: "${brief}". Return {"primary_color":"#hex","secondary_color":"#hex","font_heading":"Font Name","font_body":"Font Name","tone_of_voice":"string"}.`,
          fallback: {},
          userId: req.user.id,
        })
        let sitemap = await runAnthropicJsonPrompt({
          system: "You are a web architect. Respond only with a valid JSON array.",
          prompt: `Generate a 4-page sitemap for this company brief: "${brief}". Return a JSON array of page name strings.`,
          fallback: ["Home", "About", "Services", "Contact"],
          userId: req.user.id,
        })
        if (!Array.isArray(sitemap) || !sitemap.length) {
          sitemap = ["Home", "About", "Services", "Contact"]
        }

        outputResult = {
          message: "Brand kit and sitemap generated successfully",
          brand_kit: brandKit,
          sitemap,
          actions_taken: [
            "Generated colour palette and typography pair",
            `Drafted ${sitemap.length}-page sitemap`,
            "Prepared reusable brand context for future assistant prompts",
          ],
        }
      } else if (toolName === "cro_agent") {
        const resolvedProjectId = Number(inputPayload?.project_id || projectId || 0)
        if (!Number.isFinite(resolvedProjectId) || resolvedProjectId <= 0) {
          throw new Error("project_id is required for cro_agent")
        }
        const project = db.prepare("SELECT html FROM projects WHERE id = ? AND user_id = ?").get(resolvedProjectId, req.user.id)
        if (!project) throw new Error("Project not found")
        const htmlSnippet = String(project.html || "").slice(0, 6000)
        const cro = await runAnthropicJsonPrompt({
          system: "You are a CRO expert. Respond only with valid JSON.",
          prompt: `Identify exactly 3 conversion opportunities in this page HTML. Return JSON: {"suggestions":[{"block_id":"string","issue":"string","rewritten_html":"string"}]}\n\nHTML:\n${htmlSnippet}`,
          fallback: { suggestions: [] },
          userId: req.user.id,
        })
        outputResult = {
          message: "CRO analysis complete",
          suggestions: Array.isArray(cro?.suggestions) ? cro.suggestions : [],
          actions_taken: [
            `Analysed page HTML (${htmlSnippet.length} chars)`,
            `Identified ${Array.isArray(cro?.suggestions) ? cro.suggestions.length : 0} CRO opportunities`,
          ],
        }
      } else if (toolName === "funnel_generator") {
        const goal = String(inputPayload?.goal || "lead generation").trim()
        const funnel = await runAnthropicJsonPrompt({
          system: "You are a conversion funnel designer. Respond only with valid JSON.",
          prompt: `Design a 3-step funnel for the goal "${goal}". Return JSON: {"pages":[{"name":"Landing Page","purpose":"string"},{"name":"Form / Checkout","purpose":"string"},{"name":"Thank You","purpose":"string"}],"email_sequence":[{"subject":"string","body_preview":"string"},{"subject":"string","body_preview":"string"},{"subject":"string","body_preview":"string"}]}`,
          fallback: { pages: [], email_sequence: [] },
          userId: req.user.id,
        })
        outputResult = {
          message: "Funnel generated successfully",
          pages: Array.isArray(funnel?.pages) ? funnel.pages : [],
          email_sequence: Array.isArray(funnel?.email_sequence) ? funnel.email_sequence : [],
          actions_taken: [
            `Generated ${Array.isArray(funnel?.pages) ? funnel.pages.length : 0}-page funnel structure`,
            `Drafted ${Array.isArray(funnel?.email_sequence) ? funnel.email_sequence.length : 0}-email follow-up sequence`,
          ],
        }
      } else if (toolName === "brand_brain") {
        const html = String(inputPayload?.html || "").trim()
        if (!html) throw new Error("html is required for brand_brain")
        const brandContext = await runAnthropicJsonPrompt({
          system: "You are a brand analyst. Respond only with valid JSON.",
          prompt: `Extract brand context from this HTML. Return JSON: {"primary_color":"#hex or null","secondary_color":"#hex or null","font_families":["string"],"logo_url":"string or null","tone_summary":"string"}\n\nHTML (first 4000 chars):\n${html.slice(0, 4000)}`,
          fallback: {},
          userId: req.user.id,
        })
        if (projectId) {
          db.prepare("UPDATE projects SET brand_context = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?")
            .run(JSON.stringify(brandContext), Number(projectId), req.user.id)
        }
        outputResult = {
          message: "Brand context extracted and saved",
          brand_context: brandContext,
          actions_taken: [
            "Extracted primary and secondary colours",
            "Detected font families and tone summary",
            "Saved brand context to the project for assistant prompt injection",
          ],
        }
      } else {
        outputResult = { message: `Tool "${toolName}" is not yet implemented`, actions_taken: [] }
      }

      db.prepare("UPDATE ai_studio_runs SET output_result = ?, status = 'completed' WHERE id = ?")
        .run(JSON.stringify(outputResult), runId)

      res.json({
        ok: true,
        run: {
          id: runId,
          tool_name: toolName,
          project_id: projectId,
          input_payload: inputPayload,
          output_result: outputResult,
          status: "completed",
        },
      })
    } catch (error) {
      db.prepare("UPDATE ai_studio_runs SET output_result = ?, status = 'failed' WHERE id = ?")
        .run(JSON.stringify({ error: error?.message || "Unknown error" }), runId)
      res.status(500).json({ ok: false, error: error?.message || "Studio run failed" })
    }
  })
}
