'use client';

import { useState } from 'react';
import { WYCK_BASE_ADDRESS, WYCK_ROBINHOOD_ADDRESS } from '@/lib/tokenGate';

const NATIVE = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

function matchaUrl(address: string, chainId: number) {
  return `https://matcha.xyz/trade?ref=dexscreener&swapFeeBps=40&buyAddress=${address.toLowerCase()}&buyChain=${chainId}&sellAddress=${NATIVE}&sellChain=${chainId}`;
}

export function BuyTokenPrompt() {
  const [copied, setCopied] = useState<string | null>(null);

  function handleCopy(key: string, address: string) {
    navigator.clipboard.writeText(address);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  const networks = [
    {
      key: 'base',
      label: 'Base',
      address: WYCK_BASE_ADDRESS,
      buyLinks: [
        { label: 'Buy on Uniswap', href: `https://app.uniswap.org/swap?outputCurrency=${WYCK_BASE_ADDRESS}&chain=base`, cls: 'bg-pink-600 hover:bg-pink-500' },
        { label: 'Buy on Matcha', href: matchaUrl(WYCK_BASE_ADDRESS, 8453), cls: 'bg-blue-600 hover:bg-blue-500' },
      ],
    },
    {
      key: 'robinhood',
      label: 'Robinhood Chain',
      address: WYCK_ROBINHOOD_ADDRESS,
      buyLinks: [
        { label: 'Buy on Uniswap', href: `https://app.uniswap.org/swap?outputCurrency=${WYCK_ROBINHOOD_ADDRESS}&chain=robinhood`, cls: 'bg-pink-600 hover:bg-pink-500' },
        { label: 'Buy on Matcha', href: matchaUrl(WYCK_ROBINHOOD_ADDRESS, 4663), cls: 'bg-blue-600 hover:bg-blue-500' },
      ],
    },
  ];

  return (
    <div className="mt-6 space-y-4">
      <p className="text-sm text-slate-400">Hold WYCK on Base or Robinhood Chain to unlock access.</p>
      {networks.map((n) => (
        <div key={n.key} className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="text-sm font-bold text-slate-200">$WYCK on {n.label}</div>
          <div className="flex items-center justify-center gap-2 max-w-full">
            <span className="font-mono text-blue-400 break-all text-xs sm:text-sm">{n.address}</span>
            <button
              onClick={() => handleCopy(n.key, n.address)}
              className="shrink-0 text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
            >
              {copied === n.key ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            {n.buyLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`px-4 py-2 rounded-lg text-sm font-semibold ${l.cls}`}
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}