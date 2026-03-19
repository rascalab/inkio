import nextra from 'nextra';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoName = 'inkio';
const isGitHubPages = process.env.GITHUB_PAGES === 'true';
const basePath = isGitHubPages ? `/${repoName}` : '';
const useSourcePackages = process.env.INKIO_USE_SOURCE_PACKAGES === '1';

const withNextra = nextra({
  search: {
    codeblocks: false,
  },
});

export default withNextra({
  reactStrictMode: true,
  transpilePackages: useSourcePackages ? ['@inkio/editor', '@inkio/simple', '@inkio/advanced', '@inkio/image-editor'] : [],
  typescript: {
    tsconfigPath: useSourcePackages ? 'tsconfig.json' : 'tsconfig.build.json',
  },
  distDir: isGitHubPages ? '.next-pages' : '.next',
  ...(isGitHubPages ? { output: 'export' } : {}),
  trailingSlash: true,
  basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
  serverExternalPackages: [
    '@nextra/components',
    '@next/legacy/document',
    '@next/mdx',
    '@next/swc',
    '@next/client',
    '@next/server',
    '@next/headers'
  ],
  experimental: {
    optimizePackageImports: false,
    optimizeCss: false,
  },
  // Fix for Nextra v4 - disable server-side file system access during build.
  webpack: (config, { isServer }) => {
    if (useSourcePackages) {
      const pkgs = resolve(__dirname, '../packages');
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
      };
    }
    if (isServer) {
      config.resolve = config.resolve || {};
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    return config;
  },
});
