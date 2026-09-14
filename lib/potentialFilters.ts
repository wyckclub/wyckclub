import type { PotentialApiItem } from '@/app/api/potential/route';

export type NetworkKey = 'base' | 'robinhood';

export interface PotentialFilters {
  network: NetworkKey;
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

const BASE_DEFAULTS: Omit<PotentialFilters, 'network'> = {
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

export function defaultFiltersFor(network: NetworkKey): PotentialFilters {
  return { ...BASE_DEFAULTS, network };
}

// Giữ lại để tương thích ngược nếu chỗ nào còn import
export const DEFAULT_FILTERS: PotentialFilters = defaultFiltersFor('base');

const DRAFT_KEY_PREFIX = 'wyck_potential_draft_v2_';
const APPLIED_KEY_PREFIX = 'wyck_potential_applied_v2_';
const FOLLOW_KEY = 'wyck_potential_follow_v1';

/** Giá trị đang nhập trong panel (chưa bấm "Filter tokens"), lưu riêng theo network. */
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

/** Bộ filter đã "Apply" — quyết định bảng hiển thị gì khi vào lại tab Base/Robinhood. */
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