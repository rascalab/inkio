import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');

const PACKAGE_FILTERS = [
  '@inkio/core',
  '@inkio/essential',
  '@inkio/advanced',
  '@inkio/simple',
  '@inkio/editor',
  '@inkio/image-editor',
];
const skipPackageBuilds = process.env.INKIO_RELEASE_SMOKE_SKIP_PACKAGE_BUILDS === '1';

function getPackageDir(filter) {
  return path.join(repoRoot, 'packages', filter.split('/')[1]);
}

function collectTypeTargets(value, targets) {
  if (!value) {
    return;
  }

  if (typeof value === 'string') {
    return;
  }

  if (Array.isArray(value)) {
    for (const entry of value) {
      collectTypeTargets(entry, targets);
    }
    return;
  }

  if (typeof value === 'object') {
    if (typeof value.types === 'string') {
      targets.add(value.types);
    }

    for (const child of Object.values(value)) {
      collectTypeTargets(child, targets);
    }
  }
}

function hasReleaseReadyBuild(filter) {
  const packageDir = getPackageDir(filter);
  const manifest = JSON.parse(readFileSync(path.join(packageDir, 'package.json'), 'utf-8'));
  const targets = new Set();

  if (typeof manifest.types === 'string') {
    targets.add(manifest.types);
  }

  collectTypeTargets(manifest.exports, targets);

  if (targets.size === 0) {
    return existsSync(path.join(packageDir, 'dist'));
  }

  return Array.from(targets).every((target) => existsSync(path.join(packageDir, target)));
}

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

function pickTarball(tarballs, prefix) {
  return tarballs.find((file) => file.startsWith(prefix) && file.endsWith('.tgz'));
}

const tempRoot = mkdtempSync(path.join(os.tmpdir(), 'inkio-release-smoke-'));
const tarballDir = path.join(tempRoot, 'tarballs');
const appDir = path.join(tempRoot, 'app');

