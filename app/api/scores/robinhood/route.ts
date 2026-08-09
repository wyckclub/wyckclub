import { NextRequest, NextResponse } from 'next/server';

const URLS = [
  process.env.WYCK_ROBIN_URL,
  process.env.WYCK_ROBIN2_URL,
  process.env.WYCK_ROBIN3_URL,
  process.env.WYCK_ROBIN4_URL,
  process.env.WYCK_ROBIN5_URL,
].filter((u): u is string => !!u);

export async function GET() {
  if (!URLS.length) return NextResponse.json({ error: 'Missing config' }, { status: 400 });
  try {
    const results = await Promise.all(
      URLS.map(async (url) => {
        const res = await fetch(url, { next: { revalidate: 20 } });
        if (!res.ok) throw new Error(`Upstream error: ${url}`);
        return res.json();
      })
    );
    return NextResponse.json(Object.assign({}, ...results));
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}