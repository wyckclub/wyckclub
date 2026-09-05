export interface DexData {
  h24: number | null;
  priceUsd: number | null;
  vol24h: number | null;
  liq: number | null;
  marketCap: number | null;
  twitter: string | null;
  website: string | null;
  imageUrl: string | null;
  symbol: string | null;
  name: string | null;
  pairCreatedAt: number | null; // NEW
}

export interface FullPairInfo {
  pairAddress: string;
  topVolumePairAddress: string | null; // NEW
  dexId: string;
  url: string;
  priceUsd: number | null;
  marketCap: number | null;
  fdv: number | null;
  liq: number | null;
  pairCreatedAt: number | null;
  imageUrl: string | null;
  symbol: string | null;
  name: string | null;
  twitter: string | null;
  telegram: string | null;
  website: string | null;
  priceChange: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  volume: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  txns: {
    m5: { buys: number; sells: number };
    h1: { buys: number; sells: number };
    h6: { buys: number; sells: number };
    h24: { buys: number; sells: number };
  };
}

const TTL = 2 * 60 * 1000;
const STORAGE_KEY = 'wyck_dex_cache_v1';
const cache = new Map<string, { data: DexData; timestamp: number }>();

function loadFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: Record<string, { data: DexData; timestamp: number }> = JSON.parse(raw);
    const now = Date.now();
    Object.entries(parsed).forEach(([ca, entry]) => {
      if (now - entry.timestamp < TTL) cache.set(ca, entry);
    });
  } catch {}
}

function saveToStorage() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, { data: DexData; timestamp: number }> = {};
    cache.forEach((v, k) => (obj[k] = v));
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

loadFromStorage();

export function getCachedDexData(ca: string): DexData | null {
  return cache.get(ca)?.data ?? null;
}

function extractTwitter(pair: any): string | null {
  const socials = pair?.info?.socials || [];
  const tw = socials.find((s: any) => s.type === 'twitter');
  return tw?.url ?? null;
}

function oldestPairCreatedAt(caPairs: any[], fallback: any): number | null {
  if (!caPairs.length) return fallback?.pairCreatedAt ?? null;
  return caPairs.reduce((min: number | null, p: any) => {
    const t = p.pairCreatedAt ?? null;
    if (t == null) return min;
    return min == null ? t : Math.min(min, t);
  }, null as number | null);
}

export async function prefetchDexDataBatch(
  caList: string[],
  onBatch?: () => void,
  chainId: string = 'base'
) {
  const now = Date.now();
  const need = [...new Set(caList)].filter((ca) => {
    const c = cache.get(ca);
    return !c || now - c.timestamp >= TTL;
  });
  if (!need.length) return;

  const failedCas: string[] = [];

  const BATCH_SIZE = 30;
  for (let i = 0; i < need.length; i += BATCH_SIZE) {
    const chunk = need.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`);
      if (!res.ok) {
        console.error('Dexscreener error, status:', res.status, res.statusText);
      }
      const json = await res.json();
      const pairs = json.pairs || [];
      chunk.forEach((ca) => {
        const caPairs = pairs.filter(
          (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === chainId
        );
        const pair = caPairs[0] || pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
        if (!pair) {
          failedCas.push(ca);
          return;
        }
        const h24 = pair?.priceChange?.h24;
        const priceUsd = pair?.priceUsd;
        const vol24h = caPairs.reduce((s: number, p: any) => s + (Number(p.volume?.h24) || 0), 0);
        const liq = caPairs.reduce((s: number, p: any) => s + (Number(p.liquidity?.usd) || 0), 0);
        const marketCap = pair?.marketCap ?? pair?.fdv;
        cache.set(ca, {
          data: {
            h24: h24 == null ? null : Number(h24),
            priceUsd: priceUsd == null ? null : Number(priceUsd),
            vol24h: caPairs.length ? vol24h : null,
            liq: caPairs.length ? liq : null,
            marketCap: marketCap == null ? null : Number(marketCap),
            twitter: extractTwitter(pair),
            website: pair?.info?.websites?.[0]?.url ?? null,
            imageUrl: pair?.info?.imageUrl ?? null,
            symbol: pair?.baseToken?.symbol ?? null,
            name: pair?.baseToken?.name ?? null,
            pairCreatedAt: oldestPairCreatedAt(caPairs, pair),
          },
          timestamp: Date.now(),
        });
      });
    } catch {
      failedCas.push(...chunk);
    }
    saveToStorage();
    onBatch?.();
    if (i + BATCH_SIZE < need.length) await new Promise((r) => setTimeout(r, 300));
  }

  for (const ca of failedCas) {
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`);
      if (!res.ok) continue;
      const json = await res.json();
      const pairs = json.pairs || [];
      const caPairs = pairs.filter(
        (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === chainId
      );
      const pair = caPairs[0] || pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
      if (!pair) continue;
      const h24 = pair?.priceChange?.h24;
      const priceUsd = pair?.priceUsd;
      const vol24h = caPairs.reduce((s: number, p: any) => s + (Number(p.volume?.h24) || 0), 0);
      const liq = caPairs.reduce((s: number, p: any) => s + (Number(p.liquidity?.usd) || 0), 0);
      const marketCap = pair?.marketCap ?? pair?.fdv;
      cache.set(ca, {
        data: {
          h24: h24 == null ? null : Number(h24),
          priceUsd: priceUsd == null ? null : Number(priceUsd),
          vol24h: caPairs.length ? vol24h : null,
          liq: caPairs.length ? liq : null,
          marketCap: marketCap == null ? null : Number(marketCap),
          twitter: extractTwitter(pair),
          website: pair?.info?.websites?.[0]?.url ?? null,
          imageUrl: pair?.info?.imageUrl ?? null,
          symbol: pair?.baseToken?.symbol ?? null,
          name: pair?.baseToken?.name ?? null,
          pairCreatedAt: oldestPairCreatedAt(caPairs, pair),
        },
        timestamp: Date.now(),
      });
    } catch {
      // Skip
    }
    await new Promise((r) => setTimeout(r, 150));
  }

  if (failedCas.length) {
    saveToStorage();
    onBatch?.();
  }
}

