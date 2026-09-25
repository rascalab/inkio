import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const useSourcePackages = process.env.INKIO_USE_SOURCE_PACKAGES === '1';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: useSourcePackages
      ? [
          { find: '@inkio/simple/minimal.css', replacement: resolve(__dirname, '../../packages/simple/src/minimal.css') },
          { find: '@inkio/simple/style.css', replacement: resolve(__dirname, '../../packages/simple/src/style.css') },
          { find: '@inkio/core/icons', replacement: resolve(__dirname, '../../packages/core/src/icons/index.ts') },
          { find: '@inkio/simple', replacement: resolve(__dirname, '../../packages/simple/src/index.ts') },
          { find: '@inkio/core', replacement: resolve(__dirname, '../../packages/core/src/index.ts') },
        ]
      : [],
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          // Anchor pnpm matches on `<name>@` (name + version separator) so
          // short names like 'lucide' cannot over-match unrelated paths.
          const isPackage = (name: string) => {
            if (id.includes(`/node_modules/${name}/`)) {
              return true;
            }
            const escaped = name
              .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
              .replace('/', '\\+');
            return new RegExp(`/node_modules/\\.pnpm/${escaped}@`).test(id);
          };

          if (
            isPackage('react') ||
            isPackage('react-dom') ||
            isPackage('scheduler')
          ) {
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

          if (
            id.includes('/node_modules/@radix-ui/') ||
            id.includes('/node_modules/.pnpm/@radix-ui+') ||
            isPackage('clsx') ||
            isPackage('tailwind-merge') ||
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
