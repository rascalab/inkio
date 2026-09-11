// Bundle budget gate: total dist JS bytes per package must stay under limit.
// Bump a limit deliberately (in this file) when a size increase is justified.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BUDGETS = {
  core: 1_700_000,
  advanced: 160_000,
  simple: 12_000,
  editor: 30_000,
  // 225k -> 234k: viewport culling, export guards/retry, rAF-throttled
  // filters/redact/thumbnails, append-only freedraw buffer, versioned dirty
  // tracking (perf batch). Deliberate increase for shipped features.
  'image-editor': 234_000,
};

function jsBytes(dir) {
  let total = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += jsBytes(full);
    } else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
      total += statSync(full).size;
    }
  }
  return total;
}

let failed = false;
for (const [pkg, limit] of Object.entries(BUDGETS)) {
  const dir = path.join(repoRoot, 'packages', pkg, 'dist');
  let total;
  try {
    total = jsBytes(dir);
  } catch {
    console.error(`[budgets] @inkio/${pkg}: dist/ missing — run pnpm build:packages first`);
    failed = true;
    continue;
  }
  const status = total <= limit ? 'ok' : 'OVER';
  console.log(`[budgets] @inkio/${pkg}: ${total} / ${limit} bytes (${status})`);
  if (total > limit) failed = true;
}

process.exit(failed ? 1 : 0);
