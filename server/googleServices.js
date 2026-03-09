import { GoogleAuth } from "google-auth-library"

function getAuth() {
  const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
  if (!json) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON not set")
  const credentials = JSON.parse(json)
  return new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase"
    ]
  })
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

}
