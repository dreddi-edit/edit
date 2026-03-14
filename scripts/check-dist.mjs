import fs from 'node:fs';
import path from 'node:path';

const distIndex = path.join(process.cwd(), 'apps', 'web', 'dashboard', 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
  console.error('Missing apps/web/dashboard/dist/index.html');
  process.exit(1);
}

console.log('apps/web/dashboard/dist/index.html found');
