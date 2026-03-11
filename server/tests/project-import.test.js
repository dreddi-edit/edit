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
