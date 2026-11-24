import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const useSourcePackages = process.env.INKIO_USE_SOURCE_PACKAGES === '1';
const source = (path: string) => fileURLToPath(new URL(`../../packages/${path}`, import.meta.url));

// Vite 8 runs the proxy before its base middleware, including in preview.
// Keep the API at the origin root and let the auth server check the original Origin.
const authProxy = {
  '/api/collab-auth/': {
    target: 'http://127.0.0.1:3124',
    ws: true,
    changeOrigin: false,
    rewriteWsOrigin: false,
  },
};

export default defineConfig(async ({ command }) => ({
  plugins: [
    react(),
    // Source-mode development does not require the built Node-only plugin.
    command === 'build' && process.env.INKIO_OFFLINE === '1'
      ? (await import('@inkio/collab/vite')).inkioOffline({ routes: ['/collab', '/collab/auth'] })
      : undefined,
  ],
  server: { proxy: authProxy, cors: false },
  preview: { proxy: authProxy, cors: false },
  resolve: {
    alias: useSourcePackages
      ? [
          { find: /^@inkio\/simple\/style\.css$/, replacement: source('simple/src/style.css') },
          { find: /^@inkio\/core\/style\.css$/, replacement: source('core/src/style.css') },
          { find: /^@inkio\/collab$/, replacement: source('collab/src/index.ts') },
          { find: /^@inkio\/core\/icons$/, replacement: source('core/src/icons/index.ts') },
          { find: /^@inkio\/simple$/, replacement: source('simple/src/index.ts') },
          { find: /^@inkio\/core$/, replacement: source('core/src/index.ts') },
        ]
      : [],
  },
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /\/node_modules\/(?:react(?:-dom)?|scheduler)\// },
            { name: 'prosemirror', test: /\/node_modules\/(?:prosemirror-[^/]+|orderedmap|rope-sequence|w3c-keyname)\// },
            // Collaboration extensions belong to the lazy routes, not the document editor preload.
            { name: 'tiptap', test: /\/node_modules\/@tiptap\/(?!extension-collaboration(?:-caret)?\/|y-tiptap\/)/ },
          ],
        },
      },
    },
  },
}));
