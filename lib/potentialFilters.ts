import type { PotentialApiItem } from '@/app/api/potential/route';

export type NetworkKey = 'base' | 'robinhood' | 'arc';

export interface PotentialFilters {
  network: NetworkKey;
  basePlatforms: string[];
  robinhoodPlatforms: string[];
  arcPlatforms: string[];
  minScore: string;
  hasWhale: boolean;
  strongBuying: boolean;
  bothRequired: boolean;
  bullsIncrease: boolean;
  bearsDecrease: boolean;
  priceTrend: 'any' | 'down' | 'up';
  waiTrend: 'any' | 'notdown' | 'down';
  minBull: string;
  maxBear: string;
  minNetBull: string;
  entryWindow: 1 | 2 | 3;
  maxPriceUp: string;
  minAge: string;
  maxAge: string;
  minMarketCap: string;
  maxMarketCap: string;
  minLiq: string;
  maxChange24h: string;
  minVol1h: string;
  minVol6h: string;
  minVol24h: string;
}

const BASE_DEFAULTS: Omit<PotentialFilters, 'network'> = {
  basePlatforms: [],
  robinhoodPlatforms: [],
  arcPlatforms: [],
  minScore: '5',
  hasWhale: false,
  strongBuying: false,
  bothRequired: false,
  bullsIncrease: false,
  bearsDecrease: false,
  priceTrend: 'any',
  waiTrend: 'any',
  minBull: '5',
  maxBear: '1',
  minNetBull: '5',
  entryWindow: 1,
  maxPriceUp: '',
  minAge: '',
  maxAge: '',
  minMarketCap: '50000',
  maxMarketCap: '',
  minLiq: '20000',
  maxChange24h: '',
  minVol1h: '',
  minVol6h: '',
  minVol24h: '1000',
};

export function defaultFiltersFor(network: NetworkKey): PotentialFilters {
  return { ...BASE_DEFAULTS, network };
}

export const DEFAULT_FILTERS: PotentialFilters = defaultFiltersFor('base');

const DRAFT_KEY_PREFIX = 'wyck_potential_draft_v2_';
const APPLIED_KEY_PREFIX = 'wyck_potential_applied_v2_';
const FOLLOW_KEY = 'wyck_potential_follow_v1';

export function loadDraftFilters(network: NetworkKey): PotentialFilters {
  if (typeof window === 'undefined') return defaultFiltersFor(network);
  try {
    const raw = localStorage.getItem(DRAFT_KEY_PREFIX + network);
    if (!raw) return defaultFiltersFor(network);
    return { ...defaultFiltersFor(network), ...JSON.parse(raw), network };
  } catch {
    return defaultFiltersFor(network);
  }
}

export function saveDraftFilters(network: NetworkKey, f: PotentialFilters) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(DRAFT_KEY_PREFIX + network, JSON.stringify(f));
  } catch {}
}

export function loadAppliedFilters(network: NetworkKey): PotentialFilters | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(APPLIED_KEY_PREFIX + network);
    if (!raw) return null;
    return { ...defaultFiltersFor(network), ...JSON.parse(raw), network };
  } catch {
    return null;
  }
}

export function saveAppliedFilters(network: NetworkKey, f: PotentialFilters | null) {
  if (typeof window === 'undefined') return;
  try {
    if (f) localStorage.setItem(APPLIED_KEY_PREFIX + network, JSON.stringify(f));
    else localStorage.removeItem(APPLIED_KEY_PREFIX + network);
  } catch {}
}

export const FOLLOW_BUY_USD = 1;

export const DCA_ONLY_WHEN_DOWN = true;

export interface FollowBuy {
  price: number;
  at: number;
}

export interface FollowTrade {
  invested: number;
  proceeds: number;
  sellPrice: number;
  closedAt: number;
}

