import { NextResponse } from 'next/server';

export async function GET() {
  const url = process.env.WYCK_ROBIN_URL;
  if (!url) return NextResponse.json({ error: 'Missing config' }, { status: 400 });
  try {
    const res = await fetch(url, { next: { revalidate: 20 } });
    if (!res.ok) throw new Error('Upstream error');
    const data = await res.json();
    const out: Record<string, any> = {};
    for (const ca of Object.keys(data)) out[ca] = { ...data[ca], verified: false };
    return NextResponse.json(out);
  } catch {
    return NextResponse.json({ error: 'Upstream error' }, { status: 502 });
  }
}