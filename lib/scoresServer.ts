import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

const CACHE_TTL_SECONDS = 45;
const MEM_TTL_MS = 8000;

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
  platform: string;
  verified: boolean;
}

const CATEGORY_SOURCES: Record<string, ScoreSource[]> = {
  '1': [
    { url: process.env.WYCK_CLANKER1_URL, platform: 'clanker', verified: true },
    { url: process.env.WYCK_CLANKER2_URL, platform: 'clanker', verified: true },
    { url: process.env.WYCK_CLANKER3_URL, platform: 'clanker', verified: true },
    { url: process.env.WYCK_BANKRBOT1_URL, platform: 'bankr', verified: true },
    { url: process.env.WYCK_BANKRBOT2_URL, platform: 'bankr', verified: true },
    { url: process.env.WYCK_BANKRBOT3_URL, platform: 'bankr', verified: true },
  ],
  '2': [
    { url: process.env.WYCK_B1_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_B2_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_B3_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_B4_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_B5_URL, platform: 'base_unverified', verified: false },
    { url: process.env.WYCK_B6_URL, platform: 'base_unverified', verified: false },
    { url: process.env.WYCK_2NEW_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_ZR1_URL, platform: 'zora', verified: true },
    { url: process.env.WYCK_FLAUNCH1_URL, platform: 'flaunch', verified: true },
    { url: process.env.WYCK_O1EXCHANGE1_URL, platform: 'o1exchange', verified: true },
    { url: process.env.WYCK_BASESTONK1_URL, platform: 'basestonk', verified: true },
    { url: process.env.WYCK_THESTONKS1_URL, platform: 'thestonks', verified: true },
  ],
  '3': [
    { url: process.env.WYCK_VIRTUALS1_URL, platform: 'virtuals', verified: true },
    { url: process.env.WYCK_VIRTUALS2_URL, platform: 'virtuals', verified: true },
    { url: process.env.WYCK_VIRTUALS3_URL, platform: 'virtuals', verified: true },
  ],
  '4': [{ url: process.env.WYCK_5NEW_URL, platform: 'base_unverified', verified: false }],
};

const ROBINHOOD_SOURCES: ScoreSource[] = [
  { url: process.env.WYCK_ROBIN_URL, platform: 'robinhood_unverified', verified: false },
  // { url: process.env.WYCK_ROBIN1_URL, platform: 'robinhood_unverified', verified: false },
  // { url: process.env.WYCK_ROBIN1A_URL, platform: 'robinhood_unverified', verified: false },
  // { url: process.env.WYCK_ROBIN1B_URL, platform: 'robinhood_unverified', verified: false },
  { url: process.env.WYCK_ROBIN2_URL, platform: 'robinhood_unverified', verified: false },
  { url: process.env.WYCK_ROBIN2A_URL, platform: 'robinhood_unverified', verified: true },
  { url: process.env.WYCK_ROBIN2B_URL, platform: 'robinhood_unverified', verified: true },
  { url: process.env.WYCK_ROBIN3_URL, platform: 'robinhood_unverified', verified: false },
  { url: process.env.WYCK_ROBIN4_URL, platform: 'robinhood_unverified', verified: false },

  { url: process.env.WYCK_ROBIN5_URL, platform: 'robinhood_verified', verified: true },
  { url: process.env.WYCK_ROBIN6_URL, platform: 'robinhood_verified', verified: true },
  { url: process.env.WYCK_ROBIN_BANKRBOT1_URL, platform: 'bankr', verified: true },
  { url: process.env.WYCK_ROBIN_POOLSFUN1_URL, platform: 'poolsfun', verified: true },
  { url: process.env.WYCK_ROBIN_POOLSTRADE1_URL, platform: 'poolstrade', verified: true },
  { url: process.env.WYCK_ROBIN_CLANKER1_URL, platform: 'clanker', verified: true },
  { url: process.env.WYCK_ROBIN_VIRTUALS1_URL, platform: 'virtuals', verified: true },
  { url: process.env.WYCK_ROBIN_FLAP1_URL, platform: 'flap', verified: true },
  { url: process.env.WYCK_ROBIN_PONSFAMILY1_URL, platform: 'ponsfamily', verified: true },
  { url: process.env.WYCK_ROBIN_PONSFAMILY2_URL, platform: 'ponsfamily', verified: true },
  { url: process.env.WYCK_ROBIN_PONSFAMILY3_URL, platform: 'ponsfamily', verified: true },
  { url: process.env.WYCK_ROBIN_PONSFAMILY4_URL, platform: 'ponsfamily', verified: true },
  { url: process.env.WYCK_ROBIN_PONSFAMILY5_URL, platform: 'ponsfamily', verified: true },
  { url: process.env.WYCK_ROBIN_PONSFAMILY6_URL, platform: 'ponsfamily', verified: true },
  // { url: process.env.WYCK_ROBIN_PONSFAMILY7_URL, platform: 'ponsfamily', verified: true },
  // { url: process.env.WYCK_ROBIN_PONSFAMILY8_URL, platform: 'ponsfamily', verified: true },
  { url: process.env.WYCK_ROBIN_LETSCASH1_URL, platform: 'letscash', verified: true },
  { url: process.env.WYCK_ROBIN_NOXA1_URL, platform: 'noxa', verified: true },
  { url: process.env.WYCK_ROBIN_STONKBROKERS1_URL, platform: 'stonkbrokers', verified: true },
  { url: process.env.WYCK_ROBIN_LONG1_URL, platform: 'long', verified: true },
  { url: process.env.WYCK_ROBIN_LONG2_URL, platform: 'long', verified: true },
  { url: process.env.WYCK_ROBIN_LONG3_URL, platform: 'long', verified: true },
  // { url: process.env.WYCK_ROBIN_LONG4_URL, platform: 'long', verified: true },
  { url: process.env.WYCK_ROBIN_LEMON1_URL, platform: 'lemon', verified: true },
  { url: process.env.WYCK_ROBIN_O1EXCHANGE1_URL, platform: 'o1exchange', verified: true },
  { url: process.env.WYCK_ROBIN_FEELCASH1_URL, platform: 'feelcash', verified: true },
  { url: process.env.WYCK_ROBIN_LUNCHFUN1_URL, platform: 'lunchfun', verified: true },
  { url: process.env.WYCK_ROBIN_PAIRFUND1_URL, platform: 'pairfund', verified: true },
  { url: process.env.WYCK_ROBIN_SENTRY1_URL, platform: 'sentry', verified: true },
];

