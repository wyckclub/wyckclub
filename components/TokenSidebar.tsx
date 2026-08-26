'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getCachedDexData } from '@/lib/dexData';
import { ScoreBadge } from '@/components/ScoreBadge';
import { PlatformBadge } from '@/components/PlatformBadge';
import { useRouter, usePathname } from 'next/navigation';
import { useTokenData } from '@/components/TokenDataContext';
import { formatCap, formatAge } from '@/lib/format';
import { BASE_PLATFORMS, ROBINHOOD_PLATFORMS, FILTER_LABELS } from '@/lib/platforms';

type Chain = 'base' | 'robinhood';
type Tab = 'star' | 'all' | 'potential' | 'new';

interface Row {
  ca: string; symbol: string; category: number; score: number; scoreDisplay: string; verified: boolean; platform: string;
}

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill={filled ? '#facc15' : 'none'} stroke={filled ? '#facc15' : 'currentColor'} strokeWidth={1.5} className="w-4 h-4 shrink-0">
      <path d="M12 2.5l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.98l-6.18 3.53L7 14.63l-5-4.87 6.91-1L12 2.5z" />
    </svg>
  );
}

const scrollPositions: Record<string, number> = {};
const lastTab: Record<string, Tab> = {}; // key: chain

export function TokenSidebar({ chain, onSelect }: { chain: Chain; onSelect?: () => void }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeCa = pathname?.split('/').pop();
  const [tab, setTabState] = useState<Tab>(lastTab[chain] ?? 'all');
  const [search, setSearch] = useState('');
  const { tokens, potential, dexTick, loading, watchlist, toggleWatchlist: toggleStar } = useTokenData();
  type SortBy = 'az' | 'score' | 'volume' | 'marketcap' | 'change24h';
  const [sortBy, setSortBy] = useState<SortBy>('volume');
  const [sortMenuOpen, setSortMenuOpen] = useState(false);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const listRef = useRef<HTMLDivElement>(null);

  const platforms = chain === 'robinhood' ? ROBINHOOD_PLATFORMS : BASE_PLATFORMS;

  useEffect(() => {
    setPlatformFilter('all');
  }, [chain]);

  function setTab(t: Tab) {
    lastTab[chain] = t;
    setTabState(t);
  }

  const scrollKey = `${chain}_${tab}`;

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = scrollPositions[scrollKey] ?? 0;
  }, [scrollKey, loading]);

  function handleScroll(e: React.UIEvent<HTMLDivElement>) {
    scrollPositions[scrollKey] = e.currentTarget.scrollTop;
  }

  const rows: Row[] = useMemo(() => {
    if (tab === 'star') {
      return tokens
        .filter((t) => watchlist.has(t.CA))
        .map((t) => ({ ca: t.CA, symbol: t.symbol, category: t.category, score: t.latestScore, scoreDisplay: t.latestScoreDisplay, verified: t.verified, platform: t.platform }));
    }
    if (tab === 'new') {
      const cutoff = Date.now() - 24 * 60 * 60 * 1000;
      return tokens
        .filter((t) => {
          const pairCreatedAt = getCachedDexData(t.CA)?.pairCreatedAt;
          return pairCreatedAt != null && pairCreatedAt >= cutoff;
        })
        .map((t) => ({ ca: t.CA, symbol: t.symbol, category: t.category, score: t.latestScore, scoreDisplay: t.latestScoreDisplay, verified: t.verified, platform: t.platform }));
    }
    if (tab === 'potential') {
      return potential.map((p) => ({ ca: p.ca, symbol: p.symbol, category: p.category, score: p.score, scoreDisplay: p.scoreDisplay, verified: !!p.verified, platform: p.platform ?? 'unknown' }));
    }
    return tokens.map((t) => ({ ca: t.CA, symbol: t.symbol, category: t.category, score: t.latestScore, scoreDisplay: t.latestScoreDisplay, verified: t.verified, platform: t.platform }));
  }, [tab, tokens, potential, watchlist, dexTick]);

    const filteredRows = useMemo(() => {
    const base = [...rows].sort((a, b) => {
        if (sortBy === 'score') return b.score - a.score;
        if (sortBy === 'volume') {
        const va = getCachedDexData(a.ca)?.vol24h ?? -Infinity;
        const vb = getCachedDexData(b.ca)?.vol24h ?? -Infinity;
        return vb - va;
        }
        if (sortBy === 'marketcap') {
        const ma = getCachedDexData(a.ca)?.marketCap ?? -Infinity;
        const mb = getCachedDexData(b.ca)?.marketCap ?? -Infinity;
        return mb - ma;
        }
        if (sortBy === 'change24h') {
        const ca = getCachedDexData(a.ca)?.h24 ?? -Infinity;
        const cb = getCachedDexData(b.ca)?.h24 ?? -Infinity;
        return cb - ca;
        }
        return a.symbol.localeCompare(b.symbol);
    });
    const platformFiltered = platformFilter === 'all' ? base : base.filter((r) => r.platform === platformFilter);
    const q = search.trim().toLowerCase();
    if (!q) return platformFiltered;
    return platformFiltered.filter((r) => {
        const dex = getCachedDexData(r.ca);
        return (
        r.symbol.toLowerCase().includes(q) ||
        r.ca.toLowerCase().includes(q) ||
        (dex?.name ?? '').toLowerCase().includes(q)
        );
    });
    }, [rows, search, dexTick, sortBy, platformFilter]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'star', label: '★' },
    { key: 'all', label: 'All' },
    { key: 'potential', label: 'Potential' },
    { key: 'new', label: 'New' },
  ];
  
  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
          <SearchIcon />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, symbol or CA"
            className="bg-transparent outline-none text-xs text-slate-200 placeholder:text-slate-500 w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-1 px-2 py-2 border-b border-slate-800 shrink-0">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 text-xs font-bold py-1.5 rounded-lg transition-colors ${
              tab === t.key ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="px-2.5 py-1.5 border-b border-slate-800 shrink-0">
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
          className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-[11px] font-semibold text-slate-300 focus:outline-none focus:border-blue-500"
        >
          <option value="all">All platforms</option>
          {platforms.map((p) => (
            <option key={p} value={p}>{FILTER_LABELS[p] ?? p}</option>
          ))}
        </select>
      </div>

        <div className="flex items-center px-2.5 py-1.5 border-b border-slate-800 text-[11px] font-bold text-slate-500 tracking-wide shrink-0 relative">
            <div className="flex-1 pl-9 relative">
                <button
                onClick={() => setSortMenuOpen((v) => !v)}
                className="flex items-center gap-1 hover:text-slate-300"
                >
                Sort by
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-2.5 h-2.5">
                    <path d="m6 9 6 6 6-6" />
                </svg>
                </button>
                {sortMenuOpen && (
                <div className="absolute top-full left-0 mt-1 z-20 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden w-40 normal-case">
                    {([
                      { key: 'az', label: 'A-Z' },
                      { key: 'score', label: 'WYCKSCORE' },
                      { key: 'volume', label: 'Volume' },
                      { key: 'marketcap', label: 'Market Cap' },
                      { key: 'change24h', label: '24h Change' },
                    ] as { key: SortBy; label: string }[]).map((opt) => (
                    <button
                        key={opt.key}
                        onClick={() => { setSortBy(opt.key); setSortMenuOpen(false); }}
                        className={`block w-full text-left px-3 py-2 text-[11px] font-semibold hover:bg-slate-800 ${
                        sortBy === opt.key ? 'text-blue-400' : 'text-slate-300'
                        }`}
                    >
                        {opt.label}
                    </button>
                    ))}
                </div>
                )}
            </div>
            <span className="w-10 text-left text-[10px] leading-tight">
                24h Vol<br />Change
            </span>
            <span className="w-8 text-right">Score</span>
        </div>

      <div className="flex-1 overflow-y-auto" ref={listRef} onScroll={handleScroll}>
        {loading && <p className="text-slate-500 text-xs p-3">Loading...</p>}
        {!loading && filteredRows.length === 0 && (
          <p className="text-slate-500 text-xs p-3">{tab === 'star' ? 'No favorites yet.' : 'No tokens found.'}</p>
        )}
        {filteredRows.map((r) => {
          const dex = getCachedDexData(r.ca);
          const change24h = dex?.h24;
          const isActive = activeCa?.toLowerCase() === r.ca.toLowerCase();
          return (
            <div
              key={r.ca}
                onClick={() => { router.push(`/${chain}/${r.ca}`); onSelect?.(); }}
              className={`flex items-center gap-0.5 px-2 py-1.5 border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/60 ${
                isActive ? 'bg-slate-800' : ''
              }`}
            >
              <button onClick={(e) => { e.stopPropagation(); toggleStar(r.ca); }} className="shrink-0" aria-label="Toggle favorite">
                <StarIcon filled={watchlist.has(r.ca)} />
              </button>

              {dex?.imageUrl ? (
                <img src={dex.imageUrl} alt={r.symbol} className="w-7 h-7 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-slate-800 shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-0.5 min-w-0">
                  <span className="text-[11px] font-bold text-blue-400 truncate flex-1 min-w-0">{r.symbol}</span>
                  <PlatformBadge platform={r.platform} size="sm" />
                </div>
                <div className="text-[11px] text-slate-400 truncate">
                  {dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}
                  {tab === 'new' && dex?.pairCreatedAt != null && ` - Created: ${formatAge(dex.pairCreatedAt)}`}
                </div>
              </div>

              <div className="text-right shrink-0 w-12">
                <div className="text-[11px] font-bold text-slate-400">{dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</div>
                <div className={`text-[10px] font-semibold ${change24h == null ? 'text-slate-500' : change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {change24h == null ? 'N/A' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(0)}%`}
                </div>
              </div>

              <div className="shrink-0 w-8 text-right">
                <ScoreBadge scoreDisplay={r.scoreDisplay} score={r.score} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}