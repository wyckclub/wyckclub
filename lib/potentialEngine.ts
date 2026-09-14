import { isWhaleStarredAt, isSpringPointAt, getChartScoreTextColorClass } from '@/lib/format';
import type { PotentialApiItem, PotentialEntryRaw } from '@/app/api/potential/route';
import type { PotentialFilters } from '@/lib/potentialFilters';

/**
 * Checks a single entry (plus the ones behind it, for whale/trend lookback) against
 * every "per-entry" criterion: Min WYCKSCORE, Has Whale, Strong Buying, Price trend,
 * W.A.I trend, and Min Bull / Max Bear / Min Net Bull. All of these live on the raw
 * score entries, so they can be evaluated at any point in the token's history.
 *
 * Market Cap / Liquidity / Volume are NOT part of this — they only exist as a single
 * live snapshot from Dexscreener (no per-entry history), so they're always checked
 * separately against the token's current data regardless of the chosen window.
 */
function entryPassesCoreChecks(entries: PotentialEntryRaw[], idx: number, f: PotentialFilters): boolean {
  const e0 = entries[idx];
  if (!e0) return false;
  const e1 = entries[idx + 1];

  if (f.minScore.trim() !== '') {
    const min = Number(f.minScore);
    if (!isNaN(min) && e0.score < min) return false;
  }

  if (f.hasWhale) {
    const mapped = entries.slice(idx).map((e) => ({ score: e.score, topwhale: e.topwhale }));
    if (!isWhaleStarredAt(mapped, 0)) return false;
  }

  if (f.strongBuying && !e0.display?.endsWith('+')) return false;

  if (f.priceTrend !== 'any') {
    if (!e1 || e0.price == null || e1.price == null) return false;
    if (f.priceTrend === 'down' && !(e0.price < e1.price)) return false;
    if (f.priceTrend === 'up' && !(e0.price > e1.price)) return false;
  }

  if (f.waiTrend !== 'any') {
    if (!e1 || e0.top10 == null || e1.top10 == null) return false;
    if (f.waiTrend === 'notdown' && e0.top10 < e1.top10) return false;
    if (f.waiTrend === 'down' && !(e0.top10 < e1.top10)) return false;
  }

  const hasBullBearFilter = f.minBull.trim() !== '' || f.maxBear.trim() !== '' || f.minNetBull.trim() !== '';
  if (hasBullBearFilter) {
    const minBull = f.minBull.trim() === '' ? null : Number(f.minBull);
    const maxBear = f.maxBear.trim() === '' ? null : Number(f.maxBear);
    const minNet = f.minNetBull.trim() === '' ? null : Number(f.minNetBull);

    const bull = e0.incBull;
    const bear = e0.decBear;
    const net = bull != null && bear != null ? bull - bear : null;
    if (minBull != null && (bull == null || bull < minBull)) return false;
    if (maxBear != null && (bear == null || bear > maxBear)) return false;
    if (minNet != null && (net == null || net < minNet)) return false;
  }

  return true;
}

/** Evaluates a token against the user-defined custom filters. */
export function passesFilter(item: PotentialApiItem, f: PotentialFilters): boolean {
  if (item.chain !== f.network) return false;
  const platformList = f.network === 'base' ? f.basePlatforms : f.robinhoodPlatforms;
  if (platformList.length && !platformList.includes(item.platform)) return false;

  if (!item.entries[0]) return false;

  // "Check over" window: passes if ANY single entry within the last N entries
  // satisfies every per-entry criterion together (score, whale, strong buying,
  // price trend, W.A.I trend, bull/bear/net).
  let anyEntryMatches = false;
  for (let idx = 0; idx < f.entryWindow && idx < item.entries.length; idx++) {
    if (entryPassesCoreChecks(item.entries, idx, f)) {
      anyEntryMatches = true;
      break;
    }
  }
  if (!anyEntryMatches) return false;

  // Live snapshot data only — always checked against the current state, independent of "Check over".
  if (f.minMarketCap.trim() !== '') {
    const v = Number(f.minMarketCap);
    if (!isNaN(v) && (item.marketCap == null || item.marketCap < v)) return false;
  }
  if (f.maxMarketCap.trim() !== '') {
    const v = Number(f.maxMarketCap);
    if (!isNaN(v) && (item.marketCap == null || item.marketCap > v)) return false;
  }
  if (f.minLiq.trim() !== '') {
    const v = Number(f.minLiq);
    if (!isNaN(v) && item.liq < v) return false;
  }
  if (f.minVol1h.trim() !== '') {
    const v = Number(f.minVol1h);
    if (!isNaN(v) && item.vol1h < v) return false;
  }
  if (f.minVol6h.trim() !== '') {
    const v = Number(f.minVol6h);
    if (!isNaN(v) && item.vol6h < v) return false;
  }
  if (f.minVol24h.trim() !== '') {
    const v = Number(f.minVol24h);
    if (!isNaN(v) && item.vol24h < v) return false;
  }

  return true;
}

/**
 * Default "Potential" logic, mirroring the tier1/tier2 rules used by the
 * token sidebar's Potential tab (see app/api/whale-hub/potential/route.ts).
 */
export function passesDefaultPotential(item: PotentialApiItem): boolean {
  const mapped = item.entries.map((e) => ({
    score: e.score,
    topwhale: e.topwhale,
    price: e.price,
    top10: e.top10,
  }));
  const e0 = mapped[0];
  const e1 = mapped[1];
  if (!e0 || !e1) return false;

  const whaleE0 = isWhaleStarredAt(mapped, 0);
  const springE0 = isSpringPointAt(mapped, 0);
  const springE1 = isSpringPointAt(mapped, 1);
  const yellowE0 = getChartScoreTextColorClass(e0.score, mapped) === 'text-yellow-400';
  const priceDown = e0.price != null && e1.price != null && e0.price < e1.price;
  const top10Up = e0.top10 != null && e1.top10 != null && e0.top10 > e1.top10;
  const plusE0 = (item.entries[0]?.display || '').endsWith('+');

  const tier1 = (priceDown && yellowE0 && top10Up) || (priceDown && springE0 && top10Up) || (springE1 && whaleE0);
  const tier2 = !tier1 && whaleE0 && plusE0;

  return tier1 || tier2;
}