const ARC_SOURCES: ScoreSource[] = [
  { url: process.env.WYCK_ARC1_URL, platform: 'arc_unverified', verified: false },
  { url: process.env.WYCK_ARC2_URL, platform: 'arc_unverified', verified: false },
  { url: process.env.WYCK_ARC3_URL, platform: 'arc_unverified', verified: false },
  { url: process.env.WYCK_ARC4_URL, platform: 'arc_unverified', verified: false },
  { url: process.env.WYCK_ARC5_URL, platform: 'arc_unverified', verified: false },
  { url: process.env.WYCK_ARC_ARGUS1_URL, platform: 'argus', verified: true },
  { url: process.env.WYCK_ARC_ARGUS2_URL, platform: 'argus', verified: true },
  { url: process.env.WYCK_ARC_ARGUS3_URL, platform: 'argus', verified: true },
  { url: process.env.WYCK_ARC_O1EXCHANGE1_URL, platform: 'o1exchange', verified: true },
  { url: process.env.WYCK_ARC_VERIFY1_URL, platform: 'arc_verified', verified: true },
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

async function fetchAndTagSource(source: ScoreSource & { url: string }): Promise<Record<string, any>> {
  const res = await fetch(source.url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Upstream error: ${source.url}`);
  const data = await res.json();
  const tagged: Record<string, any> = {};
  for (const [ca, token] of Object.entries<any>(data)) {
    tagged[ca] = { ...token, platform: source.platform, verified: source.verified };
  }
  return tagged;
}

async function fetchMergedSources(sources: (ScoreSource & { url: string })[]): Promise<Record<string, any>> {
  const results = await Promise.all(sources.map(fetchAndTagSource));
  return Object.assign({}, ...results);
}

function cacheKey(kind: string) {
  return `wyck:scores:${kind}`;
}

const inFlight = new Map<string, Promise<Record<string, any>>>();

export async function fetchScoresCached(
  kind: string,
  sources: ScoreSource[],
  force = false
): Promise<Record<string, any>> {
  const validSources = sources.filter((s): s is ScoreSource & { url: string } => !!s.url);
  if (!validSources.length) return {};

  const key = cacheKey(kind);

  if (!force) {
    // 1) RAM cache trước — không tốn round-trip Redis nếu đã có request
    // khác (page khác, user khác) hỏi đúng key này trong vài giây gần đây.
    const mem = memGet(key);
    if (mem) return mem;

    try {
      const cached = await redis.get<string | Record<string, any> | null>(key);
      if (cached != null) {
        const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
        memSet(key, parsed);
        return parsed;
      }
    } catch {
      // Redis unavailable
    }
  }

  const existing = inFlight.get(kind);
  if (existing) return existing;

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
  return p;
}