export async function fetchLivePrice(ca: string, chainId: string = 'base'): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`).then((r) => r.json());
    const pairs = res.pairs || [];
    const caPairs = pairs.filter(
      (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === chainId
    );
    const pair = caPairs[0] || pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
    const priceUsd = pair?.priceUsd;
    return priceUsd == null ? null : Number(priceUsd);
  } catch {
    return null;
  }
}

export async function fetchFullTokenPairInfo(ca: string, chainId: string = 'base'): Promise<FullPairInfo | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`);
    if (!res.ok) return null;
    const json = await res.json();
    const pairs = json.pairs || [];
    const caPairs = pairs.filter(
      (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === chainId
    );
    const pair =
      [...caPairs].sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0] ||
      pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
    if (!pair) return null;

    const topVolumePair =
      [...caPairs].sort((a: any, b: any) => (Number(b.volume?.h24) || 0) - (Number(a.volume?.h24) || 0))[0] ?? pair;

    const socials = pair.info?.socials || [];
    const tw = socials.find((s: any) => s.type === 'twitter');
    const tg = socials.find((s: any) => s.type === 'telegram');

    const sumField = (getter: (p: any) => number | undefined) =>
      caPairs.length ? caPairs.reduce((s: number, p: any) => s + (Number(getter(p)) || 0), 0) : null;

    return {
      pairAddress: pair.pairAddress,
      topVolumePairAddress: topVolumePair?.pairAddress ?? pair.pairAddress,
      dexId: pair.dexId,
      url: pair.url,
      priceUsd: pair.priceUsd == null ? null : Number(pair.priceUsd),
      marketCap: pair.marketCap ?? pair.fdv ?? null,
      fdv: pair.fdv ?? null,
      liq: sumField((p) => p.liquidity?.usd),
      pairCreatedAt: oldestPairCreatedAt(caPairs, pair),
      imageUrl: pair.info?.imageUrl ?? null,
      symbol: pair.baseToken?.symbol ?? null,
      name: pair.baseToken?.name ?? null,
      twitter: tw?.url ?? null,
      telegram: tg?.url ?? null,
      website: pair.info?.websites?.[0]?.url ?? null,
      priceChange: {
        m5: pair.priceChange?.m5 ?? null,
        h1: pair.priceChange?.h1 ?? null,
        h6: pair.priceChange?.h6 ?? null,
        h24: pair.priceChange?.h24 ?? null,
      },
      volume: {
        m5: sumField((p) => p.volume?.m5),
        h1: sumField((p) => p.volume?.h1),
        h6: sumField((p) => p.volume?.h6),
        h24: sumField((p) => p.volume?.h24),
      },
      txns: {
        m5: { buys: caPairs.reduce((s: number, p: any) => s + (p.txns?.m5?.buys ?? 0), 0), sells: caPairs.reduce((s: number, p: any) => s + (p.txns?.m5?.sells ?? 0), 0) },
        h1: { buys: caPairs.reduce((s: number, p: any) => s + (p.txns?.h1?.buys ?? 0), 0), sells: caPairs.reduce((s: number, p: any) => s + (p.txns?.h1?.sells ?? 0), 0) },
        h6: { buys: caPairs.reduce((s: number, p: any) => s + (p.txns?.h6?.buys ?? 0), 0), sells: caPairs.reduce((s: number, p: any) => s + (p.txns?.h6?.sells ?? 0), 0) },
        h24: { buys: caPairs.reduce((s: number, p: any) => s + (p.txns?.h24?.buys ?? 0), 0), sells: caPairs.reduce((s: number, p: any) => s + (p.txns?.h24?.sells ?? 0), 0) },
      },
    };
  } catch {
    return null;
  }
}

const BLOCKSCOUT_BASE_URL: Record<string, string> = {
  base: 'https://base.blockscout.com',
  robinhood: 'https://robinhoodchain.blockscout.com',
};

export async function fetchHoldersCount(ca: string, chainId: string): Promise<number | null> {
  const base = BLOCKSCOUT_BASE_URL[chainId] ?? BLOCKSCOUT_BASE_URL.base;
  try {
    const res = await fetch(`${base}/api/v2/tokens/${ca}`);
    if (!res.ok) return null;
    const json = await res.json();
    const n = Number(json.holders_count);
    return isNaN(n) ? null : n;
  } catch {
    return null;
  }
}