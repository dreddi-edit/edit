import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import Database from "better-sqlite3"

test("legacy projects table migrates share token with a unique index", async (t) => {
  const tempDir = mkdtempSync(join(tmpdir(), "site-editor-db-"))
  const dbPath = join(tempDir, "legacy.db")
  const previousDbPath = process.env.DB_PATH

  t.after(() => {
    if (previousDbPath === undefined) delete process.env.DB_PATH
    else process.env.DB_PATH = previousDbPath
    rmSync(tempDir, { recursive: true, force: true })
  })

  const legacyDb = new Database(dbPath)
  legacyDb.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE projects (
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
      approved_at TEXT,
      shipped_at TEXT,
      thumbnail TEXT,
      pinned INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `)
  legacyDb.close()

  process.env.DB_PATH = dbPath

  const moduleUrl = `${new URL("../db.js", import.meta.url).href}?test=${Date.now()}`
  const { default: migratedDb } = await import(moduleUrl)

  t.after(() => {
    migratedDb.close()
  })

  const columns = migratedDb.prepare("PRAGMA table_info(projects)").all()
  assert.ok(columns.some((column) => column.name === "share_token"))
  assert.ok(columns.some((column) => column.name === "approval_status"))
  assert.ok(columns.some((column) => column.name === "tags_json"))

  const indexes = migratedDb.prepare("PRAGMA index_list(projects)").all()
  assert.ok(indexes.some((index) => index.name === "idx_projects_share_token" && index.unique === 1))

  const migration = migratedDb
    .prepare("SELECT 1 FROM schema_migrations WHERE id = ?")
    .get("20260313_lane2_projects_share_approval")
  assert.ok(migration)
  const tagsMigration = migratedDb
    .prepare("SELECT 1 FROM schema_migrations WHERE id = ?")
    .get("20260313_projects_tags_json")
  assert.ok(tagsMigration)
})
