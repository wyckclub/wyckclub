'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PotentialApiItem } from '@/app/api/potential/route';
import { PotentialFilterPanel } from '@/components/PotentialFilterPanel';
import { PotentialTable } from '@/components/PotentialTable';
import {
  DEFAULT_FILTERS,
  PotentialFilters,
  PotentialRow,
  FollowSnapshot,
  loadFilters,
  saveFilters,
  clearFilters,
  loadFollows,
  saveFollows,
  followKey,
  hasSavedFilters,
} from '@/lib/potentialFilters';
import { passesFilter } from '@/lib/potentialEngine';

const POLL_MS = 60000;
const NEW_BADGE_MS = 5 * 60 * 1000;

export default function PotentialPage() {
  const [formFilters, setFormFilters] = useState<PotentialFilters>(DEFAULT_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<PotentialFilters | null>(null);
  const [items, setItems] = useState<PotentialApiItem[]>([]);
  const [rows, setRows] = useState<PotentialRow[]>([]);
  const [follows, setFollows] = useState<Record<string, FollowSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const followsRef = useRef(follows);
  followsRef.current = follows;

  const prevPassingRef = useRef<Set<string>>(new Set());
  const hasPolledOnceRef = useRef(false);
  const newSinceRef = useRef<Map<string, number>>(new Map());

  // Restore persisted filters + follow list on mount.
  // If the user has previously applied a filter (saved to storage), re-apply it
  // automatically; otherwise the table stays empty until "Filter tokens" is clicked.
  useEffect(() => {
    const saved = loadFilters();
    setFormFilters(saved);
    if (hasSavedFilters()) setAppliedFilters(saved);
    setFollows(loadFollows());
  }, []);

  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (network: PotentialFilters['network'], force = false) => {
    try {
      const url = `/api/potential?chain=${network}${force ? '&force=1' : ''}`;
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

  const activeNetwork = (appliedFilters ?? formFilters).network;

  useEffect(() => {
    load(activeNetwork);
    const id = setInterval(() => load(activeNetwork), POLL_MS);
    return () => clearInterval(id);
  }, [activeNetwork, load]);

  // Recompute rows whenever fresh data, filters, or follow state changes.
  useEffect(() => {
    if (!items.length) {
      setRows([]);
      return;
    }

    // No filter has ever been applied -> nothing passes (followed tokens still show, handled below).
    const evaluate = appliedFilters ? (i: PotentialApiItem) => passesFilter(i, appliedFilters) : () => false;

    const currentPassing = new Set<string>();
    items.forEach((i) => {
      if (evaluate(i)) currentPassing.add(followKey(i.chain, i.ca));
    });

    if (hasPolledOnceRef.current) {
      currentPassing.forEach((k) => {
        if (!prevPassingRef.current.has(k)) newSinceRef.current.set(k, Date.now());
      });
      newSinceRef.current.forEach((ts, k) => {
        if (Date.now() - ts > NEW_BADGE_MS) newSinceRef.current.delete(k);
      });
    }
    prevPassingRef.current = currentPassing;
    hasPolledOnceRef.current = true;

    const currentFollows = followsRef.current;
    const nextRows: PotentialRow[] = items
      .map((item) => {
        const key = followKey(item.chain, item.ca);
        const passes = currentPassing.has(key);
        const isFollowed = !!currentFollows[key];
        return {
          item,
          passes,
          isNew: newSinceRef.current.has(key),
          isFollowed,
          follow: currentFollows[key],
        } as PotentialRow;
      })
      .filter((r) => r.isFollowed || r.passes)
      .sort((a, b) => {
        if (a.isFollowed !== b.isFollowed) return a.isFollowed ? -1 : 1;
        const sa = a.item.entries[0]?.score ?? 0;
        const sb = b.item.entries[0]?.score ?? 0;
        return sb - sa;
      });

    setRows(nextRows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, appliedFilters, follows]);

  function handleApply() {
    saveFilters(formFilters);
    setAppliedFilters(formFilters);
  }

  function handleReset() {
    setFormFilters((prev) => ({
      ...DEFAULT_FILTERS,
      network: prev.network,
      basePlatforms: prev.basePlatforms,
      robinhoodPlatforms: prev.robinhoodPlatforms,
    }));
    setAppliedFilters(null);
    clearFilters();
    prevPassingRef.current = new Set();
    newSinceRef.current = new Map();
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
    load(activeNetwork, true);
  }

  const passCount = rows.filter((r) => r.passes).length;

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
        filters={formFilters}
        onChange={setFormFilters}
        onApply={handleApply}
        onReset={handleReset}
        resultCount={passCount}
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading ? (
        <p className="text-slate-400">Loading potential tokens...</p>
      ) : (
        <PotentialTable rows={rows} onToggleFollow={handleToggleFollow} />
      )}
    </div>
  );
}