import fs from 'node:fs';
import path from 'node:path';

const distIndex = path.join(process.cwd(), 'Web-App', 'dashboard', 'dist', 'index.html');

if (!fs.existsSync(distIndex)) {
  console.error('Missing Web-App/dashboard/dist/index.html');
  process.exit(1);
}

console.log('Web-App/dashboard/dist/index.html found');
