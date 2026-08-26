import { isWhaleStarredAt, isSpringPointAt, getChartScoreTextColorClass } from '@/lib/format';

export const ROBINHOOD_CATEGORY = 5;
export const MIN_LIQ = 20000;
export const MIN_MARKETCAP = 80000;
export const MIN_PCT = 50;
export const HISTORY_DEPTH = 30;
const SIGNAL_SEARCH_DEPTH = 10;

export interface RawEntry {
  entry: number;
  price: number;
  score: number;
  display: string;
  topwhale?: string;
  top10?: number;
  timestamp?: string;
}

export interface RawToken {
  symbol: string;
  entries: RawEntry[];
  verified?: boolean;
  platform?: string;
}

// Tìm entry gần nhất (index nhỏ nhất, tức mới nhất) thoả cả 5 điều kiện:
// score>4, vàng (đúng như màu hiển thị trên UI chart), có whale (🐋),
// giá đang giảm so với entry trước, top10 tăng, có spring border.
// Chỉ tìm trong phạm vi 10 entry gần nhất, không thấy thì loại token
export function findSignalEntryIndex(entries: RawEntry[]): number | null {
  const maxI = Math.min(SIGNAL_SEARCH_DEPTH - 1, entries.length - 4);
  for (let i = 0; i <= maxI; i++) {
    const cur = entries[i];
    const prev = entries[i + 1];
    if (!cur || !prev) continue;
    if (cur.score == null || cur.score <= 4) continue;

    const mapped = entries.map((e) => ({
      score: e.score,
      topwhale: e.topwhale,
      price: e.price,
      top10: e.top10 ?? null,
    }));
    if (!isWhaleStarredAt(mapped, i)) continue;

    if (cur.price == null || prev.price == null || !(cur.price < prev.price)) continue;
    if (cur.top10 == null || prev.top10 == null || !(cur.top10 > prev.top10)) continue;
    if (!isSpringPointAt(mapped, i)) continue;

    return i;
  }
  return null;
}

export interface DexInfo {
  priceUsd: number | null;
  marketCap: number | null;
  name: string | null;
  imageUrl: string | null;
  liq: number;
}

export async function fetchDexInfo(ca: string, chainId: string): Promise<DexInfo | null> {
  try {
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${ca}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    const pairs = json.pairs || [];
    const caPairs = pairs.filter(
      (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === chainId
    );
    const pair = caPairs[0] || pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
    if (!pair) return null;
    const liq = caPairs.reduce((s: number, p: any) => s + (Number(p.liquidity?.usd) || 0), 0);
    return {
      priceUsd: pair.priceUsd == null ? null : Number(pair.priceUsd),
      marketCap: pair.marketCap ?? pair.fdv ?? null,
      name: pair.baseToken?.name ?? null,
      imageUrl: pair.info?.imageUrl ?? null,
      liq: caPairs.length ? liq : 0,
    };
  } catch {
    return null;
  }
}

export const HEADLINE_TEMPLATES: ((symbol: string, pct: number, chain: string) => string)[] = [
  (s, p, c) => `$${s} is up ${p}% after receiving a SmartMoney signal from WYCK on #${c}.`,
  (s, p, c) => `$${s} surged ${p}% after WYCK detected SmartMoney activity on #${c}.`,
  (s, p, c) => `$${s} +${p}% after WYCK detected a SmartMoney signal on #${c}.`,
  (s, p, c) => `$${s} jumped ${p}% following a WYCKSCORE SmartMoney signal on #${c}.`,
  (s, p, c) => `$${s} is now up ${p}% after a SmartMoney signal from WYCKSCORE on #${c}.`,
  (s, p, c) => `$${s} gained ${p}% after WYCK identified SmartMoney activity on #${c}.`,
  (s, p, c) => `$${s} +${p}% 🚀 SmartMoney activity detected by WYCK on #${c}.`,
  (s, p, c) => `$${s} has surged ${p}% since the WYCK SmartMoney signal appeared on #${c}.`,
  (s, p, c) => `$${s} climbed ${p}% after WYCK detected strong SmartMoney activity on #${c}.`,
  (s, p, c) => `$${s} is up ${p}% since WYCKSCORE flagged a SmartMoney signal on #${c}.`,
  (s, p, c) => `$${s} +${p}% after WYCKSCORE detected SmartMoney accumulation on #${c}.`,
  (s, p, c) => `$${s} jumped ${p}% after WYCK signaled SmartMoney activity on #${c}.`,
  (s, p, c) => `$${s} gained ${p}% following a WYCKSCORE SmartMoney alert on #${c}.`,
  (s, p, c) => `$${s} is ${p}% higher after a SmartMoney signal from WYCKSCORE on #${c}.`,
  (s, p, c) => `$${s} surged ${p}% after SmartMoney activity was detected by WYCK on #${c}.`,
  (s, p, c) => `$${s} +${p}% 📈 WYCKSCORE detected SmartMoney before the move on #${c}.`,
  (s, p, c) => `$${s} moved ${p}% higher after WYCK detected SmartMoney accumulation on #${c}.`,
  (s, p, c) => `$${s} has gained ${p}% since WYCKSCORE detected SmartMoney buying on #${c}.`,
  (s, p, c) => `$${s} +${p}% after WYCK identified a SmartMoney opportunity on #${c}.`,
  (s, p, c) => `$${s} is up ${p}% after WYCK spotted SmartMoney activity ahead of the move on #${c}.`,
];

export function buildHeadline(symbol: string, pct: number, chain: string): string {
  const fn = HEADLINE_TEMPLATES[Math.floor(Math.random() * HEADLINE_TEMPLATES.length)];
  return fn(symbol, pct, chain);
}