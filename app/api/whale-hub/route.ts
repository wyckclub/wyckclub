import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getWhaleStarredScore, getChartScoreTextColorClass } from '@/lib/format';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

const NOTIF_KEY = 'wyck:whalehub:notifications';
const LASTSEEN_KEY = 'wyck:whalehub:lastseen';
const MAX_NOTIFS = 300;

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
  const updates: Record<string, string> = {};
  const newNotifs: Notification[] = [];

  for (const { cat, data } of categories) {
    for (const [ca, token] of Object.entries<any>(data)) {
      const entries = token.entries || [];
      if (!entries.length) continue;
      const latest = entries[0];

      const sig = `${latest.timestamp ?? ''}_${latest.score}_${latest.display}_${latest.price}`;
      if (lastSeen[ca] === sig) continue;
      updates[ca] = sig;

      if (entries.length < 2) continue;
      const last7 = entries.slice(0, 7).map((e: any) => ({ score: e.score, topwhale: e.topwhale }));
      const level = computeLevel(latest.score, latest.display, last7);
      if (!level) continue;

      const prevEntry = entries[1];
      const scoreWithWhale = getWhaleStarredScore(latest.display, last7);
      const prevWhale = prevEntry.topwhale === 'y' ? `🐋${prevEntry.display}` : prevEntry.display;
      const levelLabel = LEVEL_LABELS[level];

      newNotifs.push({
        id: `${ca}_${sig}`,
        ca,
        symbol: token.symbol,
        category: cat,
        level,
        levelLabel,
        current: scoreWithWhale,
        previous: prevWhale,
        message: `$${token.symbol} just triggered a SmartMoney signal: ${levelLabel} ${scoreWithWhale} (previous ${prevWhale})`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  if (Object.keys(updates).length) {
    await redis.hset(LASTSEEN_KEY, updates);
  }
  if (newNotifs.length) {
    await redis.lpush(NOTIF_KEY, ...newNotifs.map((n) => JSON.stringify(n)));
    await redis.ltrim(NOTIF_KEY, 0, MAX_NOTIFS - 1);
  }

  const raw = await redis.lrange(NOTIF_KEY, 0, MAX_NOTIFS - 1);
  const notifications: Notification[] = raw.map((r: any) => (typeof r === 'string' ? JSON.parse(r) : r));

  return NextResponse.json(notifications);
}