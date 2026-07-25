export interface DexData {
  h24: number | null;
  priceUsd: number | null;
  vol24h: number | null;
  liq: number | null;
  marketCap: number | null;
}

const TTL = 20 * 60 * 1000;
const cache = new Map<string, { data: DexData; timestamp: number }>();

export function getCachedDexData(ca: string): DexData | null {
  return cache.get(ca)?.data ?? null;
}

export async function prefetchDexDataBatch(caList: string[]) {
  const now = Date.now();
  const need = [...new Set(caList)].filter((ca) => {
    const c = cache.get(ca);
    return !c || now - c.timestamp >= TTL;
  });
  if (!need.length) return;

  const BATCH_SIZE = 10;
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
          (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === 'base'
        );
        const pair = caPairs[0] || pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
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
          },
          timestamp: Date.now(),
        });
      });
    } catch {
      // bỏ qua lỗi chunk
    }
    if (i + BATCH_SIZE < need.length) await new Promise((r) => setTimeout(r, 300));
  }
}

export async function fetchLivePrice(ca: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`).then((r) => r.json());
    const pairs = res.pairs || [];
    const caPairs = pairs.filter(
      (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === 'base'
    );
    const pair = caPairs[0] || pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
    const priceUsd = pair?.priceUsd;
    return priceUsd == null ? null : Number(priceUsd);
  } catch {
    return null;
  }
}