// Drift gate for the AGENTS.md knowledge base. Compares working-tree source
// against the init-deep snapshot (.omo/init-deep.json) and fails when code
// moved on without the guides. Run `pnpm docs:drift --update` after an
// init-deep update to reset the baseline. Never run directly (see root AGENTS.md).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const SNAPSHOT = join(ROOT, '.omo', 'init-deep.json');
const FILE_THRESHOLD = Number(process.env.DOCS_DRIFT_FILES ?? '30');

const sh = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

function sourceStats(patterns) {
  const nul = String.fromCharCode(0);
  const quoted = patterns.map((p) => `'${p}'`).join(' ');
  const files = sh(['ls-files', '-z', '--', ...patterns])
    .split(nul)
    .filter(Boolean);
  let loc = 0;
  try {
    const wc = execFileSync('sh', ['-c', `git ls-files -z -- ${quoted} | xargs -0 wc -l 2>/dev/null | tail -1`], {
      cwd: ROOT,
      encoding: 'utf8',
    }).trim();
    loc = Number(wc.split(/\s+/)[0]) || 0;
  } catch {
    loc = 0;
  }
  return { files: files.length, loc };
}

const SOURCE_PATTERNS = [
  'packages/*/src/**',
  'packages/*/vite.config.*',
  'packages/*/package.json',
  'examples/**',
  'e2e/**',
  'scripts/**',
];

function changedSince(sha) {
  const names = sh(['diff', '--name-only', `${sha}`, 'HEAD', '--']).split('\n').filter(Boolean);
  const isGuide = (f) => /(^|\/)AGENTS\.md$/.test(f) || f.endsWith('.mdx') || /(^|\/)README\.md$/.test(f);
  const isSource = (f) =>
    /^(packages\/[^/]+\/(src|vite\.config|package\.json)|examples\/|e2e\/|scripts\/)/.test(f) &&
    !/\.(md|mdx)$/.test(f);
  return {
    source: names.filter(isSource),
    guides: names.filter(isGuide),
  };
}

function writeSnapshot() {
  const { files, loc } = sourceStats(SOURCE_PATTERNS);
  const snap = {
    commitSha: sh(['rev-parse', 'HEAD']),
    fileCount: files,
    loc,
    timestamp: Date.now(),
    mode: 'committed',
  };
  writeFileSync(SNAPSHOT, `${JSON.stringify(snap)}\n`);
  console.log(`docs:drift baseline reset: ${snap.commitSha.slice(0, 7)} (${files} files, ${loc} loc)`);
}

function main() {
  if (process.argv.includes('--update')) {
    writeSnapshot();
    return;
  }
  if (!existsSync(SNAPSHOT)) {
    console.log('docs:drift SKIP: no .omo/init-deep.json baseline (run init-deep first)');
    return;
  }
  const snap = JSON.parse(readFileSync(SNAPSHOT, 'utf8'));
  let exists = true;
  try {
    sh(['cat-file', '-e', `${snap.commitSha}^{commit}`]);
  } catch {
    exists = false;
  }
  if (!exists) {
    console.log(`docs:drift SKIP: baseline commit ${snap.commitSha} not in this clone`);
    return;
  }
  const { source, guides } = changedSince(snap.commitSha);
  console.log(
    `docs:drift since ${String(snap.commitSha).slice(0, 7)}: ${source.length} source files changed, ${guides.length} guide files touched`,
  );
  if (source.length >= FILE_THRESHOLD && guides.length === 0) {
    console.error(
      `docs:drift STALE: ${source.length} source files changed with no guide updates. ` +
        `Run an init-deep update, then \`pnpm docs:drift --update\`.`,
    );
    process.exit(1);
  }
  console.log('docs:drift OK');
}

main();
