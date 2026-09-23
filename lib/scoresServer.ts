import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

const CACHE_TTL_SECONDS = 240;
const MEM_TTL_MS = 20000;

interface MemEntry {
  data: Record<string, any>;
  expires: number;
}
const memCache = new Map<string, MemEntry>();

function memGet(key: string): Record<string, any> | undefined {
  const e = memCache.get(key);
  if (!e) return undefined;
  if (Date.now() > e.expires) {
    memCache.delete(key);
    return undefined;
  }
  return e.data;
}

function memSet(key: string, data: Record<string, any>) {
  memCache.set(key, { data, expires: Date.now() + MEM_TTL_MS });
}

export interface ScoreSource {
  url: string | undefined;
}

const CATEGORY_SOURCES: Record<string, ScoreSource[]> = {
  '1': [
    { url: process.env.WYCK_CLANKER1_URL },
    { url: process.env.WYCK_CLANKER2_URL },
    { url: process.env.WYCK_CLANKER3_URL },
    { url: process.env.WYCK_BANKRBOT1_URL },
    { url: process.env.WYCK_BANKRBOT2_URL },
    { url: process.env.WYCK_BANKRBOT3_URL },
  ],
  '2': [
    { url: process.env.WYCK_B1_URL },
    { url: process.env.WYCK_B2_URL },
    { url: process.env.WYCK_B3_URL },
    { url: process.env.WYCK_B4_URL },
    { url: process.env.WYCK_B5_URL },
    { url: process.env.WYCK_B6_URL },
    { url: process.env.WYCK_2NEW_URL },
    { url: process.env.WYCK_ZR1_URL },
    { url: process.env.WYCK_FLAUNCH1_URL },
    { url: process.env.WYCK_O1EXCHANGE1_URL },
    { url: process.env.WYCK_BASESTONK1_URL },
    { url: process.env.WYCK_THESTONKS1_URL },
  ],
  '3': [
    { url: process.env.WYCK_VIRTUALS1_URL },
    { url: process.env.WYCK_VIRTUALS2_URL },
    { url: process.env.WYCK_VIRTUALS3_URL },
  ],
  '4': [{ url: process.env.WYCK_5NEW_URL }],
};

const ROBINHOOD_SOURCES: ScoreSource[] = [
  { url: process.env.WYCK_ROBIN_URL },
  { url: process.env.WYCK_ROBIN1B_URL },
  { url: process.env.WYCK_ROBIN2_URL },
  { url: process.env.WYCK_ROBIN2A_URL },
  { url: process.env.WYCK_ROBIN2B_URL },
  { url: process.env.WYCK_ROBIN3_URL },
  { url: process.env.WYCK_ROBIN4_URL },
  { url: process.env.WYCK_ROBIN5_URL },
  { url: process.env.WYCK_ROBIN6_URL },
  { url: process.env.WYCK_ROBIN_BANKRBOT1_URL },
  { url: process.env.WYCK_ROBIN_POOLSFUN1_URL },
  { url: process.env.WYCK_ROBIN_POOLSTRADE1_URL },
  { url: process.env.WYCK_ROBIN_CLANKER1_URL },
  { url: process.env.WYCK_ROBIN_VIRTUALS1_URL },
  { url: process.env.WYCK_ROBIN_FLAP1_URL },
  { url: process.env.WYCK_ROBIN_PONSFAMILY1_URL },
  { url: process.env.WYCK_ROBIN_PONSFAMILY2_URL },
  { url: process.env.WYCK_ROBIN_PONSFAMILY3_URL },
  { url: process.env.WYCK_ROBIN_PONSFAMILY4_URL },
  { url: process.env.WYCK_ROBIN_PONSFAMILY5_URL },
  { url: process.env.WYCK_ROBIN_PONSFAMILY6_URL },
  { url: process.env.WYCK_ROBIN_PONSFAMILY7_URL },
  { url: process.env.WYCK_ROBIN_LETSCASH1_URL },
  { url: process.env.WYCK_ROBIN_NOXA1_URL },
  { url: process.env.WYCK_ROBIN_STONKBROKERS1_URL },
  { url: process.env.WYCK_ROBIN_LONG1_URL },
  { url: process.env.WYCK_ROBIN_LONG2_URL },
  { url: process.env.WYCK_ROBIN_LONG3_URL },
  { url: process.env.WYCK_ROBIN_LEMON1_URL },
  { url: process.env.WYCK_ROBIN_O1EXCHANGE1_URL },
  { url: process.env.WYCK_ROBIN_FEELCASH1_URL },
  { url: process.env.WYCK_ROBIN_LUNCHFUN1_URL },
  { url: process.env.WYCK_ROBIN_PAIRFUND1_URL },
  { url: process.env.WYCK_ROBIN_SENTRY1_URL },
];

