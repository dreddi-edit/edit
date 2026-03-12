import test from "node:test"
import assert from "node:assert/strict"

import { buildProjectImportPreview } from "../projectImport.js"

test("import preview classifies wordpress theme bundles before page creation", async () => {
  const preview = await buildProjectImportPreview({
    kind: "entries",
    title: "theme-preview",
    entryMode: "folder",
    entries: [
      {
        name: "theme-preview/front-page.php",
        mimeType: "text/x-php",
        buffer: Buffer.from(`<!doctype html>
<html>
  <head>
    <title>Chout</title>
    <link rel="stylesheet" href="<?php echo get_template_directory_uri(); ?>/landing.css">
  </head>
  <body>
    <section><h1>Hero</h1><img src="<?php echo get_template_directory_uri(); ?>/assets/hero.jpg" alt="Hero"></section>
  </body>
</html>`),
      },
      {
        name: "theme-preview/index.php",
        mimeType: "text/x-php",
        buffer: Buffer.from("<?php // silence"),
      },
      {
        name: "theme-preview/functions.php",
        mimeType: "text/x-php",
        buffer: Buffer.from("<?php function theme_setup() {}"),
      },
      {
        name: "theme-preview/landing.css",
        mimeType: "text/css",
        buffer: Buffer.from("body{background:#fff}"),
      },
      {
        name: "theme-preview/text/landing_de.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Hallo Welt"),
      },
      {
        name: "theme-preview/assets/chout-logo.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
      },
      {
        name: "theme-preview/assets/hero.jpg",
        mimeType: "image/jpeg",
        buffer: Buffer.from("fake"),
      },
    ],
  })

  assert.equal(preview.platform, "wordpress")
  assert.equal(preview.analysis?.projectType, "WordPress theme")
  assert.equal(preview.analysis?.homepageFile, "front-page.php")
  assert.equal(preview.analysis?.homepagePath, "/")
  assert.deepEqual(preview.pages.map((page) => page.path), ["/"])
  assert.ok(preview.analysis?.supportFiles.includes("index.php"))
  assert.ok(preview.analysis?.supportFiles.includes("functions.php"))
  assert.ok(preview.analysis?.contentSources.includes("text/landing_de.txt"))
  assert.ok(preview.analysis?.assetFiles.includes("assets/chout-logo.svg"))
  assert.ok(preview.html.includes("data:image/jpeg;base64"))
})

test("asset library mode keeps uploaded assets out of the page detector", async () => {
  const preview = await buildProjectImportPreview({
    kind: "entries",
    title: "Brand kit",
    entryMode: "assets",
    entries: [
      {
        name: "brand/logo.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
      },
      {
        name: "brand/guide.txt",
        mimeType: "text/plain",
        buffer: Buffer.from("Brand notes"),
      },
    ],
  })

  assert.equal(preview.analysis?.projectType, "Asset library")
  assert.equal(preview.pages.length, 1)
  assert.equal(preview.pages[0]?.id, "assets")
  assert.equal(preview.analysis?.pageCount, 0)
})

test("ai import analysis cannot replace detected homepage with support files", async () => {
  const originalFetch = global.fetch
  process.env.GEMINI_API_KEY = "test-key"
  global.fetch = async () =>
    ({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                {
                  text: JSON.stringify({
                    projectType: "WordPress theme",
                    platform: "wordpress",
                    confidence: "high",
                    homepageFile: "functions.php",
                    pageCandidates: [
                      { file: "functions.php", path: "/", title: "Functions" },
                    ],
                    supportFiles: ["front-page.php", "index.php"],
                    contentSources: [],
                    warnings: ["AI guessed the wrong homepage."],
                    overview: "Test overview",
                  }),
                },
              ],
            },
          },
        ],
      }),
    })

  try {
    const preview = await buildProjectImportPreview({
      kind: "entries",
      title: "theme-preview",
      entryMode: "folder",
      entries: [
        {
          name: "theme-preview/front-page.php",
          mimeType: "text/x-php",
          buffer: Buffer.from(`<!doctype html>
<html>
  <head><title>Chout</title></head>
  <body><section><h1>Hero</h1></section></body>
</html>`),
        },
        {
          name: "theme-preview/index.php",
          mimeType: "text/x-php",
          buffer: Buffer.from("<?php // silence"),
        },
        {
          name: "theme-preview/functions.php",
          mimeType: "text/x-php",
          buffer: Buffer.from("<?php function theme_setup() {}"),
        },
      ],
    })

    assert.equal(preview.analysis?.homepageFile, "front-page.php")
    assert.deepEqual(preview.analysis?.pageCandidates, ["front-page.php"])
    assert.equal(preview.pages[0]?.path, "/")
    assert.match(preview.pages[0]?.html || "", /<h1>Hero<\/h1>/)
  } finally {
    global.fetch = originalFetch
    delete process.env.GEMINI_API_KEY
  }
})

