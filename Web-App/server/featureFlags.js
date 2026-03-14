function readBoolFlag(name, fallback = false) {
  const raw = String(process.env[name] || "").trim().toLowerCase()
  if (!raw) return fallback
  return ["1", "true", "yes", "on"].includes(raw)
}

export const FEATURE_FLAGS = Object.freeze({
  asyncJobs: readBoolFlag("FEATURE_ASYNC_JOBS", true),
  strictShareSanitization: readBoolFlag("FEATURE_STRICT_SHARE_SANITIZATION", true),
  strictAvatarMagicBytes: readBoolFlag("FEATURE_STRICT_AVATAR_MAGIC_BYTES", true),
})
