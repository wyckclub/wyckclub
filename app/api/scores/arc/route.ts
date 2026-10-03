import { NextResponse } from 'next/server';
import { getArcSources, fetchScoresCached } from '@/lib/scoresServer';

export async function GET() {
  const sources = getArcSources();
  if (!sources.length) return NextResponse.json({ error: 'Missing config' }, { status: 400 });

  try {
    const merged = await fetchScoresCached('arc', sources);
    return NextResponse.json(merged, {
      headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}