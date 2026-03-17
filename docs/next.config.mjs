import nextra from 'nextra';

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
  output: 'export',
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
    if (isServer) {
      return {
        ...config,
        resolve: {
          ...config.resolve,
          fallback: {
            fs: false,
            net: false,
            tls: false,
          }
        }
      };
    }
    return config;
  },
});
