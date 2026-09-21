'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PotentialApiItem } from '@/app/api/potential/route';
import { useTokenGate, VIP_THRESHOLD } from '@/lib/tokenGate';
import { BuyTokenPrompt } from '@/components/BuyTokenPrompt';
import { PotentialFilterPanel, PotentialTab } from '@/components/PotentialFilterPanel';
import { PotentialTable } from '@/components/PotentialTable';
import { prefetchDexDataBatch } from '@/lib/dexData';
import { FILTER_LABELS } from '@/lib/platforms';
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
  followRoi,
  openFollow,
  dcaFollow,
  closeFollow,
} from '@/lib/potentialFilters';
import { passesFilter } from '@/lib/potentialEngine';

const POLL_MS = 60000;
const NEW_BADGE_MS = 5 * 60 * 1000;

export default function PotentialPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(VIP_THRESHOLD);
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
          const f = followsRef.current[key];
          const open = !!f && !f.closedAt;
          return {
            item,
            passes: true,
            isNew: newSinceRef.current.has(item.ca),
            isFollowed: open,
            follow: open ? f : undefined,
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
      .map((item) => {
        const f = followsRef.current[followKey(item.chain, item.ca)];
        return {
          item,
          passes: true,
          isNew: false,
          isFollowed: !f.closedAt,
          isClosed: !!f.closedAt,
          follow: f,
        } as PotentialRow;
      })
      .sort((a, b) => {
        const ac = a.isClosed ? 1 : 0;
        const bc = b.isClosed ? 1 : 0;
        if (ac !== bc) return ac - bc;
        if (a.isClosed) return (b.follow?.closedAt ?? 0) - (a.follow?.closedAt ?? 0);
        return (b.item.entries[0]?.score ?? 0) - (a.item.entries[0]?.score ?? 0);
      });
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
    const price = row.item.priceUsd;
    const existing = followsRef.current[key];
    const isOpen = !!existing && !existing.closedAt;

    if (isOpen && existing.buys.length > 0 && !(price != null && price > 0)) {
      window.alert('Live price is not available yet, cannot record the sell. Please try again shortly.');
      return;
    }

    setFollows((prev) => {
      const cur = prev[key];
      const next = { ...prev };
      if (cur && !cur.closedAt) next[key] = closeFollow(cur, price);
      else next[key] = openFollow(row.item, cur);
      saveFollows(next);
      return next;
    });
  }

  function handleDca(row: PotentialRow) {
    const key = followKey(row.item.chain, row.item.ca);
    const price = row.item.priceUsd;
    if (price == null || price <= 0) return;

    setFollows((prev) => {
      const cur = prev[key];
      if (!cur || cur.closedAt) return prev;
      const next = { ...prev, [key]: dcaFollow(cur, price) };
      saveFollows(next);
      return next;
    });
  }

  function handleResetFollows() {
    if (Object.keys(follows).length === 0) return;
    const ok = window.confirm('Reset all follows? This will delete every followed token, DCA and sell history.');
    if (!ok) return;
    setFollows({});
    saveFollows({});
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

  const followSummaryNode = useMemo(() => {
    if (tab !== 'following' || loading || followingRows.length === 0) return null;

    let invested = 0;
    let current = 0;
    let realized = 0;
    let openCount = 0;
    let closedCount = 0;
    const groups: Record<string, { invested: number; current: number }> = {};

    function addToGroup(key: string, inv: number, cur: number) {
      const g = (groups[key] ||= { invested: 0, current: 0 });
      g.invested += inv;
      g.current += cur;
    }

    for (const row of followingRows) {
      const f = row.follow;
      if (!f) continue;
      if (row.isClosed) closedCount++;
      else openCount++;

      const r = followRoi(f, row.item.priceUsd);
      if (r.invested <= 0) continue;

      invested += r.invested;
      current += r.current;
      realized += r.realized;

      const networkLabel = row.item.chain === 'base' ? 'Base' : row.item.chain === 'robinhood' ? 'RH' : 'Arc';
      addToGroup(networkLabel, r.invested, r.current);

      const platformLabel = FILTER_LABELS[row.item.platform] ?? row.item.platform;
      addToGroup(platformLabel, r.invested, r.current);
    }

    const roi = current - invested;
    const roiPct = invested > 0 ? (roi / invested) * 100 : 0;
    const roiColor = roi > 0 ? 'text-green-400' : roi < 0 ? 'text-red-400' : 'text-slate-300';
    const realizedColor = realized > 0 ? 'text-green-400' : realized < 0 ? 'text-red-400' : 'text-slate-300';

    const groupPcts = Object.entries(groups)
      .map(([label, g]) => ({
        label,
        pct: g.invested > 0 ? ((g.current - g.invested) / g.invested) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct);

    return (
      <div className="text-sm text-slate-300 leading-snug lg:text-right space-y-1">
        <div>
          {openCount} followed{closedCount > 0 ? ` · ${closedCount} sold` : ''}. Total bought ${invested.toFixed(0)} (incl. DCA), current value ${current.toFixed(2)}, ROI:{' '}
          <span className={`font-bold ${roiColor}`}>
            {roi >= 0 ? '+' : ''}${roi.toFixed(2)} ({roiPct >= 0 ? '+' : ''}{roiPct.toFixed(1)}%)
          </span>
          {closedCount > 0 && (
            <>
              {' '}· Realized:{' '}
              <span className={`font-bold ${realizedColor}`}>
                {realized >= 0 ? '+' : ''}${realized.toFixed(2)}
              </span>
            </>
          )}
        </div>
        <div className="text-xs text-slate-400 flex flex-wrap gap-x-3 gap-y-1 lg:justify-end">
          {groupPcts.map((g) => (
            <span key={g.label} className={g.pct >= 0 ? 'text-green-400' : 'text-red-400'}>
              {g.label} {g.pct >= 0 ? '+' : ''}{g.pct.toFixed(1)}%
            </span>
          ))}
        </div>
      </div>
    );
  }, [tab, loading, followingRows]);

  if (!isConnected) {
    return <GateMessage title="Connect your wallet" message="Connect your wallet to check Potential access." />;
  }
  if (isLoading) {
    return <GateMessage title="Checking balance..." message="" />;
  }
  if (!hasAccess) {
    return (
      <GateMessage
        title="Potential Locked"
        message={`You need at least ${VIP_THRESHOLD.toLocaleString()} tokens. Your balance: ${amount.toLocaleString()}.`}
        showBuyPrompt
      />
    );
  }

  return (
    <div className="w-full px-4 py-6 max-w-[1700px] mx-auto space-y-5">
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
          {tab === 'following' && (
            <button
              onClick={handleResetFollows}
              disabled={Object.keys(follows).length === 0}
              className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-800 text-red-400 hover:text-red-300 hover:border-red-500 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              Reset Follow
            </button>
          )}
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
        rightSlot={followSummaryNode}
      />

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {loading ? (
        <p className="text-slate-400">Loading potential tokens...</p>
      ) : (
        <PotentialTable
          rows={activeRows}
          onToggleFollow={handleToggleFollow}
          onDca={handleDca}
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