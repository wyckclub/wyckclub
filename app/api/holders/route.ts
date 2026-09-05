import { NextRequest, NextResponse } from 'next/server';

const BLOCKSCOUT_BASE_URL: Record<string, string> = {
  base: 'https://base.blockscout.com',
  robinhood: 'https://robinhoodchain.blockscout.com',
};

export async function GET(req: NextRequest) {
  const ca = req.nextUrl.searchParams.get('ca');
  const chain = req.nextUrl.searchParams.get('chain') === 'robinhood' ? 'robinhood' : 'base';

  if (!ca) return NextResponse.json({ error: 'Missing ca' }, { status: 400 });

  const base = BLOCKSCOUT_BASE_URL[chain];
  try {
    const res = await fetch(`${base}/api/v2/tokens/${ca}`, { next: { revalidate: 60 } });
    if (!res.ok) return NextResponse.json({ holders: null });
    const json = await res.json();
    const n = Number(json.holders_count);
    return NextResponse.json({ holders: isNaN(n) ? null : n });
  } catch {
    return NextResponse.json({ holders: null });
  }
}