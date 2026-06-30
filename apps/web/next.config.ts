import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: [
    '@stayos/config',
    '@stayos/theme',
    '@stayos/types',
    '@stayos/ui',
    '@stayos/utils',
  ],
};

export default nextConfig;
