'use client';

import { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { ROBINHOOD_CATEGORY } from '@/lib/tokenApi';
import { fetchFullTokenPairInfo, fetchHoldersCount, fetchFactoryWallets, FullPairInfo } from '@/lib/dexData';
import { TokenScoreChart } from '@/components/TokenScoreChart';
import { TokenInfoPanel } from '@/components/TokenInfoPanel';
import { TokenSwapPanel } from '@/components/TokenSwapPanel';
import { useTokenData } from '@/components/TokenDataContext';

type Chain = 'base' | 'robinhood';

function WalletIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4Z" />
    </svg>
  );
}

export function TokenDetailContent({ chain, ca }: { chain: Chain; ca: string }) {
  const { isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { tokens } = useTokenData();
  const [pairInfo, setPairInfo] = useState<FullPairInfo | null>(null);
  const [holders, setHolders] = useState<number | null>(null);
  const token = tokens.find((t) => t.CA.toLowerCase() === ca.toLowerCase()) ?? null;
  const [wallets, setWallets] = useState<string[]>([]);

  useEffect(() => {
    setPairInfo(null);
    setHolders(null);
    setWallets([]);
    let active = true;
    function poll() {
      fetchFullTokenPairInfo(ca, chain).then((info) => { if (active) setPairInfo(info); });
      fetchHoldersCount(ca, chain).then((h) => { if (active) setHolders(h); });
      fetchFactoryWallets(ca, chain).then((w) => { if (active) setWallets(w); });
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => { active = false; clearInterval(id); };
  }, [ca, chain]);

  const category = token?.category ?? (chain === 'robinhood' ? ROBINHOOD_CATEGORY : null);
  const symbol = pairInfo?.symbol ?? token?.symbol ?? ca.slice(0, 6);
  const dexscreenerUrl = pairInfo
    ? `https://dexscreener.com/${chain}/${pairInfo.topVolumePairAddress ?? pairInfo.pairAddress}?embed=1&theme=dark&trades=0&info=0&interval=${getDexscreenerInterval(pairInfo.pairCreatedAt)}`
    : null;

  return (
    <>
      <div className="flex-1 min-w-0 flex flex-col gap-3 lg:h-full">
        <div className="h-[42vh] lg:flex-1 lg:min-h-0 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
          {dexscreenerUrl ? (
            <iframe src={dexscreenerUrl} className="w-full h-full" title="Dexscreener chart" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-slate-500 text-sm">Loading chart...</div>
          )}
        </div>

        {isConnected ? (
          <TokenScoreChart category={category} ca={ca} chainId={chain} className="h-[42vh] lg:flex-1 lg:min-h-0" />
        ) : (
          <div className="h-[42vh] lg:flex-1 lg:min-h-0 bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col">
            <div className="flex items-center mb-2 shrink-0">
              <span className="text-sm font-bold text-blue-400">WYCKSCORE Chart</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <p className="text-slate-400 text-sm text-center">Connect your wallet to view the WYCKSCORE chart.</p>
              <button
                onClick={openConnectModal}
                className="w-10 h-10 rounded-full bg-blue-600 hover:bg-blue-500 flex items-center justify-center text-white"
                aria-label="Connect wallet"
              >
                <WalletIcon />
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="lg:w-96 shrink-0 lg:overflow-y-auto space-y-3">
        <TokenInfoPanel info={pairInfo} ca={ca} chainId={chain} symbol={symbol} platform={token?.platform} holders={holders} wallets={wallets} />
        <TokenSwapPanel chainId={chain} ca={ca} platform={token?.platform} />
      </div>
    </>
  );
}

function getDexscreenerInterval(pairCreatedAt: number | null): number {
  if (!pairCreatedAt) return 60;
  const days = (Date.now() - pairCreatedAt) / (24 * 60 * 60 * 1000);
  if (days > 30) return 240;
  if (days > 5) return 60;
  if (days > 3) return 15;
  if (days >= 1) return 5;
  return 1;
}