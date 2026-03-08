export type ExportMode = "html" | "wp-placeholder" | "standalone";

export async function exportSite(args: { url?: string; html?: string; mode?: ExportMode }) {
  const { url, html, mode = "html" } = args;

  const r = await fetch("http://127.0.0.1:8787/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, html, mode }),
  });

  if (!r.ok) throw new Error("Export failed");

  const blob = await r.blob();
  const downloadUrl = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = downloadUrl;

  // Match backend filenames
  a.download =
    mode === "wp-placeholder" ? "site_wp_placeholder.zip" :
    mode === "standalone" ? "site_standalone.zip" :
    "site_html.zip";

  document.body.appendChild(a);
  a.click();
  a.remove();

  URL.revokeObjectURL(downloadUrl);
}
