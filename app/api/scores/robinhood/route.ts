import { NextResponse } from 'next/server';
import { getRobinhoodSources, fetchScoresCached } from '@/lib/scoresServer';

export async function GET() {
  const sources = getRobinhoodSources();
  if (!sources.length) return NextResponse.json({ error: 'Missing config' }, { status: 400 });

  try {
    const merged = await fetchScoresCached('robinhood', sources);
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}