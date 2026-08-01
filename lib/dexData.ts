export interface DexData {
  h24: number | null;
  priceUsd: number | null;
  vol24h: number | null;
  liq: number | null;
  marketCap: number | null;
  twitter: string | null;
  imageUrl: string | null;
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
  if (!tw?.url) return null;
  const match = tw.url.match(/(?:x|twitter)\.com\/([^/?]+)/i);
  return match ? match[1] : null;
}

export async function prefetchDexDataBatch(
  caList: string[],
  onBatch?: () => void
) {
  const now = Date.now();
  const need = [...new Set(caList)].filter((ca) => {
    const c = cache.get(ca);
    return !c || now - c.timestamp >= TTL;
  });
  if (!need.length) return;

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
            twitter: extractTwitter(pair),
            imageUrl: pair?.info?.imageUrl ?? null,
          },
          timestamp: Date.now(),
        });
      });
    } catch {
      // skip error
    }
    saveToStorage();
    onBatch?.();
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