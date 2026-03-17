const useSourcePackages = process.env.INKIO_USE_SOURCE_PACKAGES === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: useSourcePackages ? ['@inkio/editor', '@inkio/advanced', '@inkio/image-editor'] : [],
  typescript: {
    tsconfigPath: useSourcePackages ? 'tsconfig.json' : 'tsconfig.build.json',
  },
};

export default nextConfig;
