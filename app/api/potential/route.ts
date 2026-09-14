import { NextRequest, NextResponse } from 'next/server';
import { fetchDexscreenerBatchMap, DexBatchInfo } from '@/lib/dexscreenerServer';
import { getCategorySources, getRobinhoodSources, fetchScoresCached } from '@/lib/scoresServer';

const ROBINHOOD_CATEGORY = 5;
const ENTRY_DEPTH = 8;

export interface PotentialEntryRaw {
  score: number;
  display: string;
  price: number | null;
  topwhale?: string;
  top10: number | null;
  incBull: number | null;
  decBear: number | null;
  timestamp?: string;
}

export interface PotentialApiItem {
  ca: string;
  symbol: string;
  name: string | null;
  category: number;
  chain: 'base' | 'robinhood';
  platform: string;
  verified: boolean;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  liq: number;
  vol1h: number;
  vol6h: number;
  vol24h: number;
  entries: PotentialEntryRaw[];
}

export async function GET(req: NextRequest) {
  const chainParam = req.nextUrl.searchParams.get('chain');
  const force = req.nextUrl.searchParams.get('force') === '1';
  const wantBase = chainParam !== 'robinhood';
  const wantRobinhood = chainParam !== 'base';

  const categoryTargets: { cat: number; chain: 'base' | 'robinhood' }[] = [];
  if (wantBase) {
    [1, 2, 3, 4].forEach((cat) => categoryTargets.push({ cat, chain: 'base' }));
  }
  if (wantRobinhood) {
    categoryTargets.push({ cat: ROBINHOOD_CATEGORY, chain: 'robinhood' });
  }

  const categories = await Promise.all(
    categoryTargets.map(async (t) => {
      const sources = t.chain === 'robinhood' ? getRobinhoodSources() : getCategorySources(String(t.cat));
      const key = t.chain === 'robinhood' ? 'robinhood' : `cat:${t.cat}`;
      try {
        const data = await fetchScoresCached(key, sources);
        return { ...t, data };
      } catch {
        return { ...t, data: {} as Record<string, any> };
      }
    })
  );

  type PartialItem = Omit<
    PotentialApiItem,
    'name' | 'imageUrl' | 'priceUsd' | 'marketCap' | 'liq' | 'vol1h' | 'vol6h' | 'vol24h'
  >;
  const partials: PartialItem[] = [];

  for (const { cat, chain, data } of categories) {
    for (const [ca, token] of Object.entries<any>(data)) {
      const entries: any[] = token.entries || [];
      if (!entries.length) continue;
      const sliced: PotentialEntryRaw[] = entries.slice(0, ENTRY_DEPTH).map((e) => ({
        score: e.score,
        display: e.display,
        price: e.price ?? null,
        topwhale: e.topwhale,
        top10: e.top10 ?? null,
        incBull: e.incBull ?? null,
        decBear: e.decBear ?? null,
        timestamp: e.timestamp,
      }));
      partials.push({
        ca,
        symbol: token.symbol,
        category: cat,
        chain,
        platform: token.platform ?? 'unknown',
        verified: !!token.verified,
        entries: sliced,
      });
    }
  }

  if (!partials.length) return NextResponse.json({ items: [] });

  const baseCas = partials.filter((i) => i.chain === 'base').map((i) => i.ca);
  const robinhoodCas = partials.filter((i) => i.chain === 'robinhood').map((i) => i.ca);

  const [baseMarket, robinhoodMarket] = await Promise.all([
    baseCas.length
      ? fetchDexscreenerBatchMap(baseCas, 'base', { revalidateSeconds: 30, maxRetries: 2, force })
      : Promise.resolve({} as Record<string, DexBatchInfo>),
    robinhoodCas.length
      ? fetchDexscreenerBatchMap(robinhoodCas, 'robinhood', { revalidateSeconds: 30, maxRetries: 2, force })
      : Promise.resolve({} as Record<string, DexBatchInfo>),
  ]);

  const items: PotentialApiItem[] = partials.map((i) => {
    const m = (i.chain === 'base' ? baseMarket : robinhoodMarket)[i.ca];
    return {
      ...i,
      name: m?.name ?? null,
      imageUrl: m?.imageUrl ?? null,
      priceUsd: m?.priceUsd ?? null,
      marketCap: m?.marketCap ?? null,
      liq: m?.liq ?? 0,
      vol1h: m?.vol1h ?? 0,
      vol6h: m?.vol6h ?? 0,
      vol24h: m?.vol24h ?? 0,
    };
  });

  return NextResponse.json({ items });
}