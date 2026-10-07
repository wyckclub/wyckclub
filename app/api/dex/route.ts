import { NextRequest, NextResponse } from 'next/server';
import { fetchDexscreenerBatchMap } from '@/lib/dexscreenerServer';

const CHAINS = ['base', 'robinhood', 'arc'];

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const chain = sp.get('chain') ?? 'base';
  const cas = (sp.get('cas') ?? '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (!CHAINS.includes(chain) || !cas.length) return NextResponse.json({ error: 'Invalid params' }, { status: 400 });

  const live = sp.get('live') === '1';
  const data = await fetchDexscreenerBatchMap(cas, chain, {
    revalidateSeconds: live ? 30 : 60,
    maxRetries: 2,
    cacheTtlMs: live ? 30000 : undefined,
  });
  return NextResponse.json(data);
}