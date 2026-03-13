import crypto from "node:crypto";

import db from "./db.js";
import { authMiddleware } from "./auth.js";
import { logAudit } from "./auditLog.js";
import { createProjectVersion } from "./projects.js";
import {
  isValidationError,
  readId,
  readOptionalHtml,
  readOptionalString,
  readRequiredString,
} from "./validation.js";
import { getExportSlug, generateShopifySection } from "./deliveryArtifacts.js";

const SUPPORTED_TARGETS = ["firebase", "netlify", "vercel", "wordpress", "shopify"];

function safeMsg(error) {
  return String(error?.message || error || "Unknown error");
}

function insertDeployment({ projectId, userId, target, exportMode, platform }) {
  const result = db.prepare(`
    INSERT INTO publish_deployments
      (project_id, user_id, target, status, export_mode, platform, manifest_json)
    VALUES (?, ?, ?, 'pending', ?, ?, '{}')
  `).run(projectId, userId, target, exportMode || "html-clean", platform || "unknown");
  return Number(result.lastInsertRowid);
}

function finaliseDeployment(id, { status, deployUrl = null, previewUrl = null, errorMessage = null, manifest = null }) {
  db.prepare(`
    UPDATE publish_deployments SET
      status = ?,
      deploy_url = COALESCE(?, deploy_url),
      preview_url = COALESCE(?, preview_url),
      error_message = COALESCE(?, error_message),
      manifest_json = COALESCE(?, manifest_json),
      finished_at = datetime('now')
    WHERE id = ?
  `).run(
    status,
    deployUrl,
    previewUrl,
    errorMessage,
    manifest ? JSON.stringify(manifest) : null,
    id
  );
}

function getOwnedProject(projectId, userId) {
  return db.prepare("SELECT * FROM projects WHERE id = ? AND user_id = ?").get(projectId, userId);
}

async function firebaseDeploy({ html, siteId }) {
  const serviceJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceJson) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not configured");

  const { GoogleAuth } = await import("google-auth-library");
  const credentials = JSON.parse(serviceJson);
  const auth = new GoogleAuth({
    credentials,
    scopes: [
      "https://www.googleapis.com/auth/cloud-platform",
      "https://www.googleapis.com/auth/firebase",
    ],
  });
  const client = await auth.getClient();
  const token = (await client.getAccessToken()).token;
  const bearer = `Bearer ${token}`;

  const resolvedSiteId = siteId || process.env.FIREBASE_SITE_ID || credentials.project_id;
  if (!resolvedSiteId) {
    throw new Error("Firebase siteId is required (set FIREBASE_SITE_ID or pass siteId in the request body)");
  }

  const base = `https://firebasehosting.googleapis.com/v1beta1/sites/${resolvedSiteId}`;
  const createRes = await fetch(`${base}/versions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: bearer },
    body: JSON.stringify({ config: { rewrites: [{ glob: "**", path: "/index.html" }] } }),
  });
  if (!createRes.ok) throw new Error(`Firebase createVersion ${createRes.status}: ${await createRes.text()}`);
  const { name: versionName } = await createRes.json();

  const htmlBuffer = Buffer.from(html, "utf8");
  const fileHash = crypto.createHash("sha256").update(htmlBuffer).digest("hex");

  const populateRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${versionName}:populateFiles`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: bearer },
    body: JSON.stringify({ files: { "/index.html": fileHash } }),
  });
  if (!populateRes.ok) throw new Error(`Firebase populateFiles ${populateRes.status}: ${await populateRes.text()}`);
  const { uploadUrl } = await populateRes.json();

  if (uploadUrl) {
    const uploadRes = await fetch(`${uploadUrl}/${fileHash}`, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", Authorization: bearer },
      body: htmlBuffer,
    });
    if (!uploadRes.ok) throw new Error(`Firebase upload ${uploadRes.status}: ${await uploadRes.text()}`);
  }

  const finalizeRes = await fetch(`https://firebasehosting.googleapis.com/v1beta1/${versionName}?updateMask=status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Authorization: bearer },
    body: JSON.stringify({ status: "FINALIZED" }),
  });
  if (!finalizeRes.ok) throw new Error(`Firebase finalizeVersion ${finalizeRes.status}: ${await finalizeRes.text()}`);

  const releaseRes = await fetch(`${base}/releases?versionName=${encodeURIComponent(versionName)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: bearer },
    body: JSON.stringify({}),
  });
  if (!releaseRes.ok) throw new Error(`Firebase release ${releaseRes.status}: ${await releaseRes.text()}`);

  return {
    deployUrl: `https://${resolvedSiteId}.web.app`,
    siteId: resolvedSiteId,
    versionName,
  };
}

