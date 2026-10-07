import { Redis } from '@upstash/redis';
import { gzipSync, gunzipSync } from 'zlib';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
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
  symbol: string | null;
  twitter: string | null;
  website: string | null;
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

function pack(obj: unknown): string {
  return gzipSync(JSON.stringify(obj)).toString('base64');
}

function unpack(v: string): any {
  return JSON.parse(gunzipSync(Buffer.from(v, 'base64')).toString());
}

type DexBlob = Record<string, { t: number; d: DexBatchInfo }>;

function blobKey(chainId: string) {
  return `wyck:dexblob:${chainId}`;
}

async function readBlob(chainId: string): Promise<DexBlob> {
  try {
    const raw = await redis.get<string>(blobKey(chainId));
    return raw ? (unpack(raw) as DexBlob) : {};
  } catch {
    return {};
  }
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

async function getCachedMany(chainId: string, cas: string[], ttlSeconds: number): Promise<Record<string, DexBatchInfo>> {
  if (!cas.length) return {};
  const blob = await readBlob(chainId);
  const now = Date.now();
  const out: Record<string, DexBatchInfo> = {};
  for (const ca of cas) {
    const e = blob[ca.toLowerCase()];
    if (e && now - e.t < ttlSeconds * 1000) out[ca] = e.d;
  }
  return out;
}

async function setCachedMany(chainId: string, entries: Record<string, DexBatchInfo>, _ttlSeconds: number) {
  const cas = Object.keys(entries);
  if (!cas.length) return;
  const maxAge = Math.round(DEFAULT_CACHE_TTL_MS / 1000);
  try {
    const blob = await readBlob(chainId);
    const now = Date.now();
    for (const k of Object.keys(blob)) {
      if (now - blob[k].t >= maxAge * 1000) delete blob[k];
    }
    cas.forEach((ca) => { blob[ca.toLowerCase()] = { t: now, d: entries[ca] }; });
    await redis.set(blobKey(chainId), pack(blob), { ex: maxAge });
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
      const cached = await getCachedMany(chainId, toFetch, cacheTtlSeconds);
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

      const eff = caPairs.length ? caPairs : [pair];
      const sumField = (getter: (p: any) => number | undefined) =>
        eff.reduce((s: number, p: any) => s + (Number(getter(p)) || 0), 0);
      const socials = pair.info?.socials || [];

      const info: DexBatchInfo = {
        liq: Math.round(sumField((p) => p.liquidity?.usd)),
        vol1h: Math.round(sumField((p) => p.volume?.h1)),
        vol6h: Math.round(sumField((p) => p.volume?.h6)),
        vol24h: Math.round(sumField((p) => p.volume?.h24)),
        marketCap: pair.marketCap != null ? Math.round(pair.marketCap) : pair.fdv != null ? Math.round(pair.fdv) : null,
        imageUrl: pair.info?.imageUrl ?? null,
        priceUsd: pair.priceUsd == null ? null : Number(pair.priceUsd),
        h24: pair.priceChange?.h24 == null ? null : Number(pair.priceChange.h24),
        name: pair.baseToken?.name ?? null,
        symbol: pair.baseToken?.symbol ?? null,
        twitter: socials.find((s: any) => s.type === 'twitter')?.url ?? null,
        website: pair.info?.websites?.[0]?.url ?? null,
        pairCreatedAt: oldestPairCreatedAt(eff, pair),
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

import type { FullPairInfo } from '@/lib/dexData';

export async function fetchFullPairInfoServer(ca: string, chainId: string): Promise<FullPairInfo | null> {
  const json = await fetchDeduped(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, 30, 2);
  if (!json) return null;
  const pairs = json.pairs || [];
  const caLower = ca.toLowerCase();
  const caPairs = pairs.filter((p: any) => p.baseToken?.address?.toLowerCase() === caLower && p.chainId === chainId);
  const pair =
    [...caPairs].sort((a: any, b: any) => (Number(b.liquidity?.usd) || 0) - (Number(a.liquidity?.usd) || 0))[0] ||
    pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === caLower);
  if (!pair) return null;

  const eff = caPairs.length ? caPairs : [pair];
  const topVol = [...eff].sort((a: any, b: any) => (Number(b.volume?.h24) || 0) - (Number(a.volume?.h24) || 0))[0] ?? pair;
  const socials = pair.info?.socials || [];
  const soc = (t: string) => socials.find((s: any) => s.type === t)?.url ?? null;
  const sum = (g: (p: any) => number | undefined) => eff.reduce((s: number, p: any) => s + (Number(g(p)) || 0), 0);
  const tx = (k: 'm5' | 'h1' | 'h6' | 'h24') => ({
    buys: eff.reduce((s: number, p: any) => s + (p.txns?.[k]?.buys ?? 0), 0),
    sells: eff.reduce((s: number, p: any) => s + (p.txns?.[k]?.sells ?? 0), 0),
  });

  return {
    pairAddress: pair.pairAddress,
    topVolumePairAddress: topVol?.pairAddress ?? pair.pairAddress,
    dexId: pair.dexId,
    url: pair.url,
    priceUsd: pair.priceUsd == null ? null : Number(pair.priceUsd),
    marketCap: pair.marketCap ?? pair.fdv ?? null,
    fdv: pair.fdv ?? null,
    liq: sum((p) => p.liquidity?.usd),
    pairCreatedAt: oldestPairCreatedAt(eff, pair),
    imageUrl: pair.info?.imageUrl ?? null,
    symbol: pair.baseToken?.symbol ?? null,
    name: pair.baseToken?.name ?? null,
    twitter: soc('twitter'),
    telegram: soc('telegram'),
    discord: soc('discord'),
    website: pair.info?.websites?.[0]?.url ?? null,
    priceChange: {
      m5: pair.priceChange?.m5 ?? null,
      h1: pair.priceChange?.h1 ?? null,
      h6: pair.priceChange?.h6 ?? null,
      h24: pair.priceChange?.h24 ?? null,
    },
    volume: { m5: sum((p) => p.volume?.m5), h1: sum((p) => p.volume?.h1), h6: sum((p) => p.volume?.h6), h24: sum((p) => p.volume?.h24) },
    txns: { m5: tx('m5'), h1: tx('h1'), h6: tx('h6'), h24: tx('h24') },
  };
}