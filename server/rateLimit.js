import rateLimit from 'express-rate-limit';

// Diese Funktion wird von auth.js aufgerufen
export const createRateLimit = ({ windowMs, max, message }) => {
  return rateLimit({
    windowMs: windowMs || 15 * 60 * 1000,
    max: max || 100,
    message: { error: message || "Zu viele Anfragen." },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.user?.id || req.ip
  });
};

// Diese Konstante wird für die KI-Funktionen genutzt
export const aiRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "KI-Limit erreicht. Bitte in 15 Min. erneut versuchen." },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id || req.ip
});
