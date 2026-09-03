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
  // Clanker
  process.env.WYCK_CLANKER1_URL,
  process.env.WYCK_CLANKER2_URL,
  process.env.WYCK_CLANKER3_URL,

  // Bankr
  process.env.WYCK_BANKRBOT1_URL,
  process.env.WYCK_BANKRBOT2_URL,
  process.env.WYCK_BANKRBOT3_URL,

  // Virtuals
  process.env.WYCK_VIRTUALS1_URL,
  process.env.WYCK_VIRTUALS2_URL,
  process.env.WYCK_VIRTUALS3_URL,

  process.env.WYCK_ZR1_URL,
  process.env.WYCK_BASESTONK1_URL,
  process.env.WYCK_THESTONKS1_URL,
  process.env.WYCK_FLAUNCH1_URL,
  process.env.WYCK_O1EXCHANGE1_URL,

  // Base Other (verified)
  process.env.WYCK_B1_URL,
  process.env.WYCK_B2_URL,
  process.env.WYCK_B3_URL,
  process.env.WYCK_B4_URL,
  process.env.WYCK_2NEW_URL,

  // Base Other (not verified)
  process.env.WYCK_B5_URL,
  process.env.WYCK_B6_URL,

  // New
  process.env.WYCK_5NEW_URL,
].filter((u): u is string => !!u);

const ROBINHOOD_CATEGORY_URLS = [
  // New (not verified)
  process.env.WYCK_ROBIN_URL,

  // Robinhood Other (not verified)
  process.env.WYCK_ROBIN1_URL,
  process.env.WYCK_ROBIN1A_URL,
  process.env.WYCK_ROBIN1B_URL,
  process.env.WYCK_ROBIN2_URL,
  process.env.WYCK_ROBIN2A_URL,
  process.env.WYCK_ROBIN2B_URL,
  process.env.WYCK_ROBIN3_URL,
  process.env.WYCK_ROBIN4_URL,
  // Robinhood Other (verified)
  process.env.WYCK_ROBIN5_URL,
  process.env.WYCK_ROBIN6_URL,

  // PonsFamily
  process.env.WYCK_ROBIN_PONSFAMILY1_URL,
  process.env.WYCK_ROBIN_PONSFAMILY2_URL,
  process.env.WYCK_ROBIN_PONSFAMILY3_URL,
  process.env.WYCK_ROBIN_PONSFAMILY4_URL,
  process.env.WYCK_ROBIN_PONSFAMILY5_URL,
  process.env.WYCK_ROBIN_PONSFAMILY6_URL,

  // Bankr
  process.env.WYCK_ROBIN_BANKRBOT1_URL,
  // Pools.fun
  process.env.WYCK_ROBIN_POOLSFUN1_URL,
  // Pools.trade
  process.env.WYCK_ROBIN_POOLSTRADE1_URL,
  // Clanker
  process.env.WYCK_ROBIN_CLANKER1_URL,
  // Virtuals
  process.env.WYCK_ROBIN_VIRTUALS1_URL,
  // Flap.sh
  process.env.WYCK_ROBIN_FLAP1_URL,
  process.env.WYCK_ROBIN_LEMON1_URL,
  // LetsCash
  process.env.WYCK_ROBIN_LETSCASH1_URL,
  process.env.WYCK_ROBIN_LONG1_URL,
  process.env.WYCK_ROBIN_LONG2_URL,
  process.env.WYCK_ROBIN_LONG3_URL,
  // Noxa
  process.env.WYCK_ROBIN_NOXA1_URL,
  // STONKBROKERS
  process.env.WYCK_ROBIN_STONKBROKERS1_URL,
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