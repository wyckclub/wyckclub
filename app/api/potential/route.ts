import { NextRequest, NextResponse } from 'next/server';

const ROBINHOOD_CATEGORY = 5;
const ENTRY_DEPTH = 5;
const BATCH_SIZE = 30;

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

interface MarketInfo {
  name: string | null;
  imageUrl: string | null;
  priceUsd: number | null;
  marketCap: number | null;
  liq: number;
  vol1h: number;
  vol6h: number;
  vol24h: number;
}

const CACHE_TTL_MS = 30000;
const marketCache = new Map<string, { data: MarketInfo; timestamp: number }>();

async function fetchMarketMap(caList: string[], chainId: string, force = false): Promise<Record<string, MarketInfo>> {
  const out: Record<string, MarketInfo> = {};
  const unique = [...new Set(caList)];
  const now = Date.now();

  const toFetch: string[] = [];
  for (const ca of unique) {
    const cacheKey = `${chainId}:${ca.toLowerCase()}`;
    const cached = marketCache.get(cacheKey);
    if (!force && cached && now - cached.timestamp < CACHE_TTL_MS) {
      out[ca] = cached.data;
    } else {
      toFetch.push(ca);
    }
  }

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const chunk = toFetch.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`, {
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const json = await res.json();
      const pairs = json.pairs || [];

      chunk.forEach((ca) => {
        const caLower = ca.toLowerCase();
        const caPairs = pairs.filter(
          (p: any) => p.baseToken?.address?.toLowerCase() === caLower && p.chainId === chainId
        );
        const pair =
          [...caPairs].sort((a: any, b: any) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0] ||
          pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === caLower);
        if (!pair) return;
        const effective = caPairs.length ? caPairs : [pair];
        const sum = (getter: (p: any) => number | undefined) =>
          effective.reduce((s: number, p: any) => s + (Number(getter(p)) || 0), 0);

        const info: MarketInfo = {
          name: pair.baseToken?.name ?? null,
          imageUrl: pair.info?.imageUrl ?? null,
          priceUsd: pair.priceUsd == null ? null : Number(pair.priceUsd),
          marketCap: pair.marketCap ?? pair.fdv ?? null,
          liq: sum((p) => p.liquidity?.usd),
          vol1h: sum((p) => p.volume?.h1),
          vol6h: sum((p) => p.volume?.h6),
          vol24h: sum((p) => p.volume?.h24),
        };
        out[ca] = info;
        marketCache.set(`${chainId}:${caLower}`, { data: info, timestamp: now });
      });
    } catch {
      // skip this batch, keep going — cached/other entries still return
    }
  }

  return out;
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

  const [baseMarket, robinhoodMarket] = await Promise.all([
    baseCas.length ? fetchMarketMap(baseCas, 'base', force) : Promise.resolve({} as Record<string, MarketInfo>),
    robinhoodCas.length ? fetchMarketMap(robinhoodCas, 'robinhood', force) : Promise.resolve({} as Record<string, MarketInfo>),
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