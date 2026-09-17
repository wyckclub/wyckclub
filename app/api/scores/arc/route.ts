import { NextResponse } from 'next/server';
import { getArcSources, fetchScoresCached } from '@/lib/scoresServer';

export async function GET() {
  const sources = getArcSources();
  if (!sources.length) return NextResponse.json({ error: 'Missing config' }, { status: 400 });

  try {
    const merged = await fetchScoresCached('arc', sources);
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}