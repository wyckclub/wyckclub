'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { PriceChartModal } from '@/components/PriceChartModal';
import { prefetchDexDataBatch, getCachedDexData } from '@/lib/dexData';
import { formatCap, formatPriceShort } from '@/lib/format';
import { VerifyBadge } from '@/components/VerifyBadge';

type Chain = 'base' | 'robinhood';

interface Notification {
  id: string;
  ca: string;
  symbol: string;
  category: number;
  level: 'inflow' | 'medium' | 'strong' | 'super';
  levelLabel: string;
  current: string;
  previous: string;
  message: string;
  timestamp: string;
  top10: number | null;
  prevTop10: number | null;
  verified: boolean | null;
}

const LEVEL_STYLE: Record<Notification['level'], string> = {
  inflow: 'border-slate-500/10 text-slate-300/30 bg-slate-800/10',
  medium: 'border-yellow-400/10 text-yellow-400/50 bg-yellow-500/10',
  strong: 'border-green-300/30 text-green-400/70 bg-green-300/10',
  super: 'border-green-600/50 text-green-500 bg-green-500/30',
};

function relativeTime(ts: string) {
  const diffMs = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return remHours > 0 ? `${days}d ${remHours}h ago` : `${days}d ago`;
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-3.9" />
      <path d="m8.6 13.5 6.8 3.9" />
    </svg>
  );
}

function BaseIcon() {
  return (
    <svg viewBox="0 0 400 400" className="w-6 h-6 rounded-[5px] overflow-hidden">
      <rect width="400" height="400" fill="#FFFFFF" />
      <rect x="80" y="80" width="240" height="240" rx="28" ry="28" fill="#0052FF" />
    </svg>
  );
}

function RobinhoodIcon() {
  return (
    <svg viewBox="0 0 400 400" className="w-6 h-6 rounded-[5px] overflow-hidden">
      <rect width="400" height="400" fill="#ccff00" />
      <g fill="#211d19">
        <path d="M 185 133.5 
                 L 170.5 148 
                 C 142 176.5, 131 220, 131 245 
                 C 131 260, 120 300, 106 321 
                 L 115 321 
                 C 137 280, 149 220, 172 172 
                 Z" />
        <path d="M 249 80 
                 C 275 80, 294 100, 294 130 
                 C 294 150, 280 178, 252 206 
                 L 252 145 
                 L 237 130 
                 L 185 122 
                 Z" />
        <path d="M 238 145 
                 L 238 215 
                 L 150 272 
                 C 175 235, 205 185, 238 145 
                 Z" />
      </g>
    </svg>
  );
}

function ChainSelector({ chain }: { chain: Chain }) {
  return (
    <div className="flex items-center gap-2 mb-6">
      <Link
        href="/whale-hub"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-colors ${
          chain === 'base'
            ? 'border-blue-500 bg-blue-500/10 text-blue-300'
            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
        }`}
      >
        <BaseIcon />
        Base
      </Link>
      <Link
        href="/whale-hub/robinhood"
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold transition-colors ${
          chain === 'robinhood'
            ? 'border-[#ccff00] bg-[#ccff00]/10 text-[#ccff00]'
            : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
        }`}
      >
        <RobinhoodIcon />
        Robinhood
      </Link>
    </div>
  );
}

function buildShareText(n: Notification, dex: ReturnType<typeof getCachedDexData>, chain: Chain) {
  const symbol = dex?.symbol ?? n.symbol;
  const nameTag = dex?.name ? ` (${dex.name})` : '';
  const price = dex?.priceUsd == null ? 'N/A' : formatPriceShort(dex.priceUsd);
  const cap = dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap);
  const twitterPart = dex?.twitter ? `@${dex.twitter} - ` : '';
  const networkLabel = chain === 'robinhood' ? '#Robinhood' : '#Based';

  const whaleLine =
    n.top10 != null && n.prevTop10 != null && n.top10 !== n.prevTop10
      ? `\n🐋Whale Accumulation Index: ${n.top10 - n.prevTop10 > 0 ? '+' : ''}${n.top10 - n.prevTop10} (${n.prevTop10}→${n.top10})`
      : '';

  const verifyLine =
    chain === 'robinhood' && n.verified != null
      ? `\n${n.verified ? '✅ Verify' : '❌ Not Verify'}`
      : '';

  return `$${symbol}${nameTag} just triggered a SmartMoney signal on ${networkLabel}:

👉WyckScore: ${n.levelLabel} ${n.current}${whaleLine}${verifyLine}

${twitterPart}At Price: ${price} - MaketCap: ${cap}
CA: ${n.ca}
Powered by wyck.pro/whale-hub`;
}

