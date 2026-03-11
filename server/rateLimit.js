export function createRateLimit({ windowMs, max, keyPrefix = "global", message = "Too many requests. Try again later.", keyFn } = {}) {
  const buckets = new Map()

  return function rateLimit(req, res, next) {
    const now = Date.now()
    const baseKey = keyFn
      ? keyFn(req)
      : (req.user?.id ? `user:${req.user.id}` : (req.ip || req.socket?.remoteAddress || "unknown"))
    const key = `${keyPrefix}:${baseKey}`
    const bucket = buckets.get(key) || { count: 0, resetAt: now + windowMs }

    if (now > bucket.resetAt) {
      bucket.count = 0
      bucket.resetAt = now + windowMs
    }

    bucket.count += 1
    buckets.set(key, bucket)

    if (bucket.count > max) {
      const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))
      res.setHeader("Retry-After", String(retryAfterSec))
      return res.status(429).json({ ok: false, error: message, retry_after_sec: retryAfterSec })
    }

    next()
  }
}
