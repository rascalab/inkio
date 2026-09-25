import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const outputDirs = ['.next-pages', 'out', '.next'];
const siteDir = outputDirs
  .map((dir) => path.join(process.cwd(), dir))
  .find((dir) => existsSync(path.join(dir, 'index.html')));

// next.config.mjs only static-exports for GitHub Pages (GITHUB_PAGES=true,
// distDir .next-pages): a missing export dir is fatal there, and an
// expected skip for local `next build` runs.
if (!siteDir) {
  if (process.env.GITHUB_PAGES === 'true') {
    console.error('[pagefind] static export directory missing for a GitHub Pages build');
    process.exit(1);
  }
  console.warn('[pagefind] skipped: no static export directory found');
  process.exit(0);
}

const pagefindBin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'pagefind.cmd' : 'pagefind'
);

if (!existsSync(pagefindBin)) {
  console.error(`[pagefind] binary missing: ${pagefindBin} (is the pagefind devDependency installed?)`);
  process.exit(1);
}

const result = spawnSync(pagefindBin, ['--site', siteDir, '--output-subdir', '_pagefind'], {
  stdio: 'inherit',
});

if (result.error) {
  console.error(`[pagefind] failed to launch: ${result.error.message}`);
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
