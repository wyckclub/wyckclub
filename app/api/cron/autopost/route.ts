export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { uploadMedia, postTweetWithMedia } from '@/lib/xApi';
import { generateGridImage } from '@/lib/generateGridImage';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

const HISTORY_DEPTH = 12;
const MAX_TOKENS_PER_POST = 10;

interface Notification {
  ca: string;
  symbol: string;
  levelLabel: string;
  current: string;
  top10: number | null;
  prevTop10: number | null;
  verified: boolean | null;
}

interface DexInfo {
  priceUsd: number | null;
  marketCap: number | null;
  name: string | null;
  imageUrl: string | null;
}

function stripDots(s: string | null | undefined): string {
  if (!s) return '';
  return s.replace(/\./g, '');
}

async function fetchDexInfo(caList: string[], chainId: string): Promise<Record<string, DexInfo>> {
  const out: Record<string, DexInfo> = {};
  const BATCH = 30;
  for (let i = 0; i < caList.length; i += BATCH) {
    const chunk = caList.slice(i, i + BATCH);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`, { cache: 'no-store' });
      if (!res.ok) continue;
      const json = await res.json();
      const pairs = json.pairs || [];
      chunk.forEach((ca) => {
        const caPairs = pairs.filter(
          (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === chainId
        );
        const pair = caPairs[0] || pairs.find((p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase());
        if (!pair) return;
        out[ca] = {
          priceUsd: pair.priceUsd == null ? null : Number(pair.priceUsd),
          marketCap: pair.marketCap ?? pair.fdv ?? null,
          name: pair.baseToken?.name ?? null,
          imageUrl: pair.info?.imageUrl ?? null,
        };
      });
    } catch {
      // skip
    }
  }
  return out;
}

async function runForChain(chain: 'base' | 'robinhood', origin: string) {
  const HISTORY_KEY = `wyck:autopost:history:${chain}`;

  const res = await fetch(`${origin}/api/whale-hub?chain=${chain}`, { cache: 'no-store' });
  if (!res.ok) return { chain, posted: false, reason: 'whale-hub fetch failed' };
  const notifications: Notification[] = await res.json();
  if (!notifications.length) return { chain, posted: false, reason: 'no signals' };

  const history = (await redis.lrange<string>(HISTORY_KEY, 0, HISTORY_DEPTH - 1)) || [];
  const excludedCas = new Set(
    history.flatMap((h) => {
      try {
        return JSON.parse(h) as string[];
      } catch {
        return [];
      }
    })
  );

  const candidates = notifications.filter((n) => !excludedCas.has(n.ca));
  if (!candidates.length) return { chain, posted: false, reason: 'all tokens already posted in last 12 posts' };

  const dexInfo = await fetchDexInfo(candidates.map((c) => c.ca), chain);

  const items = candidates
    .filter((c) => dexInfo[c.ca]?.priceUsd != null)
    .slice(0, MAX_TOKENS_PER_POST)
    .map((c) => ({ ...c, ...dexInfo[c.ca] }));

  if (!items.length) return { chain, posted: false, reason: 'no token with valid dexscreener price' };

  const img = await generateGridImage(
    items.map((it) => ({
        symbol: stripDots(it.symbol),
        name: stripDots(it.name),
        imageUrl: it.imageUrl ?? null,
        marketCap: it.marketCap,
        verified: chain === 'robinhood' ? it.verified : null,
    })),
    chain
  );
  const buffer = Buffer.from(await img.arrayBuffer());

  const uploaded = await uploadMedia(buffer);
  if (!uploaded.ok || !uploaded.mediaId) {
    return { chain, posted: false, reason: uploaded.error || 'image upload failed' };
  }

  const text = `#${chain} · WYCKSCORE Alert 🔔`;
  const result = await postTweetWithMedia(text, [uploaded.mediaId]);
  if (!result.ok) return { chain, posted: false, reason: result.error };

  await redis.lpush(HISTORY_KEY, JSON.stringify(items.map((i) => i.ca)));
  await redis.ltrim(HISTORY_KEY, 0, HISTORY_DEPTH - 1);

  return { chain, posted: true, tweetId: result.id, tokens: items.map((i) => i.symbol) };
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