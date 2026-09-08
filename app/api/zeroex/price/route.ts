import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const params = new URLSearchParams(req.nextUrl.searchParams);
  const feeRecipient = process.env.SWAP_FEE_RECIPIENT;
  if (feeRecipient && params.get('sellToken')) {
    params.set('swapFeeRecipient', feeRecipient);
    params.set('swapFeeBps', process.env.SWAP_FEE_BPS || '30');
    params.set('swapFeeToken', params.get('sellToken')!); // phí trừ trên token bán ra, đúng công thức 0x
  }
  const url = `https://api.0x.org/swap/allowance-holder/price?${params.toString()}`;
  const res = await fetch(url, {
    headers: { '0x-api-key': process.env.ZEROEX_API_KEY!, '0x-version': 'v2' },
    cache: 'no-store',
  });
  return NextResponse.json(await res.json(), { status: res.status });
}