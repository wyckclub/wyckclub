import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // x
  serverExternalPackages: ['@resvg/resvg-js'],
  experimental: {
    // x
  },
  turbopack: {
    // x
  },
  webpack: (config) => {
    config.externals.push(
      'pino-pretty', 
      'lokijs', 
      'encoding', 
      '@x402/core', 
      '@x402/evm', 
      '@x402/svm'
    );
    return config;
  },
};

export default nextConfig;