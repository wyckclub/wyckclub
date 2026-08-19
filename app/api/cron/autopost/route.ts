export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { uploadMedia, postTweetWithMedia } from '@/lib/xApi';
import { renderChartPng, ChartEntry } from '@/lib/chartImage';
import {
  isWhaleStarredAt,
  isSpringPointAt,
  getChartScoreTextColorClass,
  formatCap,
  formatPriceShort,
} from '@/lib/format';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

const HISTORY_DEPTH = 20;
const ROBINHOOD_CATEGORY = 5;
const MIN_LIQ = 20000;
const MIN_MARKETCAP = 80000;
const MIN_PCT = 50;

interface RawEntry {
  entry: number;
  price: number;
  score: number;
  display: string;
  topwhale?: string;
  top10?: number;
  timestamp?: string;
}
interface RawToken {
  symbol: string;
  entries: RawEntry[];
  verified?: boolean;
}

interface Candidate {
  ca: string;
  cat: number;
  symbol: string;
  verified: boolean | null;
  entries: RawEntry[];
  signalPrice: number;
}

async function fetchCategories(chain: 'base' | 'robinhood', origin: string) {
  if (chain === 'robinhood') {
    const res = await fetch(`${origin}/api/scores/robinhood`, { cache: 'no-store' });
    if (!res.ok) return [{ cat: ROBINHOOD_CATEGORY, data: {} as Record<string, RawToken> }];
    return [{ cat: ROBINHOOD_CATEGORY, data: (await res.json()) as Record<string, RawToken> }];
  }
  return Promise.all(
    [1, 2, 3, 4].map(async (cat) => {
      const res = await fetch(`${origin}/api/scores/${cat}`, { cache: 'no-store' });
      if (!res.ok) return { cat, data: {} as Record<string, RawToken> };
      return { cat, data: (await res.json()) as Record<string, RawToken> };
    })
  );
}

async function fetchTokenImageDataUri(imageUrl: string | null): Promise<string | null> {
  if (!imageUrl) return null;
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get('content-type') || 'image/png';
    return `data:${contentType};base64,${buf.toString('base64')}`;
  } catch {
    return null;
  }
}

