'use client';

import { useEffect, useState } from 'react';
import { fetchTokenHistory, PriceHistoryEntry } from '@/lib/tokenApi';
import { fetchLivePrice } from '@/lib/dexData';
import { ChartSVG } from '@/components/PriceChartModal';

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="m8.6 10.5 6.8-3.9" />
      <path d="m8.6 13.5 6.8 3.9" />
    </svg>
  );
}

export function TokenScoreChart({
  category, ca, chainId, className = '',
}: { category: number | null; ca: string; chainId: string; className?: string }) {
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [showTop10, setShowTop10] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState('');

  useEffect(() => {
    if (category == null) { setLoading(false); return; }
    setLoading(true);
    fetchTokenHistory(category, ca)
      .then((h) => setEntries(h.filter((e) => e.price != null && !isNaN(e.price) && e.price > 0).slice(-40)))
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

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    setShareMsg('');
    try {
      const res = await fetch('/api/share/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chain: chainId, ca }),
      });
      const data = await res.json();
      if (!data.ok) {
        setShareMsg(data.reason || 'This token is not eligible for share yet.');
        return;
      }
      const url = `https://x.com/intent/tweet?text=${encodeURIComponent(data.text)}`;
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch {
      setShareMsg('Share failed, please try again.');
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className={`bg-slate-900 border border-slate-800 rounded-xl p-3 flex flex-col ${className}`}>
      <div className="flex items-center justify-between mb-2 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-blue-400">WYCKSCORE Chart</span>
          <button
            onClick={handleShare}
            disabled={sharing}
            className="text-slate-400 hover:text-blue-400 disabled:opacity-50"
            aria-label="Share"
          >
            <ShareIcon />
          </button>
        </div>
        <button
          onClick={() => setShowTop10((v) => !v)}
          className={`text-xs px-2 py-1 rounded border ${
            showTop10 ? 'border-purple-400 text-purple-300 bg-purple-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'
          }`}
        >
          {showTop10 ? 'Hide' : 'Show'} Whale Accumulation Index
        </button>
      </div>
      {shareMsg && <p className="text-[11px] text-yellow-400 mb-2">{shareMsg}</p>}
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