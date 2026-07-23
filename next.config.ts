import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Thêm dòng này để báo cho Next.js 16 biết bạn chấp nhận dùng Turbopack
  experimental: {
    // Nếu bạn muốn tắt cảnh báo webpack/turbopack
  },
  turbopack: {
    // Để trống để kích hoạt Turbopack mặc định
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