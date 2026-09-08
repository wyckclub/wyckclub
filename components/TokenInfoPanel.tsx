'use client';

import { useState } from 'react';
import { formatCap, formatPriceShort, formatAge } from '@/lib/format';
import { PlatformBadge } from '@/components/PlatformBadge';
import type { FullPairInfo } from '@/lib/dexData';

function formatWalletShort(addr: string) {
  return `${addr.slice(0, 4)}...${addr.slice(-4)}`;
}

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M21.9 4.3 2.7 11.6c-1.3.5-1.3 1.2-.2 1.6l4.9 1.5 1.9 5.8c.2.6.4.8.9.8.4 0 .6-.2.9-.5l2.2-2.1 4.6 3.4c.8.5 1.4.2 1.6-.8L23.9 5.6c.3-1.2-.5-1.8-1.9-1.3z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M18.9 2H22l-7.6 8.7L23.3 22H16.7l-5.2-6.8L5.6 22H2.5l8.1-9.3L1.7 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45q-1.24.21-2.7.34-.31 1.83-.97 3.1M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.48-1.52a7 7 0 0 1-.96 0H7.5a4 4 0 0 1-.84-1.32q-.38-.89-.63-2.08a40 40 0 0 0 3.92 0q-.25 1.2-.63 2.08a4 4 0 0 1-.84 1.31zm2.94-4.76q1.66-.15 2.95-.43a7 7 0 0 0 0-2.58q-1.3-.27-2.95-.43a18 18 0 0 1 0 3.44m-1.27-3.54a17 17 0 0 1 0 3.64 39 39 0 0 1-4.3 0 17 17 0 0 1 0-3.64 39 39 0 0 1 4.3 0m1.1-1.17q1.45.13 2.69.34a6.5 6.5 0 0 0-3.67-3.44q.65 1.26.98 3.1M8.48 1.5l.01.02q.41.37.84 1.31.38.89.63 2.08a40 40 0 0 0-3.92 0q.25-1.2.63-2.08a4 4 0 0 1 .85-1.32 7 7 0 0 1 .96 0m-2.75.4a6.5 6.5 0 0 0-3.67 3.44 29 29 0 0 1 2.7-.34q.31-1.83.97-3.1M4.58 6.28q-1.66.16-2.95.43a7 7 0 0 0 0 2.58q1.3.27 2.95.43a18 18 0 0 1 0-3.44m.17 4.71q-1.45-.12-2.69-.34a6.5 6.5 0 0 0 3.67 3.44q-.65-1.27-.98-3.1"/>
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M20.3 4.4A19.8 19.8 0 0 0 15.5 3l-.3.6a14.3 14.3 0 0 1 4 1.6 15.6 15.6 0 0 0-13.9 0 14 14 0 0 1 4-1.6L9 3a19.7 19.7 0 0 0-4.8 1.4C1.5 8.8.8 13 1.1 17.2a20 20 0 0 0 6 3l.8-1.3a13 13 0 0 1-2-1c.2-.1.3-.2.5-.3a14.3 14.3 0 0 0 12.1 0l.5.3a13 13 0 0 1-2 1l.8 1.3a19.9 19.9 0 0 0 6-3c.4-4.8-.8-9-3.5-12.8ZM8.7 14.7c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2c1 0 1.8.9 1.7 2 0 1.1-.7 2-1.7 2Zm6.6 0c-.9 0-1.7-.9-1.7-2s.7-2 1.7-2c1 0 1.8.9 1.7 2 0 1.1-.7 2-1.7 2Z"/>
    </svg>
  );
}

function StatBox({ label, value, valueClass = 'text-slate-100' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="bg-[oklch(0.24_0.05_272.36)] rounded-md py-1 px-1 flex flex-col items-center justify-center gap-0">
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
            <span className="text-m font-bold text-slate-200 truncate">{info.symbol ?? symbol}</span>
            {info.name && <span className="text-[12px] font-bold text-slate-500 truncate">{info.name}</span>}
            {platform && <PlatformBadge platform={platform} size="sm" />}
          </div>
        </div>
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-slate-400 hover:underline shrink-0">
          Dex ↗
        </a>
      </div>

      {/* Links (only if present) */}
      {(info.website || info.twitter || info.telegram || info.discord) && (
        <div className="flex items-center gap-4 text-[12px]">
          {info.website && (
            <a href={info.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-slate-500 font-bold hover:underline">
              <WebsiteIcon /> Website
            </a>
          )}
          {info.twitter && (
            <a href={info.twitter} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-slate-500 font-bold hover:underline">
              <XIcon /> Twitter
            </a>
          )}
          {info.telegram && (
            <a href={info.telegram} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-slate-500 font-bold hover:underline">
              <TelegramIcon /> Telegram
            </a>
          )}
          {info.discord && (
            <a href={info.discord} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-slate-500 font-bold hover:underline">
              <DiscordIcon /> Discord
            </a>
          )}
        </div>
      )}

      {/* Price + Holders */}
      <div className="grid grid-cols-2 gap-1">
        <div className="bg-[oklch(0.18_0.05_268.11)] rounded-md py-1 px-2 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Price</span>
          <span className="text-sm font-extrabold text-slate-300 font-mono truncate">{formatPriceShort(info.priceUsd)}</span>
        </div>
        <div className="bg-[oklch(0.18_0.05_268.11)] rounded-md py-1 px-2 flex flex-col justify-center">
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">Holders</span>
          <span className="text-sm font-extrabold text-slate-300 font-mono truncate">{formatHolders(holders)}</span>
        </div>
      </div>

      {/* m5 / h1 / h6 / h24 - all 4 in ONE row */}
      <div className="grid grid-cols-4 gap-1 text-center">
        {(['m5', 'h1', 'h6', 'h24'] as const).map((k) => (
          <div key={k} className="bg-[oklch(0.18_0.05_268.11)] rounded-md py-1">
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
      <div className="flex items-center justify-between text-[14px] text-slate-400 py-0.5 border-t border-slate-800/60">
        <span className={info.txns.h24.buys >= info.txns.h24.sells ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
          {info.txns.h24.buys} / {info.txns.h24.sells} txns
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
        <span className="text-[12px] text-slate-500 shrink-0">CA:</span>
        <span className="font-mono text-[11px] text-blue-400 break-all group-hover:text-blue-300 transition-colors">
          {ca}
        </span>
        <span className={`text-[11px] shrink-0 ml-auto transition-opacity ${copied ? 'text-green-400 opacity-100' : 'text-slate-500 opacity-0 group-hover:opacity-100'}`}>
          {copied ? '✓' : 'Copy'}
        </span>
      </button>

      {wallets && wallets.length > 0 && (
        <div className="pt-1 border-t border-slate-800/60">
          <div className="flex flex-wrap items-center gap-1 text-[12px] font-mono">
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