try {
  mkdirSync(tarballDir, { recursive: true });
  mkdirSync(path.join(appDir, 'src'), { recursive: true });

  for (const filter of PACKAGE_FILTERS) {
    if (!skipPackageBuilds) {
      run('pnpm', ['--filter', filter, 'build'], repoRoot);
    } else if (!hasReleaseReadyBuild(filter)) {
      throw new Error(`Missing release-ready build for ${filter}. Run pnpm build:packages or pnpm verify:full first, or unset INKIO_RELEASE_SMOKE_SKIP_PACKAGE_BUILDS.`);
    }
    run('pnpm', ['--filter', filter, 'pack', '--pack-destination', tarballDir], repoRoot);
  }

  const tarballs = readdirSync(tarballDir);
  const coreTarball = pickTarball(tarballs, 'inkio-core-');
  const essentialTarball = pickTarball(tarballs, 'inkio-essential-');
  const advancedTarball = pickTarball(tarballs, 'inkio-advanced-');
  const simpleTarball = pickTarball(tarballs, 'inkio-simple-');
  const editorTarball = pickTarball(tarballs, 'inkio-editor-');
  const imageEditorTarball = pickTarball(tarballs, 'inkio-image-editor-');

  if (!coreTarball || !essentialTarball || !advancedTarball || !simpleTarball || !editorTarball || !imageEditorTarball) {
    throw new Error('Failed to create release tarballs for the layered Inkio packages.');
  }

  writeJson(path.join(appDir, 'package.json'), {
    name: 'inkio-release-smoke',
    private: true,
    type: 'module',
    scripts: {
      build: 'tsc --noEmit && vite build',
    },
    dependencies: {
      '@inkio/core': `file:../tarballs/${coreTarball}`,
      '@inkio/essential': `file:../tarballs/${essentialTarball}`,
      '@inkio/advanced': `file:../tarballs/${advancedTarball}`,
      '@inkio/simple': `file:../tarballs/${simpleTarball}`,
      '@inkio/editor': `file:../tarballs/${editorTarball}`,
      '@inkio/image-editor': `file:../tarballs/${imageEditorTarball}`,
      react: '^19.2.4',
      'react-dom': '^19.2.4',
    },
    pnpm: {
      overrides: {
        '@inkio/core': `file:../tarballs/${coreTarball}`,
        '@inkio/essential': `file:../tarballs/${essentialTarball}`,
        '@inkio/advanced': `file:../tarballs/${advancedTarball}`,
        '@inkio/simple': `file:../tarballs/${simpleTarball}`,
        '@inkio/editor': `file:../tarballs/${editorTarball}`,
        '@inkio/image-editor': `file:../tarballs/${imageEditorTarball}`,
      },
    },
    devDependencies: {
      '@types/react': '^19.2.14',
      '@types/react-dom': '^19.2.3',
      '@vitejs/plugin-react': '^6.0.1',
      typescript: '^5.9.3',
      vite: '^8.0.0',
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
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          const isPackage = (name) =>
            id.includes(\`/node_modules/\${name}/\`) || id.includes(\`/node_modules/.pnpm/\${name.replace('/', '+')}@\`);

          if (isPackage('react') || isPackage('react-dom') || isPackage('scheduler')) {
            return 'react-vendor';
          }

          if (
            id.includes('/node_modules/@tiptap/') ||
            id.includes('/node_modules/.pnpm/@tiptap+') ||
            id.includes('/node_modules/prosemirror-') ||
            id.includes('/node_modules/.pnpm/prosemirror-') ||
            id.includes('/node_modules/orderedmap/') ||
            id.includes('/node_modules/.pnpm/orderedmap@') ||
            id.includes('/node_modules/rope-sequence/') ||
            id.includes('/node_modules/.pnpm/rope-sequence@') ||
            id.includes('/node_modules/w3c-keyname/') ||
            id.includes('/node_modules/.pnpm/w3c-keyname@')
          ) {
            return 'tiptap-vendor';
          }

          if (id.includes('/konva/') || id.includes('/react-konva/')) {
            return 'image-vendor';
          }

          if (
            id.includes('/node_modules/@radix-ui/') ||
            id.includes('/node_modules/.pnpm/@radix-ui+') ||
            isPackage('lucide')
          ) {
            return 'ui-vendor';
          }

          return undefined;
        },
      },
    },
  },
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
    `import { StrictMode, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Editor,
  Viewer as InkioViewer,
  type InkioMessageOverrides,
  type TiptapEditor,
} from '@inkio/editor';
import {
  parseMarkdown as parseCoreMarkdown,
  stringifyMarkdown as stringifyCoreMarkdown,
} from '@inkio/core/markdown';
import {
  parseMarkdown as parseEditorMarkdown,
  stringifyMarkdown as stringifyEditorMarkdown,
} from '@inkio/editor/markdown';
import { inkioIconRegistry } from '@inkio/editor/icons';
import { Editor as SimpleEditor, Viewer as SimpleViewer } from '@inkio/simple';
import {
  parseMarkdown as parseSimpleMarkdown,
  stringifyMarkdown as stringifySimpleMarkdown,
} from '@inkio/simple/markdown';
import {
  CommentPanel,
  type CommentMessage,
  type CommentThreadData,
} from '@inkio/advanced';
import { ImageEditorModal } from '@inkio/image-editor';
import '@inkio/editor/style.css';
import '@inkio/simple/minimal.css';
import '@inkio/image-editor/style.css';

const coreMarkdown = '### Core markdown\\n\\n| a | b |\\n| - | - |\\n| 1 | 2 |';
const editorMarkdown = ':::callout{color="blue"}\\nEditor mode callout\\n:::\\n\\n## Hello Inkio';
const simpleMarkdown = '## Simple mode\\n\\n- toolbar\\n- lists\\n- links';

function createId() {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  return \`id-\${Date.now().toString(36)}-\${Math.random().toString(36).slice(2, 8)}\`;
}

function App() {
  const [coreContent] = useState(parseCoreMarkdown(coreMarkdown));
  const [editorContent, setEditorContent] = useState(parseEditorMarkdown(editorMarkdown));
  const [simpleContent, setSimpleContent] = useState(parseSimpleMarkdown(simpleMarkdown));
  const [editorInstance, setEditorInstance] = useState<TiptapEditor | null>(null);
  const [commentThreads, setCommentThreads] = useState<CommentThreadData[]>([]);
  const commentThreadsRef = useRef<CommentThreadData[]>([]);
  commentThreadsRef.current = commentThreads;

  const locale = 'en-US,en;q=0.9';
  const icons = useMemo(() => ({ comment: inkioIconRegistry.comment }), []);
  const messages = useMemo<InkioMessageOverrides>(
    () => ({
      core: {
        suggestion: { empty: 'No matching items.' },
      },
      extensions: {
        commentComposer: { placeholder: 'Leave a comment...' },
      },
    }),
    [],
  );

  const editorDefaultExtensionsOptions = useMemo(
    () => ({
      placeholder: 'Editor smoke',
      locale,
      messages,
      icons,
      hashtagItems: ({ query }: { query: string }) => [
        { id: query || 'smoke', label: \`#\${query || 'smoke'}\` },
      ],
      imageBlock: {
        onUpload: async (file: File) => URL.createObjectURL(file),
        imageEditor: ImageEditorModal,
      },
      comment: {
        locale,
        messages,
        icons,
        currentUser: 'Smoke Test',
        onCommentSubmit: (threadId: string, text: string) => {
          const message: CommentMessage = {
            id: createId(),
            author: 'Smoke Test',
            text,
            createdAt: new Date(),
          };
          setCommentThreads((prev) => [...prev, { id: threadId, messages: [message], resolved: false }]);
        },
        getThread: (threadId: string) =>
          commentThreadsRef.current.find((thread) => thread.id === threadId) ?? null,
        onCommentReply: (threadId: string, text: string) => {
          const message: CommentMessage = {
            id: createId(),
            author: 'Smoke Test',
            text,
            createdAt: new Date(),
          };
          setCommentThreads((prev) =>
            prev.map((thread) =>
              thread.id === threadId ? { ...thread, messages: [...thread.messages, message] } : thread,
            ),
          );
        },
        onCommentResolve: (threadId: string) => {
          setCommentThreads((prev) =>
            prev.map((thread) => (thread.id === threadId ? { ...thread, resolved: true } : thread)),
          );
        },
        onCommentDelete: (threadId: string) => {
          setCommentThreads((prev) => prev.filter((thread) => thread.id !== threadId));
        },
      },
    }),
    [icons, locale, messages],
  );

  const simpleDefaultExtensionsOptions = useMemo(
    () => ({
      placeholder: 'Simple smoke',
      imageBlock: {
        onUpload: async (file: File) => URL.createObjectURL(file),
        imageEditor: ImageEditorModal,
      },
    }),
    [],
  );

  return (
    <div style={{ display: 'grid', gap: 24, padding: 24 }}>
      <section>
        <h1>Inkio layered release smoke</h1>
        <p>{stringifyCoreMarkdown(coreContent)}</p>
        <p>{stringifyEditorMarkdown(editorContent)}</p>
        <p>{stringifySimpleMarkdown(simpleContent)}</p>
      </section>

      <section>
        <h2>@inkio/editor</h2>
        <Editor
          initialContent={editorContent}
          defaultExtensionsOptions={editorDefaultExtensionsOptions}
          locale={locale}
          messages={messages}
          icons={icons}
          showBubbleMenu
          showFloatingMenu
          onCreate={setEditorInstance}
          onUpdate={setEditorContent}
        />
        <CommentPanel
          editor={editorInstance}
          threads={commentThreads}
          locale={locale}
          messages={messages}
          icons={icons}
          currentUser="Smoke Test"
          onReply={(threadId: string, text: string) => {
            const message: CommentMessage = { id: createId(), author: 'Smoke Test', text, createdAt: new Date() };
            setCommentThreads((prev) =>
              prev.map((thread) =>
                thread.id === threadId ? { ...thread, messages: [...thread.messages, message] } : thread,
              ),
            );
          }}
          onResolve={(threadId: string) => {
            setCommentThreads((prev) =>
              prev.map((thread) => (thread.id === threadId ? { ...thread, resolved: true } : thread)),
            );
          }}
          onDelete={(threadId: string) => {
            setCommentThreads((prev) => prev.filter((thread) => thread.id !== threadId));
          }}
        />
        <InkioViewer content={editorContent} defaultExtensionsOptions={editorDefaultExtensionsOptions} />
      </section>

      <section>
        <h2>@inkio/simple</h2>
        <SimpleEditor
          initialContent={simpleContent}
          defaultExtensionsOptions={simpleDefaultExtensionsOptions}
          showToolbar
          onUpdate={setSimpleContent}
        />
        <SimpleViewer content={simpleContent} defaultExtensionsOptions={simpleDefaultExtensionsOptions} />
      </section>
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

  run('pnpm', ['install'], appDir);
  run('pnpm', ['build'], appDir);
} finally {
  // Keep the temp directory around on failure for inspection.
}
