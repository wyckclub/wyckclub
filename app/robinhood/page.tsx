'use client';

import { useEffect, useState } from 'react';
import { useTokenGate, PRO_THRESHOLD } from '@/lib/tokenGate';
import { getCachedDexData } from '@/lib/dexData';
import { formatCap } from '@/lib/format';
import { ScoreBadge } from '@/components/ScoreBadge';
import { PlatformBadge } from '@/components/PlatformBadge';
import { PriceChartModal } from '@/components/PriceChartModal';
import { TokenEntry } from '@/lib/tokenApi';
import { ROBINHOOD_PLATFORMS, PLATFORM_LABELS } from '@/lib/platforms';
import { BuyTokenPrompt } from '@/components/BuyTokenPrompt';
import { useTokenData } from '@/components/TokenDataContext';
import Link from 'next/link';

type SortCol = 'marketCap' | 'liq' | 'vol24h' | 'score' | 'change24h' | 'snapshot' | null;

export default function RobinhoodTrackerPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(PRO_THRESHOLD);
  const { tokens, loading: loadingData, dexReady, refresh: loadData, watchlist, toggleWatchlist } = useTokenData();
  const [sortCol, setSortCol] = useState<SortCol>('snapshot');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [search, setSearch] = useState('');
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const PAGE_SIZE = 200;
  const [page, setPage] = useState(1);
  const [chartToken, setChartToken] = useState<{ category: number; ca: string; symbol: string; verified: boolean } | null>(null);

  useEffect(() => {
    setPage(1);
  }, [search, platformFilter, sortCol, sortDir]);

  if (!isConnected) return <GateMessage title="Connect your wallet" message="Connect your wallet to check Robinhood Tracker access." />;
  if (isLoading) return <GateMessage title="Checking balance..." message="" />;
  if (!hasAccess) {
    return (
      <GateMessage
        title="Robinhood Tracker Locked"
        message={`You need at least ${PRO_THRESHOLD.toLocaleString()} tokens. Your balance: ${amount.toLocaleString()}.`}
        showBuyPrompt
      />
    );
  }

  function getSortValue(t: TokenEntry, col: SortCol): number {
    if (col === 'marketCap') {
      const d = getCachedDexData(t.CA);
      return d?.marketCap ?? -Infinity;
    }
    if (col === 'score') return t.latestScore ?? -Infinity;
    const d = getCachedDexData(t.CA);
    if (col === 'change24h') return d?.h24 ?? -Infinity;
    if (col === 'vol24h') return d?.vol24h ?? -Infinity;
    if (col === 'liq') return d?.liq ?? -Infinity;
    if (col === 'snapshot') {
      if (d?.priceUsd == null || !t.latestPrice) return -Infinity;
      return (d.priceUsd - t.latestPrice) / t.latestPrice;
    }
    return 0;
  }

  function handleSort(col: SortCol) {
    setSortDir(sortCol === col ? (sortDir === 1 ? -1 : 1) : 1);
    setSortCol(col);
  }

  const platformFiltered = platformFilter === 'all' ? tokens : tokens.filter((t) => t.platform === platformFilter);

  const filteredTokens = search.trim()
    ? platformFiltered.filter((t) => {
        const q = search.trim().toLowerCase();
        return t.symbol.toLowerCase().includes(q) || t.CA.toLowerCase().includes(q);
      })
    : platformFiltered;

  const liqFilteredTokens = dexReady
    ? filteredTokens.filter((t) => {
        const liq = getCachedDexData(t.CA)?.liq;
        return liq == null || liq >= 20000;
      })
    : filteredTokens;

  const baseSorted = sortCol
    ? [...liqFilteredTokens].sort((a, b) => (getSortValue(a, sortCol) - getSortValue(b, sortCol)) * sortDir)
    : liqFilteredTokens;

  const sortedTokens = baseSorted;

  const totalPages = Math.max(1, Math.ceil(sortedTokens.length / PAGE_SIZE));
  const pagedTokens = sortedTokens.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const headers: { col: SortCol; label: string }[] = [
    { col: 'marketCap', label: 'Market Cap' },
    { col: 'liq', label: 'Liquidity' },
    { col: 'vol24h', label: 'Vol 24h' },
    { col: 'score', label: 'WYCKSCORE' },
    { col: 'change24h', label: 'Change 24h' },
    { col: 'snapshot', label: 'Snapshot Change' },
  ];

  return (
    <div className="flex-1 min-w-0 h-full overflow-y-auto px-4 py-3">
      <h2 className="text-2xl font-bold text-blue-400 mb-4">WYCK Robinhood Tracker</h2>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search token symbol or CA 0x..."
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All platforms</option>
          {ROBINHOOD_PLATFORMS.map((p) => (
            <option key={p} value={p}>{PLATFORM_LABELS[p] ?? p}</option>
          ))}
        </select>
        <button
          onClick={loadData}
          disabled={loadingData}
          className="px-3 py-2 text-sm rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {loadingData ? 'Loading...' : '↻ Refresh'}
        </button>
      </div>
      {loadingData && <p className="text-slate-400">Loading data...</p>}
      {!loadingData && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900 text-blue-400">
                  <th className="text-left p-3 whitespace-nowrap"></th>
                  <th className="text-left p-3 whitespace-nowrap">Token</th>
                  <th className="text-left p-3 whitespace-nowrap">Platform</th>
                  <th className="text-left p-3 whitespace-nowrap">CA</th>
                  {headers.map((h) => (
                    <th
                      key={h.col}
                      onClick={() => handleSort(h.col)}
                      className={`text-left p-3 whitespace-nowrap cursor-pointer select-none ${
                        sortCol === h.col ? 'text-white' : ''
                      }`}
                    >
                      {h.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedTokens.map((t) => {
                  const dex = getCachedDexData(t.CA);
                  const change24h = dex?.h24;
                  const snapshot =
                    dex?.priceUsd != null && t.latestPrice
                      ? ((dex.priceUsd - t.latestPrice) / t.latestPrice) * 100
                      : null;

                  return (
                    <tr key={t.CA} className="border-t border-slate-800">
                      <td className="p-3">
                        {dex?.imageUrl ? (
                          <img src={dex.imageUrl} alt={t.symbol} className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-slate-800" />
                        )}
                      </td>
                      <td className="p-3 font-semibold whitespace-nowrap">
                        <Link href={`/robinhood/${t.CA}`} className="text-blue-400 hover:text-blue-300">
                          <div className="underline decoration-dotted">{t.symbol}</div>
                          {dex?.name && <div className="text-[12px] font-normal text-slate-500 no-underline">{dex.name}</div>}
                        </Link>
                      </td>
                      <td className="p-3">
                        <PlatformBadge platform={t.platform} />
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <a
                          href={`https://dexscreener.com/robinhood/${t.CA}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs text-blue-400 hover:underline"
                        >
                          {t.CA.slice(0, 6)}...{t.CA.slice(-4)}
                        </a>
                      </td>
                      <td className="p-3 whitespace-nowrap">{dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}</td>
                      <td className="p-3 whitespace-nowrap">{dex?.liq == null ? 'N/A' : formatCap(dex.liq)}</td>
                      <td className="p-3 whitespace-nowrap">{dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</td>
                      <td className="p-3 whitespace-nowrap">
                        <ScoreBadge scoreDisplay={t.latestScoreDisplay} score={t.latestScore} />
                      </td>
                      <td
                        className={`p-3 whitespace-nowrap ${
                          change24h == null ? 'text-slate-500' : change24h >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {change24h == null ? 'N/A' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
                      </td>
                      <td
                        className={`p-3 whitespace-nowrap ${
                          snapshot == null ? 'text-slate-500' : snapshot >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}
                      >
                        {snapshot == null ? 'N/A' : `${snapshot >= 0 ? '+' : ''}${snapshot.toFixed(0)}%`}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <button
                          onClick={() => toggleWatchlist(t.CA)}
                          className={`text-lg ${watchlist.has(t.CA) ? 'text-yellow-400' : 'text-slate-600 hover:text-slate-400'}`}
                          aria-label="Toggle watchlist"
                        >
                          ★
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-slate-400">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
      {chartToken && (
        <PriceChartModal
          category={chartToken.category}
          ca={chartToken.ca}
          symbol={chartToken.symbol}
          onClose={() => setChartToken(null)}
          chainId="robinhood"
          verified={chartToken.verified}
        />
      )}
    </div>
  );
}

function GateMessage({ title, message, showBuyPrompt }: { title: string; message: string; showBuyPrompt?: boolean }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-bold text-blue-400">{title}</h1>
        <p className="text-slate-400">{message}</p>
        {showBuyPrompt && <BuyTokenPrompt />}
      </div>
    </div>
  );
}