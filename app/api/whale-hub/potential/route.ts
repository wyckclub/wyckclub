import { NextRequest, NextResponse } from 'next/server';
import { isWhaleStarredAt, isSpringPointAt, getChartScoreTextColorClass } from '@/lib/format';

const ROBINHOOD_CATEGORY = 5;
const MIN_LIQ = 20000;

interface MarketInfo {
  liq: number;
  marketCap: number | null;
  imageUrl: string | null;
}

async function fetchMarketDataMap(caList: string[], chainId: string): Promise<Record<string, MarketInfo>> {
  const out: Record<string, MarketInfo> = {};
  const BATCH_SIZE = 30;
  for (let i = 0; i < caList.length; i += BATCH_SIZE) {
    const chunk = caList.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const json = await res.json();
      const pairs = json.pairs || [];
      chunk.forEach((ca) => {
        const caPairs = pairs.filter(
          (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === chainId
        );
        const pair = caPairs[0] || pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
        const liq = caPairs.reduce((s: number, p: any) => s + (Number(p.liquidity?.usd) || 0), 0);
        out[ca] = {
          liq: caPairs.length ? liq : 0,
          marketCap: pair?.marketCap ?? pair?.fdv ?? null,
          imageUrl: pair?.info?.imageUrl ?? null,
        };
      });
    } catch {
      // skip
    }
  }
  return out;
}

interface Item {
  ca: string;
  symbol: string;
  category: number;
  tier: 1 | 2;
  score: number;
  scoreDisplay: string;
  whale: boolean;
  spring: boolean;
  yellow: boolean;
  platform: string | null;
  liq?: number;
  marketCap?: number | null;
  imageUrl?: string | null;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const chain = req.nextUrl.searchParams.get('chain') === 'robinhood' ? 'robinhood' : 'base';

  const categories =
    chain === 'robinhood'
      ? await (async () => {
          try {
            const res = await fetch(`${origin}/api/scores/robinhood`, { cache: 'no-store' });
            if (!res.ok) return [{ cat: ROBINHOOD_CATEGORY, data: {} as Record<string, any> }];
            return [{ cat: ROBINHOOD_CATEGORY, data: (await res.json()) as Record<string, any> }];
          } catch {
            return [{ cat: ROBINHOOD_CATEGORY, data: {} as Record<string, any> }];
          }
        })()
      : await Promise.all(
          [1, 2, 3, 4].map(async (cat) => {
            try {
              const res = await fetch(`${origin}/api/scores/${cat}`, { cache: 'no-store' });
              if (!res.ok) return { cat, data: {} as Record<string, any> };
              return { cat, data: (await res.json()) as Record<string, any> };
            } catch {
              return { cat, data: {} as Record<string, any> };
            }
          })
        );

  const items: Item[] = [];

  for (const { cat, data } of categories) {
    for (const [ca, token] of Object.entries<any>(data)) {
      const entries = token.entries || [];
      if (entries.length < 2) continue;

      const last7 = entries.slice(0, 7).map((e: any) => ({
        score: e.score,
        scoreDisplay: e.display as string,
        price: e.price as number | null,
        topwhale: e.topwhale,
        top10: e.top10 ?? null,
      }));

      const e0 = last7[0];
      const e1 = last7[1];
      if (!e1) continue;

      const whaleE0 = isWhaleStarredAt(last7, 0);
      const springE0 = isSpringPointAt(last7, 0);
      const springE1 = isSpringPointAt(last7, 1);
      const yellowE0 = getChartScoreTextColorClass(e0.score, last7) === 'text-yellow-400';
      const priceDown = e0.price != null && e1.price != null && e0.price < e1.price;
      const top10Up = e0.top10 != null && e1.top10 != null && e0.top10 > e1.top10;
      const plusE0 = (e0.scoreDisplay || '').endsWith('+');

      const tier1 =
        (priceDown && yellowE0 && top10Up) ||
        (priceDown && springE0 && top10Up) ||
        (springE1 && whaleE0);
      const tier2 = !tier1 && whaleE0 && plusE0;

      if (!tier1 && !tier2) continue;

      items.push({
        ca,
        symbol: token.symbol,
        category: cat,
        tier: tier1 ? 1 : 2,
        score: e0.score,
        scoreDisplay: e0.scoreDisplay,
        whale: whaleE0,
        spring: springE0,
        yellow: yellowE0,
        platform: token.platform ?? null,
      });
    }
  }

  if (!items.length) return NextResponse.json({ tier1: [], tier2: [] });

  const marketMap = await fetchMarketDataMap(items.map((i) => i.ca), chain);

  const enriched = items
    .map((i) => ({ ...i, ...(marketMap[i.ca] ?? { liq: 0, marketCap: null, imageUrl: null }) }))
    .filter((i) => (i.liq ?? 0) >= MIN_LIQ);

  const tier1 = enriched.filter((i) => i.tier === 1).sort((a, b) => b.score - a.score);
  const tier2 = enriched.filter((i) => i.tier === 2).sort((a, b) => b.score - a.score);

  return NextResponse.json({ tier1, tier2 });
}