import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { formatCap, formatPriceShort } from '@/lib/format';
import {
  ROBINHOOD_CATEGORY,
  MIN_LIQ,
  MIN_MARKETCAP,
  MIN_PCT,
  HISTORY_DEPTH,
  RawToken,
  findSignalEntryIndex,
  fetchDexInfo,
  buildHeadline,
} from '@/lib/signalDetection';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

async function findToken(
  chain: 'base' | 'robinhood',
  ca: string,
  origin: string
): Promise<{ cat: number; token: RawToken } | null> {
  if (chain === 'robinhood') {
    const res = await fetch(`${origin}/api/scores/robinhood`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data: Record<string, RawToken> = await res.json();
    const key = Object.keys(data).find((k) => k.toLowerCase() === ca.toLowerCase());
    if (!key) return null;
    return { cat: ROBINHOOD_CATEGORY, token: data[key] };
  }

  for (const cat of [1, 2, 3, 4]) {
    const res = await fetch(`${origin}/api/scores/${cat}`, { cache: 'no-store' });
    if (!res.ok) continue;
    const data: Record<string, RawToken> = await res.json();
    const key = Object.keys(data).find((k) => k.toLowerCase() === ca.toLowerCase());
    if (key) return { cat, token: data[key] };
  }
  return null;
}

export async function POST(req: NextRequest) {
  const { chain, ca } = await req.json();
  if ((chain !== 'base' && chain !== 'robinhood') || !ca || typeof ca !== 'string') {
    return NextResponse.json({ ok: false, reason: 'Invalid params' }, { status: 400 });
  }

  const origin = req.nextUrl.origin;
  const found = await findToken(chain, ca, origin);
  if (!found) return NextResponse.json({ ok: false, reason: 'Token not found' });

  const { token } = found;
  const entries = token.entries || [];
  if (entries.length < 4) return NextResponse.json({ ok: false, reason: 'Not enough data' });

  const idx = findSignalEntryIndex(entries);
  if (idx == null) {
    return NextResponse.json({ ok: false, reason: 'This token has not triggered a SmartMoney signal yet.' });
  }

  const signalPrice = entries[idx].price;
  if (signalPrice == null || signalPrice <= 0) {
    return NextResponse.json({ ok: false, reason: 'Invalid signal price' });
  }

  const dex = await fetchDexInfo(ca, chain);
  if (!dex || dex.priceUsd == null) return NextResponse.json({ ok: false, reason: 'No live market data' });
  if (dex.liq < MIN_LIQ) return NextResponse.json({ ok: false, reason: 'Liquidity too low' });
  if (dex.marketCap == null || dex.marketCap < MIN_MARKETCAP) {
    return NextResponse.json({ ok: false, reason: 'Market cap too low' });
  }

  const pct = ((dex.priceUsd - signalPrice) / signalPrice) * 100;
  if (pct <= MIN_PCT) {
    return NextResponse.json({ ok: false, reason: `Not enough gain yet (+${pct.toFixed(0)}%, need >${MIN_PCT}%)` });
  }

  const oldMarketCap = dex.marketCap! * (signalPrice / dex.priceUsd!);
  const pctRounded = Math.round(pct);
  const verifyLine =
    chain === 'robinhood' && token.verified != null ? (token.verified ? '✅ Verified' : '❌ Not Verified') : null;

  const headline = buildHeadline(token.symbol, pctRounded, chain);

  let text = `${headline}

  MarketCap: ${formatCap(oldMarketCap)} → ${formatCap(dex.marketCap)} | Price: ${formatPriceShort(dex.priceUsd)}`;
  if (verifyLine) text += `\n${verifyLine}`;
  text += `\n\n🌐Check the latest WYCK update here: wyck.pro/${chain}/${ca}`;

  const HISTORY_KEY = `wyck:autopost:history:${chain}`;
  await redis.lpush(HISTORY_KEY, ca.toLowerCase());
  await redis.ltrim(HISTORY_KEY, 0, HISTORY_DEPTH - 1);

  return NextResponse.json({ ok: true, text, symbol: token.symbol, pct: pctRounded });
}