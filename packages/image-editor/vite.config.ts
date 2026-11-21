import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { posix, resolve } from 'path';
import { readFileSync } from 'fs';

const enableDts = process.env.INKIO_VITE_SKIP_DTS !== '1';

function packageExportWorker(): Plugin {
  const launcherSource = resolve(import.meta.dirname, 'src/utils/export-worker-launcher.ts');
  const launcherPath = 'assets/export-worker-launcher.js';
  const workerAsset = /^assets\/export-raster\.worker-[\w-]+\.js$/;
  return {
    name: 'package-export-worker',
    apply: 'build',
    enforce: 'pre',
    load(id) {
      if (id !== launcherSource) return;
      // This import asks Vite to compile and track the worker, not to emit
      // one of its format-specific URL expressions in the library entries.
      return `export { default as createExportWorker } from './export-raster.worker.ts?worker&url';`;
    },
    resolveFileUrl({ fileName, chunkId, format }) {
      if (!workerAsset.test(fileName)) return;
      const specifier = `./${posix.relative(posix.dirname(chunkId), launcherPath)}`;
      // Next's CJS SWC pass rewrites import() to a computed require. Keep
      // this request literal too; supported Node versions can require ESM.
      if (format === 'cjs') {
        return `() => Promise.resolve().then(() => require(${JSON.stringify(specifier)}).createExportWorker())`;
      }
      return `() => import(${JSON.stringify(specifier)}).then(({ createExportWorker }) => createExportWorker())`;
    },
    generateBundle(_options, bundle) {
      const worker = Object.keys(bundle).find((name) => workerAsset.test(name));
      if (!worker) this.error('Missing compiled image export worker');
      // Keep import.meta in a single ESM launcher, even for the CJS entry.
      // Resolve the URL as an asset. Bundling the already-built worker as a new
      // browser entry lets Next fold away `typeof window` guards inside it.
      this.emitFile({
        type: 'asset',
        fileName: launcherPath,
        source: `export function createExportWorker() {
  const url = new URL(${JSON.stringify(`./${posix.basename(worker)}`)}, import.meta.url);
  return new Worker(url, { type: 'module' });
}
`,
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    packageExportWorker(),
    ...(enableDts
      ? [
          dts({
            include: ['src'],
            entryRoot: 'src',
            compilerOptions: { rootDir: resolve(import.meta.dirname, 'src'), paths: {} },
            exclude: [
              'src/**/__tests__/**',
              'src/**/*.test.ts',
              'src/**/*.test.tsx',
            ],
            insertTypesEntry: true,
            pathsToAliases: false,
            aliasesExclude: [/^@inkio\//],
          }),
        ]
      : []),
    {
      name: 'copy-css',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'style.css',
          source: readFileSync(resolve(import.meta.dirname, 'src/style.css'), 'utf-8'),
        });
      },
    },
  ],
  resolve: {
    alias: [
      // Resolve @inkio/core to source for vitest (which uses this config and runs
      // without a build step). The production `vite build` keeps @inkio/core
      // external so declaration generation never pulls core's source into the output.
      ...(command === 'build'
        ? []
        : [
            { find: /^@inkio\/core\/icons$/, replacement: resolve(import.meta.dirname, '../core/src/icons/index.ts') },
            { find: /^@inkio\/core$/, replacement: resolve(import.meta.dirname, '../core/src/index.ts') },
          ]),
      { find: '@', replacement: resolve(import.meta.dirname, 'src') },
    ],
  },
  worker: {
    // Next's minifier assumes `typeof window === 'object'` for JS assets.
    // Konva needs the worker global here, not a browser Window.
    // https://vite.dev/config/worker-options.html#worker-rolldownoptions
    rolldownOptions: { transform: { define: { window: 'globalThis' } } },
  },
  build: {
    outDir: process.env.INKIO_VITE_OUT_DIR ?? 'dist',
    lib: {
      entry: resolve(import.meta.dirname, 'src/index.ts'),
      name: 'InkioImageEditor',
      fileName: 'index',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: (id) => {
        if (id === 'react' || id.startsWith('react/')) return true;
        if (id === 'react-dom' || id.startsWith('react-dom/')) return true;
        if (id.startsWith('@radix-ui/')) return true;
        if (id === '@inkio/core' || id.startsWith('@inkio/core/')) return true;
        if (id === 'konva' || id.startsWith('konva/')) return true;
        if (id === 'react-konva' || id.startsWith('react-konva/')) return true;
        return false;
      },
    },
    copyPublicDir: false,
  },
}));
