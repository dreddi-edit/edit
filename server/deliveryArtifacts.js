import { getPlatformGuide, normalizeSiteUrl, normalizeSupportedPlatform } from "./siteMeta.js";

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
  const transformedHtml = injectResponsiveViewport(transformExportHtml(html, mode));
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
    manifest,
    notes,
    warnings: validation.warnings,
    readiness: validation.readiness,
    guide: validation.guide,
  };
}
