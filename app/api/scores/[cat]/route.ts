import { NextRequest, NextResponse } from 'next/server';

interface Source {
  url: string | undefined;
  platform: string;
  verified: boolean;
}

const SOURCES: Record<string, Source[]> = {
  '1': [
    { url: process.env.WYCK_CLANKER1_URL, platform: 'clanker', verified: true },
    { url: process.env.WYCK_CLANKER2_URL, platform: 'clanker', verified: true },
    { url: process.env.WYCK_CLANKER3_URL, platform: 'clanker', verified: true },
    { url: process.env.WYCK_BANKRBOT1_URL, platform: 'bankr', verified: true },
    { url: process.env.WYCK_BANKRBOT2_URL, platform: 'bankr', verified: true },
    { url: process.env.WYCK_BANKRBOT3_URL, platform: 'bankr', verified: true },
  ],
  '2': [
    { url: process.env.WYCK_B1_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_B2_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_B3_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_B4_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_B5_URL, platform: 'base_unverified', verified: false },
    { url: process.env.WYCK_B6_URL, platform: 'base_unverified', verified: false },
    { url: process.env.WYCK_2NEW_URL, platform: 'base_verified', verified: true },
    { url: process.env.WYCK_ZR1_URL, platform: 'zora', verified: true },
    { url: process.env.WYCK_FLAUNCH1_URL, platform: 'flaunch', verified: true },
    { url: process.env.WYCK_O1EXCHANGE1_URL, platform: 'o1.exchange', verified: true },
    { url: process.env.WYCK_BASESTONK1_URL, platform: 'basestonk', verified: true },
    { url: process.env.WYCK_THESTONKS1_URL, platform: 'thestonks', verified: true },
  ],
  '3': [
    { url: process.env.WYCK_VIRTUALS1_URL, platform: 'virtuals', verified: true },
    { url: process.env.WYCK_VIRTUALS2_URL, platform: 'virtuals', verified: true },
    { url: process.env.WYCK_VIRTUALS3_URL, platform: 'virtuals', verified: true },
  ],
  '4': [
    { url: process.env.WYCK_5NEW_URL, platform: 'base_unverified', verified: false },
  ],
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  const sources = (SOURCES[cat] || []).filter(
    (s): s is Source & { url: string } => !!s.url
  );
  if (!sources.length) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  try {
    const results = await Promise.all(
      sources.map(async (s) => {
        const res = await fetch(s.url, { next: { revalidate: 20 } });
        if (!res.ok) throw new Error(`Upstream error: ${s.url}`);
        const data = await res.json();
        const tagged: Record<string, any> = {};
        for (const [ca, token] of Object.entries<any>(data)) {
          tagged[ca] = { ...token, platform: s.platform, verified: s.verified };
        }
        return tagged;
      })
    );
    const merged = Object.assign({}, ...results);
    return NextResponse.json(merged);
  } catch (e) {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}