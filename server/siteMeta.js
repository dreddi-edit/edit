import { rewriteHtmlAssets } from "./rewriteAssets.js";

export const SUPPORTED_SITE_PLATFORMS = ["wordpress", "shopify", "webflow", "wix", "static", "unknown"];

const PLATFORM_GUIDES = {
  wordpress: {
    platform: "wordpress",
    label: "WordPress",
    safeEditScope: "Theme markup, copied content blocks, and static layout sections.",
    exportNotes: "Export creates a portable HTML handoff. Dynamic plugins, shortcodes, and CMS loops still need WordPress-side wiring.",
    riskyAreas: ["Shortcodes", "Query loops", "WooCommerce widgets", "Third-party form plugins"],
  },
  shopify: {
    platform: "shopify",
    label: "Shopify",
    safeEditScope: "Theme sections, marketing content, and static presentation blocks.",
    exportNotes: "Export is a handoff artifact, not a live theme sync. Product forms, carts, and app embeds remain theme-level work.",
    riskyAreas: ["Cart and checkout flows", "Product forms", "App embeds", "Liquid-driven dynamic sections"],
  },
  webflow: {
    platform: "webflow",
    label: "Webflow",
    safeEditScope: "Designer-authored sections, static content, and layout structure.",
    exportNotes: "Export keeps portable markup but Webflow CMS collections and interactions may need manual re-linking.",
    riskyAreas: ["CMS collection lists", "Interactions", "Forms", "Dynamic embeds"],
  },
  wix: {
    platform: "wix",
    label: "Wix",
    safeEditScope: "Static sections, copied copy blocks, and presentational layout.",
    exportNotes: "Export is best used as a delivery handoff. Wix app widgets and dynamic store flows stay manual.",
    riskyAreas: ["Wix app widgets", "Store/cart flows", "Dynamic repeaters", "Hosted forms"],
  },
  static: {
    platform: "static",
    label: "Static HTML",
    safeEditScope: "Full-page markup, assets, and layout are fully supported.",
    exportNotes: "Export is production-ready portable HTML when assets and embeds validate cleanly.",
    riskyAreas: ["Third-party embeds", "External forms", "Inline app scripts"],
  },
  unknown: {
    platform: "unknown",
    label: "Unknown",
    safeEditScope: "Static content edits are usually safe, but dynamic integrations should be reviewed manually.",
    exportNotes: "Treat export as a handoff artifact until the platform behavior is verified.",
    riskyAreas: ["Dynamic scripts", "CMS-specific widgets", "Checkout/login flows", "Embedded apps"],
  },
};

const PLATFORM_PATTERNS = {
  wordpress: [
    /wp-content/i,
    /wp-includes/i,
    /wp-json/i,
    /wp-block-/i,
    /wordpress/i,
    /<meta[^>]+generator[^>]+wordpress/i,
  ],
  shopify: [
    /cdn\.shopify\.com/i,
    /shopify-section/i,
    /shopify-payment-button/i,
    /myshopify\.com/i,
    /Shopify\./i,
  ],
  webflow: [
    /data-wf-page/i,
    /data-wf-site/i,
    /webflow\.(js|css)/i,
    /w-webflow/i,
  ],
  wix: [
    /wixstatic\.com/i,
    /wixsite\.com/i,
    /wix-image/i,
    /_wixCIDX/i,
    /Wix/i,
  ],
};

const UNSUPPORTED_PLATFORM_PATTERNS = [
  /shopware/i,
  /window\.features\s*=\s*JSON\.parse/i,
  /window\.salesChannelId\s*=/i,
  /frontend\.cart\.offcanvas/i,
  /frontend\.home\.page/i,
];

const EDITOR_HOSTILE_SCRIPT_PATTERNS = [
  /storefront/i,
  /googletagmanager/i,
  /google-analytics/i,
  /gtag\/js/i,
  /hotjar/i,
  /clarity\.ms/i,
  /intercom/i,
  /livechat/i,
];

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

export function normalizeSupportedPlatform(platform) {
  const value = cleanText(platform).toLowerCase();
  return SUPPORTED_SITE_PLATFORMS.includes(value) ? value : "unknown";
}

export function normalizeSiteUrl(rawUrl) {
  const raw = cleanText(rawUrl);
  if (!raw) return "";
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withProtocol).toString();
  } catch {
    return raw;
  }
}

function extractTitle(html) {
  const titleMatch = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch ? cleanText(titleMatch[1]) : "";
}

