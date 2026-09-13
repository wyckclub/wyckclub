import type { PotentialApiItem } from '@/app/api/potential/route';

export interface PotentialFilters {
  network: 'base' | 'robinhood';
  basePlatforms: string[];
  robinhoodPlatforms: string[];
  minScore: string;
  hasWhale: boolean;
  strongBuying: boolean;
  priceTrend: 'any' | 'down' | 'up';
  waiTrend: 'any' | 'notdown' | 'down';
  minBull: string;
  maxBear: string;
  minNetBull: string;
  entryWindow: 1 | 2 | 3;
  minMarketCap: string;
  maxMarketCap: string;
  minLiq: string;
  minVol1h: string;
  minVol6h: string;
  minVol24h: string;
}

export const DEFAULT_FILTERS: PotentialFilters = {
  network: 'base',
  basePlatforms: [],
  robinhoodPlatforms: [],
  minScore: '5',
  hasWhale: false,
  strongBuying: false,
  priceTrend: 'any',
  waiTrend: 'any',
  minBull: '5',
  maxBear: '1',
  minNetBull: '5',
  entryWindow: 1,
  minMarketCap: '50000',
  maxMarketCap: '',
  minLiq: '20000',
  minVol1h: '',
  minVol6h: '',
  minVol24h: '',
};

const STORAGE_KEY = 'wyck_potential_filters_v1';
const FOLLOW_KEY = 'wyck_potential_follow_v1';

export function loadFilters(): PotentialFilters {
  if (typeof window === 'undefined') return DEFAULT_FILTERS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FILTERS;
    return { ...DEFAULT_FILTERS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_FILTERS;
  }
}

export function saveFilters(f: PotentialFilters) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(f));
  } catch {}
}

export function hasSavedFilters(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(STORAGE_KEY) != null;
}

export function clearFilters() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export interface FollowSnapshot {
  ca: string;
  chain: 'base' | 'robinhood';
  followedAt: number;
  priceUsd: number | null;
  marketCap: number | null;
  wai: number | null;
  bull: number | null;
  bear: number | null;
  netBull: number | null;
}

export function loadFollows(): Record<string, FollowSnapshot> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(FOLLOW_KEY);
    return raw ? JSON.parse(raw) : {};
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

export interface PotentialRow {
  item: PotentialApiItem;
  passes: boolean;
  isNew: boolean;
  isFollowed: boolean;
  follow?: FollowSnapshot;
}