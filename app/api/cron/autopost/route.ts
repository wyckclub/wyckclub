export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import crypto from 'crypto';
import { uploadMedia, postTweetWithMedia } from '@/lib/xApi';
import { renderChartPng, ChartEntry } from '@/lib/chartImage';
import { renderTopPng } from '@/lib/topImage';
import { getPotentialTier } from '@/lib/potentialEngine';
import { fetchDexscreenerBatchMap } from '@/lib/dexscreenerServer';
import { formatCap, formatPriceShort, stripDots } from '@/lib/format';
import { platformShareLines, PLATFORM_LABELS } from '@/lib/platforms';
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
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

type Chain = 'base' | 'robinhood' | 'arc';
const CHAINS: Chain[] = ['base', 'robinhood', 'arc'];
const ARC_CATEGORY = 6;

const LAST_POST_KEY = 'wyck:autopost:last_post_at';
const COUNT_KEY = 'wyck:autopost:token_count';
const TOP_CHAIN_KEY = 'wyck:autopost:next_top_chain';
const TOP_EVERY = 4;
const TOP_MIN_ITEMS = 3;
const MIN_POST_INTERVAL_SECONDS = Number(process.env.AUTOPOST_MIN_INTERVAL_SECONDS) || 900;

function isVerifiedPlatform(platform: string | null | undefined): boolean {
  return !!platform && !platform.endsWith('_unverified');
}

interface Candidate {
  ca: string;
  cat: number;
  symbol: string;
  platform: string | null;
  entries: RawEntry[];
  signalPrice: number;
}

