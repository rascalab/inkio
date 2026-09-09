import { cpSync, existsSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const tempOutDir = path.join(cwd, '.dist-build');
const finalOutDir = path.join(cwd, 'dist');

rmSync(tempOutDir, { recursive: true, force: true });

const viteBin = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm';
const build = spawnSync(viteBin, ['exec', 'vite', 'build'], {
  cwd,
  stdio: 'inherit',
  env: {
    ...process.env,
    INKIO_VITE_OUT_DIR: '.dist-build',
  },
});

if (build.status !== 0) {
  rmSync(tempOutDir, { recursive: true, force: true });
  process.exit(build.status ?? 1);
}

/**
 * Rewrite extensionless relative imports inside emitted `.d.ts` files
 * (`from './BubbleMenu'` -> `from './BubbleMenu.js'`). Node16/NodeNext ESM
 * resolution cannot resolve extensionless specifiers, so without this the
 * published types break for those consumers (attw InternalResolutionError).
 */
function fixDtsExtensions(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      fixDtsExtensions(fullPath);
      continue;
    }
    if (!entry.name.endsWith('.d.ts') || entry.name.endsWith('.d.cts') || entry.name.endsWith('.d.mts')) {
      continue;
    }
    const content = readFileSync(fullPath, 'utf-8');
    const fixed = content.replace(
      /((?:from\s+|import\s*\(\s*|export\s+[^'"]*?\s+from\s+)'(\.\.?\/[^'"]*))(')/g,
      (match, prefix, specifier, quote) => {
        if (/\.[a-zA-Z0-9]+$/.test(specifier)) return match;
        // Directory-style imports (`./i18n`, `./TocBlock`) have no sibling
        // `<name>.d.ts` — resolve to the explicit index file instead, which
        // Node16 ESM resolution requires.
        if (!existsSync(path.join(dir, `${specifier}.d.ts`)) &&
            existsSync(path.join(dir, specifier, 'index.d.ts'))) {
          return `${prefix}/index.js${quote}`;
        }
        return `${prefix}.js${quote}`;
      },
    );
    if (fixed !== content) {
      writeFileSync(fullPath, fixed);
    }
  }
}

/**
 * Duplicate every emitted `.d.ts` as `.d.cts` so CJS `require` consumers
 * resolve correctly-typed declarations (publint: split import/require types).
 * The twin is byte-identical; TypeScript accepts ESM declaration syntax
 * in `.d.cts` when resolved through the `require` condition.
 */
function emitCtsTwins(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      emitCtsTwins(fullPath);
      continue;
    }
    if (
      entry.name.endsWith('.d.ts') &&
      !entry.name.endsWith('.d.cts') &&
      !entry.name.endsWith('.d.mts')
    ) {
      const twinPath = fullPath.replace(/\.d\.ts$/, '.d.cts');
      if (!existsSync(twinPath)) {
        cpSync(fullPath, twinPath);
      }
    }
  }
}

fixDtsExtensions(tempOutDir);
emitCtsTwins(tempOutDir);

// Atomic publish: swap the finished build into place with renames instead of
// copying over a live `dist/` (a crash mid-copy previously left half-written
// output behind).
const backupOutDir = `${finalOutDir}.backup`;
try {
  rmSync(backupOutDir, { recursive: true, force: true });
  if (existsSync(finalOutDir)) {
    renameSync(finalOutDir, backupOutDir);
  }
  renameSync(tempOutDir, finalOutDir);
  rmSync(backupOutDir, { recursive: true, force: true });
} catch (error) {
  // Best-effort restore of the previous build.
  try {
    if (!existsSync(finalOutDir) && existsSync(backupOutDir)) {
      renameSync(backupOutDir, finalOutDir);
    }
  } catch {
    // Ignore restore failures; surface the original error below.
  }
  try {
    rmSync(tempOutDir, { recursive: true, force: true });
  } catch {
    // Ignore.
  }
  console.error(`[inkio-build] failed to publish dist for ${cwd}:`, error);
  process.exit(1);
}
