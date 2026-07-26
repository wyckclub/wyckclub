'use client';

import { useAccount, useBalance } from 'wagmi';

export const GATE_TOKEN_ADDRESS = '0x65021a79aeef22b17cdc1b768f5e79a8618beba3';

export const PRO_THRESHOLD = 1_000_000;
export const VIP_THRESHOLD = 50_000_000;

export function useTokenGate(threshold: number) {
  const { address, isConnected } = useAccount();
  const { data: balance, isLoading } = useBalance({
    address,
    token: GATE_TOKEN_ADDRESS,
    query: { enabled: isConnected },
  });

  const amount = balance ? parseFloat(balance.formatted) : 0;
  const hasAccess = isConnected && amount >= threshold;

  return { isConnected, isLoading, amount, hasAccess };
}