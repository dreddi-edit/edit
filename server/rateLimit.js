import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

function buildKey(req) {
  if (req.user?.id) return `user:${req.user.id}`;
  return `ip:${ipKeyGenerator(req.ip)}`;
}

export const createRateLimit = ({ windowMs, max, message, keyFn, keyPrefix }) =>
  rateLimit({
    windowMs: windowMs || 15 * 60 * 1000,
    max: max || 100,
    message: { error: message || 'Zu viele Anfragen.' },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const customKey = typeof keyFn === 'function' ? keyFn(req) : '';
      const baseKey = String(customKey || buildKey(req));
      return keyPrefix ? `${keyPrefix}:${baseKey}` : baseKey;
    },
  });

export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: 'KI-Limit erreicht. Bitte in 15 Min. erneut versuchen.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => buildKey(req),
});
