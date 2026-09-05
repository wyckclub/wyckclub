'use client';

import { useState } from 'react';
import { formatCap, formatPriceShort, formatAge } from '@/lib/format';
import { PlatformBadge } from '@/components/PlatformBadge';
import type { FullPairInfo } from '@/lib/dexData';

// ----- Small reusable pieces -----

function StatBox({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-slate-950 rounded-lg py-2 px-1.5 flex flex-col items-center justify-center gap-0.5">
      <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`text-xs sm:text-sm font-bold truncate ${valueClass}`}>{value}</span>
    </div>
  );
}

function StatRow({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

const pctClass = (v: number | null) => (v == null ? 'text-slate-500' : v >= 0 ? 'text-green-400' : 'text-red-400');
const pctText = (v: number | null) => (v == null ? 'N/A' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);

function formatHolders(h: number | null | undefined) {
  if (h == null || isNaN(h)) return 'N/A';
  if (h >= 1_000_000) return (h / 1_000_000).toFixed(1) + 'M';
  if (h >= 1_000) return (h / 1_000).toFixed(1) + 'K';
  return h.toString();
}

export function TokenInfoPanel({
  info, ca, symbol, platform,
}: { info: FullPairInfo | null; ca: string; chainId: string; symbol: string; platform?: string | null }) {
  const [copied, setCopied] = useState(false);

  const handleCopyCA = async () => {
    try {
      await navigator.clipboard.writeText(ca);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard API unavailable — fail silently
    }
  };

  if (!info) {
    return <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-500 text-sm">Dex loading...</div>;
  }

  // NOTE: `holders` isn't in the FullPairInfo snippet shown — using (info as any).holders
  // as a safe fallback. Add `holders?: number | null` to FullPairInfo and swap this out
  // for `info.holders` once the type/API actually returns it.
  const holders = (info as any).holders as number | null | undefined;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center gap-3">
        {info.imageUrl ? (
          <img src={info.imageUrl} alt={symbol} className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-800 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white truncate">{info.symbol ?? symbol}</span>
            {platform && <PlatformBadge platform={platform} />}
          </div>
          {info.name && <div className="text-xs text-slate-500 truncate">{info.name}</div>}
        </div>
      </div>

      {/* Links */}
      <div className="flex items-center gap-3 text-xs">
        {info.website && <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Website</a>}
        {info.twitter && <a href={info.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">X (Twitter)</a>}
        {info.telegram && <a href={info.telegram} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Telegram</a>}
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:underline ml-auto">Dexscreener ↗</a>
      </div>

      {/* Price + Holders */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="bg-slate-950 rounded-lg py-2 px-3 flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Price</span>
          <span className="text-lg font-extrabold text-white font-mono truncate">{formatPriceShort(info.priceUsd)}</span>
        </div>
        <div className="bg-slate-950 rounded-lg py-2 px-3 flex flex-col justify-center">
          <span className="text-[10px] text-slate-500 uppercase tracking-wide">Holders</span>
          <span className="text-lg font-extrabold text-white font-mono truncate">{formatHolders(holders)}</span>
        </div>
      </div>

      {/* Price change */}
      <div className="grid grid-cols-4 gap-1.5 text-center">
        {(['m5', 'h1', 'h6', 'h24'] as const).map((k) => (
          <div key={k} className="bg-slate-950 rounded-lg py-1.5">
            <div className="text-[10px] text-slate-500 uppercase">{k}</div>
            <div className={`text-xs font-bold ${pctClass(info.priceChange[k])}`}>{pctText(info.priceChange[k])}</div>
          </div>
        ))}
      </div>

      {/* Market Cap / FDV / Liquidity */}
      <div className="grid grid-cols-3 gap-1.5">
        <StatBox label="Market Cap" value={formatCap(info.marketCap)} />
        <StatBox label="FDV" value={formatCap(info.fdv)} />
        <StatBox label="Liquidity" value={formatCap(info.liq)} />
      </div>

      {/* Volume 24h / 6h / 1h */}
      <div className="grid grid-cols-3 gap-1.5">
        <StatBox label="Vol 24h" value={formatCap(info.volume.h24)} />
        <StatBox label="Vol 6h" value={formatCap(info.volume.h6)} />
        <StatBox label="Vol 1h" value={formatCap(info.volume.h1)} />
      </div>

      {/* Remaining rows */}
      <div className="space-y-0.5">
        <StatRow
          label="Buys/Sells 24h"
          value={`${info.txns.h24.buys} / ${info.txns.h24.sells}`}
          valueClass={info.txns.h24.buys >= info.txns.h24.sells ? 'text-green-400' : 'text-red-400'}
        />
        <StatRow label="DEX" value={info.dexId ?? 'N/A'} />
        {info.pairCreatedAt && <StatRow label="Pair Created" value={formatAge(info.pairCreatedAt)} />}
      </div>

      {/* CA - click to copy */}
      <button
        type="button"
        onClick={handleCopyCA}
        className="w-full flex items-center gap-2 pt-1 group cursor-pointer text-left"
        title="Click để copy contract address"
      >
        <span className="text-[11px] text-slate-500 shrink-0">CA:</span>
        <span className="font-mono text-[11px] text-blue-400 break-all group-hover:text-blue-300 transition-colors">
          {ca}
        </span>
        <span className={`text-[10px] shrink-0 ml-auto transition-opacity ${copied ? 'text-green-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100'}`}>
          {copied ? '✓ Copied' : 'Copy'}
        </span>
      </button>
    </div>
  );
}