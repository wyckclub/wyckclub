import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.REDIS_KV_REST_API_URL!,
  token: process.env.REDIS_KV_REST_API_TOKEN!,
});

export async function addConnectedWallet(address: string) {
  await redis.sadd('wyck:stat:connected_wallets', address.toLowerCase());
}

export async function getConnectedWalletsCount(): Promise<number> {
  return await redis.scard('wyck:stat:connected_wallets');
}

export async function incrChartView() {
  await redis.incr('wyck:stat:chart_views');
}

export async function getChartViews(): Promise<number> {
  const v = await redis.get<number>('wyck:stat:chart_views');
  return v ?? 0;
}

const CATEGORY_URLS = [
  process.env.WYCK_CLAW_URL,
  process.env.WYCK_C3_URL,
  process.env.WYCK_B1_URL,
  process.env.WYCK_B2_URL,
  process.env.WYCK_V1_URL,
  process.env.WYCK_5NEW_URL,
].filter((u): u is string => !!u);

export async function getTotalTokens(): Promise<number> {
  const results = await Promise.all(
    CATEGORY_URLS.map(async (url) => {
      try {
        const res = await fetch(url, { next: { revalidate: 60 } });
        if (!res.ok) return {};
        return res.json();
      } catch {
        return {};
      }
    })
  );
  return Object.keys(Object.assign({}, ...results)).length;
}