async function netlifyDeploy({ html, siteId, token: userToken }) {
  const token = userToken || process.env.NETLIFY_TOKEN;
  if (!token) throw new Error("NETLIFY_TOKEN is not configured");

  const htmlBuffer = Buffer.from(html, "utf8");
  const fileHash = crypto.createHash("sha1").update(htmlBuffer).digest("hex");

  let resolvedSiteId = siteId;
  if (!resolvedSiteId) {
    const createRes = await fetch("https://api.netlify.com/api/v1/sites", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: `site-editor-${Date.now()}` }),
    });
    if (!createRes.ok) throw new Error(`Netlify createSite ${createRes.status}: ${await createRes.text()}`);
    resolvedSiteId = (await createRes.json()).id;
  }

  const deployRes = await fetch(`https://api.netlify.com/api/v1/sites/${resolvedSiteId}/deploys`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ files: { "/index.html": fileHash }, async: false }),
  });
  if (!deployRes.ok) throw new Error(`Netlify createDeploy ${deployRes.status}: ${await deployRes.text()}`);
  const deployData = await deployRes.json();

  const uploadRes = await fetch(`https://api.netlify.com/api/v1/deploys/${deployData.id}/files/index.html`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/octet-stream" },
    body: htmlBuffer,
  });
  if (!uploadRes.ok) throw new Error(`Netlify uploadFile ${uploadRes.status}: ${await uploadRes.text()}`);

  return {
    deployUrl: deployData.ssl_url || deployData.url || `https://${resolvedSiteId}.netlify.app`,
    deployId: deployData.id,
    siteId: resolvedSiteId,
  };
}

async function vercelDeploy({ html, projectName, token: userToken }) {
  const token = userToken || process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured");

  const name = projectName
    ? String(projectName)
        .toLowerCase()
        .replace(/[^a-z0-9-]/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 52) || "site-editor"
    : `site-editor-${Date.now()}`;

  const deployRes = await fetch("https://api.vercel.com/v13/deployments", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      files: [{ file: "index.html", data: html, encoding: "utf-8" }],
      projectSettings: { framework: null },
    }),
  });
  if (!deployRes.ok) throw new Error(`Vercel deploy ${deployRes.status}: ${await deployRes.text()}`);
  const data = await deployRes.json();

  return {
    deployUrl: data.url ? `https://${data.url}` : null,
    deployId: data.id,
    projectName: name,
  };
}

