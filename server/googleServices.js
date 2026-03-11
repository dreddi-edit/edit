import { GoogleAuth } from "google-auth-library"
import { Storage } from "@google-cloud/storage"

function getCredentials() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set")
  return JSON.parse(json)
}

function getAuth() {
  const credentials = getCredentials()
  return new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase"
    ]
  })
}

function getGoogleProjectId(explicitProjectId) {
  return explicitProjectId || process.env.GOOGLE_PROJECT_ID || getCredentials().project_id
}

function getStorageBucket(bucketName) {
  const credentials = getCredentials()
  const storage = new Storage({ credentials, projectId: credentials.project_id })
  const resolvedBucket = bucketName || process.env.GCS_BUCKET
  if (!resolvedBucket) throw new Error("GCS_BUCKET not set")
  return storage.bucket(resolvedBucket)
}

async function authFetch(url, options = {}) {
  const auth = getAuth()
  const client = await auth.getClient()
  const token = await client.getAccessToken()
  return fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${token.token}`,
      ...options.headers
    }
  })
}

export function registerGoogleServiceRoutes(app) {

  app.post("/api/google/gemini/generate", async (req, res) => {
    try {
      const prompt = String(req.body?.prompt || "").trim()
      const model = String(req.body?.model || "gemini-2.5-flash").trim()
      const key = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
      if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" })
      if (!key) return res.status(400).json({ ok: false, error: "GEMINI_API_KEY not set" })

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        }
      )
      const data = await response.json()
      if (!response.ok) {
        const message = data?.error?.message || `Gemini error ${response.status}`
        return res.status(response.status).json({ ok: false, error: message })
      }

      res.json({
        ok: true,
        data: {
          text: data?.candidates?.[0]?.content?.parts?.[0]?.text || "",
          usage: data?.usageMetadata || null,
        },
      })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  app.post("/api/google/video", async (req, res) => {
    try {
      const { videoUrl } = req.body
      if (!videoUrl) return res.status(400).json({ ok: false, error: "Missing videoUrl" })
      const r = await authFetch("https://videointelligence.googleapis.com/v1/videos:annotate", {
        method: "POST",
        body: JSON.stringify({ inputUri: videoUrl, features: ["SHOT_CHANGE_DETECTION", "LABEL_DETECTION"] })
      })
      const data = await r.json()
      res.json({ ok: true, data })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  app.post("/api/google/documentai", async (req, res) => {
    try {
      const { html, projectId, processorId } = req.body
      if (!html) return res.status(400).json({ ok: false, error: "Missing html" })
      const pid = projectId || process.env.GOOGLE_PROJECT_ID
      const proc = processorId || process.env.GOOGLE_DOCUMENTAI_PROCESSOR_ID
      if (!pid || !proc) return res.status(400).json({ ok: false, error: "Missing projectId or processorId" })
      const r = await authFetch(`https://documentai.googleapis.com/v1/projects/${pid}/locations/us/processors/${proc}:process`, {
        method: "POST",
        body: JSON.stringify({ rawDocument: { content: Buffer.from(html).toString("base64"), mimeType: "text/html" } })
      })
      const data = await r.json()
      res.json({ ok: true, data })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  // Imagen 4 Image Generation
  app.post("/api/google/imagen", async (req, res) => {
    try {
      const { prompt, count, quality } = req.body
      if (!prompt) return res.status(400).json({ ok: false, error: "Missing prompt" })
      const images = await generateImage({ prompt, count: count || 1, quality: quality || "standard" })
      res.json({ ok: true, images })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  app.post("/api/google/firebase/deploy", async (req, res) => {
    try {
      const { siteId } = req.body
      if (!siteId) return res.status(400).json({ ok: false, error: "Missing siteId" })
      const r = await authFetch(`https://firebasehosting.googleapis.com/v1beta1/sites/${siteId}/versions`, {
        method: "POST",
        body: JSON.stringify({ config: { target: "default" } })
      })
      const data = await r.json()
      res.json({ ok: true, data })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  app.post("/api/google/storage/upload", async (req, res) => {
    try {
      const name = String(req.body?.name || "").trim()
      const contentBase64 = String(req.body?.contentBase64 || "").trim()
      const bucketName = String(req.body?.bucket || "").trim()
      const prefix = String(req.body?.prefix || "suite").trim().replace(/^\/+|\/+$/g, "")
      const contentType = String(req.body?.contentType || "application/octet-stream")
      if (!name || !contentBase64) return res.status(400).json({ ok: false, error: "Missing file payload" })

      const buffer = Buffer.from(contentBase64, "base64")
      const bucket = getStorageBucket(bucketName || undefined)
      const safeName = name.replace(/[^\w.\-]+/g, "_")
      const objectPath = `${prefix}/${Date.now()}-${safeName}`
      const file = bucket.file(objectPath)
      await file.save(buffer, {
        metadata: { contentType },
        resumable: false,
      })
      await file.makePublic()

      res.json({
        ok: true,
        data: {
          fileUrl: `https://storage.googleapis.com/${bucket.name}/${objectPath}`,
          bucket: bucket.name,
          size: buffer.length,
        },
      })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

  app.post("/api/google/bigquery/query", async (req, res) => {
    try {
      const query = String(req.body?.query || "").trim()
      const projectId = getGoogleProjectId(String(req.body?.projectId || "").trim() || undefined)
      if (!query) return res.status(400).json({ ok: false, error: "Missing query" })
      if (!projectId) return res.status(400).json({ ok: false, error: "GOOGLE_PROJECT_ID not set" })

      const r = await authFetch(`https://bigquery.googleapis.com/bigquery/v2/projects/${projectId}/queries`, {
        method: "POST",
        body: JSON.stringify({ query, useLegacySql: false }),
      })
      const data = await r.json()
      if (!r.ok) {
        const message = data?.error?.message || `BigQuery error ${r.status}`
        return res.status(r.status).json({ ok: false, error: message })
      }
      res.json({ ok: true, data })
    } catch (e) {
      res.status(500).json({ ok: false, error: e.message })
    }
  })

}

// Imagen 4 - Image Generation
export async function generateImage({ prompt, count = 1, quality = "standard", projectId }) {
  const pid = projectId || process.env.GOOGLE_PROJECT_ID
  if (!pid) throw new Error("GOOGLE_PROJECT_ID not set")

  const model = quality === "ultra"
    ? "imagen-4.0-ultra-generate-001"
    : quality === "fast"
    ? "imagen-4.0-fast-generate-001"
    : "imagen-4.0-generate-001"

  const auth = getAuth()
  const client = await auth.getClient()
  const token = await client.getAccessToken()

  const resp = await fetch(
    `https://us-central1-aiplatform.googleapis.com/v1/projects/${pid}/locations/us-central1/publishers/google/models/${model}:predict`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token.token}`
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: Math.min(4, Math.max(1, count)) }
      })
    }
  )

  if (!resp.ok) {
    const t = await resp.text()
    throw new Error(`Imagen error ${resp.status}: ${t}`)
  }

  const data = await resp.json()
  return data.predictions?.map(p => ({
    base64: p.bytesBase64Encoded,
    mimeType: p.mimeType || "image/png"
  })) || []
}
