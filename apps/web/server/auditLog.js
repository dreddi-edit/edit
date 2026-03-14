import db from "./db.js";

export function logAudit({ userId = null, action, targetType = "", targetId = "", meta = {} }) {
  try {
    if (!action) return;
    db.prepare(
      "INSERT INTO audit_logs (user_id, action, target_type, target_id, meta_json) VALUES (?, ?, ?, ?, ?)"
    ).run(userId || null, action, targetType || null, targetId ? String(targetId) : null, JSON.stringify(meta || {}));
  } catch (error) {
    console.warn("audit log failed:", error?.message || error);
  }
}
