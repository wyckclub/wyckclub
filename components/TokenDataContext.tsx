'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchAllCategories, fetchRobinhoodTokens, TokenEntry } from '@/lib/tokenApi';
import { prefetchDexDataBatch } from '@/lib/dexData';

type Chain = 'base' | 'robinhood';

export interface PotentialItem {
  ca: string;
  symbol: string;
  category: number;
  score: number;
  scoreDisplay: string;
  verified: boolean | null;
  platform?: string;
}

interface TokenDataState {
  tokens: TokenEntry[];
  potential: PotentialItem[];
  dexTick: number;
  loading: boolean;
  dexReady: boolean;
  refresh: () => void;
  watchlist: Set<string>;
  toggleWatchlist: (ca: string) => void;
}

const TokenDataContext = createContext<TokenDataState | null>(null);

const WATCHLIST_KEY_PREFIX = 'wyck_sidebar_star_';

export function TokenDataProvider({ chain, children }: { chain: Chain; children: React.ReactNode }) {
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [potential, setPotential] = useState<PotentialItem[]>([]);
  const [dexTick, setDexTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dexReady, setDexReady] = useState(false);
  const [watchlist, setWatchlist] = useState<Set<string>>(new Set());

  const watchKey = `${WATCHLIST_KEY_PREFIX}${chain}`;

  useEffect(() => {
    const saved = localStorage.getItem(watchKey);
    setWatchlist(saved ? new Set(JSON.parse(saved)) : new Set());
  }, [watchKey]);

  const toggleWatchlist = useCallback((ca: string) => {
    setWatchlist((prev) => {
      const next = new Set(prev);
      if (next.has(ca)) next.delete(ca);
      else next.add(ca);
      localStorage.setItem(watchKey, JSON.stringify([...next]));
      return next;
    });
  }, [watchKey]);

  const load = useCallback(() => {
    setLoading(true);
    setDexReady(false);
    const loadAll = chain === 'robinhood' ? fetchRobinhoodTokens() : fetchAllCategories();

    Promise.all([
      loadAll,
      fetch(`/api/whale-hub/potential?chain=${chain}`).then((r) => r.json()).catch(() => ({ tier1: [], tier2: [] })),
    ])
      .then(async ([all, pot]) => {
        setTokens(all);
        setPotential([...(pot.tier1 || []), ...(pot.tier2 || [])]);
        setLoading(false);

        const allCas = [
          ...all.map((t: TokenEntry) => t.CA),
          ...(pot.tier1 || []).map((p: PotentialItem) => p.ca),
          ...(pot.tier2 || []).map((p: PotentialItem) => p.ca),
        ];
        await prefetchDexDataBatch(allCas, () => setDexTick((v) => v + 1), chain);
        setDexReady(true);
      })
      .catch(() => setLoading(false));
  }, [chain]);

  useEffect(() => {
    load();
    const id = setInterval(load, 300000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <TokenDataContext.Provider value={{ tokens, potential, dexTick, loading, dexReady, refresh: load, watchlist, toggleWatchlist }}>
      {children}
    </TokenDataContext.Provider>
  );
}

export function useTokenData() {
  const ctx = useContext(TokenDataContext);
  if (!ctx) throw new Error('useTokenData must be used within TokenDataProvider');
  return ctx;
}