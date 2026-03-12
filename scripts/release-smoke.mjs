import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}

function writeJson(filePath, value) {
  writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'inkio-release-smoke-'));
const tarballDir = path.join(tempRoot, 'tarballs');
const appDir = path.join(tempRoot, 'app');

try {
  mkdirSync(tarballDir, { recursive: true });
  mkdirSync(path.join(appDir, 'src'), { recursive: true });

  run('pnpm', ['--filter', '@inkio/editor', 'build'], repoRoot);
  run('pnpm', ['--filter', '@inkio/extension', 'build'], repoRoot);
  run('pnpm', ['--filter', '@inkio/editor', 'pack', '--pack-destination', tarballDir], repoRoot);
  run('pnpm', ['--filter', '@inkio/extension', 'pack', '--pack-destination', tarballDir], repoRoot);

  const tarballs = readdirSync(tarballDir);
  const coreTarball = tarballs.find((file) => file.startsWith('inkio-editor-') && file.endsWith('.tgz'));
  const extensionsTarball = tarballs.find((file) => file.startsWith('inkio-extension-') && file.endsWith('.tgz'));

  if (!coreTarball || !extensionsTarball) {
    throw new Error('Failed to create release tarballs for @inkio/editor and @inkio/extension.');
  }

  writeJson(path.join(appDir, 'package.json'), {
    name: 'inkio-release-smoke',
    private: true,
    type: 'module',
    scripts: {
      build: 'tsc --noEmit && vite build',
    },
    dependencies: {
      '@inkio/editor': `file:../tarballs/${coreTarball}`,
      '@inkio/extension': `file:../tarballs/${extensionsTarball}`,
      react: '^19.2.4',
      'react-dom': '^19.2.4',
    },
    devDependencies: {
      '@types/react': '^19.2.14',
      '@types/react-dom': '^19.2.3',
      '@vitejs/plugin-react': '^5.1.4',
      typescript: '^5.9.3',
      vite: '^7.3.1',
    },
  });

  writeJson(path.join(appDir, 'tsconfig.json'), {
    compilerOptions: {
      target: 'ES2020',
      lib: ['ES2020', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      strict: true,
      noEmit: true,
      skipLibCheck: true,
    },
    include: ['src'],
  });

  writeFileSync(
    path.join(appDir, 'vite.config.ts'),
    `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
});
`,
  );

  writeFileSync(
    path.join(appDir, 'index.html'),
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Inkio Release Smoke</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
  );

  writeFileSync(
    path.join(appDir, 'src/main.tsx'),
    `import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Editor, Viewer, getDefaultCoreExtensions } from '@inkio/editor';
import {
  getDefaultInkioExtensions,
  type CommentMessage,
  type CommentThreadData,
} from '@inkio/extension';
import '@inkio/editor/style.css';
import '@inkio/extension/style.css';

const thread: CommentThreadData = {
  id: 'thread-1',
  resolved: false,
  messages: [
    {
      id: 'message-1',
      author: 'Smoke Test',
      text: 'Release fixture comment',
      createdAt: new Date(),
    } satisfies CommentMessage,
  ],
};

const coreExtensions = getDefaultCoreExtensions({ placeholder: 'Core smoke test' });
const fullExtensions = getDefaultInkioExtensions({
  placeholder: 'Extensions smoke test',
  hashtagItems: ({ query }: { query: string }) => [
    { id: query || 'smoke', label: \`#\${query || 'smoke'}\` },
  ],
  comment: {
    onCommentCreate: (_threadId: string, _selection: string) => {},
    onCommentSubmit: (_threadId: string, _text: string, _selection: string) => {},
    getThread: (threadId: string) => (thread.id === threadId ? thread : null),
    currentUser: 'Smoke Test',
  },
});

function App() {
  return (
    <div>
      <Editor extensions={coreExtensions} initialContent="<p>Core smoke</p>" />
      <Editor extensions={fullExtensions} initialContent="<p>Extensions smoke</p>" />
      <Viewer
        extensions={fullExtensions}
        content={{ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Viewer smoke' }] }] }}
      />
    </div>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
`,
  );

  run('pnpm', ['install', '--no-frozen-lockfile'], appDir);
  run('pnpm', ['build'], appDir);
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}
