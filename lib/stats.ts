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

const BASE_CATEGORY_URLS = [
  process.env.WYCK_CLAW_URL,
  process.env.WYCK_C3_URL,
  process.env.WYCK_CLAW2_URL,
  process.env.WYCK_B1_URL,
  process.env.WYCK_B2_URL,
  process.env.WYCK_B3_URL,
  process.env.WYCK_V1_URL,
  process.env.WYCK_V2_URL,
  process.env.WYCK_5NEW_URL,
].filter((u): u is string => !!u);

const ROBINHOOD_CATEGORY_URLS = [
  process.env.WYCK_ROBIN_URL,
  process.env.WYCK_ROBIN1_URL,
  process.env.WYCK_ROBIN2_URL,
  process.env.WYCK_ROBIN3_URL,
  process.env.WYCK_ROBIN4_URL,
].filter((u): u is string => !!u);

async function countTokensFromUrls(urls: string[]): Promise<number> {
  const results = await Promise.all(
    urls.map(async (url) => {
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

export async function getBaseTotalTokens(): Promise<number> {
  return countTokensFromUrls(BASE_CATEGORY_URLS);
}

export async function getRobinhoodTotalTokens(): Promise<number> {
  return countTokensFromUrls(ROBINHOOD_CATEGORY_URLS);
}

export async function getTotalTokens(): Promise<number> {
  const [base, robinhood] = await Promise.all([getBaseTotalTokens(), getRobinhoodTotalTokens()]);
  return base + robinhood;
}