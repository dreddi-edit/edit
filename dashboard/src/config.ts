export const API_BASE = '';
export const ENDPOINTS = {
  analyze: `${API_BASE}/api/ai/analyze-and-rebuild`,
  rewrite: `${API_BASE}/api/ai/rewrite-block`,
  rewriteStream: `${API_BASE}/api/ai/rewrite-block-stream`,
  proxy: `${API_BASE}/proxy`,
  asset: `${API_BASE}/asset`,
};

export const AI_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3.6, output: 18 },
  "claude-sonnet-4-5-20250929": { input: 3.6, output: 18 },
  "claude-haiku-4-5-20251001": { input: 0.3, output: 1.5 },
  "gemini-2.5-flash": { input: 0.09, output: 0.36 },
  "gemini-2.5-flash-lite": { input: 0.06, output: 0.24 },
  "gemini-2.5-pro": { input: 1.44, output: 4.32 },
  "groq:llama-3.1-8b-instant": { input: 0.12, output: 0.24 },
  "groq:llama-3.3-70b-versatile": { input: 0.9, output: 1.8 },
  "ollama:qwen2.5-coder:7b": { input: 0, output: 0 },
};

function readFeatureFlag(name: string, fallback = false): boolean {
  const env = import.meta.env as Record<string, string | undefined>;
  const value = String(env[name] ?? "").trim().toLowerCase();
  if (!value) return fallback;
  return ["1", "true", "yes", "on"].includes(value);
}

export const FEATURE_FLAGS = Object.freeze({
  asyncJobs: readFeatureFlag("VITE_FEATURE_ASYNC_JOBS", true),
  strictShareSanitization: readFeatureFlag("VITE_FEATURE_STRICT_SHARE_SANITIZATION", true),
  learnContentValidation: readFeatureFlag("VITE_FEATURE_LEARN_CONTENT_VALIDATION", true),
});
