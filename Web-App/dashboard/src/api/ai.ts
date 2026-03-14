import { ENDPOINTS } from "../config"
import { apiFetch } from "./client"

type RewriteRes = { ok: boolean; error?: string; html?: string }

export async function aiRewrite(html: string, instruction: string): Promise<string> {
  const d = await apiFetch<RewriteRes>(ENDPOINTS.rewrite, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ html, instruction }),
  })
  if (!d?.ok || !d.html) throw new Error(d?.error ?? "AI rewrite failed")
  return d.html
}
