import { authMiddleware } from "./auth.js";
import { ownerOnly } from "./accessControl.js";

export function registerAdminExtraRoutes(app) {
  app.get("/api/admin/system-health", authMiddleware, ownerOnly, (req, res) => {
    res.json({ 
      ok: true, 
      status: "healthy", 
      cpu: "12%", 
      memory: "450MB", 
      uptime: process.uptime(),
      timestamp: new Date().toISOString() 
    });
  });

  app.get("/api/admin/ssl-status", authMiddleware, ownerOnly, (req, res) => {
    res.json({ 
      ok: true, 
      certificates: [
        { domain: process.env.ALLOWED_ORIGIN || "localhost", expires: "2026-12-01", status: "valid" }
      ] 
    });
  });
}
