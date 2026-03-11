import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDeliveryArtifact,
  validateDeliveryArtifact,
  generateShopifySection,
  prepareWordPressThemeFiles,
  prepareWordPressBlockFiles,
  prepareWebComponentFile,
  prepareEmailHtml,
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
  const html = `<!DOCTYPE html><html><body><section data-block-id="hero"><h1>Hello</h1><p>World</p></section></body></html>`;
  const project = { name: "Launch Site" };

  const shopify = generateShopifySection(html);
  assert.match(shopify, /{% schema %}/);
  assert.match(shopify, /section\.settings\./);

  const themeFiles = prepareWordPressThemeFiles({ html, project });
  assert.deepEqual(themeFiles.map((file) => file.name), ["style.css", "functions.php", "index.php", "page.php"]);

  const blockFiles = prepareWordPressBlockFiles({ html, project });
  assert.ok(blockFiles.some((file) => file.name === "block.json"));
  assert.ok(blockFiles.some((file) => file.name.endsWith(".php")));

  const { jsFile, readmeFile } = prepareWebComponentFile({ html });
  assert.equal(jsFile.name, "embed.js");
  assert.match(readmeFile.content, /site-editor-embed/);

  const emailHtml = await prepareEmailHtml(`${html}<script>alert(1)</script>`);
  assert.doesNotMatch(emailHtml, /<script\b/i);

  const markdown = prepareMarkdownFile({ html, project });
  assert.equal(markdown.name, "launch-site.md");
  assert.match(markdown.content, /# Hello/);
});
