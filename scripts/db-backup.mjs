#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const dbPath = process.env.DB_PATH || path.join(root, 'server', 'data', 'editor.db');
const backupDir = process.env.DB_BACKUP_DIR || path.join(root, 'server', 'data', 'backups');

if (!fs.existsSync(dbPath)) {
  console.error(`db-backup failed: database not found at ${dbPath}`);
  process.exit(1);
}

fs.mkdirSync(backupDir, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `editor-${timestamp}.db`);
fs.copyFileSync(dbPath, backupPath);
console.log(`db-backup ok: ${backupPath}`);
