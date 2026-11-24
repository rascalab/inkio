// Bundle budget gate: total dist JS bytes per package must stay under limit.
// Bump a limit deliberately (in this file) when a size increase is justified.
import { readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BUDGETS = {
  // Separate viewer entry points reduce core size but add ESM/CJS boundaries
  // in advanced. Transfer 4 kB of the existing aggregate allowance.
  core: 1_696_000,
  advanced: 187_000,
  simple: 12_000,
  editor: 30_000,
  // Combined ESM + CJS package code; excludes only the lazy worker assets below.
  'image-editor': 277_000,
  // Browser runtime only; yjs and Hocuspocus stay external.
  'collab': 30_000,
};

// Konva's self-contained worker and launcher are fetched only on a large save.
const IMAGE_WORKER_BUDGET = 130_000;
const IMAGE_WORKER_ASSET = /^export-(?:raster\.worker-[\w-]+|worker-launcher)\.js$/;

// The opt-in Node build plugin never ships in the browser runtime.
const COLLAB_VITE_BUDGET = 12_000;
const COLLAB_VITE_ASSET = /^vite\.(?:js|cjs)$/;

function jsBytes(dir, separateAsset = () => false) {
  const seen = new Set();
  const bytes = { main: 0, separate: 0 };
  function visit(directory) {
    let realDir;
    try {
      realDir = realpathSync(directory);
    } catch {
      throw new Error(`[budgets] unreadable directory: ${directory}`);
    }
    // Symlinked dist trees would recurse forever; each real directory counts once.
    if (seen.has(realDir)) return;
    seen.add(realDir);
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(full);
      } else if (entry.name.endsWith('.js') || entry.name.endsWith('.cjs')) {
        const kind = separateAsset(entry.name) ? 'separate' : 'main';
        bytes[kind] += statSync(full).size;
      }
    }
  }
  visit(dir);
  return bytes;
}

let failed = false;
for (const [pkg, limit] of Object.entries(BUDGETS)) {
  const dir = path.join(repoRoot, 'packages', pkg, 'dist');
  let bytes;
  try {
    const separateAsset = pkg === 'image-editor' ? IMAGE_WORKER_ASSET
      : pkg === 'collab' ? COLLAB_VITE_ASSET : null;
    bytes = jsBytes(dir, separateAsset ? file => separateAsset.test(file) : undefined);
  } catch {
    console.error(`[budgets] @inkio/${pkg}: dist/ missing — run pnpm build:packages first`);
    failed = true;
    continue;
  }
  const status = bytes.main <= limit ? 'ok' : 'OVER';
  console.log(`[budgets] @inkio/${pkg}: ${bytes.main} / ${limit} bytes (${status})`);
  if (bytes.main > limit) failed = true;
  const separate = pkg === 'image-editor' ? ['lazy export worker', IMAGE_WORKER_BUDGET]
    : pkg === 'collab' ? ['Node Vite plugin', COLLAB_VITE_BUDGET] : null;
  if (separate) {
    const [label, limit] = separate;
    const status = bytes.separate === 0 ? 'MISSING' : bytes.separate > limit ? 'OVER' : 'ok';
    console.log(`[budgets] @inkio/${pkg} ${label}: ${bytes.separate} / ${limit} bytes (${status})`);
    if (status !== 'ok') failed = true;
  }
}

process.exit(failed ? 1 : 0);
