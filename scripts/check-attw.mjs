// attw gate with honest scoping.
//
// Raw `attw` can never pass for this repo for two universal reasons:
//  1. CSS subpath exports (`./style.css`) always report NoResolution — attw
//     only resolves JS/types, and every package shipping CSS hits this.
//  2. `node10` resolution predates `exports` subpaths and is EOL; our
//     `engines` already require Node >= 18.
//
// This gate therefore fails on any problem that is NOT (css entrypoint OR
// node10 resolution). Everything real — node16 CJS/ESM + bundler for JS
// entrypoints, including InternalResolutionError — must be clean.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const PACKAGES = ['core', 'advanced', 'simple', 'editor', 'image-editor', 'collab'];

let failed = false;

for (const pkg of PACKAGES) {
  const packageDir = path.join(repoRoot, 'packages', pkg);
  // attw JSON can exceed child_process stdio buffering — capture via file.
  const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'inkio-attw-'));
  const outFile = path.join(tmpDir, 'attw.json');
  let data;
  const errFile = path.join(tmpDir, 'attw.stderr.log');
  try {
    // stdout carries the JSON (buffered via file); stderr is kept aside so
    // a missing binary or pack failure is diagnosable instead of silent.
    execFileSync(`pnpm exec attw --pack ${packageDir} -f json > ${outFile} 2>${errFile} || true`, {
      cwd: repoRoot,
      shell: true,
    });
    data = JSON.parse(readFileSync(outFile, 'utf-8'));
  } catch {
    let detail = '';
    try {
      detail = readFileSync(errFile, 'utf-8').trim().split('\n').slice(-5).join('\n');
    } catch {
      // No stderr captured; report the parse failure alone.
    }
    console.error(`[attw] unparseable JSON output for @inkio/${pkg}${detail ? ` (stderr tail):\n${detail}` : ''}`);
    failed = true;
    continue;
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
  const problems = data.problems ?? {};
  const relevant = [];
  for (const list of Object.values(problems)) {
    for (const problem of list ?? []) {
      const entrypoint = problem.entrypoint ?? '';
      const resolutionKind = problem.resolutionKind ?? '';
      if (entrypoint.endsWith('.css')) continue;
      if (resolutionKind === 'node10') continue;
      relevant.push(problem);
    }
  }
  if (relevant.length > 0) {
    failed = true;
    console.error(`[attw] @inkio/${pkg}: ${relevant.length} relevant problem(s):`);
    const seen = new Set();
    for (const problem of relevant) {
      const key = `${problem.kind} ${problem.entrypoint ?? problem.fileName ?? ''} ${problem.moduleSpecifier ?? problem.resolutionKind ?? ''}`;
      if (seen.has(key)) continue;
      seen.add(key);
      console.error(`  - ${key}`);
    }
  } else {
    console.log(`[attw] @inkio/${pkg}: clean (JS entrypoints, node16 + bundler)`);
  }
}

if (failed) {
  process.exit(1);
}
console.log('[attw] all packages clean');
