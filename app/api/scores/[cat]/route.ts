import { NextRequest, NextResponse } from 'next/server';

const URLS: Record<string, string | undefined> = {
  '1': process.env.WYCK_CLAW_URL,
  '2': process.env.WYCK_B1_URL,
  '3': process.env.WYCK_V1_URL,
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  const url = URLS[cat];
  if (!url) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) return NextResponse.json({ error: 'Upstream error' }, { status: 502 });

  const data = await res.json();
  return NextResponse.json(data);
}