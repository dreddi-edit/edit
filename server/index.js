

// --- Export transforms (mode-aware) ---
function decodeAssetProxyEverywhere(input){
  let out = String(input || "");
  // Replace any occurrence of /asset?url=<ENC> with decoded REAL url (best-effort)
  out = out.replace(/\/asset\?url=([^&"' )>]+)/g, (m, enc) => {
    try { return decodeURIComponent(enc); } catch { return m; }
  });
  // HTML entities sometimes appear
  out = out.replace(/&amp;/g, "&");
  return out;
}

function transformExportHtml(html, mode){
  // mode:
  // - "wp-placeholder": blob/src empty -> placeholder
  // - "html-clean": only remove /asset proxy
  // - "html-raw": return raw html unchanged
  const raw = String(html || "");
  if (mode === "html-raw") return raw;

  let out = decodeAssetProxyEverywhere(raw);

  if (mode === "wp-placeholder") {
    // blob: images cannot be exported reliably -> placeholders
    out = out.replace(/<img\b([^>]*?)\bsrc=("|\')([^"\']*)\2([^>]*?)>/gi, (m, pre, q, src, post) => {
      const s0 = String(src || "").trim();
      if (s0.startsWith("blob:") || s0 === "") {
        let attrs = (pre + " " + post).replace(/\s+/g, " ").trim();

        // remove existing src/srcset
        attrs = attrs.replace(/\s+\bsrcset=("|\')[^"\']*\1/gi, "");
        attrs = attrs.replace(/\s+\bsrc=("|\')[^"\']*\1/gi, "");

        if (!/\balt=("|\')/i.test(attrs)) {
          attrs += ' alt="PLACEHOLDER: replace image in WordPress"';
        }
        if (!/\bdata-bo-placeholder=/i.test(attrs)) {
          attrs += ' data-bo-placeholder="1"';
        }
        return `<img ${attrs} src="" />`;
      }
      return m;
    });
  }

  return out;
}

import 'dotenv/config';
import { rewriteHtmlAssets, rewriteCssUrls } from './rewriteAssets.js';
import express from "express"
import cookieParser from "cookie-parser"
import { registerAuthRoutes } from "./auth.js"
import { registerCreditRoutes, getBalance, deductCredits } from "./credits.js"
import { registerSettingsRoutes } from "./settings.js"
import { registerOrgRoutes } from "./organisations.js"
import { registerStripeRoutes } from "./stripe.js"
import { registerScreenshotRoutes } from "./screenshot.js"
import { registerProjectRoutes } from "./projects.js"
import cors from "cors"
import { proxy, asset } from "./proxy.js"
import { claudeRewriteBlock } from "./claude.js"
import { geminiRewriteBlock } from "./gemini.js"
import { parseInstruction } from "./aiNavigator.js"
import { groqRewriteBlock } from "./groq.js"
import { ollamaRewriteBlock, ollamaHealth } from "./ollama.js"
import { resolveModel } from "./autoRouter.js"
import archiver from "archiver"

function extractJsonFromText(text) {
  if (!text) return text;
  const s = String(text).trim();
  const m = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const inner = (m ? m[1] : s).trim();
  return inner;
}

function stripJsonFences(txt) {
  if (!txt) return txt;
  let t = String(txt).trim();
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "");
    t = t.replace(/\s*```$/i, "");
  }
  const objStart = t.indexOf("{");
  const arrStart = t.indexOf("[");
  let start = -1;
  if (objStart !== -1 && arrStart !== -1) start = Math.min(objStart, arrStart);
  else if (objStart !== -1) start = objStart;
  else if (arrStart !== -1) start = arrStart;
  if (start > 0) t = t.slice(start);
  const lastObj = t.lastIndexOf("}");
  const lastArr = t.lastIndexOf("]");
  let end = -1;
  if (lastObj !== -1 && lastArr !== -1) end = Math.max(lastObj, lastArr);
  else if (lastObj !== -1) end = lastObj;
  else if (lastArr !== -1) end = lastArr;
  if (end !== -1) t = t.slice(0, end + 1);
  return t.trim();
}

function localRebuild(html) {
  let out = String(html || "");
  const blocks = [];
  let i = 1;

  function inject(tag, type, labelBase) {
    const reTag = new RegExp(`<${tag}(\\s[^>]*?)?>`, "gi");
    out = out.replace(reTag, (m, attrs = "") => {
      if (/data-block-id\s*=\s*["']/.test(m)) return m;
      const id = `block-${i++}`;
      blocks.push({ id, selector: `[data-block-id="${id}"]`, label: labelBase, type, description: "" });
      return `<${tag} data-block-id="${id}"${attrs}>`;
    });
  }

  inject("header", "section", "Header");
  inject("nav", "section", "Nav");
  inject("main", "section", "Main");
  inject("section", "section", "Section");
  inject("article", "section", "Article");
  inject("aside", "section", "Aside");
  inject("footer", "section", "Footer");
  inject("h1", "heading", "H1");
  inject("h2", "heading", "H2");
  inject("h3", "heading", "H3");
  inject("button", "cta", "Button");
  inject("a", "cta", "Link");

  return { rebuiltHtml: out, blocks };
}

const app = express()

app.use(cors({
  origin: ["http://localhost:8787", "http://localhost:8788"],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true
}))

app.use(cookieParser())
app.use(express.json({ limit: '25mb' }))

app.get("/proxy", proxy)
app.get("/asset", asset)

app.post("/api/ai/analyze-and-rebuild", async (req, res) => {
  try {
    const { html } = req.body
    if (!html) {
      return res.status(400).json({ ok: false, error: "Missing html" })
    }

    const cheap = localRebuild(html);
    const useAI = String(req.query.ai || "") === "1";

    // Nur Struktur senden statt volles HTML
    function extractStructure(el, depth) {
      if (!el || depth > 5) return null;
      const tag = (el.tagName || "").toLowerCase();
      if (!tag || ["script","style","noscript","template","svg"].includes(tag)) return null;
      const cls = (el.getAttribute ? el.getAttribute("class") || "" : "").trim().substring(0, 60);
      const bid = el.getAttribute ? el.getAttribute("data-block-id") || "" : "";
      const txt = (el.textContent || "").replace(/\s+/g," ").trim().substring(0, 50);
      const kids = Array.from(el.children||[]).map(c=>extractStructure(c,depth+1)).filter(Boolean).slice(0,6);
      return {tag, cls:cls||undefined, bid:bid||undefined, txt:txt||undefined, kids:kids.length?kids:undefined};
    }
    let structureStr = "{}";
    try {
      const { JSDOM } = await import("jsdom");
      const dom = new JSDOM(html);
      structureStr = JSON.stringify(extractStructure(dom.window.document.body, 0)).substring(0, 5000);
    } catch(e) { structureStr = html.replace(/<[^>]+>/g," ").substring(0,2000); }
    const system = "You are a website block analyzer. Return ONLY raw JSON, no markdown, no backticks. Format: {blocks:[{selector:string,label:string,type:string}]}";
    const user = "Identify main editable blocks. Return JSON only. Structure:\n" + structureStr;


    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 4000,
        temperature: 0.1,
        system,
        messages: [{ role: "user", content: user }]
      })
    })

    if (!resp.ok) {
      const t = await resp.text()
      throw new Error(`Anthropic error ${resp.status}: ${t}`)
    }

    const data = await resp.json()
    const text = (data?.content || []).map((c) => (c?.type === "text" ? c.text : "")).join("").trim()

    try {
      const result = JSON.parse(stripJsonFences(extractJsonFromText(text)))
      console.log("AI rebuild successful, blocks:", result.blocks?.length || 0)
      res.json({ ok: true, ...result, usage: data.usage || null })
    } catch (e) {
      console.error("Failed to parse AI response:", text)
      res.json({ ok: true, ...cheap, source: "ai-parse-failed" })
    }
  } catch (error) {
    console.error("AI rebuild error:", error)
    res.json({ ok: true, ...localRebuild(req.body?.html || ""), source: "ai-error", error: error.message })
  }
})

app.get("/api/ai/ollama-health", async (_req, res) => {
  try {
    const result = await ollamaHealth()
    res.json({ ok: result.ok, models: result.models || [] })
  } catch (error) {
    res.json({ ok: false, models: [], error: error.message })
  }
})

app.post("/api/ai/rewrite-block", async (req, res) => {
  try {
    const { html, instruction, systemHint, model } = req.body
    if (!html || !instruction) {
      return res.status(400).json({ ok: false, error: "Missing html or instruction" })
    }

    let chosenModel = String(model || "auto")

    if (chosenModel === "auto") {
      const routing = await resolveModel(html, instruction)

      if (routing.needsApproval) {
        // Approval nötig – direkt in Response zurückgeben
        return res.json({
          ok: false,
          needsApproval: true,
          model: routing.model,
          provider: routing.provider,
          estInputTokens: routing.inputTokens,
          estOutputTokens: routing.outputTokens,
          estCost: routing.estCost,
          reason: routing.reason
        })
      }

      chosenModel = routing.model
    }

    const useGemini = chosenModel.startsWith("gemini-")
    const useGroq   = chosenModel.startsWith("groq:")
    const useOllama = chosenModel.startsWith("ollama:")

    const result = useGemini
      ? await geminiRewriteBlock({ html, instruction, systemHint, model: chosenModel })
      : useGroq
      ? await groqRewriteBlock({ html, instruction, systemHint, model: chosenModel.replace(/^groq:/, "") })
      : useOllama
      ? await ollamaRewriteBlock({ html, instruction, systemHint, model: chosenModel.replace(/^ollama:/, "") })
      : await claudeRewriteBlock({ html, instruction, systemHint, model: chosenModel })

    const usage = result?.usage || null

    // Credits abziehen wenn User eingeloggt
    let deducted = 0
    if (req.user?.id && usage) {
      try { deducted = deductCredits(req.user.id, chosenModel, usage.input_tokens || 0, usage.output_tokens || 0) } catch {}
    }

    res.json({
      ok: true,
      model: chosenModel,
      provider: useGemini ? "gemini" : useGroq ? "groq" : useOllama ? "ollama" : "claude",
      html: result?.html ?? result,
      usage,
      cost_eur: deducted
    })
  } catch (error) {
    console.error("AI rewrite error:", error)
    res.json({ ok: false, error: error.message })
  }
})


// Streaming Endpoint für BlockOverlay
app.post("/api/ai/rewrite-block-stream", async (req, res) => {
  try {
    const { html, instruction, systemHint, model } = req.body
    if (!html || !instruction) {
      return res.status(400).json({ ok: false, error: "Missing html or instruction" })
    }

    let chosenModel = String(model || "auto")

    if (chosenModel === "auto") {
      const routing = await resolveModel(html, instruction)
      if (routing.needsApproval) {
        return res.json({
          ok: false,
          needsApproval: true,
          model: routing.model,
          provider: routing.provider,
          estInputTokens: routing.inputTokens,
          estOutputTokens: routing.outputTokens,
          estCost: routing.estCost,
          reason: routing.reason
        })
      }
      chosenModel = routing.model
    }

    // Ollama & Groq – kein natives Streaming über unseren Stack, fallback zu normal
    if (chosenModel.startsWith("ollama:") || chosenModel.startsWith("groq:")) {
      const useOllama = chosenModel.startsWith("ollama:")
      const result = useOllama
        ? await ollamaRewriteBlock({ html, instruction, systemHint, model: chosenModel.replace(/^ollama:/, "") })
        : await groqRewriteBlock({ html, instruction, systemHint, model: chosenModel.replace(/^groq:/, "") })
      return res.json({ ok: true, model: chosenModel, html: result?.html ?? result, usage: result?.usage || null })
    }

    // Claude & Gemini – Streaming
    res.setHeader("Content-Type", "text/event-stream")
    res.setHeader("Cache-Control", "no-cache")
    res.setHeader("Connection", "keep-alive")

    const isGemini = chosenModel.startsWith("gemini-")

    if (isGemini) {
      const result = await geminiRewriteBlock({ html, instruction, systemHint, model: chosenModel })
      res.write(`data: ${JSON.stringify({ type: "done", html: result?.html ?? result, usage: result?.usage || null })}\n\n`)
      return res.end()
    }

    // Claude native streaming
    const systemPrompt = [
      "You are an expert HTML editor.",
      "Return ONLY valid HTML (no markdown, no explanations, no backticks).",
      "Preserve all existing classes, IDs and data attributes.",
      "Do not remove scripts or styles unless explicitly asked.",
      systemHint || ""
    ].filter(Boolean).join("\n")

    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "messages-2023-06-01"
      },
      body: JSON.stringify({
        model: chosenModel,
        max_tokens: 8000,
        stream: true,
        system: systemPrompt,
        messages: [{ role: "user", content: `INSTRUCTION:\n${instruction}\n\nHTML:\n${html}` }]
      })
    })

    if (!claudeResp.ok) {
      const t = await claudeResp.text()
      res.write(`data: ${JSON.stringify({ type: "error", error: t })}\n\n`)
      return res.end()
    }

    let fullText = ""
    const reader = claudeResp.body.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n")

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue
        const raw = line.slice(6).trim()
        if (raw === "[DONE]") continue
        try {
          const evt = JSON.parse(raw)
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            const token = evt.delta.text || ""
            fullText += token
            res.write(`data: ${JSON.stringify({ type: "token", token })}\n\n`)
          }
          if (evt.type === "message_delta" && evt.usage) {
            res.write(`data: ${JSON.stringify({ type: "usage", usage: evt.usage })}\n\n`)
          }
        } catch {}
      }
    }

    res.write(`data: ${JSON.stringify({ type: "done", html: fullText })}\n\n`)
    res.end()

  } catch (error) {
    console.error("Stream error:", error)
    try { res.write(`data: ${JSON.stringify({ type: "error", error: error.message })}\n\n`); res.end() } catch {}
  }
})

// Export endpoint – erzeugt ZIP mit HTML+Assets
app.post("/api/export", async (req, res) => {
  try {
    const { url, html, mode } = req.body
    if (!html && !url) {
      return res.status(400).json({ ok: false, error: "Missing html or url" })
    }

    // Export content: prefer provided HTML (what the editor currently sees)
    let content = html || `<!DOCTYPE html><html><body><p>No content</p></body></html>`

    // Always de-proxy any /asset?url=... references so exported HTML is portable
    // Example: srcset="/asset?url=https%3A%2F%2F...&ref=..."  -> "https://..."
    content = content.replace(/\/asset\?url=([^"'\s&,]+)(?:&amp;ref=[^"'\s,]+|&ref=[^"'\s,]+)?/g, (full, enc) => {
      try { return decodeURIComponent(enc) } catch { return full }
    })

    // Export modes (matches dashboard dropdown):
    // - "wp-placeholder": keep images empty if they were preview-uploaded (blob:) etc.
    // - "html-clean": remove WP/Jetpack/trackers noise (lightweight clean)
    // - "html-raw": raw HTML (still de-proxied)
    const exportMode = (mode || "wp-placeholder").toString()
    const filename =
      exportMode === "wp-placeholder" ? "site_wp_placeholders.zip" :
      exportMode === "html-clean" ? "site_html_clean.zip" :
      "site_html_raw.zip"

    let exportHtml = injectResponsive(transformExportHtml(content, exportMode))

    res.setHeader("Content-Type", "application/zip")
    res.setHeader("Content-Disposition", `attachment; filename=${filename}`)

    const archive = archiver("zip", { zlib: { level: 9 } })
    archive.pipe(res)
    archive.append(exportHtml, { name: "index.html" })
    await archive.finalize()
  } catch (error) {
    console.error("Export error:", error)
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: error.message })
    }
  }
})

// WP asset fallback
app.get(['/wp-content/*', '/wp-includes/*', '/_static/*'], (req, res) => {
  const ref = req.query.ref || '';
  const base = new URL(ref);
  const abs = new URL(req.originalUrl.split('?')[0], base).toString();
  const u = `/asset?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(ref)}`;
  res.redirect(302, u);
});

registerAuthRoutes(app)
registerProjectRoutes(app)
registerCreditRoutes(app)
registerSettingsRoutes(app)
registerOrgRoutes(app)
registerStripeRoutes(app)
registerScreenshotRoutes(app)

app.listen(8787, () => {
  console.log("site-editor-server running on 8787")
})
