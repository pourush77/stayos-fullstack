import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  experimental: {
    useTypeScriptCli: true,
  },
  allowedDevOrigins: [
    '192.168.1.31',
    '192.168.112.1',
    '*.preview.emergentagent.com',
    '*.preview.emergentcf.cloud',
    '*.cluster-12.preview.emergentcf.cloud',
    '74a8720a-4322-499a-bf79-47af279c926d.preview.emergentagent.com',
    '74a8720a-4322-499a-bf79-47af279c926d.cluster-12.preview.emergentcf.cloud',
  ],
  transpilePackages: [
    '@stayos/config',
    '@stayos/theme',
    '@stayos/types',
    '@stayos/ui',
    '@stayos/utils',
  ],
};

export default nextConfig;
