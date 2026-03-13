import { rewriteHtmlAssets, rewriteCssUrls } from "./rewriteAssets.js";
import dnsPromises from "node:dns/promises";
import net from "node:net";

const MAX_PROXY_REDIRECTS = 5;

export class ProxySafetyError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "ProxySafetyError";
    this.status = status;
  }
}

function stripIpv6Decorators(value) {
  return String(value || "").trim().replace(/^\[/, "").replace(/\]$/, "").split("%")[0].toLowerCase();
}

function isPrivateIpv4(value) {
  const parts = String(value || "").split(".").map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) return true;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 0) return true;
  return false;
}

function isPrivateIpv6(value) {
  const ip = stripIpv6Decorators(value);
  if (!ip) return true;
  if (ip === "::1" || ip === "::") return true;
  if (ip.startsWith("fc") || ip.startsWith("fd")) return true;
  if (ip.startsWith("fe80")) return true;
  if (ip.startsWith("::ffff:")) {
    const mapped = ip.slice(7);
    if (net.isIP(mapped) === 4) return isPrivateIpv4(mapped);
  }
  return false;
}

function isPrivateIp(value) {
  const ip = stripIpv6Decorators(value);
  const family = net.isIP(ip);
  if (!family) return true;
  if (family === 4) return isPrivateIpv4(ip);
  return isPrivateIpv6(ip);
}

function assertAllowedHostname(hostname) {
  const normalized = stripIpv6Decorators(hostname);
  if (!normalized) {
    throw new ProxySafetyError(400, "Missing hostname.");
  }
  if (normalized === "localhost" || normalized.endsWith(".localhost") || normalized.endsWith(".local")) {
    throw new ProxySafetyError(403, "Proxying to this destination is forbidden.");
  }
  return normalized;
}

async function assertPublicDestination(hostname) {
  const normalized = assertAllowedHostname(hostname);
  const ipFamily = net.isIP(normalized);
  if (ipFamily) {
    if (isPrivateIp(normalized)) {
      throw new ProxySafetyError(403, "Proxying to this destination is forbidden.");
    }
    return;
  }

  let records;
  try {
    records = await dnsPromises.lookup(normalized, { all: true, verbatim: true });
  } catch {
    throw new ProxySafetyError(400, "Could not resolve hostname.");
  }

  if (!Array.isArray(records) || records.length === 0) {
    throw new ProxySafetyError(400, "Could not resolve hostname.");
  }

  if (records.some((record) => isPrivateIp(record.address))) {
    throw new ProxySafetyError(403, "Proxying to this destination is forbidden.");
  }
}

async function normalizeAndValidateProxyUrl(rawUrl) {
  const value = String(rawUrl || "").trim();
  if (!value) {
    throw new ProxySafetyError(400, "Missing url");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new ProxySafetyError(400, "Invalid url");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new ProxySafetyError(403, "Only HTTP/HTTPS allowed.");
  }
  if (parsed.username || parsed.password) {
    throw new ProxySafetyError(403, "Credentials in URL are not allowed.");
  }

  await assertPublicDestination(parsed.hostname);
  return parsed.toString();
}

function isRedirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(Number(status));
}

export async function fetchWithSsrfProtection(rawUrl, init = {}) {
  let currentUrl = await normalizeAndValidateProxyUrl(rawUrl);

  for (let redirects = 0; redirects <= MAX_PROXY_REDIRECTS; redirects += 1) {
    const response = await fetch(currentUrl, { ...init, redirect: "manual" });
    if (!isRedirectStatus(response.status)) {
      return response;
    }

    const location = String(response.headers.get("location") || "").trim();
    if (!location) return response;
    if (redirects === MAX_PROXY_REDIRECTS) {
      throw new ProxySafetyError(508, "Too many redirects.");
    }

    let nextUrl;
    try {
      nextUrl = new URL(location, currentUrl).toString();
    } catch {
      throw new ProxySafetyError(400, "Invalid redirect target.");
    }
    currentUrl = await normalizeAndValidateProxyUrl(nextUrl);
  }

  throw new ProxySafetyError(508, "Too many redirects.");
}

export async function proxy(req, res) {
  try {
    const targetUrl = req.query.url;
    if (!targetUrl) return res.status(400).send("Missing url");

    const r = await fetchWithSsrfProtection(targetUrl, {
      headers: {
        "User-Agent": "site-editor-proxy",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      }
    });

    const ct = r.headers.get("content-type") || "text/html; charset=utf-8";
    const html = await r.text();

    const rebuilt = rewriteHtmlAssets(html, r.url || String(targetUrl), "/asset");
    res.status(r.status);
    res.setHeader("Content-Type", ct.includes("text/html") ? "text/html; charset=utf-8" : ct);
    res.send(rebuilt);
  } catch (e) {
    if (e instanceof ProxySafetyError) {
      return res.status(e.status).send(e.message);
    }
    res.status(500).send(String(e?.message || e));
  }
}

export async function asset(req, res) {
  try {
    const url = req.query.url;
    const ref = req.query.ref;
    if (!url) return res.status(400).send("Missing url");

    const r = await fetchWithSsrfProtection(url, {
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
      const rewritten = rewriteCssUrls(css, r.url || String(url), "/asset");
      return res.send(rewritten);
    }

    return res.send(buf);
  } catch (e) {
    if (e instanceof ProxySafetyError) {
      return res.status(e.status).send(e.message);
    }
    res.status(500).send(String(e?.message || e));
  }
}
