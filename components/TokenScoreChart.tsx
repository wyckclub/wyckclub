'use client';

import { useEffect, useState } from 'react';
import { fetchTokenHistory, PriceHistoryEntry } from '@/lib/tokenApi';
import { fetchLivePrice } from '@/lib/dexData';
import { ChartSVG } from '@/components/PriceChartModal';

export function TokenScoreChart({
  category, ca, chainId, className = '',
}: { category: number | null; ca: string; chainId: string; className?: string }) {
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [showTop10, setShowTop10] = useState(false);

  useEffect(() => {
    if (category == null) { setLoading(false); return; }
    setLoading(true);
    fetchTokenHistory(category, ca)
      .then((h) => setEntries(h.filter((e) => e.price != null && !isNaN(e.price) && e.price > 0)))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, ca]);

  useEffect(() => {
    let active = true;
    function poll() {
      fetchLivePrice(ca, chainId).then((p) => { if (active) setLivePrice(p); });
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => { active = false; clearInterval(id); };
  }, [ca, chainId]);

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <span className="text-sm font-bold text-blue-400">WYCKSCORE Chart</span>
        <button
          onClick={() => setShowTop10((v) => !v)}
          className={`text-xs px-2 py-1 rounded border ${
            showTop10 ? 'border-purple-400 text-purple-300 bg-purple-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          {showTop10 ? 'Hide' : 'Show'} Whale Accumulation Index
        </button>
      </div>
      <div className="flex-1 min-h-0 overflow-auto">
        {category == null && <div className="text-center py-10 opacity-60 text-sm">There is no WYCKSCORE data available for this token.</div>}
        {category != null && loading && <div className="text-center py-10 opacity-60 text-sm">Loading...</div>}
        {category != null && error && <div className="text-center py-10 opacity-60 text-sm">Error: {error}</div>}
        {category != null && !loading && !error && (
          entries.length < 2
            ? <div className="text-center py-10 opacity-60 text-sm">Insufficient data to create a chart.</div>
            : <ChartSVG entries={entries} livePrice={livePrice} showTop10={showTop10} fit />
        )}
      </div>
    </div>
  );
}