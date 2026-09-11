import { NextRequest, NextResponse } from 'next/server';

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`Missing env var: ${key}`);
  return v;
}

const ALCHEMY_URLS: Record<'base' | 'robinhood', string> = {
  base: requireEnv('WYCK_A_BASE'),
  robinhood: requireEnv('WYCK_A_ROBINHOOD'),
};

async function alchemyRpc(chainKey: 'base' | 'robinhood', method: string, params: any[]) {
  const res = await fetch(ALCHEMY_URLS[chainKey], {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`Alchemy ${method} failed: ${res.status}`);
  const json = await res.json();
  if (json.error) throw new Error(json.error.message || `Alchemy ${method} error`);
  return json.result;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address');
  const chainKey = req.nextUrl.searchParams.get('chain') as 'base' | 'robinhood' | null;

  if (!address || (chainKey !== 'base' && chainKey !== 'robinhood')) {
    return NextResponse.json({ error: 'Missing or invalid address/chain' }, { status: 400 });
  }

  try {
    const result = await alchemyRpc(chainKey, 'alchemy_getTokenBalances', [address, 'erc20']);
    const balances: { contractAddress: string; tokenBalance: string }[] = result?.tokenBalances ?? [];
    const nonZero = balances.filter((b) => b.tokenBalance && BigInt(b.tokenBalance) > BigInt(0));

    const tokens = await Promise.all(
      nonZero.map(async (b) => {
        const meta = await alchemyRpc(chainKey, 'alchemy_getTokenMetadata', [b.contractAddress]).catch(() => null);
        return {
          CA: b.contractAddress,
          symbol: meta?.symbol ?? `${b.contractAddress.slice(0, 6)}...`,
          decimals: typeof meta?.decimals === 'number' ? meta.decimals : 18,
          rawBalance: b.tokenBalance,
        };
      })
    );

    return NextResponse.json({ tokens });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Alchemy request failed' }, { status: 502 });
  }
}