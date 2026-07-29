import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.1.31', '192.168.112.1'],
  transpilePackages: [
    '@stayos/config',
    '@stayos/theme',
    '@stayos/types',
    '@stayos/ui',
    '@stayos/utils',
  ],
};

export default nextConfig;
