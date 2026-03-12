import Database from "better-sqlite3"
import { join, dirname } from "path"
import { fileURLToPath } from "url"
import { mkdirSync } from "fs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, "data")

// Ensure data directory exists
try {
  mkdirSync(dataDir, { recursive: true })
} catch (error) {
  console.log("Data directory created or already exists:", dataDir)
}

const DB_PATH = process.env.DB_PATH || join(dataDir, "editor.db")
const db = new Database(DB_PATH)

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    avatar_url TEXT,
    email_verified INTEGER NOT NULL DEFAULT 0,
    totp_secret TEXT,
    totp_enabled INTEGER NOT NULL DEFAULT 0,
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    plan_id TEXT NOT NULL DEFAULT 'basis',
    plan_status TEXT NOT NULL DEFAULT 'active',
    notification_prefs TEXT NOT NULL DEFAULT '{"email_updates":true,"team_mentions":true}',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    name TEXT NOT NULL,
    client_name TEXT,
    url TEXT,
    html TEXT,
    pages_json TEXT DEFAULT '[]',
    asset_library_json TEXT DEFAULT '[]',
    platform TEXT DEFAULT 'unknown',
    workflow_status TEXT DEFAULT 'draft',
    workflow_stage TEXT DEFAULT 'draft',
    delivery_status TEXT DEFAULT 'not_exported',
    due_at TEXT,
    last_activity_at TEXT DEFAULT (datetime('now')),
    last_export_at TEXT,
    last_export_mode TEXT,
    last_export_warning_count INTEGER DEFAULT 0,
    brand_context TEXT DEFAULT '{}',
    share_token TEXT,
    approval_status TEXT NOT NULL DEFAULT 'draft',
    status TEXT NOT NULL DEFAULT 'active',
    approved_at TEXT,
    shipped_at TEXT,
    thumbnail TEXT,
    pinned INTEGER DEFAULT 0,
    updated_at TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS project_assignees (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    member_email TEXT NOT NULL,
    role TEXT DEFAULT 'editor',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_project_assignees_unique ON project_assignees(project_id, member_email);
  CREATE INDEX IF NOT EXISTS idx_project_assignees_project ON project_assignees(project_id, created_at);
`)

// User Settings + API Keys
db.exec(`
  CREATE TABLE IF NOT EXISTS user_settings (
    user_id INTEGER PRIMARY KEY,
    theme TEXT DEFAULT 'dark',
    disabled_models TEXT DEFAULT '[]',
    anthropic_key TEXT DEFAULT '',
    gemini_key TEXT DEFAULT '',
    groq_key TEXT DEFAULT '',
    credits INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    owner_id INTEGER NOT NULL,
    member_email TEXT NOT NULL,
    role TEXT DEFAULT 'editor',
    invited_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS product_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    event_name TEXT NOT NULL,
    project_id INTEGER,
    session_id TEXT,
    meta_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );
  CREATE INDEX IF NOT EXISTS idx_product_events_name_created ON product_events(event_name, created_at);
  CREATE INDEX IF NOT EXISTS idx_product_events_user_created ON product_events(user_id, created_at);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action TEXT NOT NULL,
    target_type TEXT,
    target_id TEXT,
    meta_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at);
`)

db.exec(`
  CREATE TABLE IF NOT EXISTS deleted_projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_project_id INTEGER,
    user_id INTEGER NOT NULL,
    name TEXT,
    archive_json TEXT NOT NULL,
    deleted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_deleted_projects_user ON deleted_projects(user_id, deleted_at);

  CREATE TABLE IF NOT EXISTS deleted_templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    original_template_id INTEGER,
    user_id INTEGER NOT NULL,
    name TEXT,
    archive_json TEXT NOT NULL,
    deleted_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_deleted_templates_user ON deleted_templates(user_id, deleted_at);
