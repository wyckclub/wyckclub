import { NextResponse } from 'next/server';

interface Source {
  url: string | undefined;
  platform: string;
  verified: boolean;
}

const SOURCES: Source[] = [
  { url: process.env.WYCK_ROBIN_URL, platform: 'robinhood_unverified', verified: false },
  { url: process.env.WYCK_ROBIN1_URL, platform: 'robinhood_unverified', verified: false },
  { url: process.env.WYCK_ROBIN2_URL, platform: 'robinhood_unverified', verified: false },
  { url: process.env.WYCK_ROBIN3_URL, platform: 'robinhood_unverified', verified: false },
  { url: process.env.WYCK_ROBIN4_URL, platform: 'robinhood_unverified', verified: false },

  { url: process.env.WYCK_ROBIN5_URL, platform: 'robinhood_verified', verified: true },
  { url: process.env.WYCK_ROBIN6_URL, platform: 'robinhood_verified', verified: true },
  { url: process.env.WYCK_ROBIN_BANKRBOT1_URL, platform: 'bankr', verified: true },
  { url: process.env.WYCK_ROBIN_POOLSFUN1_URL, platform: 'pools.fun', verified: true },
  { url: process.env.WYCK_ROBIN_POOLSTRADE1_URL, platform: 'pools.trade', verified: true },
  { url: process.env.WYCK_ROBIN_CLANKER1_URL, platform: 'clanker', verified: true },
  { url: process.env.WYCK_ROBIN_VIRTUALS1_URL, platform: 'virtuals', verified: true },
  { url: process.env.WYCK_ROBIN_FLAUNCH1_URL, platform: 'flaunch', verified: true },
  { url: process.env.WYCK_ROBIN_FLAP1_URL, platform: 'flap', verified: true },
  { url: process.env.WYCK_ROBIN_HOODFUN1_URL, platform: 'hood.fun', verified: true },
  { url: process.env.WYCK_ROBIN_PONSFAMILY1_URL, platform: 'ponsfamily', verified: true },
  { url: process.env.WYCK_ROBIN_LETSCASH1_URL, platform: 'letscash', verified: true },
  { url: process.env.WYCK_ROBIN_NOXA1_URL, platform: 'noxa', verified: true },
  { url: process.env.WYCK_ROBIN_STONKBROKERS1_URL, platform: 'stonkbrokers', verified: true },
];

async function fetchGroup(url: string, platform: string, verified: boolean): Promise<Record<string, any>> {
  const res = await fetch(url, { next: { revalidate: 20 } });
  if (!res.ok) throw new Error(`Upstream error: ${url}`);
  const data = await res.json();
  const tagged: Record<string, any> = {};
  for (const [ca, token] of Object.entries<any>(data)) {
    tagged[ca] = { ...token, platform, verified };
  }
  return tagged;
}

export async function GET() {
  const sources = SOURCES.filter((s): s is Source & { url: string } => !!s.url);
  if (!sources.length) return NextResponse.json({ error: 'Missing config' }, { status: 400 });

  try {
    const results = await Promise.all(sources.map((s) => fetchGroup(s.url, s.platform, s.verified)));
    const merged = Object.assign({}, ...results);
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}