import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@codeguard/shared-types'],
  experimental: {
    workerThreads: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
