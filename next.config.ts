import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['@resvg/resvg-js'],
  outputFileTracingIncludes: {
    '/api/cron/autopost': [
      './node_modules/roboto-fontface/fonts/roboto/Roboto-Regular.ttf',
      './node_modules/roboto-fontface/fonts/roboto/Roboto-Bold.ttf',
    ],
  },
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