const ARC_SOURCES: ScoreSource[] = [
  { url: process.env.WYCK_ARC1_URL },
  { url: process.env.WYCK_ARC2_URL },
  { url: process.env.WYCK_ARC3_URL },
  { url: process.env.WYCK_ARC4_URL },
  { url: process.env.WYCK_ARC5_URL },
  { url: process.env.WYCK_ARC_ARGUS1_URL },
  { url: process.env.WYCK_ARC_ARGUS2_URL },
  { url: process.env.WYCK_ARC_ARGUS3_URL },
  { url: process.env.WYCK_ARC_O1EXCHANGE1_URL },
  { url: process.env.WYCK_ARC_VERIFY1_URL },
];

export function getCategorySources(cat: string): ScoreSource[] {
  return (CATEGORY_SOURCES[cat] || []).filter((s): s is ScoreSource & { url: string } => !!s.url);
}

export function getRobinhoodSources(): ScoreSource[] {
  return ROBINHOOD_SOURCES.filter((s): s is ScoreSource & { url: string } => !!s.url);
}

export function getArcSources(): ScoreSource[] {
  return ARC_SOURCES.filter((s): s is ScoreSource & { url: string } => !!s.url);
}

async function fetchSourceData(source: ScoreSource & { url: string }): Promise<Record<string, any>> {
  const res = await fetch(source.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Upstream error: ${source.url}`);
  return res.json();
}

async function fetchMergedSources(sources: (ScoreSource & { url: string })[]): Promise<Record<string, any>> {
  const results = await Promise.all(sources.map(fetchSourceData));
  return Object.assign({}, ...results);
}

function cacheKey(kind: string) {
  return `wyck:scores:${kind}`;
}

// ---------- Factory (platform/verified/creator wallets) ----------

type Chain = 'base' | 'robinhood' | 'arc';

interface FactoryRawEntry {
  checked_at?: number;
  data?: {
    creator_wallet?: string | null;
    creator_2?: string | null;
    factory?: string | null;
    fee_recipients_confirmed?: string[];
  };
}

interface FactoryInfo {
  platform: string;
  verified: boolean;
  wallets: string[];
}

const FACTORY_URLS: Record<Chain, string | undefined> = {
  base: process.env.WYCK_FACTORY_BASE_URL,
  robinhood: process.env.WYCK_FACTORY_ROBINHOOD_URL,
  arc: process.env.WYCK_FACTORY_ARC_URL,
};

const FACTORY_MEM_TTL_MS = 60000;
const FACTORY_CACHE_TTL_SECONDS = 300;
const factoryMemCache = new Map<string, { data: Record<string, FactoryInfo>; expires: number }>();
const factoryInFlight = new Map<string, Promise<Record<string, FactoryInfo>>>();

function factoryCacheKey(chain: Chain) {
  return `wyck:factory:${chain}`;
}

function buildWalletsList(d: NonNullable<FactoryRawEntry['data']>): string[] {
  const raw: string[] = [];
  if (d.creator_wallet) raw.push(d.creator_wallet);
  if (d.creator_2) raw.push(d.creator_2);
  if (Array.isArray(d.fee_recipients_confirmed)) raw.push(...d.fee_recipients_confirmed);

  const seen = new Set<string>();
  const wallets: string[] = [];
  for (const w of raw) {
    if (typeof w !== 'string') continue;
    const lower = w.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);
    wallets.push(w);
    if (wallets.length >= 5) break;
  }
  return wallets;
}

function resolveFactoryInfo(chain: Chain, factory: string | null | undefined, wallets: string[]): FactoryInfo {
  if (factory === 'verified') return { platform: `${chain}_verified`, verified: true, wallets };
  if (!factory || factory === 'unknown') return { platform: `${chain}_unverified`, verified: false, wallets };
  return { platform: factory, verified: true, wallets };
}

async function fetchFactoryMap(chain: Chain): Promise<Record<string, FactoryInfo>> {
  const key = factoryCacheKey(chain);

  const mem = factoryMemCache.get(key);
  if (mem && Date.now() < mem.expires) return mem.data;

  try {
    const cached = await redis.get<string | Record<string, FactoryInfo> | null>(key);
    if (cached != null) {
      const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
      factoryMemCache.set(key, { data: parsed, expires: Date.now() + FACTORY_MEM_TTL_MS });
      return parsed;
    }
  } catch {
    // unavailable
  }

  const existing = factoryInFlight.get(chain);
  if (existing) return existing;

  const url = FACTORY_URLS[chain];
  const p = (async () => {
    const map: Record<string, FactoryInfo> = {};
    if (url) {
      try {
        const res = await fetch(url, { next: { revalidate: FACTORY_CACHE_TTL_SECONDS } });
        if (res.ok) {
          const json: Record<string, FactoryRawEntry> = await res.json();
          for (const [ca, entry] of Object.entries(json)) {
            const d = entry?.data;
            if (!d) continue;
            map[ca.toLowerCase()] = resolveFactoryInfo(chain, d.factory, buildWalletsList(d));
          }
        }
      } catch {
        // best-effort, fallback default unverified applied per-token at enrich step
      }
    }
    factoryMemCache.set(key, { data: map, expires: Date.now() + FACTORY_MEM_TTL_MS });
    try {
      await redis.set(key, JSON.stringify(map), { ex: FACTORY_CACHE_TTL_SECONDS });
    } catch {
      // best-effort cache write
    }
    return map;
  })().finally(() => {
    factoryInFlight.delete(chain);
  });

  factoryInFlight.set(chain, p);
  return p;
}

function chainFromKind(kind: string): Chain {
  if (kind === 'robinhood') return 'robinhood';
  if (kind === 'arc') return 'arc';
  return 'base';
}

async function enrichWithFactory(data: Record<string, any>, chain: Chain): Promise<Record<string, any>> {
  const factoryMap = await fetchFactoryMap(chain);
  for (const [ca, token] of Object.entries<any>(data)) {
    const info = factoryMap[ca.toLowerCase()];
    if (info) {
      token.platform = info.platform;
      token.verified = info.verified;
      token.wallets = info.wallets;
    } else {
      token.platform = `${chain}_unverified`;
      token.verified = false;
      token.wallets = [];
    }
  }
  return data;
}

// ---------- Main cached fetch ----------

const inFlight = new Map<string, Promise<Record<string, any>>>();

export async function fetchScoresCached(
  kind: string,
  sources: ScoreSource[],
  force = false
): Promise<Record<string, any>> {
  const validSources = sources.filter((s): s is ScoreSource & { url: string } => !!s.url);
  if (!validSources.length) return {};

  const chain = chainFromKind(kind);
  const key = cacheKey(kind);

  if (!force) {
    const mem = memGet(key);
    if (mem) return enrichWithFactory(mem, chain);

    try {
      const cached = await redis.get<string | Record<string, any> | null>(key);
      if (cached != null) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        memSet(key, parsed);
        return enrichWithFactory(parsed, chain);
      }
    } catch {
      // unavailable
    }
  }

  const existing = inFlight.get(kind);
  if (existing) return existing.then((d) => enrichWithFactory(d, chain));

  const p = (async () => {
    const merged = await fetchMergedSources(validSources);
    memSet(key, merged);
    try {
      await redis.set(key, JSON.stringify(merged), { ex: CACHE_TTL_SECONDS });
    } catch {
      // best-effort cache write
    }
    return merged;
  })().finally(() => {
    inFlight.delete(kind);
  });

  inFlight.set(kind, p);
  return p.then((d) => enrichWithFactory(d, chain));
}