export function sendError(res, status, message) {
  res.status(status).json({ ok: false, error: message })
}

export function safeErrorMessage(error, status = 500) {
  if (process.env.NODE_ENV === "production" && status >= 500) {
    return "Internal server error"
  }
  return String(error?.message || error || "Unknown error")
}

export function sanitizeSharedHtml(rawHtml) {
  let html = String(rawHtml || "")
  if (!html) return ""
  html = html.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, "")
  html = html.replace(/<\s*(iframe|object|embed)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
  html = html.replace(/<\s*meta\b[^>]*http-equiv\s*=\s*['\"]?refresh['\"]?[^>]*>/gi, "")
  html = html.replace(/\son[a-z]+\s*=\s*(['\"]).*?\1/gi, "")
  html = html.replace(/\son[a-z]+\s*=\s*[^\s>]+/gi, "")
  html = html.replace(/\s(href|src)\s*=\s*(['\"])\s*javascript:[\s\S]*?\2/gi, ' $1="#"')
  html = html.replace(/\ssrcset\s*=\s*(['\"])([\s\S]*?)\1/gi, (_match, quote, value) => {
    const cleaned = String(value || "")
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => !/^javascript:/i.test(entry))
      .join(", ")
    return ` srcset=${quote}${cleaned}${quote}`
  })
  return html
}

export function extractJsonFromText(text) {
  if (!text) return text
  const source = String(text).trim()
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)\s*```/i)
  return (fenced ? fenced[1] : source).trim()
}

export function stripJsonFences(text) {
  if (!text) return text
  let normalized = String(text).trim()
  if (normalized.startsWith("```")) {
    normalized = normalized.replace(/^```(?:json)?\s*/i, "")
    normalized = normalized.replace(/\s*```$/i, "")
  }
  const objStart = normalized.indexOf("{")
  const arrStart = normalized.indexOf("[")
  let start = -1
  if (objStart !== -1 && arrStart !== -1) start = Math.min(objStart, arrStart)
  else if (objStart !== -1) start = objStart
  else if (arrStart !== -1) start = arrStart
  if (start > 0) normalized = normalized.slice(start)

  const lastObj = normalized.lastIndexOf("}")
  const lastArr = normalized.lastIndexOf("]")
  let end = -1
  if (lastObj !== -1 && lastArr !== -1) end = Math.max(lastObj, lastArr)
  else if (lastObj !== -1) end = lastObj
  else if (lastArr !== -1) end = lastArr
  if (end !== -1) normalized = normalized.slice(0, end + 1)

  return normalized.trim()
}

export function localRebuild(html) {
  let output = String(html || "")
  const blocks = []
  let index = 1

  function inject(tag, type, labelBase) {
    const reTag = new RegExp(`<${tag}(\\s[^>]*?)?>`, "gi")
    output = output.replace(reTag, (match, attrs = "") => {
      if (/data-block-id\s*=\s*["']/.test(match)) return match
      const id = `block-${index++}`
      blocks.push({ id, selector: `[data-block-id="${id}"]`, label: labelBase, type, description: "" })
      return `<${tag} data-block-id="${id}"${attrs}>`
    })
  }

  inject("header", "section", "Header")
  inject("nav", "section", "Nav")
  inject("main", "section", "Main")
  inject("section", "section", "Section")
  inject("article", "section", "Article")
  inject("aside", "section", "Aside")
  inject("footer", "section", "Footer")
  inject("h1", "heading", "H1")
  inject("h2", "heading", "H2")
  inject("h3", "heading", "H3")
  inject("button", "cta", "Button")
  inject("a", "cta", "Link")

  return { rebuiltHtml: output, blocks }
}
