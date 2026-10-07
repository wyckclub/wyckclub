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
  pairCreatedAt: number | null;
}

export interface FullPairInfo {
  pairAddress: string;
  topVolumePairAddress: string | null;
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
  discord: string | null;
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

const TTL = 5 * 60 * 1000;
const STORAGE_KEY = 'wyck_dex_cache_v1';
const cache = new Map<string, { data: DexData; timestamp: number }>();
const IMAGE_TTL = 30 * 24 * 60 * 60 * 1000;
const IMAGE_STORAGE_KEY = 'wyck_image_cache_v1';
const imageCache = new Map<string, { url: string; timestamp: number }>();

function loadImageCacheFromStorage() {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(IMAGE_STORAGE_KEY);
    if (!raw) return;
    const parsed: Record<string, { url: string; timestamp: number }> = JSON.parse(raw);
    const now = Date.now();
    Object.entries(parsed).forEach(([ca, entry]) => {
      if (now - entry.timestamp < IMAGE_TTL) imageCache.set(ca, entry);
    });
  } catch {}
}

function saveImageCacheToStorage() {
  if (typeof window === 'undefined') return;
  try {
    const obj: Record<string, { url: string; timestamp: number }> = {};
    imageCache.forEach((v, k) => (obj[k] = v));
    localStorage.setItem(IMAGE_STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

function getCachedImage(ca: string): string | null {
  const entry = imageCache.get(ca);
  if (!entry || Date.now() - entry.timestamp >= IMAGE_TTL) return null;
  return entry.url;
}

function setCachedImage(ca: string, url: string | null | undefined) {
  if (!url) return;
  const existing = imageCache.get(ca);
  if (existing && existing.url === url && Date.now() - existing.timestamp < IMAGE_TTL) return;
  imageCache.set(ca, { url, timestamp: Date.now() });
  saveImageCacheToStorage();
}

loadImageCacheFromStorage();

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
  const entry = cache.get(ca);
  if (entry) return entry.data;

  const img = getCachedImage(ca);
  if (img) {
    return {
      h24: null,
      priceUsd: null,
      vol24h: null,
      liq: null,
      marketCap: null,
      twitter: null,
      website: null,
      imageUrl: img,
      symbol: null,
      name: null,
      pairCreatedAt: null,
    };
  }

  return null;
}

interface ServerDex {
  liq: number;
  vol24h: number;
  marketCap: number | null;
  imageUrl: string | null;
  priceUsd: number | null;
  h24: number | null;
  name: string | null;
  symbol?: string | null;
  twitter?: string | null;
  website?: string | null;
  pairCreatedAt: number | null;
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

  const BATCH_SIZE = 50;
  for (let i = 0; i < need.length; i += BATCH_SIZE) {
    const chunk = need.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(`/api/dex?chain=${chainId}&cas=${chunk.join(',')}`);
      if (!res.ok) {
        console.error('Dex API error, status:', res.status);
      } else {
        const map: Record<string, ServerDex> = await res.json();
        chunk.forEach((ca) => {
          const d = map[ca];
          if (!d) return;
          cache.set(ca, {
            data: {
              h24: d.h24 ?? null,
              priceUsd: d.priceUsd ?? null,
              vol24h: d.vol24h,
              liq: d.liq,
              marketCap: d.marketCap ?? null,
              twitter: d.twitter ?? null,
              website: d.website ?? null,
              imageUrl: d.imageUrl ?? getCachedImage(ca),
              symbol: d.symbol ?? null,
              name: d.name ?? null,
              pairCreatedAt: d.pairCreatedAt ?? null,
            },
            timestamp: Date.now(),
          });
          setCachedImage(ca, d.imageUrl);
        });
      }
    } catch (e) {
      console.error('Dex prefetch failed', e);
    }
    saveToStorage();
    onBatch?.();
  }
}

export async function fetchLivePrice(ca: string, chainId: string = 'base'): Promise<number | null> {
  try {
    const res = await fetch(`/api/dex?chain=${chainId}&cas=${ca}&live=1`);
    if (!res.ok) return null;
    const map: Record<string, ServerDex> = await res.json();
    return map[ca]?.priceUsd ?? null;
  } catch {
    return null;
  }
}

export async function fetchFullTokenPairInfo(ca: string, chainId: string = 'base'): Promise<FullPairInfo | null> {
  try {
    const res = await fetch(`/api/dex/pair?ca=${ca}&chain=${chainId}`);
    if (!res.ok) return null;
    const info: FullPairInfo | null = await res.json();
    if (!info) return null;
    return { ...info, imageUrl: info.imageUrl ?? getCachedImage(ca) };
  } catch {
    return null;
  }
}

export async function fetchHoldersCount(ca: string, chainId: string): Promise<number | null> {
  try {
    const res = await fetch(`/api/holders?ca=${ca}&chain=${chainId}`);
    if (!res.ok) return null;
    const json = await res.json();
    return json.holders ?? null;
  } catch {
    return null;
  }
}