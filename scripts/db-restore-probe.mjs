#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const backupDir = process.env.DB_BACKUP_DIR || path.join(root, 'apps', 'web', 'server', 'data', 'backups');

if (!fs.existsSync(backupDir)) {
  console.error(`db-restore-probe failed: backup directory not found at ${backupDir}`);
  process.exit(1);
}

const backups = fs
  .readdirSync(backupDir)
  .filter((file) => file.endsWith('.db'))
  .map((file) => ({
    file,
    mtime: fs.statSync(path.join(backupDir, file)).mtimeMs,
  }))
  .sort((a, b) => b.mtime - a.mtime);

if (!backups.length) {
  console.error('db-restore-probe failed: no backup files found');
  process.exit(1);
}

const latest = path.join(backupDir, backups[0].file);
const tmpRestore = path.join(os.tmpdir(), `restore-probe-${Date.now()}.db`);
fs.copyFileSync(latest, tmpRestore);

const header = fs.readFileSync(tmpRestore, { encoding: 'utf8', flag: 'r' }).slice(0, 16);
if (!header.startsWith('SQLite format 3')) {
  fs.unlinkSync(tmpRestore);
  console.error('db-restore-probe failed: backup does not look like a valid SQLite file');
  process.exit(1);
}

fs.unlinkSync(tmpRestore);
console.log(`db-restore-probe ok: ${latest}`);
