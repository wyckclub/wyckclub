import { isWhaleStarredAt, isSpringPointAt, getChartScoreTextColorClass } from '@/lib/format';
import type { PotentialApiItem, PotentialEntryRaw } from '@/app/api/potential/route';
import type { PotentialFilters } from '@/lib/potentialFilters';

function entryPassesCoreChecks(entries: PotentialEntryRaw[], idx: number, f: PotentialFilters): boolean {
  const e0 = entries[idx];
  if (!e0) return false;
  const e1 = entries[idx + 1];

  if (f.minScore.trim() !== '') {
    const min = Number(f.minScore);
    if (!isNaN(min) && e0.score < min) return false;
  }

  const mapped = entries.slice(idx).map((e) => ({ score: e.score, topwhale: e.topwhale }));

  const whaleOk = isWhaleStarredAt(mapped, 0);
  const strongOk = !!e0.display?.endsWith('+');

  if (f.hasWhale && !whaleOk) return false;
  if (f.strongBuying && !strongOk) return false;
  if (f.bothRequired && !(whaleOk && strongOk)) return false;

  if (f.bullsIncrease) {
    if (!e1 || e0.incBull == null || e1.incBull == null) return false;
    if (!(e0.incBull >= e1.incBull)) return false;
  }

  if (f.bearsDecrease) {
    if (!e1 || e0.decBear == null || e1.decBear == null) return false;
    if (!(e0.decBear === 0 || e0.decBear < e1.decBear)) return false;
  }

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

export function passesFilter(item: PotentialApiItem, f: PotentialFilters): boolean {
  if (item.chain !== f.network) return false;
  const platformList =
  f.network === 'base' ? f.basePlatforms :
  f.network === 'robinhood' ? f.robinhoodPlatforms :
  f.arcPlatforms;
  if (platformList.length && !platformList.includes(item.platform)) return false;

  if (!item.entries[0]) return false;

  let anyEntryMatches = false;
  for (let idx = 0; idx < f.entryWindow && idx < item.entries.length; idx++) {
    if (entryPassesCoreChecks(item.entries, idx, f)) {
      anyEntryMatches = true;
      break;
    }
  }
  if (!anyEntryMatches) return false;

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

  if (f.maxChange24h.trim() !== '') {
    const v = Number(f.maxChange24h);
    if (!isNaN(v) && (item.change24h == null || item.change24h > v)) return false;
  }

  if (f.minAge.trim() !== '' || f.maxAge.trim() !== '') {
    if (item.pairCreatedAt == null) return false;
    const ageHours = (Date.now() - item.pairCreatedAt) / (1000 * 60 * 60);
    if (f.minAge.trim() !== '') {
      const v = Number(f.minAge);
      if (!isNaN(v) && ageHours < v) return false;
    }
    if (f.maxAge.trim() !== '') {
      const v = Number(f.maxAge);
      if (!isNaN(v) && ageHours > v) return false;
    }
  }

  return true;
}

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