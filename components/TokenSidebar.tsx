'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchAllCategories, fetchRobinhoodTokens, fetchRobinhoodNewTokens, TokenEntry } from '@/lib/tokenApi';
import { prefetchDexDataBatch, getCachedDexData } from '@/lib/dexData';
import { formatCap } from '@/lib/format';
import { ScoreBadge } from '@/components/ScoreBadge';
import { useRouter, usePathname } from 'next/navigation';

type Chain = 'base' | 'robinhood';
type Tab = 'star' | 'all' | 'potential' | 'new';

interface Row {
  ca: string; symbol: string; category: number; score: number; scoreDisplay: string; verified: boolean;
}
interface PotentialItem {
  ca: string; symbol: string; category: number; score: number; scoreDisplay: string; verified: boolean | null;
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

const WATCHLIST_KEY_PREFIX = 'wyck_sidebar_star_';

export function TokenSidebar({ chain }: { chain: Chain }) {
  const router = useRouter();
  const pathname = usePathname();
  const activeCa = pathname?.split('/').pop();
  const [tab, setTab] = useState<Tab>('all');
  const [search, setSearch] = useState('');
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [newTokens, setNewTokens] = useState<TokenEntry[]>([]);
  const [potential, setPotential] = useState<PotentialItem[]>([]);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());
  const [dexTick, setDexTick] = useState(0);
  const [loading, setLoading] = useState(true);

  const watchKey = `${WATCHLIST_KEY_PREFIX}${chain}`;

  useEffect(() => {
    const saved = localStorage.getItem(watchKey);
    setWatchlist(saved ? new Set(JSON.parse(saved)) : new Set());
  }, [watchKey]);

  function toggleStar(ca: string) {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(ca)) next.delete(ca);
      else next.add(ca);
      localStorage.setItem(watchKey, JSON.stringify([...next]));
      return next;
    });
  }

    useEffect(() => {
        let active = true;
        function load() {
            setLoading(true);
            const loadAll = chain === 'robinhood' ? fetchRobinhoodTokens() : fetchAllCategories();
            const loadNew = chain === 'robinhood'
            ? fetchRobinhoodNewTokens()
            : loadAll.then((list) => list.filter((t) => t.category === 4));

            Promise.all([
            loadAll,
            loadNew,
            fetch(`/api/whale-hub/potential?chain=${chain}`).then((r) => r.json()).catch(() => ({ tier1: [], tier2: [] })),
            ])
            .then(([all, news, pot]) => {
                if (!active) return;
                setTokens(all);
                setNewTokens(news as TokenEntry[]);
                setPotential([...(pot.tier1 || []), ...(pot.tier2 || [])]);
                const allCas = [
                ...all.map((t: TokenEntry) => t.CA),
                ...(pot.tier1 || []).map((t: PotentialItem) => t.ca),
                ...(pot.tier2 || []).map((t: PotentialItem) => t.ca),
                ];
                prefetchDexDataBatch(allCas, () => setDexTick((v) => v + 1), chain);
            })
            .finally(() => { if (active) setLoading(false); });
        }
        load();
        const id = setInterval(load, 300000);
        return () => { active = false; clearInterval(id); };
    }, [chain]);

  const rows: Row[] = useMemo(() => {
    if (tab === 'star') {
      return tokens
        .filter((t) => watchlist.has(t.CA))
        .map((t) => ({ ca: t.CA, symbol: t.symbol, category: t.category, score: t.latestScore, scoreDisplay: t.latestScoreDisplay, verified: t.verified }));
    }
    if (tab === 'new') {
      return newTokens.map((t) => ({ ca: t.CA, symbol: t.symbol, category: t.category, score: t.latestScore, scoreDisplay: t.latestScoreDisplay, verified: t.verified }));
    }
    if (tab === 'potential') {
      return potential.map((p) => ({ ca: p.ca, symbol: p.symbol, category: p.category, score: p.score, scoreDisplay: p.scoreDisplay, verified: !!p.verified }));
    }
    return tokens.map((t) => ({ ca: t.CA, symbol: t.symbol, category: t.category, score: t.latestScore, scoreDisplay: t.latestScoreDisplay, verified: t.verified }));
  }, [tab, tokens, newTokens, potential, watchlist]);

  const filteredRows = useMemo(() => {
    const base = [...rows].sort((a, b) => a.symbol.localeCompare(b.symbol));
    const q = search.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) => {
      const dex = getCachedDexData(r.ca);
      return (
        r.symbol.toLowerCase().includes(q) ||
        r.ca.toLowerCase().includes(q) ||
        (dex?.name ?? '').toLowerCase().includes(q)
      );
    });
  }, [rows, search, dexTick]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'star', label: '★' },
    { key: 'all', label: 'All' },
    { key: 'potential', label: 'Potential' },
    { key: 'new', label: 'New' },
  ];

  return (
    <div className="h-full flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="p-2.5 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5">
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

        <div className="flex items-center px-2.5 py-1.5 border-b border-slate-800 text-[10px] font-bold text-slate-500 uppercase tracking-wide shrink-0">
        <span className="flex-1 pl-9">Token</span>
        <span className="w-12 text-right leading-tight">
            Vol 24h<br />Chage 24h
        </span>
        <span className="w-8 text-right">Score</span>
        </div>

      <div className="flex-1 overflow-y-auto">
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
              onClick={() => router.push(`/${chain}/${r.ca}`)}
              className={`flex items-center gap-2 px-2.5 py-2 border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/60 ${
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
                <div className="text-[11px] font-bold text-blue-400 truncate">{r.symbol}</div>
                <div className="text-[10px] text-slate-500 truncate">{dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}</div>
              </div>

              <div className="text-right shrink-0 w-14">
                <div className="text-[10px] text-slate-400">{dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</div>
                <div className={`text-[10px] font-semibold ${change24h == null ? 'text-slate-500' : change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {change24h == null ? 'N/A' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
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