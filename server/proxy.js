import { rewriteHtmlAssets, rewriteCssUrls } from "./rewriteAssets.js";

export async function proxy(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("missing url");

    const r = await fetch(targetUrl, {
      redirect: "follow",
      headers: {
        "User-Agent": "site-editor-proxy",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const ct = r.headers.get("content-type") || "text/html; charset=utf-8";
    const html = await r.text();

    const rebuilt = rewriteHtmlAssets(html, targetUrl, "/asset");
    res.status(r.status);
    res.setHeader("Content-Type", ct.includes("text/html") ? "text/html; charset=utf-8" : ct);
    res.send(rebuilt);
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}

export async function asset(req, res) {
  try {
    const url = req.query.url;
    const ref = req.query.ref;
    if (!url) return res.status(400).send("missing url");

    const r = await fetch(url, {
      redirect: "follow",
      headers: {
        "User-Agent": "site-editor-proxy",
        ...(ref ? { "Referer": ref } : {})
      }
    });

    const ct = r.headers.get("content-type") || "";
    const ab = await r.arrayBuffer();
    const buf = Buffer.from(ab);

    res.status(r.status);
    if (ct) res.setHeader("Content-Type", ct);

    if (ct.includes("text/css")) {
      const css = buf.toString("utf-8");
      const rewritten = rewriteCssUrls(css, url, "/asset");
      return res.send(rewritten);
    }

    return res.send(buf);
  } catch (e) {
    res.status(500).send(String(e?.message || e));
  }
}
