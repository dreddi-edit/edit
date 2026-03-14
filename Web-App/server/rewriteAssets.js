export function rewriteHtmlAssets(html, pageUrl, assetPath) {
  const base = new URL(pageUrl);

  const toAbs = (u) => {
    const v = (u || "").trim();
    if (!v) return v;
    if (v.startsWith(`${assetPath}?url=`)) return v;
    if (v.startsWith("data:") || v.startsWith("mailto:") || v.startsWith("tel:") || v.startsWith("javascript:") || v.startsWith("#")) return u;
    try {
      if (v.startsWith("//")) return new URL(base.protocol + v).toString();
      return new URL(v, base).toString();
    } catch {
      return u;
    }
  };

  const proxify = (abs) => String(abs).startsWith(`${assetPath}?url=`)
    ? abs
    : `${assetPath}?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(pageUrl)}`;

  let out = html;

  out = out.replace(/<base\b[^>]*>/gi, "");

  out = out.replace(/<link\b([^>]*?)\bhref=(["'])([^"']*)(\2)([^>]*)>/gi, (m, pre, q, href, _q2, post) => {
    const abs = toAbs(href);
    if (!abs) return m;
    return `<link${pre}href="${proxify(abs)}"${post}>`;
  });

  out = out.replace(/<script\b([^>]*?)\bsrc=(["'])([^"']*)(\2)([^>]*)>/gi, (m, pre, q, src, _q2, post) => {
    const abs = toAbs(src);
    if (!abs) return m;
    return `<script${pre}src="${proxify(abs)}"${post}>`;
  });

  out = out.replace(/<img\b([^>]*?)\bsrc=(["'])([^"']*)(\2)([^>]*)>/gi, (m, pre, q, src, _q2, post) => {
    const abs = toAbs(src);
    if (!abs) return m;
    return `<img${pre}src="${proxify(abs)}"${post}>`;
  });

  out = out.replace(/srcset=(["'])([^"']*)(\1)/gi, (m, q, val) => {
    const parts = val.split(",").map(p => p.trim()).filter(Boolean);
    const rewritten = parts.map(p => {
      const seg = p.split(/\s+/);
      const url = seg[0];
      const rest = seg.slice(1).join(" ");
      const abs = toAbs(url);
      const nu = proxify(abs);
      return rest ? `${nu} ${rest}` : nu;
    }).join(", ");
    return `srcset="${rewritten}"`;
  });

  out = out.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/gi, (m, attrs = "", css = "") => {
    return `<style${attrs}>${rewriteCssUrls(css, pageUrl, assetPath)}</style>`;
  });

  out = out.replace(/\sstyle=(["'])([\s\S]*?)\1/gi, (m, q, css) => {
    return ` style="${rewriteCssUrls(css, pageUrl, assetPath)}"`;
  });

  return out;
}

export function rewriteCssUrls(cssText, cssUrl, assetPath) {
  const base = new URL(cssUrl);

  const toAbs = (u) => {
    const v = (u || "").trim().replace(/^['"]|['"]$/g, "");
    if (!v) return u;
    if (v.startsWith("data:") || v.startsWith("#")) return u;
    try {
      if (v.startsWith("//")) return new URL(base.protocol + v).toString();
      return new URL(v, base).toString();
    } catch {
      return u;
    }
  };

  const proxify = (abs) => String(abs).startsWith(`${assetPath}?url=`)
    ? abs
    : `${assetPath}?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(cssUrl)}`;

  return cssText.replace(/url\(([^)]+)\)/gi, (m, inner) => {
    const abs = toAbs(inner);
    if (!abs || abs === inner) return m;
    return `url("${proxify(abs)}")`;
  });
}
