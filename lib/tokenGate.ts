'use client';

import { useAccount, useBalance } from 'wagmi';

export const GATE_TOKEN_ADDRESS = '0xloading';

export const PRO_THRESHOLD = 1_000_000;
export const VIP_THRESHOLD = 1_500_000;

const FREE_ACCESS_MODE = true;

export function useTokenGate(threshold: number) {
  const { address, isConnected } = useAccount();
  const { data: balance, isLoading } = useBalance({
    address,
    token: GATE_TOKEN_ADDRESS,
    query: { enabled: isConnected && !FREE_ACCESS_MODE },
  });

  const amount = balance ? parseFloat(balance.formatted) : 0;
  const hasAccess = FREE_ACCESS_MODE ? isConnected : isConnected && amount >= threshold;

  return { isConnected, isLoading: FREE_ACCESS_MODE ? false : isLoading, amount, hasAccess };
}