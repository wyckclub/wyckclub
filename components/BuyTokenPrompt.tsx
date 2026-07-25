'use client';

import { useState } from 'react';
import { GATE_TOKEN_ADDRESS } from '@/lib/tokenGate';

export function BuyTokenPrompt() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(GATE_TOKEN_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const uniswapUrl = `https://app.uniswap.org/swap?outputCurrency=${GATE_TOKEN_ADDRESS}&chain=base`;
  const aerodromeUrl = `https://aerodrome.finance/swap?from=eth&to=${GATE_TOKEN_ADDRESS}`;

  return (
    <div className="mt-6 space-y-3">
    <div className="flex flex-col items-center gap-2 text-sm">
    <span className="text-slate-400">$WYCK Token Contract Address</span>
    <div className="flex items-center gap-2 max-w-full">
        <span className="font-mono text-blue-400 break-all text-xs sm:text-sm">
        {GATE_TOKEN_ADDRESS}
        </span>
        <button
        onClick={handleCopy}
        className="shrink-0 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
        >
        {copied ? 'Copied!' : 'Copy'}
        </button>
    </div>
    </div>
      <div className="flex items-center justify-center gap-3">
        <a
          href={uniswapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-500 text-sm font-semibold"
        >
          Buy on Uniswap
        </a>
        <a
          href={aerodromeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-semibold"
        >
          Buy on Aerodrome
        </a>
      </div>
    </div>
  );
}