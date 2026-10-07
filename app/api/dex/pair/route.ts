import { NextRequest, NextResponse } from 'next/server';
import { fetchFullPairInfoServer } from '@/lib/dexscreenerServer';

const CHAINS = ['base', 'robinhood', 'arc'];

export async function GET(req: NextRequest) {
  const ca = req.nextUrl.searchParams.get('ca');
  const chain = req.nextUrl.searchParams.get('chain') ?? 'base';
  if (!ca || !CHAINS.includes(chain)) return NextResponse.json(null, { status: 400 });
  return NextResponse.json(await fetchFullPairInfoServer(ca, chain));
}