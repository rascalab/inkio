import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

// Only the Pages build produces the static export. A local build must
// not index an old export directory left behind by a previous build.
if (process.env.GITHUB_PAGES !== 'true') process.exit(0);

const siteDir = path.resolve('.next-pages');
if (!existsSync(path.join(siteDir, 'index.html'))) {
  console.error('[pagefind] static export directory missing for a GitHub Pages build');
  process.exit(1);
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
