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

function uniqueList(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function normalizeRemoteUrl(value) {
  const raw = decodeAssetProxyEverywhere(String(value || "").trim());
  if (!raw) return "";
  if (/^\/\//.test(raw)) return `https:${raw}`;
  if (/^https?:\/\//i.test(raw)) return raw;
  return "";
}

function escapeHtmlAttribute(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapePhpSingleQuoted(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function createNowdoc(content, tagBase = "SITE_EDITOR_EXPORT") {
  const tag = `${String(tagBase || "SITE_EDITOR_EXPORT").replace(/[^A-Z0-9_]/gi, "_").toUpperCase()}_NOWDOC`;
  return `<<<'${tag}'\n${String(content || "")}\n${tag}`;
}

function escapeTemplateLiteral(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$\{/g, "\\${");
}

const DEFAULT_FORM_ACTION_URL = process.env.EXPORT_FORM_ACTION_URL || "https://formspree.io/f/your-form-id"
const DEFAULT_CTA_URL = process.env.EXPORT_CTA_URL || "https://example.com/contact"

function ensurePortableInteractions(doc) {
  if (!doc?.body) return

  Array.from(doc.querySelectorAll("form")).forEach((form, formIndex) => {
    const action = (form.getAttribute("action") || "").trim()
    const method = (form.getAttribute("method") || "").trim()
    const needsPlaceholderAction = !action || action === "#" || /^javascript:/i.test(action)

    if (needsPlaceholderAction) {
      form.setAttribute("action", DEFAULT_FORM_ACTION_URL)
      form.setAttribute("data-site-editor-form-placeholder", "1")
    }
    if (!method) form.setAttribute("method", "post")

    Array.from(form.querySelectorAll("input, textarea, select")).forEach((field, index) => {
      const input = field
      const tag = input.tagName.toLowerCase()
      const inputType = String(input.getAttribute("type") || tag).toLowerCase()
      if (["hidden", "submit", "button", "reset"].includes(inputType)) return
      if (!input.getAttribute("name")) {
        const fallbackName = deriveFieldLabel(input, form)
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
        input.setAttribute("name", fallbackName || `field_${formIndex + 1}_${index + 1}`)
      }
    })
  })

  Array.from(doc.querySelectorAll("a")).forEach((anchor) => {
    const href = (anchor.getAttribute("href") || "").trim()
    if (!href || href === "#" || /^javascript:/i.test(href)) {
      anchor.setAttribute("href", DEFAULT_CTA_URL)
      anchor.setAttribute("data-site-editor-cta-placeholder", "1")
    }
  })

  Array.from(doc.querySelectorAll("button")).forEach((button) => {
    const type = String(button.getAttribute("type") || "").toLowerCase()
    if (type === "submit" || type === "reset" || button.closest("form")) return

    const href =
      button.getAttribute("data-site-editor-cta-url")
      || button.getAttribute("data-cta-url")
      || button.getAttribute("data-href")
      || DEFAULT_CTA_URL

    const anchor = doc.createElement("a")
    anchor.setAttribute("href", href)
    anchor.setAttribute("role", "button")
    anchor.setAttribute("data-site-editor-cta-placeholder", "1")
    anchor.innerHTML = button.innerHTML
    if (button.className) anchor.className = button.className
    Array.from(button.attributes).forEach((attribute) => {
      if (["type", "onclick", "data-cta-url", "data-href", "data-site-editor-cta-url"].includes(attribute.name)) return
      if (!anchor.hasAttribute(attribute.name)) anchor.setAttribute(attribute.name, attribute.value)
    })
    button.replaceWith(anchor)
  })
}

function extractPortableDocumentParts(html) {
  const source = injectResponsiveViewport(decodeAssetProxyEverywhere(String(html || "")));
  const dom = new JSDOM(source);
  const doc = dom.window.document;
  ensurePortableInteractions(doc);
  const title = (doc.querySelector("title")?.textContent || "").trim();
  const externalStylesheets = uniqueList(
    Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'))
      .map((node) => normalizeRemoteUrl(node.getAttribute("href")))
      .filter(Boolean)
  );
  const inlineCss = Array.from(doc.querySelectorAll("style"))
    .map((node) => node.textContent || "")
    .join("\n\n")
    .trim();

  doc.querySelectorAll("script, style, link[rel~='stylesheet'], meta, base, title, noscript").forEach((node) => node.remove());
  doc.body?.querySelectorAll("script, style, link, meta, base, title, noscript").forEach((node) => node.remove());

  const bodyHtml = (doc.body?.innerHTML || "").trim();
  return {
    dom,
    doc,
    title,
    inlineCss,
    externalStylesheets,
    bodyHtml,
  };
}

function buildExternalStylesheetTags(urls) {
  return uniqueList(urls)
    .map((href) => `<link rel="stylesheet" href="${escapeHtmlAttribute(href)}">`)
    .join("\n");
}

function wrapPortableFragment({ html, inlineCss = "", externalStylesheets = [], wrapperClass = "" }) {
  const links = buildExternalStylesheetTags(externalStylesheets);
  const styleTag = inlineCss ? `<style>${inlineCss}</style>` : "";
  const classAttr = wrapperClass ? ` class="${escapeHtmlAttribute(wrapperClass)}"` : "";
  return `${links}${links ? "\n" : ""}${styleTag}${styleTag ? "\n" : ""}<div${classAttr}>${String(html || "")}</div>`;
}

function buildPortableCss(inlineCss) {
  const baseCss = [
    ":root { color-scheme: light; }",
    "body { margin: 0; }",
    "img { max-width: 100%; height: auto; }",
    "iframe { max-width: 100%; }",
  ].join("\n");
  return `${baseCss}\n\n${String(inlineCss || "").trim()}`.trim();
}

function deriveFieldLabel(field, form) {
  const id = field.getAttribute("id");
  const explicitLabel = id
    ? Array.from(form.querySelectorAll("label")).find((label) => label.getAttribute("for") === id) || null
    : null;
  const fallback = explicitLabel?.textContent
    || field.getAttribute("aria-label")
    || field.getAttribute("placeholder")
    || field.getAttribute("name")
    || field.tagName;
  return String(fallback || "").replace(/\s+/g, " ").trim();
}

function buildShopifyContactField(field, form, index) {
  const tag = field.tagName.toLowerCase();
  const inputType = String(field.getAttribute("type") || tag).toLowerCase();
  if (["hidden", "submit", "button", "reset", "checkbox", "radio", "file"].includes(inputType)) return "";

  const label = deriveFieldLabel(field, form) || `Field ${index + 1}`;
  const placeholder = field.getAttribute("placeholder") || "";
  const required = field.hasAttribute("required") || field.getAttribute("aria-required") === "true";
  const attr = [
    placeholder ? ` placeholder="${escapeHtmlAttribute(placeholder)}"` : "",
    required ? " required" : "",
  ].join("");

  if (tag === "textarea") {
    const rows = Number(field.getAttribute("rows") || 5);
    return `<label>${escapeHtmlAttribute(label)}</label><textarea name="contact[body]" rows="${Number.isFinite(rows) && rows > 0 ? rows : 5}"${attr}></textarea>`;
  }

  if (tag === "select") {
    const optionMarkup = Array.from(field.querySelectorAll("option"))
      .map((option) => `<option value="${escapeHtmlAttribute(option.getAttribute("value") || option.textContent || "")}">${escapeHtmlAttribute(option.textContent || "")}</option>`)
      .join("");
    return `<label>${escapeHtmlAttribute(label)}</label><select name="contact[${escapeHtmlAttribute(label)}]"${attr}>${optionMarkup}</select>`;
  }

  const inputName =
    inputType === "email"
      ? "contact[email]"
      : inputType === "tel"
      ? "contact[phone]"
      : `contact[${escapeHtmlAttribute(label)}]`;

  return `<label>${escapeHtmlAttribute(label)}</label><input type="${escapeHtmlAttribute(inputType === "textarea" ? "text" : inputType || "text")}" name="${inputName}"${attr}>`;
}

function convertFormsToShopifyContact(container) {
  Array.from(container.querySelectorAll("form")).forEach((form, formIndex) => {
    const fieldMarkup = Array.from(form.querySelectorAll("input, textarea, select"))
      .map((field, index) => buildShopifyContactField(field, form, index))
      .filter(Boolean)
      .join("\n");
    if (!fieldMarkup) return;

    const buttonLabel =
      form.querySelector('button[type="submit"], input[type="submit"], button')?.textContent?.trim()
      || form.querySelector('input[type="submit"]')?.getAttribute("value")
      || "Send";

    const replacement = `
<div class="site-editor-shopify-contact site-editor-shopify-contact-${formIndex + 1}">
  {% form 'contact', class: 'site-editor-contact-form' %}
    {% if form.posted_successfully? %}
      <p class="site-editor-contact-success">Thanks, your message has been sent.</p>
    {% endif %}
    {{ form.errors | default_errors }}
    ${fieldMarkup}
    <button type="submit">${escapeHtmlAttribute(buttonLabel)}</button>
  {% endform %}
</div>`.trim();

    form.outerHTML = replacement;
  });
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
  if (/data-site-editor-form-placeholder=["']1["']/i.test(source)) {
    push("form-action-placeholder", "warning", "At least one form uses a placeholder action URL and must be wired before launch.");
  }
  if (/data-site-editor-cta-placeholder=["']1["']/i.test(source)) {
    push("cta-placeholder", "info", "At least one CTA uses a placeholder destination URL and should be reviewed before handoff.");
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
  const normalizedHtml = injectResponsiveViewport(transformExportHtml(html, mode));
  const transformedHtml = getModeSpecificHtml(normalizedHtml, mode);
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
  const { doc, bodyHtml, inlineCss, externalStylesheets, title } = extractPortableDocumentParts(html);
  const container = doc.createElement("div");
  container.innerHTML = bodyHtml;
  convertFormsToShopifyContact(container);
  const schemaSettings = [];
  const taggedBlocks = Array.from(container.querySelectorAll("[data-block-id]"));
  const fallbackBlocks = taggedBlocks.length
    ? []
    : Array.from(container.querySelectorAll("h1, h2, h3, h4, p, a, button")).filter((node) => node.textContent?.trim());
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

    if (tagName === "A" && node.getAttribute("href")) {
      const urlSettingId = `setting_${settingCounter++}`;
      const originalHref = String(node.getAttribute("href") || "").replace(/'/g, "\\'");
      schemaSettings.push({
        type: "url",
        id: urlSettingId,
        label: `${tagName} link`,
      });
      node.setAttribute("href", `{{ section.settings.${urlSettingId} | default: '${originalHref}' }}`);
    }
  }

  const schema = {
    name: title || "Site Editor Section",
    settings: schemaSettings,
    presets: [{ name: title || "Site Editor Section" }],
  };

  const headMarkup = buildExternalStylesheetTags(externalStylesheets);
  const styleMarkup = inlineCss ? `<style>\n${inlineCss}\n</style>` : "";

  return `
${headMarkup}
${styleMarkup}
<section id="shopify-section-{{ section.id }}" class="site-editor-shopify-section">
${container.innerHTML.trim()}
</section>

{% schema %}
${JSON.stringify(schema, null, 2)}
{% endschema %}`.trim();
}

export function prepareWordPressThemeFiles({ html, project }) {
  const themeName = project?.name || "Site Editor Exported Theme";
  const themeSlug = slugify(themeName, "site-editor-theme");
  const { bodyHtml, inlineCss, externalStylesheets, title } = extractPortableDocumentParts(html);
  const externalEnqueues = externalStylesheets
    .map((href, index) => `  wp_enqueue_style('${themeSlug}-remote-${index + 1}', '${escapePhpSingleQuoted(href)}', ['${themeSlug}-export'], null);`)
    .join("\n");
  const styleCss = `/*
Theme Name: ${themeName}
Author: Site Editor
Version: 1.0
*/
`;
  const functionsPhp = `<?php
if (!defined('ABSPATH')) exit;

add_action('after_setup_theme', function () {
  add_theme_support('title-tag');
  add_theme_support('post-thumbnails');
  add_theme_support('html5', ['search-form', 'gallery', 'caption', 'style', 'script']);
});

function ${themeSlug}_enqueue_styles() {
  wp_enqueue_style('${themeSlug}-style', get_stylesheet_uri(), [], '1.0');
  wp_enqueue_style('${themeSlug}-export', get_template_directory_uri() . '/assets/site-editor-export.css', ['${themeSlug}-style'], '1.0');
${externalEnqueues || "  // No remote stylesheets were detected in the source export."}
}
add_action('wp_enqueue_scripts', '${themeSlug}_enqueue_styles');
`;
  const headerPhp = `<?php if (!defined('ABSPATH')) exit; ?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
  <meta charset="<?php bloginfo('charset'); ?>">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>
`;
  const footerPhp = `<?php if (!defined('ABSPATH')) exit; ?>
<?php wp_footer(); ?>
</body>
</html>
`;
  const indexPhp = `<?php get_header(); ?>
<?php get_template_part('template-parts/content', 'site-editor'); ?>
<?php get_footer(); ?>
`;
  const frontPagePhp = `<?php
/* Template Name: Site Editor Front Page */
get_header();
get_template_part('template-parts/content', 'site-editor');
get_footer();
`;
  const pagePhp = `<?php get_header(); ?>
<?php get_template_part('template-parts/content', 'site-editor'); ?>
<?php get_footer(); ?>
`;
  const contentPhp = `<?php if (!defined('ABSPATH')) exit; ?>
<?php
$site_editor_export_html = ${createNowdoc(`<div class="site-editor-export site-editor-export--${themeSlug}">\n${bodyHtml}\n</div>`, `${themeSlug}_content`)};
echo $site_editor_export_html; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped
`;
  const themeJson = {
    version: 2,
    settings: {
      layout: {
        contentSize: "840px",
        wideSize: "1240px",
      },
    },
    customTemplates: title ? [{ name: "site-editor-front-page", title }] : [],
  };

  return [
    { name: "style.css", content: styleCss },
    { name: "functions.php", content: functionsPhp },
    { name: "header.php", content: headerPhp },
    { name: "footer.php", content: footerPhp },
    { name: "index.php", content: indexPhp },
    { name: "front-page.php", content: frontPagePhp },
    { name: "page.php", content: pagePhp },
    { name: "theme.json", content: JSON.stringify(themeJson, null, 2) },
    { name: "assets/site-editor-export.css", content: buildPortableCss(inlineCss) },
    { name: "template-parts/content-site-editor.php", content: contentPhp },
  ];
}

export function prepareWordPressBlockFiles({ html, project }) {
  const projectName = project?.name || "Site Editor Project";
  const slug = slugify(projectName, "site-editor-block");
  const { bodyHtml, inlineCss, externalStylesheets } = extractPortableDocumentParts(html);
  const blockName = `site-editor/${slug}`;
  const wrapperClass = `wp-block-site-editor-${slug}`;
  const previewMarkup = wrapPortableFragment({
    html: bodyHtml,
    inlineCss,
    wrapperClass,
  });
  const blockJson = {
    $schema: "https://schemas.wp.org/trunk/block.json",
    apiVersion: 3,
    name: blockName,
    version: "1.0.0",
    title: `${projectName} (Exported)`,
    category: "design",
    icon: "layout",
    description: "A portable static block exported from Site Editor.",
    supports: { html: false, anchor: true, align: ["wide", "full"] },
    textdomain: slug,
    editorScript: "file:./editor.js",
    style: "file:./style.css",
  };
  const remoteStyleEnqueues = externalStylesheets
    .map((href, index) => `  wp_enqueue_style('${slug}-remote-${index + 1}', '${escapePhpSingleQuoted(href)}', ['${slug}-style'], null);`)
    .join("\n");
  const pluginPhp = `<?php
/**
 * Plugin Name: Site Editor - ${projectName}
 * Description: Portable block export generated by Site Editor.
 * Version: 1.0.0
 */
if (!defined('ABSPATH')) exit;
add_action('init', function () {
  register_block_type(__DIR__);
});

add_action('enqueue_block_assets', function () {
${remoteStyleEnqueues || "  // No remote stylesheets were detected in the source export."}
});
`;
  const editorJs = `(function (blocks, element, blockEditor) {
  const el = element.createElement;
  const RawHTML = element.RawHTML;
  const useBlockProps = blockEditor.useBlockProps;
  const previewMarkup = \`${escapeTemplateLiteral(previewMarkup)}\`;

  blocks.registerBlockType(${JSON.stringify(blockName)}, {
    edit: function () {
      return el("div", useBlockProps({ className: "site-editor-export-editor" }), el(RawHTML, null, previewMarkup));
    },
    save: function () {
      return el(RawHTML, null, previewMarkup);
    },
  });
})(window.wp.blocks, window.wp.element, window.wp.blockEditor);
`;

  return [
    { name: `${slug}.php`, content: pluginPhp },
    { name: "block.json", content: JSON.stringify(blockJson, null, 2) },
    { name: "editor.js", content: editorJs },
    { name: "style.css", content: buildPortableCss(inlineCss) },
    { name: "README.md", content: `Install this plugin ZIP in WordPress, activate it, then insert the "${projectName} (Exported)" block.` },
  ];
}

export function prepareWebComponentFile({ html, project }) {
  const { bodyHtml, inlineCss, externalStylesheets } = extractPortableDocumentParts(html);
  const componentName = `site-editor-${slugify(project?.name || "embed", "embed")}`;
  const bodyContent = wrapPortableFragment({
    html: bodyHtml,
    inlineCss,
    externalStylesheets,
    wrapperClass: "site-editor-web-component",
  });
  const jsContent = `class SiteEditorEmbed extends HTMLElement {
  constructor() {
    super();
    const root = this.attachShadow({ mode: "open" });
    const template = document.createElement("template");
    template.innerHTML = \`${escapeTemplateLiteral(bodyContent)}\`;
    root.appendChild(template.content.cloneNode(true));
  }
}

if (!customElements.get(${JSON.stringify(componentName)})) {
  customElements.define(${JSON.stringify(componentName)}, SiteEditorEmbed);
}
`;
  const demoHtml = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${project?.name || "Site Editor Embed"}</title>
    <script type="module" src="./embed.js"></script>
  </head>
  <body style="margin:0;background:#0b0f14">
    <${componentName}></${componentName}>
  </body>
</html>`;
  const readme = `Usage:

<script type="module" src="./embed.js"></script>
<${componentName}></${componentName}>
`;

  return {
    jsFile: { name: "embed.js", content: jsContent },
    demoFile: { name: "demo.html", content: demoHtml },
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

  const { bodyHtml } = extractPortableDocumentParts(processed);
  const wrappedBody = `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;background:#ffffff;">
  <tr>
    <td align="center" style="padding:24px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="width:640px;max-width:100%;border-collapse:collapse;">
        <tr>
          <td style="font-family:Arial, Helvetica, sans-serif;color:#111827;font-size:16px;line-height:1.6;">
            ${bodyHtml}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email export</title>
  </head>
  <body style="margin:0;padding:0;background:#f5f5f5;">
    ${wrappedBody}
  </body>
</html>`;
}

export function preparePlainTextEmail({ html, project }) {
  const markdown = prepareMarkdownFile({ html, project });
  return {
    name: "plain.txt",
    content: markdown.content
      .replace(/^#{1,6}\s+/gm, "")
      .replace(/\[(.*?)\]\((.*?)\)/g, "$1: $2")
      .replace(/^\s*[-*]\s+/gm, "")
      .replace(/^>\s?/gm, "")
      .replace(/[*_`]/g, "")
      .trim(),
  };
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