function extractCanonicalUrl(html, fallbackUrl) {
  const canonicalMatch = String(html || "").match(/<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["'][^>]*>/i);
  const candidate = canonicalMatch ? canonicalMatch[1] : fallbackUrl;
  if (!candidate) return "";
  try {
    return new URL(candidate, fallbackUrl || candidate).toString();
  } catch {
    return candidate;
  }
}

function stripEditorHostileScripts(html) {
  return String(html || "").replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (match, rawAttrs = "", body = "") => {
    const attrs = String(rawAttrs || "");
    const typeMatch = attrs.match(/\btype=["']([^"']+)["']/i);
    const scriptType = String(typeMatch?.[1] || "").toLowerCase();
    if (scriptType && /application\/(ld\+json|json)|importmap/i.test(scriptType)) return match;

    const srcMatch = attrs.match(/\bsrc=["']([^"']+)["']/i);
    const source = `${srcMatch?.[1] || ""}\n${body || ""}`;
    if (EDITOR_HOSTILE_SCRIPT_PATTERNS.some((pattern) => pattern.test(source))) return "";

    // The editor should render stable static markup. Executing live site scripts makes
    // WordPress and ecommerce pages mutate the DOM, hijack navigation, and block overlays.
    return "";
  });
}

function stripInlineEventHandlers(html) {
  return String(html || "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\son\w+=[^\s>]+/gi, "");
}

function stripEditorHostileMeta(html) {
  return String(html || "")
    .replace(/<meta[^>]+http-equiv=["']Content-Security-Policy["'][^>]*>/gi, "")
    .replace(/<meta[^>]+http-equiv=["']X-Frame-Options["'][^>]*>/gi, "");
}

export function detectSitePlatform(url, html) {
  const source = `${url || ""}\n${html || ""}`;
  for (const [platform, patterns] of Object.entries(PLATFORM_PATTERNS)) {
    if (patterns.some((pattern) => pattern.test(source))) {
      return platform;
    }
  }

  if (UNSUPPORTED_PLATFORM_PATTERNS.some((pattern) => pattern.test(source))) {
    return "unknown";
  }

  if (/<html[\s>]/i.test(source) && /<(main|section|article|div|header|footer)[\s>]/i.test(source)) {
    return "static";
  }

  return "unknown";
}

export function detectSiteMeta(url, html) {
  const normalizedUrl = normalizeSiteUrl(url);
  const canonicalUrl = extractCanonicalUrl(html, normalizedUrl);
  const platform = normalizeSupportedPlatform(detectSitePlatform(canonicalUrl || normalizedUrl, html));
  return {
    platform,
    title: extractTitle(html),
    url: canonicalUrl || normalizedUrl,
  };
}

export function getPlatformGuide(platform) {
  return PLATFORM_GUIDES[normalizeSupportedPlatform(platform)] || PLATFORM_GUIDES.unknown;
}

export function prepareHtmlForEditor(html, url) {
  let out = String(html || "");
  if (!out.trim()) return out;

  const normalizedUrl = normalizeSiteUrl(url);
  const canonicalUrl = extractCanonicalUrl(out, normalizedUrl);
  const resolvedUrl = canonicalUrl || normalizedUrl;

  if (resolvedUrl) {
    out = rewriteHtmlAssets(out, resolvedUrl, "/asset");
  }
  out = out.replace(/<base\b[^>]*>/gi, "");
  out = stripEditorHostileMeta(out);
  out = stripEditorHostileScripts(out);
  out = stripInlineEventHandlers(out);
  return out;
}

export function prepareEditorDocument(html, url) {

  // Preserve Shopify Liquid tags
  if (html && (html.includes('{{') || html.includes('{%'))) {
    html = html.replace(/\{\{([\s\S]*?)\}\}|\{%([\s\S]*?)%\}/g, (match) => 
      `<template data-shopify-liquid="${Buffer.from(match).toString('base64')}"></template>`
    );
  }


  // Preserve PHP tags for WordPress semantic treatment
  if (html && html.includes('<?php')) {
    html = html.replace(/<\?php([\s\S]*?)\?>/g, (match, p1) => `<template data-wp-php="${Buffer.from(p1).toString('base64')}"></template>`);
  }

  const meta = detectSiteMeta(url, html);
  return {
    html: prepareHtmlForEditor(html, meta.url || url),
    meta,
  };
}

export function normalizeProjectDocument({ html, url, platform }) {
  const rawHtml = String(html || "");
  const normalizedUrl = normalizeSiteUrl(url);
  const requestedPlatform = normalizeSupportedPlatform(platform);

  if (!rawHtml.trim()) {
    const resolvedPlatform = requestedPlatform !== "unknown"
      ? requestedPlatform
      : normalizeSupportedPlatform(detectSitePlatform(normalizedUrl, ""));
    const meta = {
      platform: resolvedPlatform,
      title: "",
      url: normalizedUrl,
    };
    return { html: "", meta, guide: getPlatformGuide(resolvedPlatform) };
  }

  const prepared = prepareEditorDocument(rawHtml, normalizedUrl);
  const resolvedPlatform = prepared.meta.platform !== "unknown"
    ? prepared.meta.platform
    : requestedPlatform;
  const meta = {
    ...prepared.meta,
    platform: normalizeSupportedPlatform(resolvedPlatform),
    url: prepared.meta.url || normalizedUrl,
  };
  return {
    html: prepared.html,
    meta,
    guide: getPlatformGuide(meta.platform),
  };
}
