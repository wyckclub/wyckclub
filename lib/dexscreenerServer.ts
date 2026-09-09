// lib/dexscreenerServer.ts

const DEFAULT_REVALIDATE_SECONDS = 20;
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 4000;
const BATCH_SIZE = 30;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchDexscreenerWithRetry(
  url: string,
  revalidateSeconds: number,
  maxRetries: number
): Promise<any | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, { next: { revalidate: revalidateSeconds } });

      if (res.ok) return await res.json();

      if (res.status === 429 && attempt < maxRetries) {
        const retryAfter = res.headers.get('retry-after');
        const wait = retryAfter
          ? Number(retryAfter) * 1000
          : Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
        await sleep(wait);
        continue;
      }

      return null;
    } catch {
      if (attempt < maxRetries) {
        await sleep(Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS));
        continue;
      }
      return null;
    }
  }
  return null;
}

const inFlight = new Map<string, Promise<any | null>>();

function fetchDeduped(url: string, revalidateSeconds: number, maxRetries: number): Promise<any | null> {
  const existing = inFlight.get(url);
  if (existing) return existing;

  const p = fetchDexscreenerWithRetry(url, revalidateSeconds, maxRetries).finally(() => {
    inFlight.delete(url);
  });
  inFlight.set(url, p);
  return p;
}

export interface DexBatchInfo {
  liq: number;
  vol24h: number;
  marketCap: number | null;
  imageUrl: string | null;
  priceUsd: number | null;
  h24: number | null;
  name: string | null;
}

export interface DexFetchOpts {
  revalidateSeconds?: number;
  maxRetries?: number;
}

export async function fetchDexscreenerBatchMap(
  caList: string[],
  chainId: string,
  opts: DexFetchOpts = {}
): Promise<Record<string, DexBatchInfo>> {
  const revalidateSeconds = opts.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;

  const uniqueCas = [...new Set(caList)];
  const out: Record<string, DexBatchInfo> = {};

  for (let i = 0; i < uniqueCas.length; i += BATCH_SIZE) {
    const chunk = uniqueCas.slice(i, i + BATCH_SIZE);
    const url = `https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`;
    const json = await fetchDeduped(url, revalidateSeconds, maxRetries);
    if (!json) continue;

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

      out[ca] = {
        liq: caPairs.length ? caPairs.reduce((s: number, p: any) => s + (Number(p.liquidity?.usd) || 0), 0) : 0,
        vol24h: caPairs.length ? caPairs.reduce((s: number, p: any) => s + (Number(p.volume?.h24) || 0), 0) : 0,
        marketCap: pair.marketCap ?? pair.fdv ?? null,
        imageUrl: pair.info?.imageUrl ?? null,
        priceUsd: pair.priceUsd == null ? null : Number(pair.priceUsd),
        h24: pair.priceChange?.h24 == null ? null : Number(pair.priceChange.h24),
        name: pair.baseToken?.name ?? null,
      };
    });
  }

  return out;
}

export async function fetchDexscreenerSingle(
  ca: string,
  chainId: string,
  opts: DexFetchOpts = {}
): Promise<DexBatchInfo | null> {
  const map = await fetchDexscreenerBatchMap([ca], chainId, opts);
  return map[ca] ?? null;
}