'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PotentialApiItem } from '@/app/api/potential/route';
import { PotentialFilterPanel, PotentialTab } from '@/components/PotentialFilterPanel';
import { PotentialTable } from '@/components/PotentialTable';
import { prefetchDexDataBatch } from '@/lib/dexData';
import {
  PotentialFilters,
  PotentialRow,
  FollowSnapshot,
  NetworkKey,
  defaultFiltersFor,
  loadDraftFilters,
  saveDraftFilters,
  loadAppliedFilters,
  saveAppliedFilters,
  loadFollows,
  saveFollows,
  followKey,
} from '@/lib/potentialFilters';
import { passesFilter } from '@/lib/potentialEngine';

const POLL_MS = 60000;
const NEW_BADGE_MS = 5 * 60 * 1000;

export default function PotentialPage() {
  const [tab, setTab] = useState<PotentialTab>('base');
  const [network, setNetwork] = useState<NetworkKey>('base');

  const [formFilters, setFormFilters] = useState<PotentialFilters>(defaultFiltersFor('base'));
  const [appliedBase, setAppliedBase] = useState<PotentialFilters | null>(null);
  const [appliedRobinhood, setAppliedRobinhood] = useState<PotentialFilters | null>(null);

  const [items, setItems] = useState<PotentialApiItem[]>([]);
  const [baseRows, setBaseRows] = useState<PotentialRow[]>([]);
  const [robinhoodRows, setRobinhoodRows] = useState<PotentialRow[]>([]);
  const [followingRows, setFollowingRows] = useState<PotentialRow[]>([]);
  const [follows, setFollows] = useState<Record<string, FollowSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const [appliedArc, setAppliedArc] = useState<PotentialFilters | null>(null);
  const [arcRows, setArcRows] = useState<PotentialRow[]>([]);
  const prevPassingArcRef = useRef<Set<string>>(new Set());
  const newSinceArcRef = useRef<Map<string, number>>(new Map());

  const followsRef = useRef(follows);
  followsRef.current = follows;

  const hasPolledOnceRef = useRef(false);
  const prevPassingBaseRef = useRef<Set<string>>(new Set());
  const prevPassingRobinhoodRef = useRef<Set<string>>(new Set());
  const newSinceBaseRef = useRef<Map<string, number>>(new Map());
  const newSinceRobinhoodRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    setAppliedBase(loadAppliedFilters('base'));
    setAppliedRobinhood(loadAppliedFilters('robinhood'));
    setAppliedArc(loadAppliedFilters('arc'));
    setFollows(loadFollows());
    setFormFilters(loadDraftFilters('base'));
  }, []);

  function handleTabChange(t: PotentialTab) {
    setTab(t);
    if (t !== 'following') {
      setNetwork(t);
      setFormFilters(loadDraftFilters(t));
    }
  }

  const load = useCallback(async (force = false) => {
    try {
      const url = `/api/potential${force ? '?force=1' : ''}`;
      const res = await fetch(url, { cache: 'no-store' });
      const data = await res.json();
      setItems(Array.isArray(data.items) ? data.items : []);
      setError('');
    } catch (e: any) {
      setError(e?.message || 'Failed to load potential tokens');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(() => load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!items.length) return;
    const baseCas = items.filter((i) => i.chain === 'base').map((i) => i.ca);
    const rhCas = items.filter((i) => i.chain === 'robinhood').map((i) => i.ca);
    const arcCas = items.filter((i) => i.chain === 'arc').map((i) => i.ca);
    if (baseCas.length) prefetchDexDataBatch(baseCas, undefined, 'base');
    if (rhCas.length) prefetchDexDataBatch(rhCas, undefined, 'robinhood');
    if (arcCas.length) prefetchDexDataBatch(arcCas, undefined, 'arc');
  }, [items]);

  useEffect(() => {
    if (!items.length) {
      setBaseRows([]);
      setRobinhoodRows([]);
      setArcRows([]);
      setFollowingRows([]);
      return;
    }

    function computeChainRows(
      chain: NetworkKey,
      applied: PotentialFilters | null,
      prevPassingRef: React.MutableRefObject<Set<string>>,
      newSinceRef: React.MutableRefObject<Map<string, number>>
    ): PotentialRow[] {
      const chainItems = items.filter((i) => i.chain === chain);

      if (!applied) {
        prevPassingRef.current = new Set();
        return [];
      }

      const currentPassing = new Set<string>();
      chainItems.forEach((i) => {
        if (passesFilter(i, applied)) currentPassing.add(i.ca);
      });

      if (hasPolledOnceRef.current) {
        currentPassing.forEach((ca) => {
          if (!prevPassingRef.current.has(ca)) newSinceRef.current.set(ca, Date.now());
        });
        newSinceRef.current.forEach((ts, ca) => {
          if (Date.now() - ts > NEW_BADGE_MS) newSinceRef.current.delete(ca);
        });
      }
      prevPassingRef.current = currentPassing;

      return chainItems
        .filter((i) => currentPassing.has(i.ca))
        .map((item) => {
          const key = followKey(item.chain, item.ca);
          return {
            item,
            passes: true,
            isNew: newSinceRef.current.has(item.ca),
            isFollowed: !!followsRef.current[key],
            follow: followsRef.current[key],
          } as PotentialRow;
        })
        .sort((a, b) => (b.item.entries[0]?.score ?? 0) - (a.item.entries[0]?.score ?? 0));
    }

    setBaseRows(computeChainRows('base', appliedBase, prevPassingBaseRef, newSinceBaseRef));
    setRobinhoodRows(computeChainRows('robinhood', appliedRobinhood, prevPassingRobinhoodRef, newSinceRobinhoodRef));
    setArcRows(computeChainRows('arc', appliedArc, prevPassingArcRef, newSinceArcRef));
    hasPolledOnceRef.current = true;

    const followed = items
      .filter((i) => !!followsRef.current[followKey(i.chain, i.ca)])
      .map(
        (item) =>
          ({
            item,
            passes: true,
            isNew: false,
            isFollowed: true,
            follow: followsRef.current[followKey(item.chain, item.ca)],
          } as PotentialRow)
      )
      .sort((a, b) => (b.item.entries[0]?.score ?? 0) - (a.item.entries[0]?.score ?? 0));
    setFollowingRows(followed);
  }, [items, appliedBase, appliedRobinhood, appliedArc, follows]);

  function handleApply() {
    saveDraftFilters(network, formFilters);
    saveAppliedFilters(network, formFilters);
    if (network === 'base') setAppliedBase(formFilters);
    else if (network === 'robinhood') setAppliedRobinhood(formFilters);
    else setAppliedArc(formFilters);
  }

  function handleReset() {
    const cleared = defaultFiltersFor(network);
    setFormFilters(cleared);
    saveDraftFilters(network, cleared);
    saveAppliedFilters(network, null);
    if (network === 'base') {
      setAppliedBase(null);
      prevPassingBaseRef.current = new Set();
      newSinceBaseRef.current = new Map();
    } else if (network === 'robinhood') {
      setAppliedRobinhood(null);
      prevPassingRobinhoodRef.current = new Set();
      newSinceRobinhoodRef.current = new Map();
    } else {
      setAppliedArc(null);
      prevPassingArcRef.current = new Set();
      newSinceArcRef.current = new Map();
    }
  }

  function handleToggleFollow(row: PotentialRow) {
    const key = followKey(row.item.chain, row.item.ca);
    setFollows((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        const e0 = row.item.entries[0];
        next[key] = {
          ca: row.item.ca,
          chain: row.item.chain,
          followedAt: Date.now(),
          priceUsd: row.item.priceUsd,
          marketCap: row.item.marketCap,
          wai: e0?.top10 ?? null,
          bull: e0?.incBull ?? null,
          bear: e0?.decBear ?? null,
          netBull: e0?.incBull != null && e0?.decBear != null ? e0.incBull - e0.decBear : null,
        };
      }
      saveFollows(next);
      return next;
    });
  }

  function handleRefreshClick() {
    setRefreshing(true);
    load(true);
  }

  const activeRows =
    tab === 'following' ? followingRows :
    tab === 'base' ? baseRows :
    tab === 'robinhood' ? robinhoodRows :
    arcRows;

  return (
    <div className="w-full px-4 py-6 max-w-[1600px] mx-auto space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-2xl font-bold text-blue-400">Potential Tokens</h2>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-500">Auto-refreshing every 1 minute</span>
          <button
            onClick={handleRefreshClick}
            disabled={refreshing}
            className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300 hover:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
          >
            {refreshing ? 'Refreshing...' : '↻ Refresh'}
          </button>
        </div>
      </div>

      <PotentialFilterPanel
        tab={tab}
        network={network}
        onTabChange={handleTabChange}
        filters={formFilters}
        onChange={setFormFilters}
        onApply={handleApply}
        onReset={handleReset}
        resultCount={activeRows.length}
      />
      {tab === 'following' && !loading && followingRows.length > 0 && (() => {
        let invested = 0;
        let current = 0;
        for (const row of followingRows) {
          const buyPrice = row.follow?.priceUsd;
          const nowPrice = row.item.priceUsd;
          if (buyPrice == null || buyPrice <= 0 || nowPrice == null) continue;
          invested += 1;
          current += nowPrice / buyPrice;
        }
        const roi = current - invested;
        const roiPct = invested > 0 ? (roi / invested) * 100 : 0;
        const roiColor = roi > 0 ? 'text-green-400' : roi < 0 ? 'text-red-400' : 'text-slate-300';
        return (
          <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-300">
            {followingRows.length} followed tokens. If you bought it for ${invested.toFixed(0)}, the current value is ${current.toFixed(2)}, ROI:{' '}
            <span className={`font-bold ${roiColor}`}>
              {roi >= 0 ? '+' : ''}${roi.toFixed(2)} ({roiPct >= 0 ? '+' : ''}{roiPct.toFixed(1)}%)
            </span>
          </div>
        );
      })()}
      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading ? (
        <p className="text-slate-400">Loading potential tokens...</p>
      ) : (
        <PotentialTable
          rows={activeRows}
          onToggleFollow={handleToggleFollow}
          emptyMessage={
            tab === 'following'
              ? 'You are not following any tokens yet. Tap the star icon on a token to follow it.'
              : 'No tokens match current filters yet. Set your criteria above and click "Filter tokens".'
          }
        />
      )}
    </div>
  );
}