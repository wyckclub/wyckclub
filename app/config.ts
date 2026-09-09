import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';
import { defineChain } from 'viem';

export const robinhood = defineChain({
  id: 4663,
  name: 'Robinhood',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://rpc.mainnet.chain.robinhood.com'] },
  },
  iconUrl: '/robinhood.svg',
  iconBackground: '#ccff00',
});

export { base };

export const config = getDefaultConfig({
  appName: 'WyckPro',
  projectId: '23d7ff6550f3e0aacc456c8c6268d407',
  chains: [base, robinhood],
  ssr: true,
});