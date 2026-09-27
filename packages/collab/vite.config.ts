import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

const enableDts = process.env.INKIO_VITE_SKIP_DTS !== '1';

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    ...(enableDts
      ? [
          dts({
            include: ['src'],
            entryRoot: 'src',
            compilerOptions: { rootDir: resolve(__dirname, 'src'), paths: {} },
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
  ],
  resolve: {
    alias: [
      // Resolve @inkio/core to source for vitest (which uses this config and runs
      // without a build step). The production `vite build` keeps @inkio/core
      // external so declaration generation never pulls core's source into the output.
      ...(command === 'build'
        ? []
        : [
            { find: /^@inkio\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
          ]),
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  build: {
    outDir: process.env.INKIO_VITE_OUT_DIR ?? 'dist',
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
      },
      name: 'InkioCollab',
      formats: ['es', 'cjs'],
    },
    rollupOptions: {
      external: (id) => {
        if (id === 'react' || id.startsWith('react/')) return true;
        if (id === 'react-dom' || id.startsWith('react-dom/')) return true;
        if (id.startsWith('@tiptap/')) return true;
        if (id === '@inkio/core' || id.startsWith('@inkio/core/')) return true;
        // CRDT + transport runtimes stay external so host apps share a single
        // copy (duplicate yjs instances split document identity).
        if (id === 'yjs' || id.startsWith('yjs/')) return true;
        if (id === 'y-protocols' || id.startsWith('y-protocols/')) return true;
        if (id === 'y-indexeddb' || id.startsWith('y-indexeddb/')) return true;
        if (id.startsWith('@hocuspocus/')) return true;
        return false;
      },
    },
    copyPublicDir: false,
  },
}));