async function fetchDexInfo(ca: string, chainId: string) {
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

// Tìm entry gần nhất (index nhỏ nhất, tức mới nhất) thoả cả 5 điều kiện:
// score>4, vàng, có whale (🐋), giá đang giảm so với entry trước, top10 tăng, có spring border.
const SIGNAL_SEARCH_DEPTH = 10;

// Chỉ tìm trong phạm vi 10 entry gần nhất, không thấy thì loại token
function findSignalEntryIndex(entries: RawEntry[]): number | null {
  const maxI = Math.min(SIGNAL_SEARCH_DEPTH - 1, entries.length - 4);
  for (let i = 0; i <= maxI; i++) {
    const cur = entries[i];
    const prev = entries[i + 1];
    if (!cur || !prev) continue;
    if (cur.score == null || cur.score <= 4) continue;

    const last7Slice = entries.slice(i, i + 4).map((e) => ({ score: e.score }));
    if (getChartScoreTextColorClass(cur.score, last7Slice) !== 'text-yellow-400') continue;

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

const HEADLINE_TEMPLATES: ((symbol: string, pct: number, chain: string) => string)[] = [
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

function buildHeadline(symbol: string, pct: number, chain: string): string {
  const fn = HEADLINE_TEMPLATES[Math.floor(Math.random() * HEADLINE_TEMPLATES.length)];
  return fn(symbol, pct, chain);
}

async function runForChain(chain: 'base' | 'robinhood', origin: string) {
  const HISTORY_KEY = `wyck:autopost:history:${chain}`;
  const categories = await fetchCategories(chain, origin);

  const history = (await redis.lrange<string>(HISTORY_KEY, 0, HISTORY_DEPTH - 1)) || [];
  const excludedCas = new Set(
    history.flatMap((h) => {
      try { return JSON.parse(h) as string[]; } catch { return []; }
    })
  );

  const candidates: Candidate[] = [];
  for (const { cat, data } of categories) {
    for (const [ca, token] of Object.entries(data)) {
      if (excludedCas.has(ca)) continue;
      const entries = token.entries || [];
      if (entries.length < 4) continue;

      const idx = findSignalEntryIndex(entries);
      if (idx == null) continue;

      const signalPrice = entries[idx].price;
      if (signalPrice == null || signalPrice <= 0) continue;

      candidates.push({ ca, cat, symbol: token.symbol, verified: token.verified ?? null, entries, signalPrice });
    }
  }

  if (!candidates.length) return { chain, posted: false, reason: 'no matching token' };

  // Fetch dữ liệu dex thật cho từng candidate, tính % tăng từ giá thật hiện tại so với giá tại entry tín hiệu
  const scored: (Candidate & { dex: NonNullable<Awaited<ReturnType<typeof fetchDexInfo>>>; pct: number })[] = [];
  for (const c of candidates) {
    const dex = await fetchDexInfo(c.ca, chain);
    if (!dex || dex.priceUsd == null) continue;
    if (dex.liq < MIN_LIQ) continue;
    if (dex.marketCap == null || dex.marketCap < MIN_MARKETCAP) continue;

    const pct = ((dex.priceUsd - c.signalPrice) / c.signalPrice) * 100;
    if (pct <= MIN_PCT) continue;

    scored.push({ ...c, dex, pct });
  }

  if (!scored.length) return { chain, posted: false, reason: 'no candidate passed pct/marketcap check' };

  const picked = scored[Math.floor(Math.random() * scored.length)];

  const chartEntries: ChartEntry[] = [...picked.entries]
    .reverse()
    .map((e) => ({
      date: `#${e.entry}`, price: e.price, score: e.score, scoreDisplay: e.display,
      topwhale: e.topwhale, top10: e.top10 ?? null, timestamp: e.timestamp,
    }))
    .filter((e) => e.price != null && !isNaN(e.price) && e.price > 0);

  if (chartEntries.length < 2) return { chain, posted: false, reason: 'not enough chart data' };

  const tokenImageDataUri = await fetchTokenImageDataUri(picked.dex.imageUrl);

  const png = renderChartPng(chartEntries, {
    chain,
    tokenImageDataUri,
    name: picked.dex.name,
    symbol: picked.symbol,
    verified: chain === 'robinhood' ? picked.verified : null,
    marketCap: picked.dex.marketCap,
    liq: picked.dex.liq,
  });

  const uploaded = await uploadMedia(png);
  if (!uploaded.ok || !uploaded.mediaId) return { chain, posted: false, reason: uploaded.error };

  const oldMarketCap = picked.dex.marketCap! * (picked.signalPrice / picked.dex.priceUsd!);
  const pctRounded = Math.round(picked.pct);
  const verifyLine =
    chain === 'robinhood' && picked.verified != null
      ? (picked.verified ? '✅ Verified' : '❌ Not Verified')
      : null;

  const headline = buildHeadline(picked.symbol, pctRounded, chain);

  let text = `${headline}

MarketCap: ${formatCap(oldMarketCap)} → ${formatCap(picked.dex.marketCap)} | Price: ${formatPriceShort(picked.dex.priceUsd)}`;
  if (verifyLine) text += `\n${verifyLine}`;

  const result = await postTweetWithMedia(text, [uploaded.mediaId]);
  if (!result.ok) return { chain, posted: false, reason: result.error };

  await redis.lpush(HISTORY_KEY, JSON.stringify([picked.ca]));
  await redis.ltrim(HISTORY_KEY, 0, HISTORY_DEPTH - 1);

  return { chain, posted: true, tweetId: result.id, token: picked.symbol, ca: picked.ca, pct: pctRounded };
}

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const LOCK_KEY = 'wyck:autopost:lock';
  const locked = await redis.set(LOCK_KEY, '1', { nx: true, ex: 120 });
  if (!locked) {
    return NextResponse.json({ posted: false, reason: 'already running' });
  }

  try {
    const origin = req.nextUrl.origin;
    const NEXT_CHAIN_KEY = 'wyck:autopost:next_chain';
    const lastChain = await redis.get<string>(NEXT_CHAIN_KEY);
    const chain: 'base' | 'robinhood' = lastChain === 'base' ? 'robinhood' : 'base';

    const result = await runForChain(chain, origin);
    await redis.set(NEXT_CHAIN_KEY, chain);

    return NextResponse.json(result);
  } finally {
    await redis.del(LOCK_KEY);
  }
}