'use client';

import { useAccount, useBalance } from 'wagmi';

// ---------------------------------------------------------------------------
// Token addresses — edit here, everything else (gating, buy prompt, homepage
// banner) follows.
// ---------------------------------------------------------------------------

// ONE contract address shared by the 3 EVM networks: Base, Robinhood, BSC
export const WYCK_EVM_ADDRESS = '0xd3eaB7BF15cC6659e7921A1547406d43071B96EA' as const;

// Solana mint address (leave '' to show "Coming soon" on the homepage)
export const WYCK_SOLANA_ADDRESS = '994cLdKTCiQaSUp3j72QnygKKZfz5caqm7CZFYPfpump';

export const WYCK_BASE_ADDRESS = WYCK_EVM_ADDRESS;
export const WYCK_ROBINHOOD_ADDRESS = WYCK_EVM_ADDRESS;
export const WYCK_BSC_ADDRESS = WYCK_EVM_ADDRESS;

export const GATE_TOKEN_ADDRESS = WYCK_ROBINHOOD_ADDRESS;

export type TokenNetworkKey = 'base' | 'robinhood' | 'bsc' | 'solana';

export interface TokenNetworkInfo {
  key: TokenNetworkKey;
  label: string;
  address: string;
  explorerUrl: string;
}

export const WYCK_TOKEN_NETWORKS: TokenNetworkInfo[] = [
  { key: 'base', label: 'Base', address: WYCK_BASE_ADDRESS, explorerUrl: 'https://basescan.org/token/' },
  { key: 'robinhood', label: 'Robinhood', address: WYCK_ROBINHOOD_ADDRESS, explorerUrl: 'https://robinhoodchain.blockscout.com/token/' },
  { key: 'bsc', label: 'BSC', address: WYCK_BSC_ADDRESS, explorerUrl: 'https://bscscan.com/token/' },
  { key: 'solana', label: 'Solana', address: WYCK_SOLANA_ADDRESS, explorerUrl: 'https://solscan.io/token/' },
];

export const PRO_THRESHOLD = 1_000_000;
export const VIP_THRESHOLD = 1_000_000;

const FREE_ACCESS_MODE = false;

export function useTokenGate(threshold: number) {
  const { address, isConnected } = useAccount();
  const enabled = isConnected && !!address && !FREE_ACCESS_MODE;

  const base = useBalance({ address, token: WYCK_BASE_ADDRESS, chainId: 8453, query: { enabled } });
  const rh = useBalance({ address, token: WYCK_ROBINHOOD_ADDRESS, chainId: 4663, query: { enabled } });

  const baseAmount = base.data ? parseFloat(base.data.formatted) : 0;
  const rhAmount = rh.data ? parseFloat(rh.data.formatted) : 0;
  const amount = Math.max(baseAmount, rhAmount);

  const hasAccess = FREE_ACCESS_MODE ? isConnected : isConnected && amount >= threshold;
  const isLoading = FREE_ACCESS_MODE ? false : base.isLoading || rh.isLoading;

  return { isConnected, isLoading, amount, hasAccess, baseAmount, rhAmount };
}
