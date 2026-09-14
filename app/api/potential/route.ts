import { NextRequest, NextResponse } from 'next/server';
import { fetchDexscreenerBatchMap, DexBatchInfo } from '@/lib/dexscreenerServer';

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
  const origin = req.nextUrl.origin;
  const chainParam = req.nextUrl.searchParams.get('chain'); // 'base' | 'robinhood' | null (= all)
  const force = req.nextUrl.searchParams.get('force') === '1';
  const wantBase = chainParam !== 'robinhood';
  const wantRobinhood = chainParam !== 'base';

  const categorySources: { cat: number; chain: 'base' | 'robinhood'; url: string }[] = [];
  if (wantBase) {
    [1, 2, 3, 4].forEach((cat) => categorySources.push({ cat, chain: 'base', url: `${origin}/api/scores/${cat}` }));
  }
  if (wantRobinhood) {
    categorySources.push({ cat: ROBINHOOD_CATEGORY, chain: 'robinhood', url: `${origin}/api/scores/robinhood` });
  }

  const categories = await Promise.all(
    categorySources.map(async (s) => {
      try {
        const res = await fetch(s.url, { cache: 'no-store' });
        if (!res.ok) return { ...s, data: {} as Record<string, any> };
        return { ...s, data: (await res.json()) as Record<string, any> };
      } catch {
        return { ...s, data: {} as Record<string, any> };
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

  // Shared cache/dedup with /api/whale-hub and /api/whale-hub/potential — a token
  // already fetched by another route within the last 30s is reused here for free.
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