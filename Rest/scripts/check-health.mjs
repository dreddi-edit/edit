#!/usr/bin/env node
import process from 'node:process';

const healthUrl = process.env.HEALTH_URL || 'http://127.0.0.1:8787/health';

const run = async () => {
  const res = await fetch(healthUrl, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    throw new Error(`Health endpoint returned ${res.status}`);
  }
  const data = await res.json().catch(() => ({}));
  if (data && typeof data === 'object' && 'ok' in data && !data.ok) {
    throw new Error('Health payload reports ok=false');
  }
  console.log(`health-check ok: ${healthUrl}`);
};

run().catch((error) => {
  console.error(`health-check failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
