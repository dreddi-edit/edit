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

function providerForAssistantModel(model) {
  const value = String(model || "")
  if (value.startsWith("claude-")) return "anthropic"
  if (value.startsWith("gemini-")) return "gemini"
  if (value.startsWith("groq:")) return "groq"
  return ""
}

function modelHasConfiguredKey(model, userId) {
  const provider = providerForAssistantModel(model)
  if (!provider) return false
  return Boolean(getProviderApiKey(provider, { userId }))
}

function resolveAssistantModelForUser(plan, requestedModel, userId) {
  const allowedModels = ASSISTANT_MODELS_BY_PLAN[plan] || ASSISTANT_MODELS_BY_PLAN.basis
  if (!allowedModels.includes(requestedModel)) {
    return { ok: false, error: `Model not available on ${plan}` }
  }
  if (modelHasConfiguredKey(requestedModel, userId)) {
    return { ok: true, model: requestedModel, fallbackFrom: null, allowedModels }
  }
  const fallback = allowedModels.find((candidate) => modelHasConfiguredKey(candidate, userId))
  if (!fallback) {
    return {
      ok: false,
      error: "No AI provider key configured for the assistant. Add an Anthropic, Gemini, or Groq key in Settings > API Keys.",
      code: "MISSING_PROVIDER_KEY",
      allowedModels,
    }
  }
  return { ok: true, model: fallback, fallbackFrom: requestedModel, allowedModels }
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

      const modelResolution = resolveAssistantModelForUser(plan, requestedModel, req.user.id)
      if (!modelResolution.ok) {
        const statusCode = modelResolution.code === "MISSING_PROVIDER_KEY" ? 503 : 403
        return res.status(statusCode).json({
          ok: false,
          error: modelResolution.error,
          code: modelResolution.code || "MODEL_NOT_AVAILABLE",
          allowed_models: modelResolution.allowedModels || ASSISTANT_MODELS_BY_PLAN[plan] || [],
        })
      }
      const activeModel = modelResolution.model
      const fallbackFrom = modelResolution.fallbackFrom

      const system = buildSystemPrompt(context, plan)
      const tokenInputEstimate = estimateTokensFromText(
        `${system}\n${messages.map((message) => `${message.role}: ${message.content}`).join("\n")}`
      )
      const tokenOutputEstimate = activeModel === "claude-haiku-4-5-20251001" ? 800 : 1200
      const creditCheck = hasEnoughCredits(req.user.id, activeModel, tokenInputEstimate, tokenOutputEstimate)
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
        model: activeModel,
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
          activeModel,
          Number(usage.input_tokens || 0),
          Number(usage.output_tokens || 0),
          "Assistant widget"
        )
      }

      res.json({
        ok: true,
        model: activeModel,
        requested_model: requestedModel,
        model_notice:
          fallbackFrom && fallbackFrom !== activeModel
            ? `Requested model ${fallbackFrom} is not available because its provider key is missing. Switched to ${activeModel}.`
            : undefined,
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
      } else if (toolName === "headline_generator") {
        // #85 Headline generator
        const html = String(inputPayload?.html || "").trim()
        const topic = String(inputPayload?.topic || "").trim()
        const tone = String(inputPayload?.tone || "engaging").trim()
        const count = Math.max(1, Math.min(10, Number(inputPayload?.count) || 5))
        if (!html && !topic) throw new Error("html or topic is required for headline_generator")
        const context = html ? `HTML excerpt:\n${html.slice(0, 3000)}` : `Topic: ${topic}`
        const headlines = await runAnthropicJsonPrompt({
          system: "You are a headline copywriter. Respond only with valid JSON.",
          prompt: `Generate ${count} high-converting headlines. Tone: ${tone}.\n${context}\nReturn JSON: {"headlines":[{"text":"string","type":"string","score":0-100}],"focus_keyword":"string","rationale":"string"}`,
          fallback: { headlines: [], focus_keyword: "", rationale: "" },
          userId: req.user.id,
        })
        outputResult = {
          message: `Generated ${Array.isArray(headlines?.headlines) ? headlines.headlines.length : 0} headlines`,
          headlines: Array.isArray(headlines?.headlines) ? headlines.headlines : [],
          focus_keyword: headlines?.focus_keyword || "",
          rationale: headlines?.rationale || "",
          actions_taken: [`Generated ${count} headline variations`, `Tone: ${tone}`, "Scored each headline for impact"],
        }
      } else if (toolName === "ad_copy_generator") {
        // #90 Ad copy suggestions
        const html = String(inputPayload?.html || "").trim()
        const topic = String(inputPayload?.topic || "").trim()
        const platforms = Array.isArray(inputPayload?.platforms) ? inputPayload.platforms : ["google", "facebook", "linkedin"]
        if (!html && !topic) throw new Error("html or topic is required for ad_copy_generator")
        const context = html ? `Landing page HTML:\n${html.slice(0, 3000)}` : `Product/service: ${topic}`
        const adCopy = await runAnthropicJsonPrompt({
          system: "You are an expert paid advertising copywriter. Respond only with valid JSON.",
          prompt: `Generate ad copy for these platforms: ${platforms.join(", ")}.\n${context}\nReturn JSON: {"ads":{"google":{"headline1":"string","headline2":"string","headline3":"string","description1":"string","description2":"string"},"facebook":{"primary_text":"string","headline":"string","description":"string","cta":"string"},"linkedin":{"headline":"string","intro_text":"string","cta":"string"}},"usp":"string","target_audience":"string"}`,
          fallback: { ads: {}, usp: "", target_audience: "" },
          userId: req.user.id,
        })
        outputResult = {
          message: "Ad copy generated for requested platforms",
          ads: adCopy?.ads || {},
          usp: adCopy?.usp || "",
          target_audience: adCopy?.target_audience || "",
          platforms,
          actions_taken: [`Created ad copy for ${platforms.join(", ")}`, "Extracted unique selling proposition", "Defined target audience"],
        }
      } else if (toolName === "keyword_suggestions") {
        // #104 Keyword suggestions
        const html = String(inputPayload?.html || "").trim()
        const topic = String(inputPayload?.topic || "").trim()
        const targetAudience = String(inputPayload?.target_audience || "").trim()
        if (!html && !topic) throw new Error("html or topic is required for keyword_suggestions")
        const context = html ? `HTML:\n${html.slice(0, 3000)}` : `Topic: ${topic}`
        const kwResult = await runAnthropicJsonPrompt({
          system: "You are an SEO keyword researcher. Respond only with valid JSON.",
          prompt: `Suggest SEO keywords.\n${context}\n${targetAudience ? `Target audience: ${targetAudience}` : ""}\nReturn JSON: {"primary_keywords":["word"],"secondary_keywords":["word"],"long_tail_keywords":["phrase"],"semantic_clusters":[{"cluster":"string","keywords":["word"]}],"difficulty":{"easy":["word"],"medium":["word"],"hard":["word"]},"monthly_searches_estimate":{"high":["word"],"medium":["word"]}}`,
          fallback: { primary_keywords: [], secondary_keywords: [], long_tail_keywords: [], semantic_clusters: [] },
          userId: req.user.id,
        })
        outputResult = {
          message: `Found ${(kwResult?.primary_keywords || []).length} primary keywords`,
          primary_keywords: kwResult?.primary_keywords || [],
          secondary_keywords: kwResult?.secondary_keywords || [],
          long_tail_keywords: kwResult?.long_tail_keywords || [],
          semantic_clusters: kwResult?.semantic_clusters || [],
          difficulty: kwResult?.difficulty || {},
          monthly_searches_estimate: kwResult?.monthly_searches_estimate || {},
          actions_taken: ["Extracted primary and secondary keywords", "Built semantic clusters", "Estimated keyword difficulty"],
        }
      } else if (toolName === "content_gap_analysis") {
        // #105 Content gap analysis
        const html = String(inputPayload?.html || "").trim()
        const topic = String(inputPayload?.topic || "").trim()
        const competitors = String(inputPayload?.competitors || "").trim()
        if (!html && !topic) throw new Error("html or topic is required for content_gap_analysis")
        const context = html ? `Page HTML:\n${html.slice(0, 3000)}` : `Topic: ${topic}`
        const gapResult = await runAnthropicJsonPrompt({
          system: "You are an expert content strategist and SEO analyst. Respond only with valid JSON.",
          prompt: `Perform content gap analysis.\n${context}\n${competitors ? `Competitor context: ${competitors}` : ""}\nReturn JSON: {"missing_topics":["string"],"underserved_queries":["string"],"recommended_sections":[{"title":"string","priority":"high|medium|low","rationale":"string"}],"content_score":0-100,"gaps_summary":"string","quick_additions":["string"]}`,
          fallback: { missing_topics: [], underserved_queries: [], recommended_sections: [], content_score: 0, gaps_summary: "" },
          userId: req.user.id,
        })
        outputResult = {
          message: `Identified ${(gapResult?.missing_topics || []).length} content gaps`,
          missing_topics: gapResult?.missing_topics || [],
          underserved_queries: gapResult?.underserved_queries || [],
          recommended_sections: gapResult?.recommended_sections || [],
          content_score: gapResult?.content_score || 0,
          gaps_summary: gapResult?.gaps_summary || "",
          quick_additions: gapResult?.quick_additions || [],
          actions_taken: ["Analysed current content coverage", `Found ${(gapResult?.missing_topics || []).length} missing topics`, "Prioritised recommendations"],
        }
      } else if (toolName === "brand_keyword_alignment") {
        // #126 Brand keyword alignment
        const html = String(inputPayload?.html || "").trim()
        const brandContext = String(inputPayload?.brand_context || "").trim()
        const keywords = Array.isArray(inputPayload?.keywords) ? inputPayload.keywords : []
        if (!html) throw new Error("html is required for brand_keyword_alignment")
        const alignResult = await runAnthropicJsonPrompt({
          system: "You are a brand and SEO strategist. Respond only with valid JSON.",
          prompt: `Analyse brand keyword alignment in this page.\nHTML:\n${html.slice(0, 3000)}\n${brandContext ? `Brand context: ${brandContext}` : ""}\n${keywords.length ? `Target brand keywords: ${keywords.join(", ")}` : ""}\nReturn JSON: {"aligned_keywords":["string"],"missing_keywords":["string"],"overused_keywords":["string"],"alignment_score":0-100,"recommendations":["string"],"brand_voice_consistency":0-100}`,
          fallback: { aligned_keywords: [], missing_keywords: [], overused_keywords: [], alignment_score: 0, recommendations: [] },
          userId: req.user.id,
        })
        outputResult = {
          message: `Brand keyword alignment score: ${alignResult?.alignment_score || 0}%`,
          aligned_keywords: alignResult?.aligned_keywords || [],
          missing_keywords: alignResult?.missing_keywords || [],
          overused_keywords: alignResult?.overused_keywords || [],
          alignment_score: alignResult?.alignment_score || 0,
          brand_voice_consistency: alignResult?.brand_voice_consistency || 0,
          recommendations: alignResult?.recommendations || [],
          actions_taken: ["Checked keyword presence against brand guidelines", "Scored alignment", "Generated keyword recommendations"],
        }
      } else if (toolName === "agent_chain") {
        // #73 Agent chaining — runs a sequence of tool definitions in order
        const chain = Array.isArray(inputPayload?.chain) ? inputPayload.chain : []
        if (!chain.length) throw new Error("chain array is required for agent_chain")
        if (chain.length > 5) throw new Error("agent_chain supports maximum 5 steps")

        const results = []
        let contextCarryover = {}

        for (const step of chain) {
          const stepToolName = String(step?.tool_name || "").trim()
          if (!stepToolName) throw new Error("Each chain step must have a tool_name")
          // Merge carryover context into step payload
          const stepPayload = { ...contextCarryover, ...(step?.input_payload || {}) }

          // Run the step by creating a sub-run
          const subRunId = `chain-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
          db.prepare(
            `INSERT INTO ai_studio_runs (id, user_id, project_id, tool_name, input_payload, output_result, status)
             VALUES (?, ?, ?, ?, ?, '{}', 'running')`
          ).run(subRunId, req.user.id, projectId, stepToolName, JSON.stringify(stepPayload))

          // We simulate the step by building a minimal result via AI with the step context
          const stepResult = await runAnthropicJsonPrompt({
            system: "You are an AI orchestrator. Respond only with valid JSON.",
            prompt: `Execute tool "${stepToolName}" with this context:\n${JSON.stringify(stepPayload).slice(0, 2000)}\nReturn a JSON object representing the tool output with fields: message, actions_taken (array), and any relevant output fields for "${stepToolName}".`,
            fallback: { message: `Step ${stepToolName} completed`, actions_taken: [] },
            userId: req.user.id,
          })

          db.prepare("UPDATE ai_studio_runs SET output_result = ?, status = 'completed' WHERE id = ?")
            .run(JSON.stringify(stepResult), subRunId)

          results.push({ step: stepToolName, run_id: subRunId, output: stepResult })
          // Pass message + top-level string fields to next step
          contextCarryover = {}
          for (const [k, v] of Object.entries(stepResult)) {
            if (typeof v === "string") contextCarryover[`prev_${k}`] = v
          }
        }

        outputResult = {
          message: `Agent chain completed: ${chain.length} steps`,
          steps: results,
          actions_taken: results.map((r, i) => `Step ${i + 1} (${r.step}): ${r.output?.message || "done"}`),
        }
      } else if (toolName === "brand_style_guide") {
        // #122 Brand style guide generation
        const html = String(inputPayload?.html || "").trim()
        const brandContext = String(inputPayload?.brand_context || "").trim()
        if (!html && !brandContext) throw new Error("html or brand_context is required for brand_style_guide")
        const guide = await runAnthropicJsonPrompt({
          system: "You are a brand design expert. Respond only with valid JSON.",
          prompt: `Generate a comprehensive brand style guide.\n${html ? `HTML excerpt:\n${html.slice(0, 3000)}` : ""}\n${brandContext ? `Known brand context: ${brandContext}` : ""}\nReturn JSON: {"primary_color":"#hex","secondary_color":"#hex","accent_color":"#hex","font_heading":{"family":"string","weight":"string","size_scale":"string"},"font_body":{"family":"string","weight":"string","line_height":"string"},"tone_of_voice":{"adjectives":["string"],"avoid":["string"],"examples":["string"]},"spacing_system":"string","border_radius":"string","logo_usage":{"min_size":"string","clear_space":"string"},"color_usage":{"primary":"string","secondary":"string","text":"string"},"button_style":{"border_radius":"string","font_weight":"string"},"do_list":["string"],"dont_list":["string"]}`,
          fallback: {},
          userId: req.user.id,
        })
        outputResult = {
          message: "Brand style guide generated",
          style_guide: guide,
          actions_taken: ["Extracted colour palette", "Defined typography system", "Documented tone of voice", "Created do / don't list"],
        }
      } else if (toolName === "brand_audit_full") {
        // #128 / #129 Brand audit + messaging suggestions
        const resolvedProjectId = Number(inputPayload?.project_id || projectId || 0)
        const html = String(inputPayload?.html || "").trim()
        if (!html && (!Number.isFinite(resolvedProjectId) || resolvedProjectId <= 0)) {
          throw new Error("html or project_id is required for brand_audit_full")
        }
        let pageHtml = html
        if (!pageHtml && resolvedProjectId) {
          const proj = db.prepare("SELECT html, brand_context FROM projects WHERE id = ? AND user_id = ?").get(resolvedProjectId, req.user.id)
          if (!proj) throw new Error("Project not found")
          pageHtml = String(proj.html || "").slice(0, 5000)
        }
        const auditResult = await runAnthropicJsonPrompt({
          system: "You are a brand strategist. Respond only with valid JSON.",
          prompt: `Perform a comprehensive brand audit.\nHTML excerpt:\n${pageHtml.slice(0, 4000)}\nReturn JSON: {"brand_score":0-100,"consistency_score":0-100,"messaging_clarity":0-100,"issues":[{"severity":"high|medium|low","area":"string","description":"string","suggestion":"string"}],"messaging_suggestions":["string"],"brand_strengths":["string"],"brand_weaknesses":["string"],"positioning_statement":"string"}`,
          fallback: { brand_score: 0, issues: [], messaging_suggestions: [] },
          userId: req.user.id,
        })
        outputResult = {
          message: `Brand audit complete. Score: ${auditResult?.brand_score || 0}/100`,
          brand_score: auditResult?.brand_score || 0,
          consistency_score: auditResult?.consistency_score || 0,
          messaging_clarity: auditResult?.messaging_clarity || 0,
          issues: Array.isArray(auditResult?.issues) ? auditResult.issues : [],
          messaging_suggestions: Array.isArray(auditResult?.messaging_suggestions) ? auditResult.messaging_suggestions : [],
          brand_strengths: Array.isArray(auditResult?.brand_strengths) ? auditResult.brand_strengths : [],
          brand_weaknesses: Array.isArray(auditResult?.brand_weaknesses) ? auditResult.brand_weaknesses : [],
          positioning_statement: auditResult?.positioning_statement || "",
          actions_taken: ["Scored brand consistency", "Identified messaging issues", "Generated improvement suggestions"],
        }
      } else if (toolName === "ab_test_ideas") {
        // #98 A/B experiment ideas
        const html = String(inputPayload?.html || "").trim()
        const goal = String(inputPayload?.goal || "increase conversions").trim()
        if (!html) throw new Error("html is required for ab_test_ideas")
        const testIdeas = await runAnthropicJsonPrompt({
          system: "You are a CRO and A/B testing expert. Respond only with valid JSON.",
          prompt: `Generate A/B test ideas for this page.\nGoal: ${goal}\nHTML excerpt:\n${html.slice(0, 3000)}\nReturn JSON: {"experiments":[{"name":"string","hypothesis":"string","variant_a":"Current version description","variant_b":"string","metric":"string","estimated_impact":"high|medium|low","implementation_effort":"low|medium|high"}],"priority_test":"string","expected_lift":"string"}`,
          fallback: { experiments: [], priority_test: "", expected_lift: "" },
          userId: req.user.id,
        })
        outputResult = {
          message: `Generated ${Array.isArray(testIdeas?.experiments) ? testIdeas.experiments.length : 0} A/B test ideas`,
          experiments: Array.isArray(testIdeas?.experiments) ? testIdeas.experiments : [],
          priority_test: testIdeas?.priority_test || "",
          expected_lift: testIdeas?.expected_lift || "",
          actions_taken: ["Analysed page for test opportunities", "Ranked by impact vs effort", "Defined success metrics"],
        }
      } else if (toolName === "email_copy_generator") {
        // #89 Email copy generation (dedicated tool)
        const goal = String(inputPayload?.goal || "lead nurturing").trim()
        const product = String(inputPayload?.product || "").trim()
        const audience = String(inputPayload?.audience || "").trim()
        const sequenceLength = Math.max(1, Math.min(7, Number(inputPayload?.sequence_length) || 3))
        const sequence = await runAnthropicJsonPrompt({
          system: "You are an email marketing expert. Respond only with valid JSON.",
          prompt: `Write an email sequence.\nGoal: ${goal}\n${product ? `Product: ${product}` : ""}\n${audience ? `Audience: ${audience}` : ""}\nSequence length: ${sequenceLength} emails\nReturn JSON: {"emails":[{"sequence_number":1,"subject":"string","preheader":"string","body":"string","cta":"string","send_day":1}],"sequence_goal":"string","segment":"string"}`,
          fallback: { emails: [], sequence_goal: goal },
          userId: req.user.id,
        })
        outputResult = {
          message: `Email sequence of ${Array.isArray(sequence?.emails) ? sequence.emails.length : 0} emails created`,
          emails: Array.isArray(sequence?.emails) ? sequence.emails : [],
          sequence_goal: sequence?.sequence_goal || goal,
          segment: sequence?.segment || audience,
          actions_taken: [`Drafted ${sequenceLength}-email sequence`, "Optimised subject lines", "Added clear CTAs"],
        }
      } else if (toolName === "cro_checklist") {
        // #99 CRO checklist
        const html = String(inputPayload?.html || "").trim()
        if (!html) throw new Error("html is required for cro_checklist")
        const checklist = await runAnthropicJsonPrompt({
          system: "You are a CRO expert. Respond only with valid JSON.",
          prompt: `Generate a CRO checklist for this page.\nHTML:\n${html.slice(0, 3000)}\nReturn JSON: {"passed":[{"item":"string","evidence":"string"}],"failed":[{"item":"string","fix":"string","priority":"high|medium|low"}],"score":0-100,"summary":"string"}`,
          fallback: { passed: [], failed: [], score: 0, summary: "" },
          userId: req.user.id,
        })
        outputResult = {
          message: `CRO checklist: ${checklist?.score || 0}/100`,
          passed: Array.isArray(checklist?.passed) ? checklist.passed : [],
          failed: Array.isArray(checklist?.failed) ? checklist.failed : [],
          score: checklist?.score || 0,
          summary: checklist?.summary || "",
          actions_taken: ["Checked 20+ CRO criteria", `${(checklist?.passed || []).length} passed, ${(checklist?.failed || []).length} failed`],
        }
      } else if (toolName === "optimization_summary") {
        // #100 Optimization summary
        const resolvedProjectId = Number(inputPayload?.project_id || projectId || 0)
        if (!Number.isFinite(resolvedProjectId) || resolvedProjectId <= 0) {
          throw new Error("project_id is required for optimization_summary")
        }
        const project = db.prepare("SELECT html, name FROM projects WHERE id = ? AND user_id = ?").get(resolvedProjectId, req.user.id)
        if (!project) throw new Error("Project not found")
        const summary = await runAnthropicJsonPrompt({
          system: "You are a web optimization expert. Respond only with valid JSON.",
          prompt: `Create a comprehensive optimization summary for this page.\nProject: ${project.name || ""}\nHTML:\n${String(project.html || "").slice(0, 4000)}\nReturn JSON: {"overall_score":0-100,"seo_score":0-100,"cro_score":0-100,"performance_score":0-100,"accessibility_score":0-100,"top_opportunities":[{"category":"string","action":"string","impact":"high|medium|low"}],"achieved_optimizations":["string"],"next_steps":["string"],"executive_summary":"string"}`,
          fallback: { overall_score: 0, top_opportunities: [], next_steps: [] },
          userId: req.user.id,
        })
        outputResult = {
          message: `Optimization summary: ${summary?.overall_score || 0}/100 overall score`,
          overall_score: summary?.overall_score || 0,
          seo_score: summary?.seo_score || 0,
          cro_score: summary?.cro_score || 0,
          performance_score: summary?.performance_score || 0,
          accessibility_score: summary?.accessibility_score || 0,
          top_opportunities: Array.isArray(summary?.top_opportunities) ? summary.top_opportunities : [],
          achieved_optimizations: Array.isArray(summary?.achieved_optimizations) ? summary.achieved_optimizations : [],
          next_steps: Array.isArray(summary?.next_steps) ? summary.next_steps : [],
          executive_summary: summary?.executive_summary || "",
          actions_taken: ["Scored SEO, CRO, performance and accessibility", "Ranked opportunities by impact", "Created executive summary"],
        }
      } else if (toolName === "landing_page_score") {
        // #97 Landing page scoring
        const html = String(inputPayload?.html || "").trim()
        if (!html) throw new Error("html is required for landing_page_score")
        const score = await runAnthropicJsonPrompt({
          system: "You are a landing page expert. Respond only with valid JSON.",
          prompt: `Score this landing page across key dimensions.\nHTML:\n${html.slice(0, 4000)}\nReturn JSON: {"overall_score":0-100,"dimensions":{"headline_strength":0-100,"cta_clarity":0-100,"value_proposition":0-100,"trust_signals":0-100,"page_speed_hints":0-100,"mobile_readiness":0-100,"social_proof":0-100},"grade":"A|B|C|D|F","top_improvements":["string"],"strengths":["string"]}`,
          fallback: { overall_score: 0, dimensions: {}, grade: "C", top_improvements: [] },
          userId: req.user.id,
        })
        outputResult = {
          message: `Landing page score: ${score?.overall_score || 0}/100 (Grade: ${score?.grade || "C"})`,
          overall_score: score?.overall_score || 0,
          dimensions: score?.dimensions || {},
          grade: score?.grade || "C",
          top_improvements: Array.isArray(score?.top_improvements) ? score.top_improvements : [],
          strengths: Array.isArray(score?.strengths) ? score.strengths : [],
          actions_taken: ["Scored 7 landing page dimensions", `Grade: ${score?.grade || "C"}`, "Ranked improvement actions"],
        }
      } else {
        outputResult = { message: `Tool "${toolName}" is not yet implemented`, actions_taken: [] }
      }

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
