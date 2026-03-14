import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@inkio\/core\/icons$/, replacement: resolve(__dirname, '../core/src/icons/index.ts') },
      { find: /^@inkio\/core\/markdown$/, replacement: resolve(__dirname, '../core/src/markdown/index.ts') },
      { find: /^@inkio\/core$/, replacement: resolve(__dirname, '../core/src/index.ts') },
      { find: /^@inkio\/advanced$/, replacement: resolve(__dirname, '../advanced/src/index.ts') },
      { find: /^@inkio\/advanced\//, replacement: `${resolve(__dirname, '../advanced/src')}/` },
      { find: '@', replacement: resolve(__dirname, 'src') },
    ],
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: [resolve(__dirname, '../core/src/test-setup.ts')],
    include: [resolve(__dirname, 'src/__tests__/**/*.test.{ts,tsx}')],
  },
});
