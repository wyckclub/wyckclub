export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { uploadMedia, postTweetWithMedia } from '@/lib/xApi';
import { renderChartPng, ChartEntry } from '@/lib/chartImage';
import { formatCap, formatPriceShort } from '@/lib/format';
import { platformShareLines } from '@/lib/platforms';
import {
  ROBINHOOD_CATEGORY,
  MIN_LIQ,
  MIN_MARKETCAP,
  MIN_PCT,
  HISTORY_DEPTH,
  RawEntry,
  RawToken,
  findSignalEntryIndex,
  fetchDexInfo,
  buildHeadline,
} from '@/lib/signalDetection';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

interface Candidate {
  ca: string;
  cat: number;
  symbol: string;
  platform: string | null;
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

async function runForChain(chain: 'base' | 'robinhood', origin: string) {
  const HISTORY_KEY = `wyck:autopost:history:${chain}`;
  const categories = await fetchCategories(chain, origin);

  const history = (await redis.lrange<string>(HISTORY_KEY, 0, HISTORY_DEPTH - 1)) || [];
  const excludedCas = new Set(history.map((ca) => String(ca).toLowerCase()));

  const candidates: Candidate[] = [];
  for (const { cat, data } of categories) {
    for (const [ca, token] of Object.entries(data)) {
      if (excludedCas.has(ca.toLowerCase())) continue;
      const entries = token.entries || [];
      if (entries.length < 4) continue;

      const idx = findSignalEntryIndex(entries);
      if (idx == null) continue;

      const signalPrice = entries[idx].price;
      if (signalPrice == null || signalPrice <= 0) continue;

      candidates.push({ ca, cat, symbol: token.symbol, platform: token.platform ?? null, entries, signalPrice });
    }
  }

  if (!candidates.length) return { chain, posted: false, reason: 'no matching token' };

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
    platform: picked.platform,
    marketCap: picked.dex.marketCap,
    liq: picked.dex.liq,
  });

  const uploaded = await uploadMedia(png);
  if (!uploaded.ok || !uploaded.mediaId) return { chain, posted: false, reason: uploaded.error };

  const oldMarketCap = picked.dex.marketCap! * (picked.signalPrice / picked.dex.priceUsd!);
  const pctRounded = Math.round(picked.pct);
  const displayName = picked.dex.name ? `${picked.symbol} (${picked.dex.name})` : picked.symbol;
  const shareLines = platformShareLines(picked.platform);

  const headline = buildHeadline(displayName, pctRounded, chain);

  let text = `${headline}

MarketCap: ${formatCap(oldMarketCap)} → ${formatCap(picked.dex.marketCap)} | Price: ${formatPriceShort(picked.dex.priceUsd)}`;
  for (const line of shareLines) text += `\n${line}`;

  const result = await postTweetWithMedia(text, [uploaded.mediaId]);
  if (!result.ok) return { chain, posted: false, reason: result.error };

  await redis.lpush(HISTORY_KEY, picked.ca.toLowerCase());
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
  const locked = await redis.set(LOCK_KEY, '1', { nx: true, ex: 300 });
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