async function wordPressDeploy({ html, wpUrl, wpUser, wpAppPassword, pageTitle, pageId }) {
  if (!wpUrl) throw new Error("WordPress site URL is required");
  if (!wpUser || !wpAppPassword) throw new Error("WordPress username and application password are required");

  const creds = Buffer.from(`${wpUser}:${wpAppPassword}`).toString("base64");
  const headers = { Authorization: `Basic ${creds}`, "Content-Type": "application/json" };
  const apiBase = `${wpUrl.replace(/\/+$/, "")}/wp-json/wp/v2`;
  const title = pageTitle || "Site Editor Export";

  if (pageId) {
    const updateRes = await fetch(`${apiBase}/pages/${pageId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({ title, content: html, status: "publish" }),
    });
    if (!updateRes.ok) throw new Error(`WordPress updatePage ${updateRes.status}: ${await updateRes.text()}`);
    const page = await updateRes.json();
    return { deployUrl: page.link, pageId: page.id };
  }

  const createRes = await fetch(`${apiBase}/pages`, {
    method: "POST",
    headers,
    body: JSON.stringify({ title, content: html, status: "publish" }),
  });
  if (!createRes.ok) throw new Error(`WordPress createPage ${createRes.status}: ${await createRes.text()}`);
  const page = await createRes.json();
  return { deployUrl: page.link, pageId: page.id };
}

async function shopifyDeploy({ liquidContent, shopDomain, accessToken, themeId, fileName }) {
  if (!shopDomain) throw new Error("Shopify shopDomain is required");
  if (!accessToken) throw new Error("Shopify accessToken is required");

  const domain = shopDomain.replace(/^https?:\/\//, "").replace(/\/+$/, "");
  const resolvedThemeId = themeId || process.env.SHOPIFY_THEME_ID;
  if (!resolvedThemeId) {
    throw new Error("Shopify themeId is required (set SHOPIFY_THEME_ID or pass themeId in the request body)");
  }

  const assetKey = fileName ? `sections/${fileName}` : "sections/site-editor-section.liquid";
  const uploadRes = await fetch(`https://${domain}/admin/api/2024-01/themes/${resolvedThemeId}/assets.json`, {
    method: "PUT",
    headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
    body: JSON.stringify({ asset: { key: assetKey, value: liquidContent } }),
  });
  if (!uploadRes.ok) throw new Error(`Shopify uploadAsset ${uploadRes.status}: ${await uploadRes.text()}`);
  const data = await uploadRes.json();

  return {
    deployUrl: `https://${domain}`,
    assetKey: data.asset?.key || assetKey,
    themeId: resolvedThemeId,
  };
}

