import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { base, baseSepolia } from 'wagmi/chains';
import { defineChain, http, fallback } from 'viem';

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

const ALCHEMY_BASE_KEY = process.env.WYCK_A_BASE!;
const ALCHEMY_ROBINHOOD_KEY = process.env.WYCK_A_ROBINHOOD!;
const QUICKNODE_BASE_RPC = process.env.WYCK_Q_BASE_RPC!;
const QUICKNODE_ROBINHOOD_RPC = process.env.WYCK_Q_ROBINHOOD_RPC!;

export const ALCHEMY_URLS: Record<'base' | 'robinhood', string> = {
  base: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_BASE_KEY}`,
  robinhood: `https://robinhood-mainnet.g.alchemy.com/v2/${ALCHEMY_ROBINHOOD_KEY}`,
};

export const config = getDefaultConfig({
  appName: 'WyckPro',
  projectId: '23d7ff6550f3e0aacc456c8c6268d407',
  chains: [base, robinhood],
  ssr: true,
  transports: {
    [base.id]: fallback([http(ALCHEMY_URLS.base), http(QUICKNODE_BASE_RPC)]),
    [robinhood.id]: fallback([http(ALCHEMY_URLS.robinhood), http(QUICKNODE_ROBINHOOD_RPC)]),
  },
});