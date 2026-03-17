import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const cwd = process.cwd();
const tempOutDir = path.join(cwd, '.dist-build');
const finalOutDir = path.join(cwd, 'dist');

function removeExtraEntries(targetDir, sourceDir) {
  if (!existsSync(targetDir) || !existsSync(sourceDir)) {
    return;
  }

  for (const entry of readdirSync(targetDir, { withFileTypes: true })) {
    const targetPath = path.join(targetDir, entry.name);
    const sourcePath = path.join(sourceDir, entry.name);

    if (!existsSync(sourcePath)) {
      rmSync(targetPath, { recursive: true, force: true });
      continue;
    }

    if (entry.isDirectory()) {
      removeExtraEntries(targetPath, sourcePath);
    }
  }
}

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

if (!existsSync(finalOutDir)) {
  mkdirSync(path.dirname(finalOutDir), { recursive: true });
  cpSync(tempOutDir, finalOutDir, { recursive: true });
  rmSync(tempOutDir, { recursive: true, force: true });
  process.exit(0);
}

cpSync(tempOutDir, finalOutDir, { recursive: true, force: true });
removeExtraEntries(finalOutDir, tempOutDir);
rmSync(tempOutDir, { recursive: true, force: true });
