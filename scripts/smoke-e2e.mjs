import { spawn } from "node:child_process"

const BASE_URL = process.env.SMOKE_BASE_URL || "http://127.0.0.1:8799"
const START_TIMEOUT_MS = 30_000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function parseSetCookie(setCookieValue) {
  const [pair] = String(setCookieValue || "").split(";")
  const idx = pair.indexOf("=")
  if (idx <= 0) return null
  const name = pair.slice(0, idx).trim()
  const value = pair.slice(idx + 1).trim()
  if (!name) return null
  return { name, value }
}

class CookieJar {
  constructor() {
    this.cookies = new Map()
  }

  storeFromResponse(response) {
    const setCookie = response.headers.getSetCookie?.() || []
    for (const entry of setCookie) {
      const parsed = parseSetCookie(entry)
      if (parsed) this.cookies.set(parsed.name, parsed.value)
    }
  }

  header() {
    return Array.from(this.cookies.entries()).map(([k, v]) => `${k}=${v}`).join("; ")
  }

  get(name) {
    return this.cookies.get(name)
  }
}

async function waitForServer() {
  const start = Date.now()
  while (Date.now() - start < START_TIMEOUT_MS) {
    try {
      const response = await fetch(`${BASE_URL}/health`)
      if (response.ok) return
    } catch {}
    await sleep(500)
  }
  throw new Error("Server did not start in time")
}

async function request(jar, path, options = {}) {
  const headers = { ...(options.headers || {}) }
  const cookieHeader = jar.header()
  if (cookieHeader) headers.cookie = cookieHeader
  const response = await fetch(`${BASE_URL}${path}`, { ...options, headers })
  jar.storeFromResponse(response)
  return response
}

function csrfHeaders(jar) {
  const token = jar.get("csrf_token")
  if (!token) throw new Error("csrf cookie was not set")
  return {
    "content-type": "application/json",
    "x-csrf-token": token,
  }
}

async function run() {
  const server = spawn(process.execPath, ["server/index.js"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || "test",
      PORT: "8799",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  server.stdout.on("data", (chunk) => {
    process.stdout.write(String(chunk))
  })
  server.stderr.on("data", (chunk) => {
    process.stderr.write(String(chunk))
  })

  try {
    await waitForServer()
    const jar = new CookieJar()

    const providersRes = await request(jar, "/api/auth/providers", { method: "GET" })
    if (!providersRes.ok) throw new Error(`providers failed (${providersRes.status})`)
    const email = `smoke-${Date.now()}@example.com`
    const password = "SmokePass123!"

    const registerRes = await request(jar, "/api/auth/register", {
      method: "POST",
      headers: csrfHeaders(jar),
      body: JSON.stringify({ email, password, name: "Smoke User" }),
    })
    if (!registerRes.ok) throw new Error(`register failed (${registerRes.status})`)

    const loginRes = await request(jar, "/api/auth/login", {
      method: "POST",
      headers: csrfHeaders(jar),
      body: JSON.stringify({ email, password }),
    })
    if (!loginRes.ok) throw new Error(`login failed (${loginRes.status})`)

    const oauthRes = await request(jar, "/api/auth/google", {
      method: "GET",
      redirect: "manual",
    })
    if (oauthRes.status !== 302) throw new Error(`oauth redirect failed (${oauthRes.status})`)

    const importRes = await request(jar, "/api/projects/import-preview", {
      method: "POST",
      headers: csrfHeaders(jar),
      body: JSON.stringify({
        kind: "html",
        html: "<html><body><main><h1>Smoke import</h1><p>ok</p></main></body></html>",
      }),
    })
    if ([404, 401, 403].includes(importRes.status)) {
      throw new Error(`import-preview smoke failed (${importRes.status})`)
    }

    const exportValidateRes = await request(jar, "/api/export/validate", {
      method: "POST",
      headers: csrfHeaders(jar),
      body: JSON.stringify({ html: "<html><body><main><h1>Smoke export</h1></main></body></html>", mode: "html-clean" }),
    })
    if (!exportValidateRes.ok) throw new Error(`export validate failed (${exportValidateRes.status})`)

    console.log("Smoke checks passed")
  } finally {
    server.kill("SIGTERM")
    await sleep(500)
  }
}

run().catch((error) => {
  console.error(error.message || error)
  process.exit(1)
})
