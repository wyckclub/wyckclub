import { NextRequest, NextResponse } from 'next/server';

const URLS: Record<string, (string | undefined)[]> = {
  '1': [
    process.env.WYCK_CLAW_URL,
    process.env.WYCK_CLAW2_URL,
    process.env.WYCK_CLAW3_URL,
    process.env.WYCK_C1_URL,
    process.env.WYCK_C2_URL,
    process.env.WYCK_C3_URL,
  ],
  '2': [
    process.env.WYCK_B1_URL,
    process.env.WYCK_B2_URL,
    process.env.WYCK_B3_URL,
    process.env.WYCK_B4_URL,
    process.env.WYCK_B5_URL,
    process.env.WYCK_B6_URL,
  ],
  '3': [
    process.env.WYCK_V1_URL,
    process.env.WYCK_V2_URL,
    process.env.WYCK_V3_URL,
    process.env.WYCK_V4_URL,
  ],
  '4': [
    process.env.WYCK_2NEW_URL,
    process.env.WYCK_5NEW_URL,
  ],
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  const urls = (URLS[cat] || []).filter((u): u is string => !!u);
  if (!urls.length) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  try {
    const results = await Promise.all(
      urls.map(async (url) => {
        const res = await fetch(url, { next: { revalidate: 20 } });
        if (!res.ok) throw new Error(`Upstream error: ${url}`);
        return res.json();
      })
    );
    const merged = Object.assign({}, ...results);
    return NextResponse.json(merged);
  } catch (e) {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}