'use client';

import { useEffect, useState } from 'react';
import { PriceChartModal } from '@/components/PriceChartModal';
import { prefetchDexDataBatch, getCachedDexData } from '@/lib/dexData';
import { formatCap } from '@/lib/format';

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
}

const LEVEL_STYLE: Record<Notification['level'], string> = {
  inflow: 'border-slate-500/10 text-slate-300/30 bg-slate-800/10',
  medium: 'border-yellow-400/10 text-yellow-400/50 bg-yellow-500/10',
  strong: 'border-green-300/30 text-green-400/70 bg-green-300/10',
  super: 'border-green-600/50 text-green-500 bg-green-500/30',
};

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

export default function WhaleHubPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartToken, setChartToken] = useState<{ category: number; ca: string; symbol: string } | null>(null);
  const [dexTick, setDexTick] = useState(0);

  function load() {
    setLoading(true);
    fetch('/api/whale-hub')
      .then((r) => r.json())
      .then((data) => setNotifications(Array.isArray(data) ? data : []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 300000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!notifications.length) return;
    prefetchDexDataBatch(notifications.map((n) => n.ca)).then(() => setDexTick((v) => v + 1));
  }, [notifications]);

  const groups = notifications.reduce<Record<string, Notification[]>>((acc, n) => {
    const key = dayLabel(n.timestamp);
    (acc[key] ||= []).push(n);
    return acc;
  }, {});

  return (
    <div className="w-full px-4 py-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-blue-400">Whale Hub</h2>
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
                      src={`https://dd.dexscreener.com/ds-data/tokens/base/${n.ca}.png`}
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
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider border ${LEVEL_STYLE[n.level]}`}>
                          {n.symbol}
                        </span>
                        <span className="text-xs font-bold uppercase tracking-wide">{n.levelLabel} SmartMoney</span>
                      </div>
                      <span className="text-[10px] opacity-70">{timeLabel(n.timestamp)}</span>
                    </div>

                    <p className="text-sm text-slate-100">{renderMessage(n)}</p>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                      <a
                        href={`https://dexscreener.com/base/${n.ca}`}
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
        />
      )}
    </div>
  );
}