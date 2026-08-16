export interface HistoryEntry {
  date: string;
  price: number | null;
  score: number;
  scoreDisplay: string;
}

export interface TokenEntry {
  symbol: string;
  CA: string;
  category: number;
  latestMarketCap: number | null;
  latestPrice: number | null;
  latestDate: string;
  latestScore: number;
  latestScoreDisplay: string;
  last7: HistoryEntry[];
  verified: boolean;
}

interface RawEntry {
  entry: number;
  price: number;
  score: number;
  hasBuyNow: boolean;
  display: string;
  topwhale?: string;
  top10?: number;
  timestamp?: string;
  verified?: boolean;
}

interface RawToken {
  symbol: string;
  entries: RawEntry[];
  verified?: boolean;
}

type RawCategoryData = Record<string, RawToken>;

const rawCache = new Map<number, { data: RawCategoryData; timestamp: number }>();
const RAW_TTL = 30 * 1000;

async function fetchCategoryRaw(cat: number): Promise<RawCategoryData> {
  const cached = rawCache.get(cat);
  if (cached && Date.now() - cached.timestamp < RAW_TTL) return cached.data;

  const res = await fetch(`/api/scores/${cat}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`ERROR category ${cat}`);
  const data: RawCategoryData = await res.json();
  rawCache.set(cat, { data, timestamp: Date.now() });
  return data;
}

function toTokenEntry(ca: string, raw: RawToken, category: number): TokenEntry {
  const entries = raw.entries || [];
  const latest = entries[0];
  const last7 = entries
    .slice(0, 7)
    .map((e) => ({
      date: `#${e.entry}`,
      price: e.price,
      score: e.score,
      scoreDisplay: e.display,
      topwhale: e.topwhale,
    }));

  return {
    symbol: raw.symbol,
    CA: ca,
    category,
    latestMarketCap: null,
    latestPrice: latest?.price ?? null,
    latestDate: latest ? `#${latest.entry}` : '',
    latestScore: latest?.score ?? 0,
    latestScoreDisplay: latest?.display ?? '0',
    last7,
    verified: raw.verified ?? false,
  };
}

export const CATEGORY_LABELS: Record<number, string> = {
  1: 'Clanker & Bankr',
  2: 'Other Base',
  3: 'Virtuals',
  4: 'New Token',
};

export async function fetchAllCategories(): Promise<TokenEntry[]> {
  const results = await Promise.all(
    [1, 2, 3, 4].map(async (cat) => {
      const raw = await fetchCategoryRaw(cat);
      return Object.entries(raw).map(([ca, token]) => toTokenEntry(ca, token, cat));
    })
  );
  return results.flat().sort((a, b) => b.latestScore - a.latestScore);
}

export interface PriceHistoryEntry {
  date: string;
  price: number | null;
  score: number | null;
  scoreDisplay: string | null;
  topwhale?: string;
  top10?: number;
  timestamp?: string;
}

export async function fetchTokenHistory(category: number, ca: string): Promise<PriceHistoryEntry[]> {
  const raw = category === ROBINHOOD_CATEGORY ? await fetchRobinhoodRaw() : (
    (rawCache.get(category) && Date.now() - rawCache.get(category)!.timestamp < RAW_TTL)
      ? rawCache.get(category)!.data
      : await fetchCategoryRaw(category)
  );
  const token = raw[ca];
  if (!token) return [];
  return [...token.entries].reverse().map((e) => ({
    date: `#${e.entry}`,
    price: e.price,
    score: e.score,
    scoreDisplay: e.display,
    topwhale: e.topwhale,
    top10: e.top10,
    timestamp: e.timestamp,
  }));
}

export interface HistoryEntry {
  date: string;
  price: number | null;
  score: number;
  scoreDisplay: string;
  topwhale?: string;
}

export const ROBINHOOD_CATEGORY = 5;
CATEGORY_LABELS[ROBINHOOD_CATEGORY] = 'Robinhood';

let robinRawCache: { data: RawCategoryData; timestamp: number } | null = null;

async function fetchRobinhoodRaw(): Promise<RawCategoryData> {
  if (robinRawCache && Date.now() - robinRawCache.timestamp < RAW_TTL) return robinRawCache.data;
  const res = await fetch('/api/scores/robinhood', { cache: 'no-store' });
  if (!res.ok) throw new Error('ERROR robinhood');
  const data: RawCategoryData = await res.json();
  robinRawCache = { data, timestamp: Date.now() };
  return data;
}

export async function fetchRobinhoodTokens(): Promise<TokenEntry[]> {
  const raw = await fetchRobinhoodRaw();
  return Object.entries(raw)
    .map(([ca, token]) => toTokenEntry(ca, token, ROBINHOOD_CATEGORY))
    .sort((a, b) => b.latestScore - a.latestScore);
}

let robinNewRawCache: { data: RawCategoryData; timestamp: number } | null = null;

async function fetchRobinhoodNewRaw(): Promise<RawCategoryData> {
  if (robinNewRawCache && Date.now() - robinNewRawCache.timestamp < RAW_TTL) return robinNewRawCache.data;
  const res = await fetch('/api/scores/robinhood-new', { cache: 'no-store' });
  if (!res.ok) throw new Error('ERROR robinhood-new');
  const data: RawCategoryData = await res.json();
  robinNewRawCache = { data, timestamp: Date.now() };
  return data;
}

export async function fetchRobinhoodNewTokens(): Promise<TokenEntry[]> {
  const raw = await fetchRobinhoodNewRaw();
  return Object.entries(raw)
    .map(([ca, token]) => toTokenEntry(ca, token, ROBINHOOD_CATEGORY))
    .sort((a, b) => b.latestScore - a.latestScore);
}