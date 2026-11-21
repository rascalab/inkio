// Bundle budget gate: total dist JS bytes per package must stay under limit.
// Bump a limit deliberately (in this file) when a size increase is justified.
import { readdirSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BUDGETS = {
  core: 1_700_000,
  // 180.1k measured with dedicated drag sessions and a ProseMirror decoration
  // that keeps the keyboard menu's source highlighted across redraws (both formats).
  advanced: 181_000,
  simple: 12_000,
  editor: 30_000,
  // 225k -> 234k: viewport culling, export guards/retry, rAF-throttled
  // filters/redact/thumbnails, append-only freedraw buffer, versioned dirty
  // tracking (perf batch). Deliberate increase for shipped features.
  // 234k -> 240k: audit round 2 (taint tracking, crop normalize, bounds
  // mirror, dirty/save race, text measure, input guards). Deliberate.
  // 240k -> 244k: audit rounds 3-4 fixes (filter/finetune visual tracking,
  // NaN-guard branches, crop full-session bounds, mount guards). Measured
  // +6.1k over the pre-fix tree (236091 -> 242235). Deliberate.
  // 244k -> 252k: native on-canvas text editing with multiline/IME support,
  // live integer resize input, and shared per-axis preview/export projection.
  // Deliberate feature increase; no additional runtime dependency.
  // 252k -> 260k: keyboard canvas editing, popover navigation, and bounded
  // asynchronous export (257.1k measured, no new runtime dependency).
  // 263k measured after crop drag feedback and the lazy export loader (both formats).
  // 269.8k measured with custom tool controls and responsive rail placement.
  // 275.2k measured after adding bounded main-thread filter bands (both formats).
  'image-editor': 277_000,
  // collab ships provider + hooks only; yjs/@hocuspocus stay external (measured ~16k).
  'collab': 30_000,
};

// Konva's self-contained worker and launcher are fetched only on a large save.
const IMAGE_WORKER_BUDGET = 198_000;
const IMAGE_WORKER_ASSET = /^export-(?:raster\.worker-[\w-]+|worker-launcher)\.js$/;

function jsBytes(dir, splitImageWorker = false) {
  const seen = new Set();
  const bytes = { main: 0, worker: 0 };
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
        const kind = splitImageWorker && IMAGE_WORKER_ASSET.test(entry.name) ? 'worker' : 'main';
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
    bytes = jsBytes(dir, pkg === 'image-editor');
  } catch {
    console.error(`[budgets] @inkio/${pkg}: dist/ missing — run pnpm build:packages first`);
    failed = true;
    continue;
  }
  const status = bytes.main <= limit ? 'ok' : 'OVER';
  console.log(`[budgets] @inkio/${pkg}: ${bytes.main} / ${limit} bytes (${status})`);
  if (bytes.main > limit) failed = true;
  if (pkg === 'image-editor') {
    const workerStatus = bytes.worker === 0 ? 'MISSING' : bytes.worker > IMAGE_WORKER_BUDGET ? 'OVER' : 'ok';
    console.log(`[budgets] @inkio/${pkg} lazy export worker: ${bytes.worker} / ${IMAGE_WORKER_BUDGET} bytes (${workerStatus})`);
    if (workerStatus !== 'ok') failed = true;
  }
}

process.exit(failed ? 1 : 0);