async function fetchCategories(chain: Chain, origin: string) {
  if (chain === 'robinhood' || chain === 'arc') {
    const cat = chain === 'robinhood' ? ROBINHOOD_CATEGORY : ARC_CATEGORY;
    const res = await fetch(`${origin}/api/scores/${chain}`, { cache: 'no-store' });
    if (!res.ok) return [{ cat, data: {} as Record<string, RawToken> }];
    return [{ cat, data: (await res.json()) as Record<string, RawToken> }];
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

async function findBestForChain(chain: Chain, origin: string) {
  const HISTORY_KEY = `wyck:autopost:history:${chain}`;
  const categories = await fetchCategories(chain, origin);

  const history = (await redis.lrange<string>(HISTORY_KEY, 0, HISTORY_DEPTH - 1)) || [];
  const excludedCas = new Set(history.map((ca) => String(ca).toLowerCase()));

  const candidates: Candidate[] = [];
  for (const { cat, data } of categories) {
    for (const [ca, token] of Object.entries(data)) {
      if (excludedCas.has(ca.toLowerCase())) continue;
      if (!isVerifiedPlatform(token.platform)) continue;

      const entries = token.entries || [];
      if (entries.length < 4) continue;

      const idx = findSignalEntryIndex(entries);
      if (idx == null) continue;

      const signalPrice = entries[idx].price;
      if (signalPrice == null || signalPrice <= 0) continue;

      candidates.push({ ca, cat, symbol: token.symbol, platform: token.platform ?? null, entries, signalPrice });
    }
  }
  if (!candidates.length) return null;

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
  if (!scored.length) return null;

  const picked = scored.reduce((best, c) => (c.pct > best.pct ? c : best));
  return { ...picked, chain };
}

async function postPicked(picked: NonNullable<Awaited<ReturnType<typeof findBestForChain>>>) {
  const { chain } = picked;
  const HISTORY_KEY = `wyck:autopost:history:${chain}`;

  const chartEntries: ChartEntry[] = [...picked.entries]
    .reverse()
    .map((e) => ({
      date: `#${e.entry}`, price: e.price, score: e.score, scoreDisplay: e.display,
      topwhale: e.topwhale, top10: e.top10 ?? null, timestamp: e.timestamp,
    }))
    .filter((e) => e.price != null && !isNaN(e.price) && e.price > 0)
    .slice(-39);

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
  const displayName = picked.dex.name
    ? `${stripDots(picked.symbol)} (${stripDots(picked.dex.name)})`
    : stripDots(picked.symbol);
  const shareLines = platformShareLines(picked.platform);

  const headline = buildHeadline(displayName, pctRounded, chain);

  let text = `${headline}
  ${picked.ca}

MarketCap: ${formatCap(oldMarketCap)} → ${formatCap(picked.dex.marketCap)} | Price: ${formatPriceShort(picked.dex.priceUsd)}`;
  for (const line of shareLines) text += `\n${line}`;

  const result = await postTweetWithMedia(text, [uploaded.mediaId]);
  if (!result.ok) return { chain, posted: false, reason: result.error };

  await redis.lpush(HISTORY_KEY, picked.ca.toLowerCase());
  await redis.ltrim(HISTORY_KEY, 0, HISTORY_DEPTH - 1);
  await redis.set(LAST_POST_KEY, Date.now());

  return { chain, posted: true, tweetId: result.id, token: picked.symbol, ca: picked.ca, pct: pctRounded };
}

async function runTopPost(chain: Chain, origin: string) {
  const categories = await fetchCategories(chain, origin);
  const TOP_LAST_KEY = `wyck:autopost:top_last:${chain}`;
  const lastTop = (await redis.get<string[]>(TOP_LAST_KEY)) || [];
  const excluded = new Set(lastTop.map((c) => c.toLowerCase()));
  const found: { ca: string; symbol: string; platform: string; tier: 1 | 2; score: number }[] = [];

  for (const { data } of categories) {
    for (const [ca, token] of Object.entries(data)) {
      if (!isVerifiedPlatform(token.platform)) continue;
      const entries = (token.entries || []).slice(0, 8);
      if (entries.length < 2) continue;
      const tier = getPotentialTier({ entries } as any);
      if (!tier) continue;
      if (excluded.has(ca.toLowerCase())) continue;

      const e0 = entries[0];
      const e1 = entries[1];
      if (e0.incBull == null || e0.decBear == null || e1.incBull == null || e1.decBear == null) continue;
      if (e0.incBull - e0.decBear <= 7) continue;
      if (!(e0.incBull > e1.incBull)) continue;
      if (!(e0.decBear < 1 || e0.decBear < e1.decBear)) continue;

      found.push({ ca, symbol: token.symbol, platform: token.platform!, tier, score: entries[0].score });
    }
  }
  if (!found.length) return { chain, posted: false, reason: 'no potential token' };

  const market = await fetchDexscreenerBatchMap(found.map((f) => f.ca), chain, { revalidateSeconds: 40, maxRetries: 2 });
  const top = found
    .map((f) => ({ ...f, m: market[f.ca] }))
    .filter((f) => f.m && f.m.liq >= MIN_LIQ && f.m.marketCap != null)
    .sort((a, b) => a.tier - b.tier || b.score - a.score)
    .slice(0, 5);

  if (top.length < TOP_MIN_ITEMS) return { chain, posted: false, reason: 'not enough potential tokens' };

  const images = await Promise.all(top.map((t) => fetchTokenImageDataUri(t.m.imageUrl)));
  const png = renderTopPng(chain, top.map((t, i) => ({
    imageDataUri: images[i], name: t.m.name, symbol: t.symbol,
    platform: t.platform, marketCap: t.m.marketCap, liq: t.m.liq,
  })));

  const uploaded = await uploadMedia(png);
  if (!uploaded.ok || !uploaded.mediaId) return { chain, posted: false, reason: uploaded.error };

  const label = chain === 'base' ? 'Base' : chain === 'robinhood' ? 'Robinhood' : 'Arc';
  let text = `Top ${top.length} Tokens with accumulation potential on #${label}:\n`;
  for (const t of top) {
    const tag = (PLATFORM_LABELS[t.platform] ?? t.platform).replace(/[^a-zA-Z0-9]/g, '');
    text += `\n#${stripDots(t.symbol)} ${t.ca}\nDeploy: #${tag} MarketCap: ${formatCap(t.m.marketCap)}\n`;
  }

  const result = await postTweetWithMedia(text.trim(), [uploaded.mediaId]);
  if (!result.ok) return { chain, posted: false, reason: result.error };
  await redis.set(LAST_POST_KEY, Date.now());
  await redis.set(TOP_LAST_KEY, top.map((t) => t.ca.toLowerCase()));
  return { chain, posted: true, type: 'top5', tweetId: result.id };
}

export async function GET(req: NextRequest) {
  if (process.env.CRON_SECRET) {
    const auth = req.headers.get('authorization');
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const LOCK_KEY = 'wyck:autopost:lock';
  const lockId = crypto.randomUUID();
  const locked = await redis.set(LOCK_KEY, lockId, { nx: true, ex: 300 });
  if (!locked) {
    return NextResponse.json({ posted: false, reason: 'already running' });
  }

  try {

    const forceTop = req.nextUrl.searchParams.get('top') as Chain | null;
    if (forceTop && CHAINS.includes(forceTop)) {
      return NextResponse.json(await runTopPost(forceTop, req.nextUrl.origin));
    }

    const lastPostAt = await redis.get<number>(LAST_POST_KEY);
    if (lastPostAt && Date.now() - lastPostAt < MIN_POST_INTERVAL_SECONDS * 1000) {
      return NextResponse.json({ posted: false, reason: 'too soon since last post' });
    }

    const origin = req.nextUrl.origin;

    const count = Number(await redis.get<number>(COUNT_KEY)) || 0;
    if (count >= TOP_EVERY) {
      const lastTop = await redis.get<string>(TOP_CHAIN_KEY);
      const topChain = CHAINS[(CHAINS.indexOf(lastTop as Chain) + 1) % CHAINS.length];
      const r = await runTopPost(topChain, origin);
      await redis.set(TOP_CHAIN_KEY, topChain);
      if (r.posted) {
        await redis.set(COUNT_KEY, 0);
        return NextResponse.json(r);
      }
    }

    let best: Awaited<ReturnType<typeof findBestForChain>> = null;
    for (const c of CHAINS) {
      const b = await findBestForChain(c, origin);
      if (b && (!best || b.pct > best.pct)) best = b;
    }
    if (!best) return NextResponse.json({ posted: false, reason: 'no matching token on any chain' });

    const result = await postPicked(best);
    if (result.posted) await redis.incr(COUNT_KEY);
    return NextResponse.json(result);
  } finally {
    const current = await redis.get<string>(LOCK_KEY);
    if (current === lockId) await redis.del(LOCK_KEY);
  }
}