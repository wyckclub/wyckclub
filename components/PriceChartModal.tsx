'use client';

import { useEffect, useState } from 'react';
import { fetchTokenHistory, PriceHistoryEntry } from '@/lib/tokenApi';
import { formatPriceShort } from '@/lib/format';

interface Props {
  category: number;
  ca: string;
  symbol: string;
  onClose: () => void;
}

export function PriceChartModal({ category, ca, symbol, onClose }: Props) {
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchTokenHistory(category, ca)
      .then((history) => {
        setEntries(history.filter((h) => h.price != null && !isNaN(h.price) && h.price > 0));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, ca]);

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-5xl w-[90%]">
        <div className="flex justify-between items-center mb-3 text-blue-400 text-sm">
          <span>{symbol} - Price chart by entry</span>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>
        {loading && <div className="text-center py-10 opacity-60">Loading...</div>}
        {error && <div className="text-center py-10 opacity-60">Error: {error}</div>}
        {!loading && !error && (
          entries.length < 2
            ? <div className="text-center py-10 opacity-60">Not enough price data to draw a chart</div>
            : <ChartSVG entries={entries} />
        )}
      </div>
    </div>
  );
}

function ChartSVG({ entries }: { entries: PriceHistoryEntry[] }) {
  const width = 960;
  const height = 520;
  const pad = { left: 64, right: 16, top: 30, bottom: 30 };

  const prices = entries.map((e) => Math.log10(e.price as number));
  let minLog = Math.min(...prices);
  let maxLog = Math.max(...prices);
  if (minLog === maxLog) { minLog -= 0.1; maxLog += 0.1; }

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xStep = entries.length > 1 ? innerW / (entries.length - 1) : 0;

  const points = entries.map((e, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + innerH * (1 - (Math.log10(e.price as number) - minLog) / (maxLog - minLog));
    return { x, y, ...e };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const logVal = minLog + (maxLog - minLog) * (i / tickCount);
    const price = Math.pow(10, logVal);
    const y = pad.top + innerH * (1 - i / tickCount);
    return { y, price };
  });

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: 'auto' }}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <text x={pad.left - 8} y={t.y} textAnchor="end" dominantBaseline="middle" className="fill-slate-500 text-[10px]">
              {formatPriceShort(t.price)}
            </text>
            <line x1={pad.left} y1={t.y} x2={width - pad.right} y2={t.y} className="stroke-slate-800" />
          </g>
        ))}
        <polyline points={polyline} fill="none" className="stroke-blue-400" strokeWidth={1.5} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-blue-400">
            <title>{p.date}: {formatPriceShort(p.price)} (Score {p.scoreDisplay ?? '-'})</title>
          </circle>
        ))}
        {points.map((p, i) => {
          const above = i % 2 === 0;
          const y = above ? p.y - 8 : p.y + 14;
          return (
            <text key={i} x={p.x} y={y} textAnchor="middle" className="fill-slate-300 text-xs">
              {p.scoreDisplay ?? '-'}
            </text>
          );
        })}
      </svg>
    </div>
  );
}