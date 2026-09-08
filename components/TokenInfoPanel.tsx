'use client';

import { useState } from 'react';
import { formatCap, formatPriceShort, formatAge } from '@/lib/format';
import { PlatformBadge } from '@/components/PlatformBadge';
import type { FullPairInfo } from '@/lib/dexData';

function formatWalletShort(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function StatBox({ label, value, valueClass = 'text-slate-100' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-slate-950 rounded-md py-1 px-1 flex flex-col items-center justify-center gap-0">
      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">{label}</span>
      <span className={`text-[11px] font-bold truncate ${valueClass}`}>{value}</span>
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
  info, ca, symbol, platform, holders, wallets,
}: { info: FullPairInfo | null; ca: string; chainId: string; symbol: string; platform?: string | null; holders?: number | null; wallets?: string[] }) {
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
    return <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 text-slate-500 text-xs">Dex loading...</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-2 space-y-1.5">
      {/* Header */}
      <div className="flex items-center gap-2">
        {info.imageUrl ? (
          <img src={info.imageUrl} alt={symbol} className="w-8 h-8 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-slate-800 shrink-0" />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-bold text-slate-100 truncate">{info.symbol ?? symbol}</span>
            {info.name && <span className="text-[11px] text-slate-500 truncate">{info.name}</span>}
            {platform && <PlatformBadge platform={platform} size="sm" />}
          </div>
        </div>
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 hover:underline shrink-0">
          Dex ↗
        </a>
      </div>

      {/* Links (only if present) */}
      {(info.website || info.twitter || info.telegram) && (
        <div className="flex items-center gap-2 text-[10px]">
          {info.website && <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Website</a>}
          {info.twitter && <a href={info.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">X</a>}
          {info.telegram && <a href={info.telegram} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Telegram</a>}
        </div>
      )}

      {/* Price + Holders */}
      <div className="grid grid-cols-2 gap-1">
        <div className="bg-slate-950 rounded-md py-1 px-2 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Price</span>
          <span className="text-sm font-extrabold text-slate-100 font-mono truncate">{formatPriceShort(info.priceUsd)}</span>
        </div>
        <div className="bg-slate-950 rounded-md py-1 px-2 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Holders</span>
          <span className="text-sm font-extrabold text-slate-100 font-mono truncate">{formatHolders(holders)}</span>
        </div>
      </div>

      {/* m5 / h1 / h6 / h24 - all 4 in ONE row */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {(['m5', 'h1', 'h6', 'h24'] as const).map((k) => (
          <div key={k} className="bg-slate-950 rounded-md py-1">
            <div className="text-[9px] font-bold text-slate-500 uppercase">{k}</div>
            <div className={`text-[11px] font-bold ${pctClass(info.priceChange[k])}`}>{pctText(info.priceChange[k])}</div>
          </div>
        ))}
      </div>

      {/* Market Cap / FDV / Liquidity */}
      <div className="grid grid-cols-3 gap-1">
        <StatBox label="MCap" value={formatCap(info.marketCap)} />
        <StatBox label="FDV" value={formatCap(info.fdv)} />
        <StatBox label="Liq" value={formatCap(info.liq)} />
      </div>

      {/* Volume 24h / 6h / 1h */}
      <div className="grid grid-cols-3 gap-1">
        <StatBox label="Vol24h" value={formatCap(info.volume.h24)} />
        <StatBox label="Vol6h" value={formatCap(info.volume.h6)} />
        <StatBox label="Vol1h" value={formatCap(info.volume.h1)} />
      </div>

      {/* Buys/Sells, DEX, Pair Created */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 py-0.5 border-t border-slate-800/60">
        <span className={info.txns.h24.buys >= info.txns.h24.sells ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
          {info.txns.h24.buys}/{info.txns.h24.sells} txns
        </span>
        <span>{info.dexId ?? 'N/A'}</span>
        {info.pairCreatedAt && <span>{formatAge(info.pairCreatedAt)} old</span>}
      </div>

      {/* CA - click to copy */}
      <button
        type="button"
        onClick={handleCopyCA}
        className="w-full flex items-center gap-1.5 group cursor-pointer text-left"
        title="Click để copy contract address"
      >
        <span className="text-[10px] text-slate-500 shrink-0">CA:</span>
        <span className="font-mono text-[10px] text-blue-400 break-all group-hover:text-blue-300 transition-colors">
          {ca}
        </span>
        <span className={`text-[9px] shrink-0 ml-auto transition-opacity ${copied ? 'text-green-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100'}`}>
          {copied ? '✓' : 'Copy'}
        </span>
      </button>

      {wallets && wallets.length > 0 && (
        <div className="pt-1 border-t border-slate-800/60">
          <div className="flex flex-wrap items-center gap-1 text-[10px] font-mono">
            <span className="text-slate-500 shrink-0">Dev:</span>
            {wallets.map((w, i) => (
              <span key={w} className="flex items-center gap-1">
                <a
                  href={`https://app.zerion.io/${w}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 hover:underline"
                >
                  {formatWalletShort(w)}
                </a>
                {i < wallets.length - 1 && <span className="text-slate-700">|</span>}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}