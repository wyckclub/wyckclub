import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

const DEFAULT_REVALIDATE_SECONDS = 40;
const DEFAULT_MAX_RETRIES = 2;
const BASE_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 4000;
const BATCH_SIZE = 30;
const DEFAULT_CACHE_TTL_MS = 120000;
const MEM_TTL_MS = 20000;

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
  vol1h: number;
  vol6h: number;
  vol24h: number;
  marketCap: number | null;
  imageUrl: string | null;
  priceUsd: number | null;
  h24: number | null;
  name: string | null;
  pairCreatedAt: number | null;
}

export interface DexFetchOpts {
  revalidateSeconds?: number;
  maxRetries?: number;
  force?: boolean;
  cacheTtlMs?: number;
}

function oldestPairCreatedAt(pairs: any[], fallback: any): number | null {
  if (!pairs.length) return fallback?.pairCreatedAt ?? null;
  return pairs.reduce((min: number | null, p: any) => {
    const t = p.pairCreatedAt ?? null;
    if (t == null) return min;
    return min == null ? t : Math.min(min, t);
  }, null as number | null);
}

function hashKey(chainId: string) {
  return `wyck:dex:${chainId}`;
}

interface MemEntry {
  data: DexBatchInfo;
  expires: number;
}
const memCache = new Map<string, MemEntry>();

function memKey(chainId: string, ca: string) {
  return `${chainId}:${ca.toLowerCase()}`;
}

function memGetMany(chainId: string, cas: string[]): Record<string, DexBatchInfo> {
  const out: Record<string, DexBatchInfo> = {};
  const now = Date.now();
  for (const ca of cas) {
    const e = memCache.get(memKey(chainId, ca));
    if (e && now <= e.expires) out[ca] = e.data;
  }
  return out;
}

function memSetMany(chainId: string, entries: Record<string, DexBatchInfo>, ttlMs = MEM_TTL_MS) {
  const expires = Date.now() + ttlMs;
  for (const [ca, data] of Object.entries(entries)) {
    memCache.set(memKey(chainId, ca), { data, expires });
  }
}

async function getCachedMany(chainId: string, cas: string[]): Promise<Record<string, DexBatchInfo>> {
  if (!cas.length) return {};
  try {
    const fields = cas.map((ca) => ca.toLowerCase());
    const raw = await redis.hmget<Record<string, DexBatchInfo | string>>(hashKey(chainId), ...fields);
    const out: Record<string, DexBatchInfo> = {};
    cas.forEach((ca) => {
      const v = raw?.[ca.toLowerCase()];
      if (v == null) return;
      try {
        out[ca] = typeof v === 'string' ? (JSON.parse(v) as DexBatchInfo) : v;
      } catch {}
    });
    return out;
  } catch {
    return {};
  }
}

async function setCachedMany(chainId: string, entries: Record<string, DexBatchInfo>, ttlSeconds: number) {
  const cas = Object.keys(entries);
  if (!cas.length) return;
  try {
    const fields: Record<string, string> = {};
    cas.forEach((ca) => { fields[ca.toLowerCase()] = JSON.stringify(entries[ca]); });
    await redis.hset(hashKey(chainId), fields);
    await redis.expire(hashKey(chainId), ttlSeconds);
  } catch {}
}

export async function fetchDexscreenerBatchMap(
  caList: string[],
  chainId: string,
  opts: DexFetchOpts = {}
): Promise<Record<string, DexBatchInfo>> {
  const revalidateSeconds = opts.revalidateSeconds ?? DEFAULT_REVALIDATE_SECONDS;
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES;
  const cacheTtlSeconds = Math.round((opts.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS) / 1000);
  const force = opts.force ?? false;

  const uniqueCas = [...new Set(caList)];
  const out: Record<string, DexBatchInfo> = {};

  let toFetch = uniqueCas;

  if (!force) {
    const memHit = memGetMany(chainId, uniqueCas);
    Object.assign(out, memHit);
    toFetch = uniqueCas.filter((ca) => !(ca in memHit));

    if (toFetch.length) {
      const cached = await getCachedMany(chainId, toFetch);
      Object.assign(out, cached);
      memSetMany(chainId, cached);
      toFetch = toFetch.filter((ca) => !(ca in cached));
    }
  }

  const freshEntries: Record<string, DexBatchInfo> = {};

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
        pairCreatedAt: oldestPairCreatedAt(caPairs, pair),
      };

      out[ca] = info;
      freshEntries[ca] = info;
    });
  }

  if (Object.keys(freshEntries).length) {
    await setCachedMany(chainId, freshEntries, cacheTtlSeconds);
    memSetMany(chainId, freshEntries);
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