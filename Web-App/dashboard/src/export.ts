import { fetchWithAuth } from "./api/client";

export type ExportMode =
  | "html-clean"
  | "html-raw"
  | "wp-placeholder"
  | "shopify-section"
  | "wp-theme"
  | "wp-block"
  | "web-component"
  | "react-component"
  | "webflow-json"
  | "email-newsletter"
  | "markdown-content"
  | "pdf-print";

const EXPORT_FILENAME_MAP: Record<ExportMode, string> = {
  "html-clean": "site_html_clean.zip",
  "html-raw": "site_html_raw.zip",
  "wp-placeholder": "site_wp_placeholders.zip",
  "shopify-section": "shopify_section.zip",
  "wp-theme": "wordpress_theme.zip",
  "wp-block": "wordpress_block_plugin.zip",
  "web-component": "web_component_embed.zip",
  "react-component": "react_component.zip",
  "webflow-json": "webflow_import.zip",
  "email-newsletter": "email_newsletter.zip",
  "markdown-content": "content_markdown.zip",
  "pdf-print": "design_preview.pdf",
};

export async function exportSite(args: { url?: string; html?: string; mode?: ExportMode }) {
  const { url, html, mode = "html-clean" } = args;

  const r = await fetchWithAuth("/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, html, mode }),
  });

  if (!r.ok) throw new Error("Export failed");

  const blob = await r.blob();
  const downloadUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = downloadUrl;

  const disposition = r.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="?([^"]+)"?/i);
  a.download = match?.[1] || EXPORT_FILENAME_MAP[mode];

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(downloadUrl);
}
