import { existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const outputDirs = ['.next-pages', 'out', '.next'];
const siteDir = outputDirs
  .map((dir) => path.join(process.cwd(), dir))
  .find((dir) => existsSync(path.join(dir, 'index.html')));

if (!siteDir) {
  console.warn('[pagefind] skipped: no static export directory found');
  process.exit(0);
}

const pagefindBin = path.join(
  process.cwd(),
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'pagefind.cmd' : 'pagefind'
);

const result = spawnSync(pagefindBin, ['--site', siteDir, '--output-subdir', '_pagefind'], {
  stdio: 'inherit',
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