function handleShare(n: Notification, dex: ReturnType<typeof getCachedDexData>, chain: Chain) {
  const text = buildShareText(n, dex, chain);
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

function getEmphasisStyle(n: Notification): string {
  const styles: Record<Notification['level'], string> = {
    inflow: 'border-slate-400/0 bg-slate-500/20 text-slate-200',
    medium: 'border-yellow-400/0 bg-yellow-500/20 text-yellow-300/60',
    strong: 'border-green-400/0 bg-green-400/20 text-green-300',
    super: 'border-green-500/0 bg-green-600/30 text-green-400',
  };
  return styles[n.level];
}

function dayLabel(ts: string) {
  return new Date(ts).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function timeLabel(ts: string) {
  return (
    new Date(ts).toLocaleTimeString('en-US', {
      timeZone: 'UTC',
      hour: '2-digit',
      minute: '2-digit',
    }) + ' UTC'
  );
}

function renderMessage(n: Notification) {
  const emphasis = getEmphasisStyle(n);
  const target = `${n.levelLabel} ${n.current}`;
  const idx = n.message.indexOf(target);

  if (idx === -1) return n.message;

  const before = n.message.slice(0, idx);
  const after = n.message.slice(idx + target.length);

  return (
    <>
      {before}
      <span className={`inline-flex items-center px-1.5 py-0.5 rounded border mx-0.5 ${emphasis}`}>
        {target}
      </span>
      {after}
    </>
  );
}

export function WhaleHubView({ chain }: { chain: Chain }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartToken, setChartToken] = useState<{ category: number; ca: string; symbol: string } | null>(null);
  const [dexTick, setDexTick] = useState(0);

  function load() {
    setLoading(true);
    fetch(`/api/whale-hub?chain=${chain}`)
      .then((r) => r.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 300000);
    return () => clearInterval(id);
  }, [chain]);

  useEffect(() => {
    if (!notifications.length) return;
    prefetchDexDataBatch(notifications.map((n) => n.ca), () => setDexTick((v) => v + 1), chain);
  }, [notifications, chain]);

  const groups = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const key = dayLabel(n.timestamp);
    (acc[key] ||= []).push(n);
    return acc;
  }, {});

  return (
    <div className="w-full px-4 py-6 max-w-3xl mx-auto">
      <ChainSelector chain={chain} />
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-400">
          Whale Hub {chain === 'robinhood' ? '· Robinhood' : '· Base'}
        </h2>
        <button
          onClick={load}
          disabled={loading}
          className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300 hover:border-blue-500 disabled:opacity-50"
        >
          {loading ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>
      {error && <p className="text-red-400">{error}</p>}
      {!loading && notifications.length === 0 && <p className="text-slate-400">No SmartMoney signals yet.</p>}

      <div className="space-y-8">
        {Object.entries(groups).map(([day, items]) => (
          <div key={day}>
            <div className="mb-3">
              <span className="text-xs font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-1 rounded">
                {day}
              </span>
            </div>
            <div className="space-y-3 border-l border-slate-800 pl-4">
            {items.map((n) => {
              const dex = getCachedDexData(n.ca);
              const change24h = dex?.h24;

              return (
              <div key={n.id} className={`rounded-lg border p-3 ${LEVEL_STYLE[n.level]}`}>
                <div className="flex items-start gap-3">
                  <div className="shrink-0 pt-0.5 flex flex-col items-center gap-1.5">
                    <img
                      src={`https://dd.dexscreener.com/ds-data/tokens/${chain}/${n.ca}.png`}
                      alt={n.symbol}
                      className="w-9 h-9 rounded-full object-cover border border-slate-700/50 bg-slate-800"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                    <button
                      onClick={() => setChartToken({ category: n.category, ca: n.ca, symbol: n.symbol })}
                      className="text-[12px] px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 whitespace-nowrap"
                    >
                      View Chart
                    </button>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center justify-between gap-y-1 mb-1">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${LEVEL_STYLE[n.level]}`}>
                        {n.symbol}
                        </span>
                        {chain === 'robinhood' && n.verified != null && (
                        <VerifyBadge verified={n.verified} className="w-5 h-5" />
                        )}
                        <span className="text-xs font-bold uppercase tracking-wide">{n.levelLabel} SmartMoney</span>
                    </div>
                      
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-[10px] opacity-70 flex items-center gap-2">
                          {timeLabel(n.timestamp)}
                          <button
                            onClick={() => handleShare(n, dex, chain)}
                            className="text-slate-400 hover:text-blue-400"
                            aria-label="Share"
                          >
                            <ShareIcon />
                          </button>
                        </span>
                        <span className="text-[10px] font-bold opacity-90">{relativeTime(n.timestamp)}</span>
                      </div>

                    </div>

                    <p className="text-sm text-slate-100">{renderMessage(n)}</p>
                    {n.top10 != null && n.prevTop10 != null && n.top10 !== n.prevTop10 && (() => {
                      const diff = n.top10 - n.prevTop10;
                      const isUp = diff > 0;
                      return (
                        <p className={`text-xs mt-0.5 ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                          Whale Accumulation Index: {isUp ? '+' : ''}{diff} ({n.prevTop10}→{n.top10})
                        </p>
                      );
                    })()}

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <a
                        href={`https://dexscreener.com/${chain}/${n.ca}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] font-mono text-blue-400 hover:underline"
                      >
                        Dexscreener ↗
                      </a>
                      <span className="text-[11px] text-slate-400">
                        MC: {dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Vol 24h: {dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}
                      </span>
                      <span
                        className={`text-[11px] ${
                          change24h == null ? 'text-slate-400' : change24h >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        24h: {change24h == null ? 'N/A' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
            </div>
          </div>
        ))}
      </div>

      {chartToken && (
        <PriceChartModal
          category={chartToken.category}
          ca={chartToken.ca}
          symbol={chartToken.symbol}
          onClose={() => setChartToken(null)}
          chainId={chain}
        />
      )}
    </div>
  );
}