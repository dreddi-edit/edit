import { JSDOM } from "jsdom";

import { getPlatformGuide, normalizeSiteUrl, normalizeSupportedPlatform } from "./siteMeta.js";

function slugify(value, fallback = "site-editor-export") {
  const slug = String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function safeComponentName(value, fallback = "SiteEditorExport") {
  const cleaned = String(value || "").replace(/[^a-zA-Z0-9]+/g, "");
  return cleaned || fallback;
}

function decodeAssetProxyEverywhere(input) {
  let out = String(input || "");
  out = out.replace(/\/asset\?url=([^&"' )>]+)/g, (match, enc) => {
    try {
      return decodeURIComponent(enc);
    } catch {
      return match;
    }
  });
  return out.replace(/&amp;/g, "&");
}

export function transformExportHtml(html, mode) {
  const raw = String(html || "");
  if (mode === "html-raw") return raw;

  let out = decodeAssetProxyEverywhere(raw);

  if (mode === "wp-placeholder") {
    out = out.replace(/<img\b([^>]*?)\bsrc=("|\')([^"\']*)\2([^>]*?)>/gi, (match, pre, _quote, src, post) => {
      const value = String(src || "").trim();
      if (!value.startsWith("blob:") && value !== "") return match;

      let attrs = `${pre || ""} ${post || ""}`.replace(/\s+/g, " ").trim();
      attrs = attrs.replace(/\s+\bsrcset=("|\')[^"\']*\1/gi, "");
      attrs = attrs.replace(/\s+\bsrc=("|\')[^"\']*\1/gi, "");
      if (!/\balt=("|\')/i.test(attrs)) {
        attrs += ' alt="PLACEHOLDER: replace image in WordPress"';
      }
      if (!/\bdata-bo-placeholder=/i.test(attrs)) {
        attrs += ' data-bo-placeholder="1"';
      }
      return `<img ${attrs} src="" />`;
    });
  }

  return out;
}

export function injectResponsiveViewport(html) {
  const value = String(html || "");
  if (!value) return value;
  if (/<meta[^>]+name=["']viewport["']/i.test(value)) return value;
  return value.replace(/<head([^>]*)>/i, (match) => `${match}<meta name="viewport" content="width=device-width, initial-scale=1">`);
}

function findUnresolvedRelativeAssets(html) {
  const warnings = [];
  const attrRe = /\b(?:src|href)=["']([^"']+)["']/gi;
  let match;
  while ((match = attrRe.exec(html))) {
    const value = String(match[1] || "").trim();
    if (!value) continue;
    if (/^(https?:|mailto:|tel:|data:|blob:|javascript:|#)/i.test(value)) continue;
    if (/^\/\//.test(value)) continue;
    warnings.push(value);
  }
  return Array.from(new Set(warnings)).slice(0, 8);
}

export function validateDeliveryArtifact({ html, url, platform, mode }) {
  const normalizedPlatform = normalizeSupportedPlatform(platform);
  const normalizedUrl = normalizeSiteUrl(url);
  const guide = getPlatformGuide(normalizedPlatform);
  const source = String(html || "");
  const warnings = [];
  const push = (code, level, message, detail) => {
    warnings.push({ code, level, message, detail: detail || "" });
  };

  const unresolved = findUnresolvedRelativeAssets(source);
  if (unresolved.length) {
    push(
      "relative-assets",
      "warning",
      "Some assets still use relative URLs and may need manual review after handoff.",
      unresolved.join(", ")
    );
  }

  if (/\/asset\?url=/i.test(source)) {
    push("proxied-assets", "warning", "The export still references proxied assets and should be normalized before shipping.");
  }

  if (/__REPLACE_IN_WORDPRESS__|data-bo-placeholder=["']1["']/i.test(source)) {
    push("placeholder-assets", "warning", "At least one preview image is still a placeholder and must be replaced in the final CMS.");
  }

  if (/<iframe\b/i.test(source)) {
    push("embedded-frames", "info", "Embedded iframes were preserved. Validate third-party embeds after handoff.");
  }

  if (/<form\b/i.test(source)) {
    push("forms-present", "info", "Forms are present. Submission handling may require platform-side configuration.");
  }

  if (/<script\b/i.test(source) && normalizedPlatform !== "static") {
    push("dynamic-scripts", "info", "Dynamic scripts were preserved where possible. Verify runtime behavior on the target platform.");
  }

  if (normalizedPlatform === "wordpress" && /woocommerce|wp-block-latest|wpforms|shortcode/i.test(source)) {
    push("wordpress-dynamic", "warning", "WordPress dynamic blocks or plugin markup were detected and may need manual wiring after export.");
  }

  if (normalizedPlatform === "shopify" && /shopify-payment-button|product-form|cart|shopify-section/i.test(source)) {
    push("shopify-dynamic", "warning", "Shopify commerce markup was detected. Product/cart interactions remain theme-level work.");
  }

  if (normalizedPlatform === "webflow" && /(w-dyn-|data-wf-|w-form)/i.test(source)) {
    push("webflow-dynamic", "warning", "Webflow CMS or interaction markup was detected. Reconnect dynamic behavior after handoff.");
  }

  if (normalizedPlatform === "wix" && /(wix-|_wix|wix-image)/i.test(source)) {
    push("wix-dynamic", "warning", "Wix-specific widgets were detected. Expect manual follow-up for apps and dynamic content.");
  }

  return {
    guide,
    warnings,
    readiness: warnings.some((item) => item.level === "warning") ? "guarded" : "ready",
    sourceUrl: normalizedUrl,
    mode: String(mode || "wp-placeholder"),
  };
}

export function buildDeliveryArtifact({ html, url, platform, mode, project, versionId }) {
  const normalizedPlatform = normalizeSupportedPlatform(platform);
  const modeSpecificHtml = getModeSpecificHtml(html, mode);
  const transformedHtml = injectResponsiveViewport(transformExportHtml(modeSpecificHtml, mode));
  const validation = validateDeliveryArtifact({
    html: transformedHtml,
    url,
    platform: normalizedPlatform,
    mode,
  });

  const manifest = {
    version: 1,
    exportedAt: new Date().toISOString(),
    mode: String(mode || "wp-placeholder"),
    platform: normalizedPlatform,
    project: project ? {
      id: project.id ?? null,
      name: project.name ?? "",
      workflowStage: project.workflowStage ?? project.workflow_status ?? "draft",
      deliveryStatus: project.deliveryStatus ?? project.delivery_status ?? "not_exported",
    } : null,
    source: {
      url: validation.sourceUrl || "",
      versionId: versionId ?? null,
    },
    readiness: validation.readiness,
    guide: validation.guide,
    warnings: validation.warnings,
  };

  const notes = [
    "# Delivery notes",
    "",
    `Platform: ${validation.guide.label}`,
    `Mode: ${manifest.mode}`,
    `Exported at: ${manifest.exportedAt}`,
    validation.sourceUrl ? `Source URL: ${validation.sourceUrl}` : "Source URL: not set",
    versionId ? `Linked version snapshot: ${versionId}` : "Linked version snapshot: none",
    "",
    "Safe edit scope:",
    validation.guide.safeEditScope,
    "",
    "Export notes:",
    validation.guide.exportNotes,
    "",
    "Risky areas:",
    ...validation.guide.riskyAreas.map((item) => `- ${item}`),
    "",
    "Validation warnings:",
    ...(validation.warnings.length
      ? validation.warnings.map((item) => `- [${item.level}] ${item.message}${item.detail ? ` (${item.detail})` : ""}`)
      : ["- No blocking warnings detected."]),
  ].join("\n");

  return {
    html: transformedHtml,
    assets: [],
    manifest,
    notes,
    warnings: validation.warnings,
    readiness: validation.readiness,
    guide: validation.guide,
  };
}

export function generateShopifySection(html) {
  const dom = new JSDOM(String(html || ""));
  const doc = dom.window.document;
  const schemaSettings = [];
  const taggedBlocks = Array.from(doc.querySelectorAll("[data-block-id]"));
  const fallbackBlocks = taggedBlocks.length
    ? []
    : Array.from(doc.querySelectorAll("h1, h2, h3, p, a, button")).filter((node) => node.textContent?.trim());
  const editableNodes = taggedBlocks.length ? taggedBlocks : fallbackBlocks.slice(0, 24);
  let settingCounter = 1;

  for (const node of editableNodes) {
    const tagName = node.tagName.toUpperCase();
    const isSimpleText =
      /^H[1-6]$/.test(tagName) ||
      (node.children.length === 0 && (node.textContent || "").trim().length <= 180);
    const settingId = `setting_${settingCounter++}`;
    const defaultValue = isSimpleText ? (node.textContent || "").trim() : node.innerHTML.trim();
    schemaSettings.push({
      type: isSimpleText ? "text" : "richtext",
      id: settingId,
      label: node.getAttribute("aria-label") || node.getAttribute("data-block-id") || `${tagName} content`,
      default: defaultValue,
    });
    if (isSimpleText) {
      node.textContent = `{{ section.settings.${settingId} }}`;
    } else {
      node.innerHTML = `{{ section.settings.${settingId} }}`;
    }
  }

  const schema = {
    name: "Site Editor Section",
    target: "section",
    settings: schemaSettings,
  };

  return `${doc.body.innerHTML}\n\n{% schema %}\n${JSON.stringify(schema, null, 2)}\n{% endschema %}`.trim();
}

export function prepareWordPressThemeFiles({ html, project }) {
  const themeName = project?.name || "Site Editor Exported Theme";
  const themeSlug = slugify(themeName, "site-editor-theme");
  const styleCss = `/*
Theme Name: ${themeName}
Author: Site Editor
Version: 1.0
*/

body {
  margin: 0;
}
`;
  const functionsPhp = `<?php
function ${themeSlug}_enqueue_styles() {
  wp_enqueue_style('${themeSlug}-style', get_stylesheet_uri(), [], '1.0');
}
add_action('wp_enqueue_scripts', '${themeSlug}_enqueue_styles');
`;
  const indexPhp = `<?php
get_header();
if (have_posts()) :
  while (have_posts()) : the_post();
    the_content();
  endwhile;
endif;
get_footer();
`;
  const pagePhp = `<?php /* Template Name: Site Editor Export */ get_header(); ?>

${html}

<?php get_footer(); ?>
`;

  return [
    { name: "style.css", content: styleCss },
    { name: "functions.php", content: functionsPhp },
    { name: "index.php", content: indexPhp },
    { name: "page.php", content: pagePhp },
  ];
}

export function prepareWordPressBlockFiles({ html, project }) {
  const projectName = project?.name || "Site Editor Project";
  const slug = slugify(projectName, "site-editor-block");
  const blockJson = {
    $schema: "https://schemas.wp.org/trunk/block.json",
    apiVersion: 2,
    name: `site-editor/${slug}`,
    version: "1.0.0",
    title: `${projectName} (Exported)`,
    category: "design",
    icon: "layout",
    description: "A custom block exported from Site Editor.",
    supports: { html: false, align: ["wide", "full"] },
    textdomain: slug,
    editorScript: "file:./view.js",
    render: "file:./render.php",
  };
  const pluginPhp = `<?php
/**
 * Plugin Name: Site Editor - ${projectName}
 */
if (!defined('ABSPATH')) exit;
add_action('init', function () {
  register_block_type(__DIR__);
});
`;

  return [
    { name: `${slug}.php`, content: pluginPhp },
    { name: "block.json", content: JSON.stringify(blockJson, null, 2) },
    { name: "render.php", content: html },
    { name: "view.js", content: "// Required for the block editor preview." },
  ];
}

export function prepareWebComponentFile({ html }) {
  const dom = new JSDOM(String(html || ""));
  const doc = dom.window.document;
  const styles = Array.from(doc.querySelectorAll("style"))
    .map((style) => style.textContent || "")
    .join("\n");
  const bodyContent = doc.body.innerHTML;
  const jsContent = `class SiteEditorEmbed extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const template = document.createElement("template");
    template.innerHTML = \`<style>${styles.replace(/`/g, "\\`")}</style>${bodyContent.replace(/`/g, "\\`")}\`;
    root.appendChild(template.content.cloneNode(true));
  }
}

customElements.define("site-editor-embed", SiteEditorEmbed);
`;
  const readme = `Usage:

<script src="./embed.js"></script>
<site-editor-embed></site-editor-embed>
`;

  return {
    jsFile: { name: "embed.js", content: jsContent },
    readmeFile: { name: "README.md", content: readme },
  };
}

export async function prepareEmailHtml(html) {
  let processed = String(html || "");
  try {
    const imported = await import("juice");
    const juice = imported.default || imported;
    processed = juice(processed, { removeStyleTags: true, preserveMediaQueries: true });
  } catch {
    // `juice` is optional; fall back to a cleaned HTML export if it is not installed.
  }

  const dom = new JSDOM(processed);
  const doc = dom.window.document;
  doc.querySelectorAll("script").forEach((node) => node.remove());
  return `<!DOCTYPE html>\n${doc.documentElement.outerHTML}`;
}

export function prepareMarkdownFile({ html, project }) {
  const dom = new JSDOM(String(html || ""));
  const doc = dom.window.document;

  function walk(node) {
    if (node.nodeType === 3) return node.textContent || "";
    if (node.nodeType !== 1) return "";
    const tag = node.tagName.toLowerCase();
    const children = Array.from(node.childNodes).map(walk).join("");

    switch (tag) {
      case "h1":
        return `# ${children.trim()}\n\n`;
      case "h2":
        return `## ${children.trim()}\n\n`;
      case "h3":
        return `### ${children.trim()}\n\n`;
      case "p":
        return `${children.trim()}\n\n`;
      case "a":
        return `[${children.trim()}](${node.getAttribute("href") || "#"})`;
      case "img":
        return `![${node.getAttribute("alt") || ""}](${node.getAttribute("src") || "#"})`;
      case "li":
        return `- ${children.trim()}\n`;
      case "ul":
      case "ol":
        return `${children}\n`;
      case "strong":
      case "b":
        return `**${children}**`;
      case "em":
      case "i":
        return `*${children}*`;
      case "blockquote":
        return `> ${children.trim()}\n\n`;
      case "hr":
        return `\n---\n\n`;
      case "br":
        return `  \n`;
      default:
        return children;
    }
  }

  const raw = walk(doc.body).replace(/\n{3,}/g, "\n\n").trim();
  return {
    name: `${slugify(project?.name || "content", "content")}.md`,
    content: raw,
  };
}

export async function preparePdfFile({ html }) {
  const imported = await import("puppeteer");
  const puppeteer = imported.default || imported;
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  try {
    const page = await browser.newPage();
    await page.setContent(String(html || ""), { waitUntil: "domcontentloaded" });
    await page.addStyleTag({
      content: "@page { margin: 0; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }",
    });
    const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
    return { name: "design-preview.pdf", content: pdfBuffer };
  } finally {
    await browser.close();
  }
}

export function getModeSpecificHtml(html, mode) {
  if (mode === "shopify-section") {
    return generateShopifySection(html);
  }
  return html;
}

export function getExportSlug(project) {
  return slugify(project?.name || "site-editor-export", "site-editor-export");
}

export function getExportComponentName(project) {
  return safeComponentName(project?.name || "SiteEditorExport", "SiteEditorExport");
}
