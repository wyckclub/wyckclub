import { TokenEntry } from './tokenApi';

export interface WalletToken {
  CA: string;
  symbol: string;
  decimals: number;
  qty: number;
  category: number | null;
  platform: string;
  verified: boolean;
}

export async function getWalletHeldTokens(
  chainKey: 'base' | 'robinhood',
  address: string,
  knownTokens: Map<string, TokenEntry>
): Promise<WalletToken[]> {
  const res = await fetch(`/api/wallet-tokens?address=${address}&chain=${chainKey}`);
  if (!res.ok) throw new Error(`wallet-tokens API failed: ${res.status}`);
  const { tokens, error } = await res.json();
  if (error) throw new Error(error);

  return (tokens as { CA: string; symbol: string; decimals: number; rawBalance: string }[]).map((t) => {
    const ca = t.CA.toLowerCase();
    const known = knownTokens.get(ca);
    const raw = BigInt(t.rawBalance);
    const qty = Number(raw) / 10 ** t.decimals;

    return {
      CA: t.CA,
      symbol: known?.symbol ?? t.symbol,
      decimals: t.decimals,
      qty,
      category: known?.category ?? null,
      platform: known?.platform ?? 'unknown',
      verified: known?.verified ?? false,
    };
  });
}