export function registerPublishRoutes(app) {
  app.get("/api/publish/targets", authMiddleware, (_req, res) => {
    res.json({
      ok: true,
      targets: [
        {
          id: "firebase",
          label: "Firebase Hosting",
          configured: !!process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
          requiredEnv: ["GOOGLE_SERVICE_ACCOUNT_JSON"],
          optionalEnv: ["FIREBASE_SITE_ID"],
          requiredBody: ["siteId"],
        },
        {
          id: "netlify",
          label: "Netlify",
          configured: !!process.env.NETLIFY_TOKEN,
          requiredEnv: ["NETLIFY_TOKEN"],
          requiredBody: [],
        },
        {
          id: "vercel",
          label: "Vercel",
          configured: !!process.env.VERCEL_TOKEN,
          requiredEnv: ["VERCEL_TOKEN"],
          requiredBody: [],
        },
        {
          id: "wordpress",
          label: "WordPress",
          configured: false,
          requiredEnv: [],
          requiredBody: ["wpUrl", "wpUser", "wpAppPassword"],
        },
        {
          id: "shopify",
          label: "Shopify",
          configured: !!process.env.SHOPIFY_THEME_ID,
          requiredEnv: ["SHOPIFY_THEME_ID"],
          requiredBody: ["shopDomain", "accessToken"],
        },
      ],
    });
  });

  app.post("/api/projects/:id/publish/preview", authMiddleware, async (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt");
      const project = getOwnedProject(projectId, req.user.id);
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" });
      const previewHtml = readOptionalHtml(req.body?.html, "HTML", { max: 5_000_000 }) || String(project.html || "");
      if (!previewHtml.trim()) return res.status(400).json({ ok: false, error: "Project has no HTML to preview" });

      db.prepare("DELETE FROM project_preview_tokens WHERE project_id = ? AND datetime(expires_at) < datetime('now')").run(projectId);

      const token = crypto.randomBytes(24).toString("hex");
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      db.prepare("INSERT INTO project_preview_tokens (project_id, token, html, expires_at) VALUES (?, ?, ?, ?)").run(
        projectId,
        token,
        previewHtml,
        expiresAt
      );

      const previewUrl = `${req.protocol}://${req.get("host")}/publish-preview/${token}`;
      logAudit({
        userId: req.user.id,
        action: "project.publish.preview",
        targetType: "project",
        targetId: projectId,
        meta: { token },
      });

      res.json({ ok: true, previewUrl, expiresAt, token });
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message });
      res.status(500).json({ ok: false, error: safeMsg(error) });
    }
  });

  app.get("/publish-preview/:token", (req, res) => {
    try {
      const row = db.prepare(
        "SELECT html FROM project_preview_tokens WHERE token = ? AND datetime(expires_at) > datetime('now')"
      ).get(req.params.token);
      if (!row) return res.status(404).send("Preview link not found or has expired.");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.send(row.html);
    } catch {
      res.status(500).send("Preview error");
    }
  });

  app.post("/api/projects/:id/publish", authMiddleware, async (req, res) => {
    let deploymentId = null;
    try {
      const projectId = readId(req.params.id, "Projekt");
      const target = readRequiredString(req.body?.target, "target", { max: 40 });
      if (!SUPPORTED_TARGETS.includes(target)) {
        return res.status(400).json({
          ok: false,
          error: `Unsupported target "${target}". Supported: ${SUPPORTED_TARGETS.join(", ")}`,
        });
      }

      const project = getOwnedProject(projectId, req.user.id);
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" });
      const publishHtml = readOptionalHtml(req.body?.html, "HTML", { max: 5_000_000 }) || String(project.html || "");
      if (!publishHtml.trim()) return res.status(400).json({ ok: false, error: "Project has no HTML to deploy" });

      const exportMode = readOptionalString(req.body?.exportMode, "exportMode", { max: 40, empty: "html-clean" }) || "html-clean";
      createProjectVersion(projectId, {
        html: publishHtml,
        label: `Before publish · ${target}`,
        source: "export",
      })
      deploymentId = insertDeployment({
        projectId,
        userId: req.user.id,
        target,
        exportMode,
        platform: project.platform || "unknown",
      });

      let result = {};
      if (target === "firebase") {
        const siteId = readOptionalString(req.body?.siteId, "siteId", { max: 128, empty: "" });
        result = await firebaseDeploy({ html: publishHtml, siteId });
      } else if (target === "netlify") {
        const siteId = readOptionalString(req.body?.siteId, "siteId", { max: 128, empty: "" });
        const token = readOptionalString(req.body?.token, "token", { max: 512, empty: "" });
        result = await netlifyDeploy({ html: publishHtml, siteId, token });
      } else if (target === "vercel") {
        const token = readOptionalString(req.body?.token, "token", { max: 512, empty: "" });
        result = await vercelDeploy({ html: publishHtml, projectName: project.name, token });
      } else if (target === "wordpress") {
        const wpUrl = readRequiredString(req.body?.wpUrl, "wpUrl", { max: 512 });
        const wpUser = readRequiredString(req.body?.wpUser, "wpUser", { max: 200 });
        const wpAppPassword = readRequiredString(req.body?.wpAppPassword, "wpAppPassword", { max: 512 });
        const pageId = readOptionalString(req.body?.pageId, "pageId", { max: 20, empty: "" }) || null;
        result = await wordPressDeploy({
          html: publishHtml,
          wpUrl,
          wpUser,
          wpAppPassword,
          pageTitle: project.name,
          pageId,
        });
      } else if (target === "shopify") {
        const shopDomain = readRequiredString(req.body?.shopDomain, "shopDomain", { max: 256 });
        const accessToken = readRequiredString(req.body?.accessToken, "accessToken", { max: 512 });
        const themeId = readOptionalString(req.body?.themeId, "themeId", { max: 40, empty: "" });
        const liquidContent = generateShopifySection(publishHtml);
        result = await shopifyDeploy({
          liquidContent,
          shopDomain,
          accessToken,
          themeId,
          fileName: `${getExportSlug(project)}.liquid`,
        });
      }

      finaliseDeployment(deploymentId, {
        status: "success",
        deployUrl: result.deployUrl || null,
        manifest: { ...result, target, exportMode },
      });

      db.prepare(`
        UPDATE projects
        SET
          last_activity_at = datetime('now'),
          updated_at = datetime('now'),
          last_export_at = datetime('now'),
          last_export_mode = ?,
          last_export_warning_count = 0,
          delivery_status = 'published'
        WHERE id = ?
      `).run(exportMode, projectId);
      logAudit({
        userId: req.user.id,
        action: `project.publish.${target}`,
        targetType: "project",
        targetId: projectId,
        meta: { deploymentId, target, deployUrl: result.deployUrl || null },
      });

      res.json({ ok: true, deploymentId, target, deployUrl: result.deployUrl || null, result });
    } catch (error) {
      if (deploymentId) finaliseDeployment(deploymentId, { status: "failed", errorMessage: safeMsg(error) });
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message });
      console.error("Publish error:", error);
      res.status(500).json({ ok: false, error: safeMsg(error) });
    }
  });

  app.get("/api/projects/:id/publish/history", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt");
      if (!getOwnedProject(projectId, req.user.id)) {
        return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" });
      }

      const rows = db.prepare(`
        SELECT
          pd.id,
          pd.target,
          pd.status,
          pd.deploy_url,
          pd.preview_url,
          pd.export_mode,
          pd.platform,
          pd.error_message,
          pd.manifest_json,
          pd.created_at,
          pd.finished_at,
          u.email AS deployed_by
        FROM publish_deployments pd
        LEFT JOIN users u ON u.id = pd.user_id
        WHERE pd.project_id = ?
        ORDER BY pd.created_at DESC
        LIMIT 100
      `).all(projectId);

      const deployments = rows.map((row) => {
        let manifest = {};
        try {
          manifest = JSON.parse(row.manifest_json || "{}");
        } catch {}
        return { ...row, manifest };
      });

      res.json({ ok: true, deployments });
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message });
      res.status(500).json({ ok: false, error: safeMsg(error) });
    }
  });

  app.post("/api/projects/:id/publish/:deploymentId/rollback", authMiddleware, async (req, res) => {
    let rollbackId = null;
    try {
      const projectId = readId(req.params.id, "Projekt");
      const sourceDeploymentId = readId(req.params.deploymentId, "deploymentId");

      const project = getOwnedProject(projectId, req.user.id);
      if (!project) return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" });

      const sourceDeploy = db.prepare(
        "SELECT * FROM publish_deployments WHERE id = ? AND project_id = ? AND status = 'success'"
      ).get(sourceDeploymentId, projectId);
      if (!sourceDeploy) {
        return res.status(404).json({ ok: false, error: "Source deployment not found or was not successful" });
      }

      const versionRow = db.prepare(`
        SELECT html FROM project_versions
        WHERE project_id = ? AND created_at <= ?
        ORDER BY created_at DESC
        LIMIT 1
      `).get(projectId, sourceDeploy.created_at);

      const rollbackHtml = versionRow?.html || project.html;
      if (!rollbackHtml) {
        return res.status(400).json({ ok: false, error: "No HTML snapshot found for this deployment" });
      }

      let manifest = {};
      try {
        manifest = JSON.parse(sourceDeploy.manifest_json || "{}");
      } catch {}

      const target = sourceDeploy.target;
      rollbackId = insertDeployment({
        projectId,
        userId: req.user.id,
        target,
        exportMode: sourceDeploy.export_mode,
        platform: sourceDeploy.platform,
      });

      let result = {};
      if (target === "firebase") {
        result = await firebaseDeploy({ html: rollbackHtml, siteId: manifest.siteId });
      } else if (target === "netlify") {
        result = await netlifyDeploy({ html: rollbackHtml, siteId: manifest.siteId });
      } else if (target === "vercel") {
        result = await vercelDeploy({ html: rollbackHtml, projectName: project.name });
      } else if (target === "wordpress") {
        const wpUrl = readRequiredString(req.body?.wpUrl, "wpUrl", { max: 512 });
        const wpUser = readRequiredString(req.body?.wpUser, "wpUser", { max: 200 });
        const wpAppPassword = readRequiredString(req.body?.wpAppPassword, "wpAppPassword", { max: 512 });
        result = await wordPressDeploy({
          html: rollbackHtml,
          wpUrl,
          wpUser,
          wpAppPassword,
          pageTitle: project.name,
          pageId: manifest.pageId || null,
        });
      } else if (target === "shopify") {
        const shopDomain = readRequiredString(req.body?.shopDomain, "shopDomain", { max: 256 });
        const accessToken = readRequiredString(req.body?.accessToken, "accessToken", { max: 512 });
        const liquidContent = generateShopifySection(rollbackHtml);
        result = await shopifyDeploy({
          liquidContent,
          shopDomain,
          accessToken,
          themeId: manifest.themeId,
          fileName: manifest.assetKey ? String(manifest.assetKey).replace(/^sections\//, "") : undefined,
        });
      } else {
        return res.status(400).json({ ok: false, error: `Rollback not supported for target: ${target}` });
      }

      finaliseDeployment(rollbackId, {
        status: "success",
        deployUrl: result.deployUrl || null,
        manifest: { ...result, target, rollbackOf: sourceDeploymentId },
      });

      db.prepare(`
        UPDATE projects
        SET
          last_activity_at = datetime('now'),
          updated_at = datetime('now'),
          last_export_at = datetime('now'),
          last_export_mode = ?,
          last_export_warning_count = 0,
          delivery_status = 'published'
        WHERE id = ?
      `).run(sourceDeploy.export_mode || "html-clean", projectId);

      logAudit({
        userId: req.user.id,
        action: "project.publish.rollback",
        targetType: "project",
        targetId: projectId,
        meta: { rollbackId, sourceDeploymentId, target },
      });

      res.json({
        ok: true,
        deploymentId: rollbackId,
        target,
        deployUrl: result.deployUrl || null,
        rolledBackFrom: sourceDeploymentId,
      });
    } catch (error) {
      if (rollbackId) finaliseDeployment(rollbackId, { status: "failed", errorMessage: safeMsg(error) });
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message });
      console.error("Rollback error:", error);
      res.status(500).json({ ok: false, error: safeMsg(error) });
    }
  });

  app.post("/api/projects/:id/publish/custom-domain", authMiddleware, (req, res) => {
    try {
      const projectId = readId(req.params.id, "Projekt");
      const domain = readRequiredString(req.body?.domain, "domain", { max: 253 });
      const target = readOptionalString(req.body?.target, "target", { max: 40, empty: "netlify" }) || "netlify";

      if (!getOwnedProject(projectId, req.user.id)) {
        return res.status(404).json({ ok: false, error: "Projekt nicht gefunden" });
      }

      const guides = {
        firebase: {
          steps: [
            "Go to Firebase Console -> Hosting -> Add custom domain.",
            `Enter "${domain}" and follow the verification steps.`,
            "Add the CNAME or A record shown in the Firebase wizard to your DNS provider.",
            "Firebase provisions SSL automatically via Let's Encrypt.",
          ],
          recordType: "CNAME",
          recordValue: `${process.env.FIREBASE_SITE_ID || "<your-site>"}.web.app`,
        },
        netlify: {
          steps: [
            "Go to Netlify Dashboard -> Domain Management -> Add custom domain.",
            `Enter "${domain}".`,
            "Add a CNAME record pointing to your Netlify subdomain.",
            "Netlify provisions SSL via Let's Encrypt automatically.",
          ],
          recordType: "CNAME",
          recordValue: "<your-site>.netlify.app",
        },
        vercel: {
          steps: [
            "Go to Vercel Dashboard -> Project Settings -> Domains -> Add.",
            `Enter "${domain}".`,
            "Add a CNAME record to cname.vercel-dns.com in your DNS provider.",
          ],
          recordType: "CNAME",
          recordValue: "cname.vercel-dns.com",
        },
        wordpress: {
          steps: [
            "Update your WordPress site URL in Settings -> General to match the new domain.",
            "Point your domain's A record to your WordPress server IP.",
            "Run a search-replace on the database to update hardcoded URLs (use WP-CLI or a plugin).",
          ],
          recordType: "A",
          recordValue: "<your-server-ip>",
        },
        shopify: {
          steps: [
            "Go to Shopify Admin -> Online Store -> Domains -> Connect existing domain.",
            `Enter "${domain}" and follow the Shopify wizard.`,
            "Add the CNAME record shown by Shopify to your DNS provider.",
          ],
          recordType: "CNAME",
          recordValue: "shops.myshopify.com",
        },
      };

      const guide = guides[target] || guides.netlify;
      res.json({ ok: true, domain, target, guide });
    } catch (error) {
      if (isValidationError(error)) return res.status(400).json({ ok: false, error: error.message });
      res.status(500).json({ ok: false, error: safeMsg(error) });
    }
  });
}
