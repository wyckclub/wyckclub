'use client';

import { useEffect, useState } from 'react';
import { useTokenGate, PRO_THRESHOLD } from '@/lib/tokenGate';
import { prefetchDexDataBatch, getCachedDexData } from '@/lib/dexData';
import { formatCap } from '@/lib/format';
import { ScoreBadge } from '@/components/ScoreBadge';
import { HistoryStrip } from '@/components/HistoryStrip';
import { PriceChartModal } from '@/components/PriceChartModal';
import { fetchAllCategories, TokenEntry, CATEGORY_LABELS } from '@/lib/tokenApi';
import { BuyTokenPrompt } from '@/components/BuyTokenPrompt';

type SortCol = 'marketCap' | 'liq' | 'vol24h' | 'score' | 'change24h' | 'snapshot' | null;

export default function ProPlanPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(PRO_THRESHOLD);
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadingData, setLoadingData] = useState(false);
  const [dexReady, setDexReady] = useState(false);
  const [sortCol, setSortCol] = useState<SortCol>('marketCap');
  const [sortDir, setSortDir] = useState<1 | -1>(-1);
  const [chartToken, setChartToken] = useState<{ category: number; ca: string; symbol: string } | null>(null);
  const [search, setSearch] = useState('');
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<number | 'all'>('all');

  useEffect(() => {
    const saved = localStorage.getItem('wyck_watchlist');
    if (saved) setWatchlist(new Set(JSON.parse(saved)));
  }, []);

  function toggleWatchlist(ca: string) {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(ca)) next.delete(ca);
      else next.add(ca);
      localStorage.setItem('wyck_watchlist', JSON.stringify([...next]));
      return next;
    });
  }

  function loadData() {
    if (!hasAccess) return;
    setLoadingData(true);
    setLoadError('');
    setDexReady(false);
    fetchAllCategories()
      .then(async (data) => {
        setTokens(data);
        await prefetchDexDataBatch(data.map((t) => t.CA));
        setDexReady(true);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoadingData(false));
  }

  useEffect(() => {
    loadData();
  }, [hasAccess]);

  if (!isConnected) return <GateMessage title="Connect your wallet" message="Connect your wallet to check Pro Plan access." />;
  if (isLoading) return <GateMessage title="Checking balance..." message="" />;
  if (!hasAccess) {
    return (
      <GateMessage
        title="PRO Plan Locked"
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

  const categoryFiltered = categoryFilter === 'all' ? tokens : tokens.filter((t) => t.category === categoryFilter);

  const filteredTokens = search.trim()
    ? categoryFiltered.filter((t) => {
        const q = search.trim().toLowerCase();
        return t.symbol.toLowerCase().includes(q) || t.CA.toLowerCase().includes(q);
      })
    : categoryFiltered;

  const baseSorted = sortCol
    ? [...filteredTokens].sort((a, b) => (getSortValue(a, sortCol) - getSortValue(b, sortCol)) * sortDir)
    : filteredTokens;

  const sortedTokens = [
    ...baseSorted.filter((t) => watchlist.has(t.CA)),
    ...baseSorted.filter((t) => !watchlist.has(t.CA)),
  ];

  const headers: { col: SortCol; label: string }[] = [
    { col: 'marketCap', label: 'Market Cap' },
    { col: 'liq', label: 'Liquidity' },
    { col: 'vol24h', label: 'Vol 24h' },
    { col: 'score', label: 'WYCKSCORE' },
    { col: 'change24h', label: 'Change 24h' },
    { col: 'snapshot', label: 'Snapshot Change' },
  ];

  return (
    <div className="w-full px-4 py-6">
      <h2 className="text-2xl font-bold text-blue-400 mb-4">Pro Plan - WYCKSCORE Token Tracker</h2>
      <div className="flex items-center gap-3 mb-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search token symbol or CA 0x..."
          className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
        />
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-500"
        >
          <option value="all">All tokens</option>
          <option value={1}>Clanker & Bankr</option>
          <option value={2}>Other Base</option>
          <option value={3}>Virtuals</option>
          <option value={4}>New tokens</option>
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
      {loadError && <p className="text-red-400">{loadError}</p>}
      {!loadingData && !loadError && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-blue-400">
                <th className="text-left p-3 whitespace-nowrap">Token</th>
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
                <th className="text-left p-3 whitespace-nowrap">Latest entries</th>
                <th className="text-left p-3 whitespace-nowrap">Category</th>
                <th className="text-left p-3 whitespace-nowrap">Watchlist</th>
              </tr>
            </thead>
            <tbody>
              {sortedTokens.map((t) => {
                const dex = dexReady ? getCachedDexData(t.CA) : null;
                const change24h = dex?.h24;
                const snapshot =
                  dex?.priceUsd != null && t.latestPrice
                    ? ((dex.priceUsd - t.latestPrice) / t.latestPrice) * 100
                    : null;

                return (
                  <tr key={t.CA} className="border-t border-slate-800">
                    <td
                      className="p-3 font-semibold whitespace-nowrap cursor-pointer text-blue-400 hover:text-blue-300 underline decoration-dotted"
                      onClick={() => setChartToken({ category: t.category, ca: t.CA, symbol: t.symbol })}
                    >
                      {t.symbol}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <a
                        href={`https://dexscreener.com/base/${t.CA}`}
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
                    <td className="p-3">
                      <HistoryStrip last7={t.last7} />
                    </td>
                    <td className="p-3 whitespace-nowrap text-slate-400 text-xs">
                      {CATEGORY_LABELS[t.category] ?? t.category}
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
      )}
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