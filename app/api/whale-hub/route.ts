import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getWhaleStarredScore, getChartScoreTextColorClass } from '@/lib/format';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

const NOTIF_HASH_KEY = 'wyck:whalehub:notifications_by_ca';
const LASTSEEN_KEY = 'wyck:whalehub:lastseen';
const MAX_NOTIFS = 300;
const MIN_VOL24H = 1000;

async function fetchVol24hMap(caList: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  const BATCH_SIZE = 30;
  for (let i = 0; i < caList.length; i += BATCH_SIZE) {
    const chunk = caList.slice(i, i + BATCH_SIZE);
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${chunk.join(',')}`, {
        cache: 'no-store',
      });
      if (!res.ok) continue;
      const json = await res.json();
      const pairs = json.pairs || [];
      chunk.forEach((ca) => {
        const caPairs = pairs.filter(
          (p: any) => p.baseToken?.address?.toLowerCase() === ca.toLowerCase() && p.chainId === 'base'
        );
        const vol24h = caPairs.reduce((s: number, p: any) => s + (Number(p.volume?.h24) || 0), 0);
        out[ca] = caPairs.length ? vol24h : 0;
      });
    } catch {
      // skip vol = 0
    }
  }
  return out;
}

type Level = 'inflow' | 'medium' | 'strong' | 'super';

const LEVEL_LABELS: Record<Level, string> = {
  inflow: 'Inflow',
  medium: 'Medium',
  strong: 'Strong',
  super: 'Super Strong',
};

interface Notification {
  id: string;
  ca: string;
  symbol: string;
  category: number;
  level: Level;
  levelLabel: string;
  current: string;
  previous: string;
  message: string;
  timestamp: string;
}

function computeLevel(
  latestScore: number,
  latestDisplay: string,
  last7: { score: number; topwhale?: string }[]
): Level | null {
  const scoreWithWhale = getWhaleStarredScore(latestDisplay, last7);
  const hasWhale = scoreWithWhale.includes('🐋');
  const isYellow = getChartScoreTextColorClass(latestScore, last7) === 'text-yellow-400';
  const hasPlus = latestDisplay.endsWith('+');
  const prevScore = last7[1]?.score;
  const scoreJump = prevScore != null && latestScore - prevScore > 3;

  if (hasWhale && isYellow && hasPlus) return 'super';
  if (hasWhale && (hasPlus || isYellow)) return 'strong';
  if (hasWhale || isYellow) return 'medium';
  if (scoreJump || (hasPlus && latestScore > 3)) return 'inflow';
  return null;
}

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;

  const categories = await Promise.all(
    [1, 2, 3, 4].map(async (cat) => {
      try {
        const res = await fetch(`${origin}/api/scores/${cat}`, { cache: 'no-store' });
        if (!res.ok) return { cat, data: {} as Record<string, any> };
        return { cat, data: (await res.json()) as Record<string, any> };
      } catch {
        return { cat, data: {} as Record<string, any> };
      }
    })
  );

  const lastSeen = (await redis.hgetall<Record<string, string>>(LASTSEEN_KEY)) || {};
  const seenUpdates: Record<string, string> = {};

  type Candidate = {
    ca: string;
    cat: number;
    symbol: string;
    level: Level;
    sig: string;
    scoreWithWhale: string;
    prevWhale: string;
  };
  const candidates: Candidate[] = [];

  for (const { cat, data } of categories) {
    for (const [ca, token] of Object.entries<any>(data)) {
      const entries = token.entries || [];
      if (!entries.length) continue;
      const latest = entries[0];

      const sig = `${latest.timestamp ?? ''}_${latest.score}_${latest.display}_${latest.price}`;
      if (lastSeen[ca] === sig) continue;
      seenUpdates[ca] = sig;

      if (entries.length < 2) continue;
      const last7 = entries.slice(0, 7).map((e: any) => ({ score: e.score, topwhale: e.topwhale }));
      const level = computeLevel(latest.score, latest.display, last7);
      if (!level) continue;

      const prevEntry = entries[1];
      const scoreWithWhale = getWhaleStarredScore(latest.display, last7);
      const prevWhale = prevEntry.topwhale === 'y' ? `🐋${prevEntry.display}` : prevEntry.display;

      candidates.push({ ca, cat, symbol: token.symbol, level, sig, scoreWithWhale, prevWhale });
    }
  }

  const notifUpdates: Record<string, string> = {};

  if (candidates.length) {
    const volMap = await fetchVol24hMap(candidates.map((c) => c.ca));

    for (const c of candidates) {
      const vol24h = volMap[c.ca] ?? 0;
      if (vol24h < MIN_VOL24H) continue; // bỏ qua token thanh khoản/vol quá thấp

      const levelLabel = LEVEL_LABELS[c.level];
      const notif: Notification = {
        id: `${c.ca}_${c.sig}`,
        ca: c.ca,
        symbol: c.symbol,
        category: c.cat,
        level: c.level,
        levelLabel,
        current: c.scoreWithWhale,
        previous: c.prevWhale,
        message: `$${c.symbol} just triggered a SmartMoney signal: ${levelLabel} ${c.scoreWithWhale} (previous ${c.prevWhale})`,
        timestamp: new Date().toISOString(),
      };

      notifUpdates[c.ca] = JSON.stringify(notif);
    }
  }

  if (Object.keys(seenUpdates).length) {
    await redis.hset(LASTSEEN_KEY, seenUpdates);
  }
  if (Object.keys(notifUpdates).length) {
    await redis.hset(NOTIF_HASH_KEY, notifUpdates);
  }

  const all = (await redis.hgetall<Record<string, string>>(NOTIF_HASH_KEY)) || {};
  const notifications: Notification[] = Object.values(all)
    .map((r) => (typeof r === 'string' ? JSON.parse(r) : (r as unknown as Notification)))
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, MAX_NOTIFS);

  return NextResponse.json(notifications);
}