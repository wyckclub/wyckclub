// lib/dexscreenerServer.ts

const DEFAULT_REVALIDATE_SECONDS = 20;
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 4000;
const BATCH_SIZE = 30;

/** Default lifetime of a cached per-CA market data entry, shared across all callers. */
const DEFAULT_CACHE_TTL_MS = 30000;

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

// Dedupes concurrent requests for the exact same batch URL (e.g. two callers
// asking for the same chunk of CAs within the same tick).
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
  vol1h: number;
  vol6h: number;
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
  /** Skip the shared per-CA cache and force a fresh Dexscreener fetch for every CA. */
  force?: boolean;
  /** How long a cached per-CA entry stays valid (ms). Shared across all callers. Default 30s. */
  cacheTtlMs?: number;
}

// Shared per-CA cache. Any caller (whale-hub, whale-hub/potential, potential, etc.)
// that asks about the same CA within the TTL window reuses this instead of hitting
// Dexscreener again — cuts down on request volume and the odds of getting rate-limited.
const perCaCache = new Map<string, { data: DexBatchInfo; timestamp: number }>();

function cacheKey(chainId: string, ca: string) {
  return `${chainId}:${ca.toLowerCase()}`;
}

export async function fetchDexscreenerBatchMap(
  caList: string[],
  chainId: string,
  opts: DexFetchOpts = {}
): Promise<Record<string, DexBatchInfo>> {
  const revalidateSeconds = opts.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const cacheTtlMs = opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  const force = opts.force ?? false;

  const uniqueCas = [...new Set(caList)];
  const out: Record<string, DexBatchInfo> = {};
  const now = Date.now();

  const toFetch: string[] = [];
  for (const ca of uniqueCas) {
    const cached = perCaCache.get(cacheKey(chainId, ca));
    if (!force && cached && now - cached.timestamp < cacheTtlMs) {
      out[ca] = cached.data;
    } else {
      toFetch.push(ca);
    }
  }

  for (let i = 0; i < toFetch.length; i += BATCH_SIZE) {
    const chunk = toFetch.slice(i, i + BATCH_SIZE);
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

      // Only trust liquidity/volume when we have pairs confirmed on this exact chain;
      // otherwise fall back to 0 (matches the previous behavior for liq/vol24h).
      const sumField = (getter: (p: any) => number | undefined) =>
        caPairs.length ? caPairs.reduce((s: number, p: any) => s + (Number(getter(p)) || 0), 0) : 0;

      const info: DexBatchInfo = {
        liq: sumField((p) => p.liquidity?.usd),
        vol1h: sumField((p) => p.volume?.h1),
        vol6h: sumField((p) => p.volume?.h6),
        vol24h: sumField((p) => p.volume?.h24),
        marketCap: pair.marketCap ?? pair.fdv ?? null,
        imageUrl: pair.info?.imageUrl ?? null,
        priceUsd: pair.priceUsd == null ? null : Number(pair.priceUsd),
        h24: pair.priceChange?.h24 == null ? null : Number(pair.priceChange.h24),
        name: pair.baseToken?.name ?? null,
      };

      out[ca] = info;
      perCaCache.set(cacheKey(chainId, ca), { data: info, timestamp: now });
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