test("url import localizes assets and supports auth/header overrides", async () => {
  const originalFetch = global.fetch
  const seenHeaders = []

  const mockResponse = ({ url, text = "", body, contentType = "text/html; charset=utf-8", status = 200 }) => {
    const buffer = body ? Buffer.from(body) : Buffer.from(text, "utf8")
    return {
      ok: status >= 200 && status < 300,
      status,
      url,
      headers: {
        get(name) {
          if (String(name || "").toLowerCase() === "content-type") return contentType
          return null
        },
      },
      text: async () => buffer.toString("utf8"),
      arrayBuffer: async () => buffer,
      json: async () => ({}),
    }
  }

  global.fetch = async (url, options = {}) => {
    const target = String(url)
    seenHeaders.push(options?.headers || {})
    if (target === "https://example.com/") {
      return mockResponse({
        url: target,
        text: `<!doctype html>
<html>
  <head>
    <title>Auth Import</title>
    <link rel="stylesheet" href="/styles/site.css" />
  </head>
  <body>
    <h1>Landing</h1>
    <img src="/assets/hero.png" alt="Hero" />
  </body>
</html>`,
      })
    }
    if (target === "https://example.com/styles/site.css") {
      return mockResponse({
        url: target,
        text: "body{background:url('/assets/bg.png') no-repeat center}",
        contentType: "text/css",
      })
    }
    if (target === "https://example.com/assets/hero.png" || target === "https://example.com/assets/bg.png") {
      return mockResponse({
        url: target,
        body: Buffer.from([137, 80, 78, 71]),
        contentType: "image/png",
      })
    }
    throw new Error(`Unexpected fetch URL: ${target}`)
  }

  try {
    const preview = await buildProjectImportPreview({
      kind: "url",
      mode: "single",
      url: "https://example.com/",
      requestOverrides: {
        basicAuth: { username: "edgar", password: "secret" },
        cookie: "session=abc123",
        headers: [{ key: "X-Trace", value: "import-preview" }],
      },
    })

    assert.equal(preview.pages.length, 1)
    assert.equal(preview.analysis?.localizedAssets?.count, 3)
    assert.match(preview.pages[0]?.html || "", /<style data-imported-from=/i)
    assert.match(preview.pages[0]?.html || "", /data:image\/png;base64/i)
    assert.ok((preview.analysis?.fidelityScore ?? 0) >= 0)

    const headerSnapshot = seenHeaders.map((headers) => JSON.stringify(headers)).join("\n")
    assert.match(headerSnapshot, /Authorization/i)
    assert.match(headerSnapshot, /Cookie/i)
    assert.match(headerSnapshot, /X-Trace/i)
  } finally {
    global.fetch = originalFetch
  }
})

test("figma export mode converts frame assets into editable pages", async () => {
  const preview = await buildProjectImportPreview({
    kind: "entries",
    title: "Figma Kit",
    entryMode: "figma-export",
    entries: [
      {
        name: "Figma/Frame 1.png",
        mimeType: "image/png",
        buffer: Buffer.from([137, 80, 78, 71]),
      },
      {
        name: "Figma/Frame 2.svg",
        mimeType: "image/svg+xml",
        buffer: Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 60"><rect width="120" height="60" fill="#111827"/><text x="12" y="34" fill="#fff">Frame 2</text></svg>`),
      },
    ],
  })

  assert.equal(preview.analysis?.projectType, "Figma export")
  assert.ok((preview.analysis?.pageCount || 0) >= 3)
  assert.ok(preview.pages.some((page) => page.path === "/"))
  assert.ok(preview.pages.some((page) => page.path === "/frame-1"))
  assert.ok(preview.pages.some((page) => page.path === "/frame-2"))
})

test("import analysis reports repeated sections, nav model, seo coverage, and interaction preservation", async () => {
  const preview = await buildProjectImportPreview({
    kind: "entries",
    title: "semantic-check",
    entryMode: "folder",
    entries: [
      {
        name: "semantic-check/index.html",
        mimeType: "text/html",
        buffer: Buffer.from(`<!doctype html>
<html>
  <head>
    <title>Home</title>
    <meta name="description" content="Home description" />
    <meta property="og:title" content="Home OG" />
  </head>
  <body>
    <header><nav><a href="/about">About</a><a href="/pricing">Pricing</a></nav></header>
    <main>
      <section class="feature"><h2>Feature</h2><p>Reusable copy block.</p></section>
      <form action="/lead"><input type="email"><button>Get Demo</button></form>
    </main>
    <footer><nav><a href="/privacy">Privacy</a></nav></footer>
  </body>
</html>`),
      },
      {
        name: "semantic-check/about.html",
        mimeType: "text/html",
        buffer: Buffer.from(`<!doctype html>
<html>
  <head>
    <title>About</title>
    <meta name="description" content="About description" />
  </head>
  <body>
    <header><nav><a href="/">Home</a><a href="/pricing">Pricing</a></nav></header>
    <main>
      <section class="feature"><h2>Feature</h2><p>Reusable copy block.</p></section>
      <a href="/contact" class="btn primary">Contact Sales</a>
    </main>
    <footer><nav><a href="/privacy">Privacy</a></nav></footer>
  </body>
</html>`),
      },
    ],
  })

  assert.ok((preview.analysis?.repeatedSections?.length || 0) >= 1)
  assert.ok((preview.analysis?.navStructure?.primary?.length || 0) >= 1)
  assert.ok((preview.analysis?.formsCount || 0) >= 1)
  assert.ok((preview.analysis?.ctaCount || 0) >= 1)
  assert.ok((preview.analysis?.seoCoverage?.withTitle || 0) >= 2)
  assert.ok((preview.analysis?.fidelityScore || 0) >= 0)
  assert.ok(preview.pages.every((page) => page.seo && page.semantic))
})
