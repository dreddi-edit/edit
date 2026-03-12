import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeliveryArtifact,
  validateDeliveryArtifact,
  generateShopifySection,
  prepareWordPressThemeFiles,
  prepareWordPressBlockFiles,
  prepareWebComponentFile,
  prepareReactComponentFile,
  prepareWebflowJsonFile,
  prepareEmailHtml,
  preparePlainTextEmail,
  prepareMarkdownFile,
} from "../deliveryArtifacts.js";
import { normalizeProjectDocument } from "../siteMeta.js";

const FIXTURES = [
  {
    name: "wordpress-marketing",
    url: "https://agency.example.com/landing",
    html: `<!DOCTYPE html><html><head><title>WP</title><script src="https://www.googletagmanager.com/gtag/js?id=1"></script></head><body>
      <main class="wp-site-blocks"><section class="wp-block-group" onclick="alert(1)">
      <img src="/wp-content/uploads/hero.jpg" alt="Hero"><a href="/contact">Contact</a></section></main></body></html>`,
    expectedPlatform: "wordpress",
  },
  {
    name: "shopify-product",
    url: "https://store.example.com/products/widget",
    html: `<!DOCTYPE html><html><head><title>Shop</title></head><body>
      <div class="shopify-section product-form"><img src="//cdn.shopify.com/s/files/product.jpg">
      <form action="/cart/add"><button type="submit">Add to cart</button></form></div></body></html>`,
    expectedPlatform: "shopify",
  },
  {
    name: "static-saas",
    url: "https://static.example.com/index.html",
    html: `<!DOCTYPE html><html><head><title>Static</title></head><body>
      <main><section class="hero"><img src="./hero.png"><iframe src="https://player.example.com/embed/1"></iframe></section></main></body></html>`,
    expectedPlatform: "static",
  },
];