`)

// Organisationen
db.exec(`
  CREATE TABLE IF NOT EXISTS organisations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    owner_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS org_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    org_id INTEGER NOT NULL,
    user_id INTEGER,
    invite_email TEXT NOT NULL,
    role TEXT DEFAULT 'editor',
    status TEXT DEFAULT 'pending',
    invited_at TEXT DEFAULT (datetime('now')),
    joined_at TEXT,
    FOREIGN KEY (org_id) REFERENCES organisations(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS user_api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    key_value TEXT NOT NULL,
    detected_models TEXT DEFAULT '[]',
    label TEXT DEFAULT '',
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// Credits-Tabelle
db.exec(`
  CREATE TABLE IF NOT EXISTS credits (
    user_id INTEGER PRIMARY KEY,
    balance_eur REAL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS credit_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    amount_eur REAL NOT NULL,
    type TEXT NOT NULL,
    description TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
`)

// Shareable preview links (public, no auth)
db.exec(`
  CREATE TABLE IF NOT EXISTS project_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    html_snapshot TEXT,
    page_id TEXT,
    language_variant TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );
  CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(token);
`)

// Version history (snapshots for rollback)
db.exec(`
  CREATE TABLE IF NOT EXISTS project_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    html TEXT NOT NULL,
    label TEXT,
    source TEXT DEFAULT 'autosave',
    page_id TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id)
  );
  CREATE INDEX IF NOT EXISTS idx_project_versions_project ON project_versions(project_id);

  CREATE TABLE IF NOT EXISTS project_exports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    version_id INTEGER,
    export_mode TEXT NOT NULL,
    platform TEXT DEFAULT 'unknown',
    readiness TEXT DEFAULT 'ready',
    warning_count INTEGER DEFAULT 0,
    manifest_json TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (version_id) REFERENCES project_versions(id)
  );
  CREATE INDEX IF NOT EXISTS idx_project_exports_project ON project_exports(project_id);

  CREATE TABLE IF NOT EXISTS project_workflow_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    from_stage TEXT,
    to_stage TEXT NOT NULL,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (project_id) REFERENCES projects(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_project_workflow_events_project ON project_workflow_events(project_id);

  CREATE TABLE IF NOT EXISTS password_resets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets(token);

  CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
  CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);

  CREATE TABLE IF NOT EXISTS email_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    new_email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);

  CREATE TABLE IF NOT EXISTS totp_pending_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    session_token TEXT UNIQUE NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_totp_pending_token ON totp_pending_sessions(session_token);

  CREATE TABLE IF NOT EXISTS user_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stripe_invoice_id TEXT UNIQUE,
    stripe_charge_id TEXT,
    amount_eur REAL,
    status TEXT,
    receipt_url TEXT,
    refunded INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_user_invoices_user ON user_invoices(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_user_invoices_stripe ON user_invoices(stripe_invoice_id);

  CREATE TABLE IF NOT EXISTS schema_migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT DEFAULT (datetime('now'))
  );
`)

function execMigrationSql(sql) {
  try {
    db.exec(sql)
  } catch (error) {
    const msg = String(error?.message || error)
    if (!/duplicate column name|already exists/i.test(msg)) throw error
  }
}

function runMigration(id, up) {
  const exists = db.prepare("SELECT 1 FROM schema_migrations WHERE id = ?").get(id)
  if (exists) return
  const tx = db.transaction(() => {
    up()
    db.prepare("INSERT INTO schema_migrations (id) VALUES (?)").run(id)
  })
  tx()
}

runMigration("20260310_user_settings_plan", () => {
  execMigrationSql(`ALTER TABLE user_settings ADD COLUMN plan TEXT DEFAULT 'basis'`)
})
runMigration("20260310_projects_pinned", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN pinned INTEGER DEFAULT 0`)
})
runMigration("20260310_projects_platform", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN platform TEXT DEFAULT 'unknown'`)
})
runMigration("20260310_projects_client_name", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN client_name TEXT`)
})
runMigration("20260310_projects_workflow_status", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN workflow_status TEXT DEFAULT 'draft'`)
})
runMigration("20260310_projects_approved_at", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN approved_at TEXT`)
})
runMigration("20260310_projects_shipped_at", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN shipped_at TEXT`)
})
runMigration("20260310_projects_workflow_stage", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN workflow_stage TEXT DEFAULT 'draft'`)
  execMigrationSql(`UPDATE projects SET workflow_stage = COALESCE(workflow_stage, workflow_status, 'draft')`)
})
runMigration("20260310_projects_delivery_status", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN delivery_status TEXT DEFAULT 'not_exported'`)
})
runMigration("20260310_projects_due_at", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN due_at TEXT`)
})
runMigration("20260310_projects_last_activity_at", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN last_activity_at TEXT`)
  execMigrationSql(`UPDATE projects SET last_activity_at = COALESCE(last_activity_at, updated_at, created_at, datetime('now'))`)
})
runMigration("20260310_projects_last_export_at", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN last_export_at TEXT`)
})
runMigration("20260310_projects_last_export_mode", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN last_export_mode TEXT`)
})
runMigration("20260310_projects_last_export_warning_count", () => {
execMigrationSql(`ALTER TABLE projects ADD COLUMN last_export_warning_count INTEGER DEFAULT 0`)
})
runMigration("20260311_projects_pages_json", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN pages_json TEXT DEFAULT '[]'`)
  execMigrationSql(`UPDATE projects SET pages_json = COALESCE(pages_json, '[]')`)
})
runMigration("20260311_projects_asset_library_json", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN asset_library_json TEXT DEFAULT '[]'`)
  execMigrationSql(`UPDATE projects SET asset_library_json = COALESCE(asset_library_json, '[]')`)
})
runMigration("20260311_project_shares_snapshot", () => {
  execMigrationSql(`ALTER TABLE project_shares ADD COLUMN html_snapshot TEXT`)
  execMigrationSql(`ALTER TABLE project_shares ADD COLUMN page_id TEXT`)
  execMigrationSql(`ALTER TABLE project_shares ADD COLUMN language_variant TEXT`)
})
runMigration("20260310_project_exports_table", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS project_exports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      version_id INTEGER,
      export_mode TEXT NOT NULL,
      platform TEXT DEFAULT 'unknown',
      readiness TEXT DEFAULT 'ready',
      warning_count INTEGER DEFAULT 0,
      manifest_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (version_id) REFERENCES project_versions(id)
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_project_exports_project ON project_exports(project_id)`)
})
runMigration("20260310_project_workflow_events", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS project_workflow_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      from_stage TEXT,
      to_stage TEXT NOT NULL,
      comment TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_project_workflow_events_project ON project_workflow_events(project_id)`)
})
runMigration("20260310_audit_logs", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action TEXT NOT NULL,
      target_type TEXT,
      target_id TEXT,
      meta_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)`)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created ON audit_logs(user_id, created_at)`)
})
runMigration("20260310_deleted_archives", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS deleted_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_project_id INTEGER,
      user_id INTEGER NOT NULL,
      name TEXT,
      archive_json TEXT NOT NULL,
      deleted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_deleted_projects_user ON deleted_projects(user_id, deleted_at)`)
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS deleted_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      original_template_id INTEGER,
      user_id INTEGER NOT NULL,
      name TEXT,
      archive_json TEXT NOT NULL,
      deleted_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_deleted_templates_user ON deleted_templates(user_id, deleted_at)`)
})
runMigration("20260311_project_versions_metadata", () => {
  execMigrationSql(`ALTER TABLE project_versions ADD COLUMN label TEXT`)
  execMigrationSql(`ALTER TABLE project_versions ADD COLUMN source TEXT DEFAULT 'autosave'`)
  execMigrationSql(`ALTER TABLE project_versions ADD COLUMN page_id TEXT`)
  execMigrationSql(`UPDATE project_versions SET source = COALESCE(NULLIF(source, ''), 'autosave')`)
})
runMigration("20260312_publish_deployments", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS publish_deployments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      target TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      deploy_url TEXT,
      preview_url TEXT,
      error_message TEXT,
      export_mode TEXT,
      platform TEXT DEFAULT 'unknown',
      manifest_json TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      finished_at TEXT,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_publish_deployments_project ON publish_deployments(project_id, created_at)`)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_publish_deployments_user ON publish_deployments(user_id, created_at)`)
})
runMigration("20260312_project_preview_tokens", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS project_preview_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL,
      deployment_id INTEGER,
      token TEXT UNIQUE NOT NULL,
      html TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id)
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_preview_tokens_token ON project_preview_tokens(token)`)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_preview_tokens_project ON project_preview_tokens(project_id)`)
})
runMigration("20260312_project_exports_outcome", () => {
  execMigrationSql(`ALTER TABLE project_exports ADD COLUMN outcome TEXT DEFAULT 'success'`)
  execMigrationSql(`ALTER TABLE project_exports ADD COLUMN error_message TEXT`)
})
runMigration("20260313_lane2_ai_studio_runs", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS ai_studio_runs (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      project_id TEXT,
      tool_name TEXT NOT NULL,
      input_payload TEXT NOT NULL DEFAULT '{}',
      output_result TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'completed',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_ai_studio_runs_user ON ai_studio_runs(user_id, created_at)`)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_ai_studio_runs_project ON ai_studio_runs(project_id, created_at)`)
})
runMigration("20260313_lane2_block_comments", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS block_comments (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      block_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      comment_text TEXT NOT NULL,
      resolved INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_block_comments_project ON block_comments(project_id, resolved)`)
})
runMigration("20260313_lane2_projects_share_approval", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN share_token TEXT`)
  execMigrationSql(`CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_share_token ON projects(share_token)`)
  execMigrationSql(`ALTER TABLE projects ADD COLUMN approval_status TEXT NOT NULL DEFAULT 'draft'`)
})
runMigration("20260313_lane2_projects_brand_context", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN brand_context TEXT DEFAULT '{}'`)
})
runMigration("20260313_lane2_org_member_role", () => {
  try {
    execMigrationSql(`ALTER TABLE org_members ADD COLUMN role TEXT NOT NULL DEFAULT 'editor'`)
  } catch {}
})
runMigration("20260313_lane2_user_notification_prefs", () => {
  execMigrationSql(`ALTER TABLE users ADD COLUMN notification_prefs TEXT NOT NULL DEFAULT '{"email_updates":true,"team_mentions":true}'`)
})
runMigration("20260313_lane3_auth_columns", () => {
  execMigrationSql(`ALTER TABLE users ADD COLUMN avatar_url TEXT`)
  execMigrationSql(`ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0`)
  execMigrationSql(`ALTER TABLE users ADD COLUMN totp_secret TEXT`)
  execMigrationSql(`ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0`)
})
runMigration("20260313_lane3_billing_columns", () => {
  execMigrationSql(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`)
  execMigrationSql(`ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT`)
  execMigrationSql(`ALTER TABLE users ADD COLUMN plan_id TEXT NOT NULL DEFAULT 'basis'`)
  execMigrationSql(`ALTER TABLE users ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'active'`)
  execMigrationSql(`
    UPDATE users
    SET plan_id = COALESCE(
      NULLIF((SELECT plan FROM user_settings WHERE user_settings.user_id = users.id), ''),
      NULLIF(plan_id, ''),
      'basis'
    )
  `)
})
runMigration("20260313_lane3_projects_status", () => {
  execMigrationSql(`ALTER TABLE projects ADD COLUMN status TEXT NOT NULL DEFAULT 'active'`)
  execMigrationSql(`UPDATE projects SET status = COALESCE(NULLIF(status, ''), 'active')`)
})
runMigration("20260313_lane3_refresh_tokens", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token)`)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id)`)
})
runMigration("20260313_lane3_email_verifications", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS email_verifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      new_email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token)`)
})
runMigration("20260313_lane3_totp_pending", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS totp_pending_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      session_token TEXT UNIQUE NOT NULL,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_totp_pending_token ON totp_pending_sessions(session_token)`)
})
runMigration("20260313_lane3_invoices", () => {
  execMigrationSql(`
    CREATE TABLE IF NOT EXISTS user_invoices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      stripe_invoice_id TEXT UNIQUE,
      stripe_charge_id TEXT,
      amount_eur REAL,
      status TEXT,
      receipt_url TEXT,
      refunded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_user_invoices_user ON user_invoices(user_id, created_at)`)
  execMigrationSql(`CREATE INDEX IF NOT EXISTS idx_user_invoices_stripe ON user_invoices(stripe_invoice_id)`)
})

export default db
