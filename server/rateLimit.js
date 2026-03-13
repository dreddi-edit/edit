import rateLimit from 'express-rate-limit';

export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 20, // Maximal 20 KI-Anfragen pro User in diesem Fenster
  message: { error: "Zu viele Anfragen. Bitte versuche es in 15 Minuten erneut." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});
