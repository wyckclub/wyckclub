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
}

interface RawEntry {
  entry: number;
  price: number;
  score: number;
  hasBuyNow: boolean;
  display: string;
}

interface RawToken {
  symbol: string;
  entries: RawEntry[];
}

type RawCategoryData = Record<string, RawToken>;

const CATEGORY_URLS: Record<number, string> = {
  1: 'https://wyck.live/k/claw/exported_scores.json',
  2: 'https://wyck.live/k/b1/exported_scores.json',
  3: 'https://wyck.live/k/v1/exported_scores.json',
};

const rawCache = new Map<number, RawCategoryData>();

async function fetchCategoryRaw(cat: number): Promise<RawCategoryData> {
  const res = await fetch(`/api/scores/${cat}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Lỗi tải category ${cat}`);
  const data: RawCategoryData = await res.json();
  rawCache.set(cat, data);
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
  };
}

export async function fetchAllCategories(): Promise<TokenEntry[]> {
  const results = await Promise.all(
    [1, 2, 3].map(async (cat) => {
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
}

export async function fetchTokenHistory(category: number, ca: string): Promise<PriceHistoryEntry[]> {
  let raw = rawCache.get(category);
  if (!raw) raw = await fetchCategoryRaw(category);
  const token = raw[ca];
  if (!token) return [];
  return [...token.entries].reverse().map((e) => ({
    date: `#${e.entry}`,
    price: e.price,
    score: e.score,
    scoreDisplay: e.display,
  }));
}