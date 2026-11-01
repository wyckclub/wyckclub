'use client';

import { useAccount, useBalance } from 'wagmi';

export const WYCK_BASE_ADDRESS = '0x0e4faDFBD8c3a506227e4b6B9A13a02F0E6176eA' as const;
export const WYCK_ROBINHOOD_ADDRESS = '0x875ab39b84dbd1f962214c013e55a1ffcd8bdc7f' as const;

export const GATE_TOKEN_ADDRESS = WYCK_ROBINHOOD_ADDRESS;

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