export interface FollowSnapshot {
  ca: string;
  chain: 'base' | 'robinhood' | 'arc';
  followedAt: number;
  priceUsd: number | null;
  marketCap: number | null;
  wai: number | null;
  bull: number | null;
  bear: number | null;
  netBull: number | null;
  buys: FollowBuy[];
  closedAt: number | null;
  trades: FollowTrade[];
}

function normalizeFollow(raw: any): FollowSnapshot {
  const price = typeof raw?.priceUsd === 'number' && raw.priceUsd > 0 ? raw.priceUsd : null;
  const buys: FollowBuy[] = Array.isArray(raw?.buys)
    ? raw.buys
    : price != null
    ? [{ price, at: raw?.followedAt ?? Date.now() }]
    : [];
  return {
    ...raw,
    priceUsd: raw?.priceUsd ?? null,
    buys,
    closedAt: raw?.closedAt ?? null,
    trades: Array.isArray(raw?.trades) ? raw.trades : [],
  } as FollowSnapshot;
}

export function loadFollows(): Record<string, FollowSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, FollowSnapshot> = {};
    for (const key of Object.keys(parsed)) out[key] = normalizeFollow(parsed[key]);
    return out;
  } catch {
    return {};
  }
}

export function saveFollows(f: Record<string, FollowSnapshot>) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(FOLLOW_KEY, JSON.stringify(f));
  } catch {}
}

export function followKey(chain: string, ca: string) {
  return `${chain}:${ca.toLowerCase()}`;
}

export function followPosition(f: FollowSnapshot) {
  const buys = f.buys.filter((b) => b.price > 0);
  const invested = buys.length * FOLLOW_BUY_USD;
  const tokens = buys.reduce((s, b) => s + FOLLOW_BUY_USD / b.price, 0);
  return { invested, tokens, avgPrice: tokens > 0 ? invested / tokens : null };
}

export function lastBuyPrice(f: FollowSnapshot): number | null {
  const last = f.buys[f.buys.length - 1];
  return last ? last.price : f.priceUsd;
}

export function followRoi(f: FollowSnapshot, nowPrice: number | null) {
  let invested = 0;
  let current = 0;
  let realized = 0;

  for (const t of f.trades) {
    invested += t.invested;
    current += t.proceeds;
    realized += t.proceeds - t.invested;
  }

  if (!f.closedAt && f.buys.length > 0 && nowPrice != null && nowPrice > 0) {
    const pos = followPosition(f);
    invested += pos.invested;
    current += pos.tokens * nowPrice;
  }

  return { invested, current, realized };
}

export function openFollow(item: PotentialApiItem, prev?: FollowSnapshot | null): FollowSnapshot {
  const e0 = item.entries[0];
  const now = Date.now();
  const price = item.priceUsd;
  return {
    ca: item.ca,
    chain: item.chain,
    followedAt: now,
    priceUsd: price,
    marketCap: item.marketCap,
    wai: e0?.top10 ?? null,
    bull: e0?.incBull ?? null,
    bear: e0?.decBear ?? null,
    netBull: e0?.incBull != null && e0?.decBear != null ? e0.incBull - e0.decBear : null,
    buys: price != null && price > 0 ? [{ price, at: now }] : [],
    closedAt: null,
    trades: prev?.trades ?? [],
  };
}

export function dcaFollow(f: FollowSnapshot, price: number): FollowSnapshot {
  return { ...f, buys: [...f.buys, { price, at: Date.now() }] };
}

export function closeFollow(f: FollowSnapshot, sellPrice: number | null): FollowSnapshot {
  const now = Date.now();
  const pos = followPosition(f);
  const trades =
    pos.invested > 0 && sellPrice != null && sellPrice > 0
      ? [...f.trades, { invested: pos.invested, proceeds: pos.tokens * sellPrice, sellPrice, closedAt: now }]
      : f.trades;
  return { ...f, buys: [], closedAt: now, trades };
}

export interface PotentialRow {
  item: PotentialApiItem;
  passes: boolean;
  isNew: boolean;
  isFollowed: boolean;
  isClosed?: boolean;
  follow?: FollowSnapshot;
}