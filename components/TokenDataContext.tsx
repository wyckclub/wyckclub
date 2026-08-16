'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { fetchAllCategories, fetchRobinhoodTokens, fetchRobinhoodNewTokens, TokenEntry } from '@/lib/tokenApi';
import { prefetchDexDataBatch } from '@/lib/dexData';

type Chain = 'base' | 'robinhood';

export interface PotentialItem {
  ca: string;
  symbol: string;
  category: number;
  score: number;
  scoreDisplay: string;
  verified: boolean | null;
}

interface TokenDataState {
  tokens: TokenEntry[];
  newTokens: TokenEntry[];
  potential: PotentialItem[];
  dexTick: number;
  loading: boolean;
  dexReady: boolean;
  refresh: () => void;
}

const TokenDataContext = createContext<TokenDataState | null>(null);

export function TokenDataProvider({ chain, children }: { chain: Chain; children: React.ReactNode }) {
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [newTokens, setNewTokens] = useState<TokenEntry[]>([]);
  const [potential, setPotential] = useState<PotentialItem[]>([]);
  const [dexTick, setDexTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [dexReady, setDexReady] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setDexReady(false);
    const loadAll = chain === 'robinhood' ? fetchRobinhoodTokens() : fetchAllCategories();
    const loadNew = chain === 'robinhood'
      ? fetchRobinhoodNewTokens()
      : loadAll.then((list) => list.filter((t) => t.category === 4));

    Promise.all([
      loadAll,
      loadNew,
      fetch(`/api/whale-hub/potential?chain=${chain}`).then((r) => r.json()).catch(() => ({ tier1: [], tier2: [] })),
    ])
      .then(async ([all, news, pot]) => {
        setTokens(all);
        setNewTokens(news as TokenEntry[]);
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
    <TokenDataContext.Provider value={{ tokens, newTokens, potential, dexTick, loading, dexReady, refresh: load }}>
      {children}
    </TokenDataContext.Provider>
  );
}

export function useTokenData() {
  const ctx = useContext(TokenDataContext);
  if (!ctx) throw new Error('useTokenData must be used within TokenDataProvider');
  return ctx;
}