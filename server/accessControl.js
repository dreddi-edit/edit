export const AGENCY_ROLES = ["owner", "admin", "strategist", "designer", "editor", "client_reviewer"];

export function normalizeAgencyRole(role, fallback = "editor") {
  const value = String(role || "").trim().toLowerCase();
  return AGENCY_ROLES.includes(value) ? value : fallback;
}

export function canInviteWithRole(role) {
  return AGENCY_ROLES.includes(normalizeAgencyRole(role));
}

export function canAdvanceWorkflow(role, stage) {
  const normalizedRole = normalizeAgencyRole(role, "owner");
  const normalizedStage = String(stage || "").trim().toLowerCase();
  if (normalizedRole === "client_reviewer") return normalizedStage === "client_review";
  if (normalizedRole === "editor" || normalizedRole === "designer") {
    return ["draft", "internal_review", "client_review"].includes(normalizedStage);
  }
  return ["draft", "internal_review", "client_review", "approved", "shipped"].includes(normalizedStage);
}

export function canExportProject(role) {
  return normalizeAgencyRole(role, "owner") !== "client_reviewer";
}

export function ownerOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ ok: false, error: "not authenticated" })
  }

  const owner = process.env.OWNER_EMAIL
  if (!owner || req.user.email !== owner) {
    return res.status(403).json({ ok: false, error: "not owner" })
  }

  next()
}
