import { NextRequest, NextResponse } from 'next/server';
import { formatCap, formatPriceShort, getWhaleStarredScore, getChartScoreTextColorClass } from '@/lib/format';
import { platformShareLines } from '@/lib/platforms';
import { ROBINHOOD_CATEGORY, RawToken, fetchDexInfo } from '@/lib/signalDetection';

async function findToken(
  chain: 'base' | 'robinhood',
  ca: string,
  origin: string
): Promise<{ cat: number; token: RawToken } | null> {
  if (chain === 'robinhood') {
    const res = await fetch(`${origin}/api/scores/robinhood`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data: Record<string, RawToken> = await res.json();
    const key = Object.keys(data).find((k) => k.toLowerCase() === ca.toLowerCase());
    if (!key) return null;
    return { cat: ROBINHOOD_CATEGORY, token: data[key] };
  }

  for (const cat of [1, 2, 3, 4]) {
    const res = await fetch(`${origin}/api/scores/${cat}`, { cache: 'no-store' });
    if (!res.ok) continue;
    const data: Record<string, RawToken> = await res.json();
    const key = Object.keys(data).find((k) => k.toLowerCase() === ca.toLowerCase());
    if (key) return { cat, token: data[key] };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { chain, ca } = await req.json();
  if ((chain !== 'base' && chain !== 'robinhood') || !ca || typeof ca !== 'string') {
    return NextResponse.json({ ok: false, reason: 'Invalid params' }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const found = await findToken(chain, ca, origin);
  if (!found) return NextResponse.json({ ok: false, reason: 'Token not found' });

  const { token } = found;
  const entries = token.entries || [];
  if (!entries.length) return NextResponse.json({ ok: false, reason: 'No data yet' });

  const latest = entries[0];
  const prevEntry = entries[1];
  const last7 = entries.slice(0, 7).map((e) => ({ score: e.score, topwhale: e.topwhale }));

  const scoreWithWhale = getWhaleStarredScore(latest.display, last7);
  const isYellow = getChartScoreTextColorClass(latest.score, last7) === 'text-yellow-400';

  const dex = await fetchDexInfo(ca, chain);

  const nameTag = dex?.name ? ` (${dex.name})` : '';
  const networkLabel = chain === 'robinhood' ? 'robinhood' : 'base';

  const curTop10 = latest.top10 ?? null;
  const prevTop10 = prevEntry?.top10 ?? null;
  const whaleLine =
    curTop10 != null && prevTop10 != null && curTop10 !== prevTop10
      ? `\n🐋Whale Accumulation Index: ${curTop10 - prevTop10 > 0 ? '+' : ''}${curTop10 - prevTop10} (${prevTop10}→${curTop10})`
      : '';

  const platformStatus = platformShareLines(token.platform);
  const platformLine = platformStatus.length ? `\n${platformStatus.join('\n')}` : '';

  const price = dex?.priceUsd == null ? 'N/A' : formatPriceShort(dex.priceUsd);
  const cap = dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap);

  const text = `$${token.symbol}${nameTag} WYCKSCORE update on #${networkLabel}:

👉WyckScore: ${isYellow ? '⚡' : ''}${scoreWithWhale}${whaleLine}${platformLine}

At Price: ${price} - MarketCap: ${cap}

Check the latest WYCK update here:
wyck.pro/${chain}/${ca}`;

  return NextResponse.json({ ok: true, text, symbol: token.symbol });
}