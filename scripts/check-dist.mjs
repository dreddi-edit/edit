import fs from 'node:fs';
import path from 'node:path';

const distIndex = path.join(process.cwd(), 'dashboard', 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
  console.error('Missing dashboard/dist/index.html');
  process.exit(1);
}

console.log('dashboard/dist/index.html found');