test("normalizeProjectDocument keeps a stable editor contract", () => {
  for (const fixture of FIXTURES) {
    const normalized = normalizeProjectDocument({
      html: fixture.html,
      url: fixture.url,
      platform: "",
    });
    const secondPass = normalizeProjectDocument({
      html: normalized.html,
      url: normalized.meta.url,
      platform: normalized.meta.platform,
    });

    assert.equal(normalized.meta.platform, fixture.expectedPlatform, `${fixture.name} platform`);
    assert.doesNotMatch(normalized.html, /<base href="/i, `${fixture.name} does not inject a remote base tag`);
    assert.match(normalized.html, /\/asset\?url=/i, `${fixture.name} proxifies asset urls`);
    assert.doesNotMatch(normalized.html, /<script\b(?![^>]*type=["'](?:application\/(?:ld\+json|json)|importmap))/i, `${fixture.name} strips executable scripts`);
    assert.doesNotMatch(normalized.html, /\sonclick=/i, `${fixture.name} strips inline handlers`);
    assert.doesNotMatch(normalized.html, /googletagmanager/i, `${fixture.name} strips editor-hostile scripts`);
    assert.equal(secondPass.html, normalized.html, `${fixture.name} normalization is idempotent`);
  }
});

test("delivery artifact emits manifest and warnings for guarded cases", () => {
  const normalized = normalizeProjectDocument({
    html: FIXTURES[1].html,
    url: FIXTURES[1].url,
    platform: "",
  });
  const artifact = buildDeliveryArtifact({
    html: normalized.html,
    url: normalized.meta.url,
    platform: normalized.meta.platform,
    mode: "html-clean",
    project: {
      id: 42,
      name: "Storefront",
      workflowStage: "client_review",
      deliveryStatus: "export_ready",
    },
    versionId: 7,
  });

  assert.equal(artifact.manifest.platform, "shopify");
  assert.equal(artifact.manifest.project?.id, 42);
  assert.equal(artifact.manifest.source.versionId, 7);
  assert.ok(Array.isArray(artifact.manifest.warnings));
  assert.ok(artifact.notes.includes("Delivery notes"));
  assert.ok(artifact.readiness === "guarded");
});

test("delivery artifact emits canonical and hreflang metadata for multilingual bundles", () => {
  const artifact = buildDeliveryArtifact({
    html: `<!DOCTYPE html><html><head><title>Localized</title></head><body><main><h1>Hello</h1></main></body></html>`,
    url: "https://example.com",
    platform: "static",
    mode: "html-clean",
    canonicalUrl: "index.html",
    language: "de",
    alternates: [
      { hreflang: "x-default", href: "index.html" },
      { hreflang: "de", href: "variants/de/index.html" },
    ],
  });

  assert.equal(artifact.manifest.language, "de");
  assert.equal(artifact.manifest.source.canonicalUrl, "index.html");
  assert.equal(artifact.manifest.alternates.length, 2);
  assert.match(artifact.html, /rel="canonical" href="index\.html"/);
  assert.match(artifact.html, /rel="alternate" hreflang="de" href="variants\/de\/index\.html"/);
});

test("delivery artifact rewrites seo, asset, and internal link output for handoff", () => {
  const artifact = buildDeliveryArtifact({
    html: `<!DOCTYPE html><html><head><title>Launch Page</title><meta name="description" content="Ship faster"></head><body><a href="https://agency.example.com/about?ref=nav">About</a><img src="/asset?url=https%3A%2F%2Fcdn.example.com%2Fhero.png"></body></html>`,
    url: "https://agency.example.com",
    platform: "static",
    mode: "html-clean",
  });

  assert.match(artifact.html, /<meta name="description" content="Ship faster">/);
  assert.match(artifact.html, /href="\/about\?ref=nav"/);
  assert.match(artifact.html, /src="https:\/\/cdn\.example\.com\/hero\.png"/);
});

test("delivery validation warns on unresolved assets and embeds", () => {
  const validation = validateDeliveryArtifact({
    html: `<!DOCTYPE html><html><body><img src="hero.png"><iframe src="https://example.com"></iframe></body></html>`,
    url: "https://docs.example.com/page",
    platform: "static",
    mode: "html-clean",
  });

  assert.ok(validation.warnings.some((item) => item.code === "relative-assets"));
  assert.ok(validation.warnings.some((item) => item.code === "embedded-frames"));
});

test("format generators produce portable export artifacts", async () => {
  const html = `<!DOCTYPE html><html><head><style>.hero{padding:24px}</style><link rel="stylesheet" href="https://cdn.example.com/site.css"></head><body><section data-block-id="hero" class="hero"><h1>Hello</h1><p>World</p><form><label for="email">Email</label><input id="email" type="email" required><button type="submit">Send</button></form><button class="cta">Talk to sales</button></section></body></html>`;
  const project = { name: "Launch Site" };

  const shopify = generateShopifySection(html);
  assert.match(shopify, /{% schema %}/);
  assert.match(shopify, /section\.settings\./);
  assert.match(shopify, /{% form 'contact'/);
  assert.match(shopify, /"presets": \[/);
  assert.doesNotMatch(shopify, /"target": "section"/);

  const themeFiles = prepareWordPressThemeFiles({ html, project });
  assert.ok(themeFiles.some((file) => file.name === "header.php"));
  assert.ok(themeFiles.some((file) => file.name === "footer.php"));
  assert.ok(themeFiles.some((file) => file.name === "assets/site-editor-export.css"));
  assert.ok(themeFiles.some((file) => file.name === "template-parts/content-site-editor.php"));
  const themeContent = themeFiles.find((file) => file.name === "template-parts/content-site-editor.php")?.content || "";
  assert.match(themeContent, /data-site-editor-form-placeholder="1"/);
  assert.match(themeContent, /https:\/\/formspree\.io\/f\/your-form-id/);
  assert.match(themeContent, /data-site-editor-cta-placeholder="1"/);
  assert.match(themeContent, /<a[^>]*role="button"[^>]*>Talk to sales<\/a>/);

  const blockFiles = prepareWordPressBlockFiles({ html, project });
  assert.ok(blockFiles.some((file) => file.name === "block.json"));
  assert.ok(blockFiles.some((file) => file.name.endsWith(".php")));
  assert.ok(blockFiles.some((file) => file.name === "editor.js"));
  assert.ok(blockFiles.some((file) => file.name === "style.css"));

  const { jsFile, demoFile, readmeFile } = prepareWebComponentFile({ html, project });
  assert.equal(jsFile.name, "embed.js");
  assert.equal(demoFile.name, "demo.html");
  assert.match(readmeFile.content, /site-editor-launch-site/);

  const reactFiles = prepareReactComponentFile({ html, project });
  assert.ok(reactFiles.some((file) => file.name === "LaunchSite.jsx"));
  assert.ok(reactFiles.some((file) => file.name === "launch-site.css"));
  assert.ok(reactFiles.some((file) => file.name === "demo.jsx"));

  const webflow = prepareWebflowJsonFile({ html, project });
  assert.equal(webflow.jsonFile.name, "launch-site.webflow.json");
  assert.match(webflow.readmeFile.content, /Webflow Import/);
  assert.match(webflow.jsonFile.content, /"type": "page"/);

  const emailHtml = await prepareEmailHtml(`${html}<script>alert(1)</script>`);
  assert.doesNotMatch(emailHtml, /<script\b/i);
  assert.match(emailHtml, /<table role="presentation"/);
  const plainText = preparePlainTextEmail({ html, project });
  assert.equal(plainText.name, "plain.txt");
  assert.match(plainText.content, /Hello/);

  const markdown = prepareMarkdownFile({ html, project });
  assert.equal(markdown.name, "launch-site.md");
  assert.match(markdown.content, /# Hello/);
});
