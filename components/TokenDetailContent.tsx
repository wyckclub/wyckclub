'use client';

import { useEffect, useState } from 'react';
import { fetchAllCategories, fetchRobinhoodTokens, ROBINHOOD_CATEGORY, TokenEntry } from '@/lib/tokenApi';
import { fetchFullTokenPairInfo, FullPairInfo } from '@/lib/dexData';
import { TokenScoreChart } from '@/components/TokenScoreChart';
import { TokenInfoPanel } from '@/components/TokenInfoPanel';
import { TokenSwapPanel } from '@/components/TokenSwapPanel';

type Chain = 'base' | 'robinhood';

export function TokenDetailContent({ chain, ca }: { chain: Chain; ca: string }) {
  const [token, setToken] = useState<TokenEntry | null>(null);
  const [pairInfo, setPairInfo] = useState<FullPairInfo | null>(null);

  useEffect(() => {
    setToken(null);
    setPairInfo(null);
    const load = chain === 'robinhood' ? fetchRobinhoodTokens() : fetchAllCategories();
    load.then((list) => setToken(list.find((t) => t.CA.toLowerCase() === ca.toLowerCase()) ?? null));
  }, [chain, ca]);

  useEffect(() => {
    let active = true;
    function poll() {
      fetchFullTokenPairInfo(ca, chain).then((info) => { if (active) setPairInfo(info); });
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => { active = false; clearInterval(id); };
  }, [ca, chain]);

  const category = token?.category ?? (chain === 'robinhood' ? ROBINHOOD_CATEGORY : null);
  const symbol = pairInfo?.symbol ?? token?.symbol ?? ca.slice(0, 6);
  const dexscreenerUrl = pairInfo
    ? `https://dexscreener.com/${chain}/${pairInfo.pairAddress}?embed=1&theme=dark&trades=0&info=0&interval=240`
    : null;

  return (
    <>
      <div className="flex-1 min-w-0 flex flex-col gap-3 h-full">
        <div className="flex-1 min-h-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {dexscreenerUrl ? (
            <iframe src={dexscreenerUrl} className="w-full h-full" title="Dexscreener chart" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">Loading chart...</div>
          )}
        </div>
        <TokenScoreChart category={category} ca={ca} chainId={chain} className="flex-1 min-h-0" />
      </div>

      <div className="lg:w-96 shrink-0 overflow-y-auto space-y-3">
        <TokenSwapPanel chainId={chain} ca={ca} />
        <TokenInfoPanel info={pairInfo} ca={ca} chainId={chain} symbol={symbol} verified={token?.verified} />
      </div>
    </>
  );
}