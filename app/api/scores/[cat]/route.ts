import { NextRequest, NextResponse } from 'next/server';
import { getCategorySources, fetchScoresCached } from '@/lib/scoresServer';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ cat: string }> }) {
  const { cat } = await params;
  const sources = getCategorySources(cat);
  if (!sources.length) return NextResponse.json({ error: 'Invalid category' }, { status: 400 });

  try {
    const merged = await fetchScoresCached(`cat:${cat}`, sources);
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}