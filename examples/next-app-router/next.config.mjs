import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const useSourcePackages = process.env.INKIO_USE_SOURCE_PACKAGES === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: useSourcePackages ? ['@inkio/editor', '@inkio/advanced', '@inkio/image-editor'] : [],
  typescript: {
    tsconfigPath: useSourcePackages ? 'tsconfig.json' : 'tsconfig.build.json',
  },
  webpack: (config) => {
    if (useSourcePackages) {
      const pkgs = resolve(__dirname, '../../packages');
      config.resolve = config.resolve || {};
      config.resolve.alias = {
        ...config.resolve.alias,
        '@inkio/core/style.css': resolve(pkgs, 'core/src/style.css'),
        '@inkio/core/minimal.css': resolve(pkgs, 'core/src/minimal.css'),
        '@inkio/editor/style.css': resolve(pkgs, 'editor/src/style.css'),
        '@inkio/editor/minimal.css': resolve(pkgs, 'editor/src/minimal.css'),
        '@inkio/simple/style.css': resolve(pkgs, 'simple/src/style.css'),
        '@inkio/simple/minimal.css': resolve(pkgs, 'simple/src/minimal.css'),
        '@inkio/image-editor/style.css': resolve(pkgs, 'image-editor/src/style.css'),
        '@inkio/core/icons': resolve(pkgs, 'core/src/icons/index.ts'),
        '@inkio/core/markdown': resolve(pkgs, 'core/src/markdown/index.ts'),
        '@inkio/core': resolve(pkgs, 'core/src/index.ts'),
        '@inkio/advanced': resolve(pkgs, 'advanced/src/index.ts'),
        '@inkio/editor': resolve(pkgs, 'editor/src/index.ts'),
        '@inkio/simple': resolve(pkgs, 'simple/src/index.ts'),
        '@inkio/image-editor': resolve(pkgs, 'image-editor/src/index.ts'),
      };
    }
    return config;
  },
};

export default nextConfig;
