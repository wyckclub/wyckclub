import { NextRequest, NextResponse } from 'next/server';

const NOT_VERIFIED_URLS = [
  process.env.WYCK_ROBIN_URL,
  process.env.WYCK_ROBIN2_URL,
  process.env.WYCK_ROBIN3_URL,
  process.env.WYCK_ROBIN4_URL,
].filter((u): u is string => !!u);

const VERIFIED_URLS = [
  process.env.WYCK_ROBIN5_URL,
].filter((u): u is string => !!u);

async function fetchGroup(urls: string[], verified: boolean): Promise<Record<string, any>> {
  if (!urls.length) return {};
  const results = await Promise.all(
    urls.map(async (url) => {
      const res = await fetch(url, { next: { revalidate: 20 } });
      if (!res.ok) throw new Error(`Upstream error: ${url}`);
      return res.json();
    })
  );
  const merged: Record<string, any> = Object.assign({}, ...results);
  for (const ca of Object.keys(merged)) {
    merged[ca] = { ...merged[ca], verified };
  }
  return merged;
}

export async function GET() {
  if (!NOT_VERIFIED_URLS.length && !VERIFIED_URLS.length) {
    return NextResponse.json({ error: 'Missing config' }, { status: 400 });
  }
  try {
    const [notVerified, verified] = await Promise.all([
      fetchGroup(NOT_VERIFIED_URLS, false),
      fetchGroup(VERIFIED_URLS, true),
    ]);
    return NextResponse.json({ ...notVerified, ...verified });
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}