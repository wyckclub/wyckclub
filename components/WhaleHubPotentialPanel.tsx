'use client';

import { useEffect, useState } from 'react';
import { formatCap } from '@/lib/format';

type Chain = 'base' | 'robinhood';

interface Item {
  ca: string;
  symbol: string;
  category: number;
  scoreDisplay: string;
  whale: boolean;
  spring: boolean;
  yellow: boolean;
  liq: number;
  marketCap: number | null;
  imageUrl: string | null;
}

function Row({ item, onOpenChart }: { item: Item; onOpenChart: (t: { category: number; ca: string; symbol: string }) => void }) {
  const scoreColor = item.yellow ? 'text-yellow-400' : 'text-slate-300';
  const label = `${item.whale ? '🐋' : ''}${item.scoreDisplay}`;
  return (
    <button
      onClick={() => onOpenChart({ category: item.category, ca: item.ca, symbol: item.symbol })}
      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-slate-800 text-left"
    >
      {item.imageUrl ? (
        <img src={item.imageUrl} alt={item.symbol} className="w-7 h-7 rounded-full object-cover shrink-0" />
      ) : (
        <div className="w-7 h-7 rounded-full bg-slate-800 shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-blue-400 truncate">{item.symbol}</div>
        <div className="text-[11px] text-slate-500">{item.marketCap == null ? 'N/A' : formatCap(item.marketCap)}</div>
      </div>
      <span
        className={`shrink-0 text-sm font-bold px-1.5 py-0.5 rounded ${scoreColor} ${
          item.spring ? 'border border-yellow-300/80 bg-[#363603]/60' : ''
        }`}
      >
        {label}
      </span>
    </button>
  );
}

export function WhaleHubPotentialPanel({
  chain,
  onOpenChart,
}: {
  chain: Chain;
  onOpenChart: (t: { category: number; ca: string; symbol: string }) => void;
}) {
  const [tier1, setTier1] = useState<Item[]>([]);
  const [tier2, setTier2] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/whale-hub/potential?chain=${chain}`)
      .then((r) => r.json())
      .then((d) => {
        setTier1(d.tier1 || []);
        setTier2(d.tier2 || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [chain]);

  return (
    <div className="w-full lg:w-80 shrink-0 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <h3 className="text-sm font-bold text-green-400 px-2 mb-1">Tier 1 - Strong Potential</h3>
        {loading && <p className="text-slate-500 text-xs px-2">Loading...</p>}
        {!loading && tier1.length === 0 && <p className="text-slate-500 text-xs px-2">No tokens.</p>}
        <div className="space-y-1">
          {tier1.map((t) => (
            <Row key={t.ca} item={t} onOpenChart={onOpenChart} />
          ))}
        </div>
      </div>
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
        <h3 className="text-sm font-bold text-yellow-300 px-2 mb-1">Tier 2 - Potential</h3>
        {loading && <p className="text-slate-500 text-xs px-2">Loading...</p>}
        {!loading && tier2.length === 0 && <p className="text-slate-500 text-xs px-2">No tokens.</p>}
        <div className="space-y-1">
          {tier2.map((t) => (
            <Row key={t.ca} item={t} onOpenChart={onOpenChart} />
          ))}
        </div>
      </div>
    </div>
  );
}