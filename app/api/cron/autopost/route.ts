export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { uploadMedia, postTweetWithMedia } from '@/lib/xApi';
import { renderChartPng, ChartEntry } from '@/lib/chartImage';
import {
  isWhaleStarredAt,
  isSpringPointAt,
  getChartScoreTextColorClass,
  getWhaleStarredScore,
  formatCap,
  formatPriceShort,
} from '@/lib/format';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

const HISTORY_DEPTH = 12;
const ROBINHOOD_CATEGORY = 5;
const MIN_LIQ = 20000;

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
  current: string;
  previous: string;
  levelLabel: string;
  top10: number | null;
  prevTop10: number | null;
}

function computeLevelLabel(hasWhale: boolean, isYellow: boolean, hasPlus: boolean): string {
  if (hasWhale && isYellow && hasPlus) return 'Super Strong';
  if (hasWhale && (hasPlus || isYellow)) return 'Strong';
  return 'Medium';
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

      const last7 = entries.slice(0, 7).map((e) => ({
        score: e.score, price: e.price, topwhale: e.topwhale, top10: e.top10 ?? null,
      }));
      const e0 = entries[0];
      const e1 = entries[1];
      if (!e1) continue;

      if (e0.score <= 4) continue;
      const isYellow = getChartScoreTextColorClass(e0.score, last7) === 'text-yellow-400';
      if (!isYellow) continue;
      const hasWhale = isWhaleStarredAt(last7, 0);
      if (!hasWhale) continue;
      const priceDown = e1.price != null && e0.price != null && e1.price > e0.price;
      if (!priceDown) continue;
      const top10Up = e0.top10 != null && e1.top10 != null && e0.top10 > e1.top10;
      if (!top10Up) continue;
      const spring = isSpringPointAt(last7, 0);
      if (!spring) continue;

      const hasPlus = (e0.display || '').endsWith('+');
      const current = getWhaleStarredScore(e0.display, last7);
      const previous = e1.topwhale === 'y' ? `🐋${e1.display}` : e1.display;

      candidates.push({
        ca, cat, symbol: token.symbol, verified: token.verified ?? null, entries,
        current, previous,
        levelLabel: computeLevelLabel(hasWhale, isYellow, hasPlus),
        top10: e0.top10 ?? null, prevTop10: e1.top10 ?? null,
      });
    }
  }

  if (!candidates.length) return { chain, posted: false, reason: 'no matching token' };

  // random pick, retry with next candidate if dex data/liquidity fails
  const pool = [...candidates];
  while (pool.length) {
    const idx = Math.floor(Math.random() * pool.length);
    const picked = pool.splice(idx, 1)[0];

    const dex = await fetchDexInfo(picked.ca, chain);
    if (!dex || dex.priceUsd == null || dex.liq < MIN_LIQ) continue;

    const chartEntries: ChartEntry[] = [...picked.entries]
      .reverse()
      .map((e) => ({
        date: `#${e.entry}`, price: e.price, score: e.score, scoreDisplay: e.display,
        topwhale: e.topwhale, top10: e.top10 ?? null, timestamp: e.timestamp,
      }))
      .filter((e) => e.price != null && !isNaN(e.price) && e.price > 0);

    if (chartEntries.length < 2) continue;

    const tokenImageDataUri = await fetchTokenImageDataUri(dex.imageUrl);

    const png = renderChartPng(chartEntries, {
      chain,
      tokenImageDataUri,
      name: dex.name,
      symbol: picked.symbol,
      verified: chain === 'robinhood' ? picked.verified : null,
      marketCap: dex.marketCap,
      liq: dex.liq,
    });

    const uploaded = await uploadMedia(png);
    if (!uploaded.ok || !uploaded.mediaId) continue;

    const nameTag = dex.name ? ` (${dex.name})` : '';
    const price = formatPriceShort(dex.priceUsd);
    const cap = formatCap(dex.marketCap);
    const whaleLine =
      picked.top10 != null && picked.prevTop10 != null && picked.top10 !== picked.prevTop10
        ? `\n🐋Whale Accumulation Index: ${picked.top10 - picked.prevTop10 > 0 ? '+' : ''}${picked.top10 - picked.prevTop10} (${picked.prevTop10}→${picked.top10})`
        : '';
    const verifyLine =
      chain === 'robinhood' && picked.verified != null ? `\n${picked.verified ? '✅ Verified' : '❌ Not Verified'}` : '';

    const text = `$${picked.symbol}${nameTag} just triggered a SmartMoney signal on #${chain}:

👉WyckScore: ${picked.levelLabel} ${picked.current}${whaleLine}${verifyLine}

At Price: ${price} - MaketCap: ${cap}

Check the latest WYCK update here:
wyck.pro/${chain}/${picked.ca}`;

    const result = await postTweetWithMedia(text, [uploaded.mediaId]);
    if (!result.ok) return { chain, posted: false, reason: result.error };

    await redis.lpush(HISTORY_KEY, JSON.stringify([picked.ca]));
    await redis.ltrim(HISTORY_KEY, 0, HISTORY_DEPTH - 1);

    return { chain, posted: true, tweetId: result.id, token: picked.symbol, ca: picked.ca };
  }

  return { chain, posted: false, reason: 'no candidate passed dex/liquidity/chart check' };
}

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const origin = req.nextUrl.origin;
  const NEXT_CHAIN_KEY = 'wyck:autopost:next_chain';
  const lastChain = await redis.get<string>(NEXT_CHAIN_KEY);
  const chain: 'base' | 'robinhood' = lastChain === 'base' ? 'robinhood' : 'base';

  const result = await runForChain(chain, origin);
  await redis.set(NEXT_CHAIN_KEY, chain);

  return NextResponse.json(result);
}