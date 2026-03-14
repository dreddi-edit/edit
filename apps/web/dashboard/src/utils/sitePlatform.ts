export type SitePlatform = "wordpress" | "shopify" | "webflow" | "wix" | "static" | "unknown";

type PlatformMeta = {
  label: string;
  shortLabel: string;
  accent: string;
  background: string;
  border: string;
};

const PLATFORM_META: Record<SitePlatform, PlatformMeta> = {
  wordpress: {
    label: "WordPress",
    shortLabel: "WP",
    accent: "#2563eb",
    background: "rgba(37,99,235,0.12)",
    border: "rgba(37,99,235,0.32)",
  },
  shopify: {
    label: "Shopify",
    shortLabel: "Shopify",
    accent: "#16a34a",
    background: "rgba(22,163,74,0.12)",
    border: "rgba(22,163,74,0.32)",
  },
  webflow: {
    label: "Webflow",
    shortLabel: "Webflow",
    accent: "#2563eb",
    background: "rgba(59,130,246,0.12)",
    border: "rgba(59,130,246,0.32)",
  },
  wix: {
    label: "Wix",
    shortLabel: "Wix",
    accent: "#7c3aed",
    background: "rgba(124,58,237,0.12)",
    border: "rgba(124,58,237,0.32)",
  },
  static: {
    label: "Static HTML",
    shortLabel: "Static",
    accent: "#f59e0b",
    background: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.32)",
  },
  unknown: {
    label: "Unknown",
    shortLabel: "Unknown",
    accent: "#94a3b8",
    background: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.26)",
  },
};

export function getPlatformMeta(platform?: string | null): PlatformMeta {
  return PLATFORM_META[normalizePlatform(platform)];
}

export function normalizePlatform(platform?: string | null): SitePlatform {
  const value = String(platform || "").trim().toLowerCase();
  if (value === "wordpress" || value === "shopify" || value === "webflow" || value === "wix" || value === "static") {
    return value;
  }
  return "unknown";
}

export function detectSitePlatform(url?: string, html?: string): SitePlatform {
  const source = `${url || ""}\n${html || ""}`;
  if (/wp-content|wp-includes|wp-json|wp-block-|wordpress/i.test(source)) return "wordpress";
  if (/cdn\.shopify\.com|shopify-section|shopify-payment-button|myshopify\.com|Shopify\./i.test(source)) return "shopify";
  if (/data-wf-page|data-wf-site|webflow\.(js|css)|w-webflow/i.test(source)) return "webflow";
  if (/wixstatic\.com|wixsite\.com|wix-image|_wixCIDX|Wix/i.test(source)) return "wix";
  if (/shopware|window\.features\s*=\s*JSON\.parse|window\.salesChannelId\s*=|frontend\.cart\.offcanvas|frontend\.home\.page/i.test(source)) return "unknown";
  if (/<html[\s>]/i.test(source) && /<(main|section|article|div|header|footer)[\s>]/i.test(source)) return "static";
  return "unknown";
}
