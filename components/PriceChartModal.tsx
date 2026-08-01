'use client';

import { useEffect, useState } from 'react';
import { fetchTokenHistory, PriceHistoryEntry } from '@/lib/tokenApi';
import { fetchLivePrice } from '@/lib/dexData';
import { formatPriceShort, formatDateShort } from '@/lib/format';

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
  const [livePrice, setLivePrice] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/stats/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'chart_view' }),
    }).catch(() => {});
  }, [ca]);

  useEffect(() => {
    setLoading(true);
    fetchTokenHistory(category, ca)
      .then((history) => {
        setEntries(history.filter((h) => h.price != null && !isNaN(h.price) && h.price > 0));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [category, ca]);

  useEffect(() => {
    let active = true;
    function poll() {
      fetchLivePrice(ca).then((p) => {
        if (active) setLivePrice(p);
      });
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [ca]);

  const e0Price = entries[entries.length - 1]?.price ?? null;
  const isUp = livePrice != null && e0Price != null ? livePrice >= e0Price : true;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-5xl w-[90%]">
        <div className="flex justify-between items-center mb-3 text-blue-400 text-sm">
          <span className="text-base">
            Powered by{' '}
            <a
              href="https://x.com/WYCKSCORE"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold hover:underline"
            >
              @WYCKSCORE
            </a>
            . Token: <span className="font-bold">{symbol}</span>
          </span>
          <div className="flex items-center gap-4">
          {livePrice != null && (
            <span className={`flex items-center gap-1.5 font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
              <span className={`w-2 h-2 rounded-full animate-pulse ${isUp ? 'bg-green-400' : 'bg-red-400'}`} />
              Live: {formatPriceShort(livePrice)}
              {e0Price != null && e0Price > 0 && (
                <span>
                  ({isUp ? '+' : ''}{(((livePrice - e0Price) / e0Price) * 100).toFixed(1)}%)
                </span>
              )}
            </span>
          )}
            <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
          </div>
        </div>
        {loading && <div className="text-center py-10 opacity-60">Loading...</div>}
        {error && <div className="text-center py-10 opacity-60">Error: {error}</div>}
        {!loading && !error && (
          entries.length < 2
            ? <div className="text-center py-10 opacity-60">Not enough price data to draw a chart</div>
            : <ChartSVG entries={entries} livePrice={livePrice} />
        )}
      </div>
    </div>
  );
}

function ChartSVG({ entries, livePrice }: { entries: PriceHistoryEntry[]; livePrice: number | null }) {
  const width = 960;
  const height = 520;
  const pad = { left: 64, right: 16, top: 30, bottom: 46 };

  const hasLive = livePrice != null && livePrice > 0;
  const totalCount = entries.length + (hasLive ? 1 : 0);

  const allPrices = [
    ...entries.map((e) => Math.log10(e.price as number)),
    ...(hasLive ? [Math.log10(livePrice as number)] : []),
  ];
  let minLog = Math.min(...allPrices);
  let maxLog = Math.max(...allPrices);
  if (minLog === maxLog) { minLog -= 0.1; maxLog += 0.1; }

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xStep = totalCount > 1 ? innerW / (totalCount - 1) : 0;

  const points = entries.map((e, i) => {
    const x = pad.left + i * xStep;
    const y = pad.top + innerH * (1 - (Math.log10(e.price as number) - minLog) / (maxLog - minLog));
    return { x, y, ...e };
  });

  const e0Price = entries[entries.length - 1]?.price ?? null;
  const livePoint = hasLive
    ? {
        x: pad.left + entries.length * xStep,
        y: pad.top + innerH * (1 - (Math.log10(livePrice as number) - minLog) / (maxLog - minLog)),
        price: livePrice as number,
      }
    : null;

function isSpringPoint(idx: number) {
  const p = points[idx];
  const prev = points[idx - 1];
  const prev2 = points[idx - 2];

  const springCondition =
    !!(p && prev && prev2 &&
    p.score != null && prev.score != null &&
    p.price != null && prev2.price != null &&
    p.score - prev.score > 3 &&
    p.price < prev2.price);

  const whaleCount = [idx - 1, idx - 2, idx - 3].filter((i) => starredIndices.has(i)).length;
  const whaleStreakCondition = starredIndices.has(idx) && whaleCount >= 2;

  return springCondition || whaleStreakCondition;
}

  function segmentColorClass(currentScore: number, prevScores: number[]) {
      if (prevScores.length < 3) return 'stroke-blue-400';
      if (currentScore <= 2) return 'stroke-blue-400'; // điểm sau phải > 2 score

      const avg = (prevScores[0] + prevScores[1] + prevScores[2]) / 3;
      const aboveAvg = currentScore - avg;

      if (aboveAvg > 3) return 'stroke-green-600'; // xanh lá đậm
      if (aboveAvg > 0) return 'stroke-green-300'; // xanh lá nhạt
      return 'stroke-blue-400';
    }

    const starredIndices = new Set<number>();
    const segments = points.slice(1).map((p, idx) => {
      const i = idx + 1;
      const prev = points[i - 1];
      const prevScores = [points[i - 1]?.score, points[i - 2]?.score, points[i - 3]?.score].filter(
        (s): s is number => s != null
      );
      const colorClass = p.score == null ? 'stroke-blue-400' : segmentColorClass(p.score, prevScores);
      if ((colorClass === 'stroke-green-600' || colorClass === 'stroke-green-300') && p.topwhale === 'y') {
        starredIndices.add(i);
      }
      return { x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, colorClass };
    });

  if (livePoint) {
    const last = points[points.length - 1];
    segments.push({ x1: last.x, y1: last.y, x2: livePoint.x, y2: livePoint.y, colorClass: 'stroke-blue-400' });
  }

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const logVal = minLog + (maxLog - minLog) * (i / tickCount);
    const price = Math.pow(10, logVal);
    const y = pad.top + innerH * (1 - i / tickCount);
    return { y, price };
  });

  const isUp = livePoint && e0Price != null ? livePoint.price >= e0Price : true;
  const liveColorClass = isUp ? 'fill-green-400' : 'fill-red-400';

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
        {[0, Math.floor((points.length - 1) / 2), points.length - 1].map((idx) => {
          const p = points[idx];
          if (!p) return null;
          const isLatest = idx === points.length - 1;
          return (
            <text
              key={`date-${idx}`}
              x={p.x}
              y={height - 12}
              textAnchor={isLatest ? 'end' : idx === 0 ? 'start' : 'middle'}
              className="fill-slate-500 text-[10px]"
            >
              {formatDateShort(p.timestamp)}{isLatest ? ' (UTC +0)' : ''}
            </text>
          );
        })}
        {segments.map((s, i) => (
                  <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} className={s.colorClass} strokeWidth={1.5} />
                ))}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-blue-400">
            <title>{p.date}: {formatPriceShort(p.price)} (Score {p.scoreDisplay ?? '-'})</title>
          </circle>
        ))}
        {points.map((p, i) => {
          const above = i % 2 === 0;
          const y = above ? p.y - 8 : p.y + 14;

          const prevScores = [points[i - 1]?.score, points[i - 2]?.score, points[i - 3]?.score].filter(
            (s): s is number => s != null
          );
          const avg = prevScores.length === 3 ? (prevScores[0] + prevScores[1] + prevScores[2]) / 3 : null;
          const isTripleAvg =
            avg != null && avg > 0 && p.score != null && p.score > 5 && p.score > avg * 3;

          const scoreColorClass = (p.score ?? 0) > 8 || isTripleAvg ? 'fill-yellow-400' : 'fill-slate-300';
          const label = `${starredIndices.has(i) ? '🐋' : ''}${p.scoreDisplay ?? '-'}`;
          const spring = isSpringPoint(i);

          const charWidth = starredIndices.has(i) ? 14 + (label.length - 1) * 7.5 : label.length * 7.5;
          const boxW = charWidth + 8;
          const boxH = 18;

          return (
            <g key={i}>
              {spring && (
                <rect
                  x={p.x - boxW / 2}
                  y={y - boxH + 4}
                  width={boxW}
                  height={boxH}
                  rx={4}
                  fill="#363603"
                  fillOpacity={0.55}
                  stroke="#ffde3ad3"
                  strokeWidth={2}
                />
              )}
              <text x={p.x} y={y} textAnchor="middle" className={`${scoreColorClass} text-sm font-bold`}>
                {label}
              </text>
            </g>
          );
        })}
        {livePoint && (
          <g>
            <line
              x1={livePoint.x} y1={pad.top} x2={livePoint.x} y2={height - pad.bottom}
              className="stroke-slate-700" strokeDasharray="4 4"
            />
            <circle cx={livePoint.x} cy={livePoint.y} r={9} className={liveColorClass} fillOpacity={0.3}>
              <animate attributeName="r" values="6;12;6" dur="1.4s" repeatCount="indefinite" />
              <animate attributeName="fill-opacity" values="0.35;0;0.35" dur="1.4s" repeatCount="indefinite" />
            </circle>
            <circle cx={livePoint.x} cy={livePoint.y} r={5} className={liveColorClass}>
              <title>Live: {formatPriceShort(livePoint.price)}</title>
            </circle>
            <text x={livePoint.x} y={pad.top - 10} textAnchor="middle" className={`${liveColorClass} text-xs font-bold`}>
              LIVE
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}