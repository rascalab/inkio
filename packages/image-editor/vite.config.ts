import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';
import { readFileSync } from 'fs';

const enableDts = process.env.INKIO_VITE_SKIP_DTS !== '1';

export default defineConfig({
  plugins: [
    react(),
    ...(enableDts
      ? [
          dts({
            include: ['src'],
            entryRoot: 'src',
            exclude: [
              'src/**/__tests__/**',
              'src/**/*.test.ts',
              'src/**/*.test.tsx',
            ],
            insertTypesEntry: true,
          }),
        ]
      : []),
    {
      name: 'copy-css',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'style.css',
          source: readFileSync(resolve(__dirname, 'src/style.css'), 'utf-8'),
        });
      },
    },
  ],
  resolve: {
    alias: [
      { find: /^@inkio\/core\/icons$/, replacement: resolve(__dirname, '../core/src/icons/index.ts') },
      { find: /^@inkio\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  build: {
    outDir: process.env.INKIO_VITE_OUT_DIR ?? 'dist',
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
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
});
