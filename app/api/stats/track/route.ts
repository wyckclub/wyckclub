import { NextRequest, NextResponse } from 'next/server';
import { addConnectedWallet, incrChartView } from '@/lib/stats';

export async function POST(req: NextRequest) {
  const { type, address } = await req.json();

  if (type === 'connect') {
    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Missing address' }, { status: 400 });
    }
    await addConnectedWallet(address);
    return NextResponse.json({ ok: true });
  }

  if (type === 'chart_view') {
    await incrChartView();
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
}