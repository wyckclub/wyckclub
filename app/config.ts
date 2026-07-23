import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Wyck Club',
  projectId: '23d7ff6550f3e0aacc456c8c6268d407', // Tùy chọn: Có thể giữ nguyên hoặc đăng ký tại cloud.walletconnect.com
  chains: [base], // Cấu hình ưu tiên mạng Base (và Base Sepolia Testnet)
  ssr: true, // Bật SSR cho Next.js App Router
});