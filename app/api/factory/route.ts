import { NextRequest, NextResponse } from 'next/server';

const FACTORY_URLS: Record<string, string | undefined> = {
  base: process.env.WYCK_FACTORY_BASE_URL,
  robinhood: process.env.WYCK_FACTORY_ROBINHOOD_URL,
};

export async function GET(req: NextRequest) {
  const ca = req.nextUrl.searchParams.get('ca');
  const chain = req.nextUrl.searchParams.get('chain') === 'robinhood' ? 'robinhood' : 'base';
  if (!ca) return NextResponse.json({ error: 'Missing ca' }, { status: 400 });

  const url = FACTORY_URLS[chain];
  if (!url) return NextResponse.json({ wallets: [] });

  try {
    const res = await fetch(url, { next: { revalidate: 300 } });
    if (!res.ok) return NextResponse.json({ wallets: [] });
    const json = await res.json();
    const key = Object.keys(json).find((k) => k.toLowerCase() === ca.toLowerCase());
    const data = key ? json[key]?.data : null;
    if (!data) return NextResponse.json({ wallets: [] });

    const raw: string[] = [];
    if (data.creator_wallet) raw.push(data.creator_wallet);
    if (data.creator_2) raw.push(data.creator_2);
    if (Array.isArray(data.fee_recipients_confirmed)) raw.push(...data.fee_recipients_confirmed);

    const seen = new Set<string>();
    const wallets: string[] = [];
    for (const w of raw) {
      if (typeof w !== 'string') continue;
      const lower = w.toLowerCase();
      if (seen.has(lower)) continue;
      seen.add(lower);
      wallets.push(w);
      if (wallets.length >= 5) break;
    }

    return NextResponse.json({ wallets });
  } catch {
    return NextResponse.json({ wallets: [] });
  }
}