'use client';

import { useEffect, useState, useRef } from 'react';
import { fetchTokenHistory, PriceHistoryEntry } from '@/lib/tokenApi';
import { fetchLivePrice, getCachedDexData } from '@/lib/dexData';
import { formatPriceShort, formatDateShort, formatCap } from '@/lib/format';
import { VerifyBadge } from '@/components/VerifyBadge';

interface Props {
  category: number;
  ca: string;
  symbol: string;
  onClose: () => void;
  chainId?: string;
  verified?: boolean | null;
}

export function PriceChartModal({ category, ca, symbol, onClose, chainId = 'base', verified = null }: Props) {
  const dex = getCachedDexData(ca);
  const [entries, setEntries] = useState<PriceHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [showTop10, setShowTop10] = useState(false);

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
      fetchLivePrice(ca, chainId).then((p) => {
        if (active) setLivePrice(p);
      });
    }
    poll();
    const id = setInterval(poll, 15000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [ca, chainId]);

  const e0Price = entries[entries.length - 1]?.price ?? null;
  const isUp = livePrice != null && e0Price != null ? livePrice >= e0Price : true;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
      <div className="relative bg-slate-900 border border-slate-700 rounded-lg p-4 max-w-7xl w-[90%]">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 text-slate-400 hover:text-white bg-slate-900/80 rounded-full w-7 h-7 flex items-center justify-center"
          aria-label="Close"
        >
          ✕
        </button>
        <div className="mb-3 pr-8 text-sm space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-blue-400">
            {chainId === 'robinhood' ? <RobinhoodIcon /> : <BaseIcon />}
            <span className="font-bold text-base">Token:</span>
            {dex?.imageUrl ? (
              <img src={dex.imageUrl} alt={symbol} className="w-5 h-5 rounded-full object-cover" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-slate-800" />
            )}
            <span className="font-bold text-white">{symbol}</span>
            {dex?.name && <span className="text-slate-400 text-xs font-normal">{dex.name}</span>}
            {dex?.twitter && (
              <a href={`https://x.com/${dex.twitter}`} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400">
                <XIcon />
              </a>
            )}
            {dex?.website && (
              <a href={dex.website} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:text-blue-400">
                <WebsiteIcon />
              </a>
            )}
            {chainId === 'robinhood' && verified != null && (
              <VerifyBadge verified={verified} className="w-4 h-4" />
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-y-2">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span>Cap: {dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}</span>
              <span>Liq: {dex?.liq == null ? 'N/A' : formatCap(dex.liq)}</span>
              <span>Vol24h: {dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</span>
              <span>
                Powered by{' '}
                <a href="https://x.com/WYCKSCORE" target="_blank" rel="noopener noreferrer" className="font-bold text-blue-400 hover:underline">
                  @WYCKSCORE
                </a>
              </span>
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              {livePrice != null && (
                <span className={`flex items-center gap-1.5 font-mono ${isUp ? 'text-green-400' : 'text-red-400'}`}>
                  <span className={`w-2 h-2 rounded-full animate-pulse ${isUp ? 'bg-green-400' : 'bg-red-400'}`} />
                  Live: {formatPriceShort(livePrice)}
                  {e0Price != null && e0Price > 0 && (
                    <span>({isUp ? '+' : ''}{(((livePrice - e0Price) / e0Price) * 100).toFixed(1)}%)</span>
                  )}
                </span>
              )}
              <button
                onClick={() => setShowTop10((v) => !v)}
                className={`text-xs px-2 py-1 rounded border ${
                  showTop10 ? 'border-purple-400 text-purple-300 bg-purple-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'
                }`}
              >
                {showTop10 ? 'Hide' : 'Show'} Whale Accumulation Index
              </button>
            </div>
          </div>
        </div>
        {loading && <div className="text-center py-10 opacity-60">Loading...</div>}
        {error && <div className="text-center py-10 opacity-60">Error: {error}</div>}
        {!loading && !error && (
          entries.length < 2
            ? <div className="text-center py-10 opacity-60">Not enough price data to draw a chart</div>
            : <ChartSVG entries={entries} livePrice={livePrice} showTop10={showTop10} />
        )}
      </div>
    </div>
  );
}

function ChartSVG({ entries, livePrice, showTop10 }: { entries: PriceHistoryEntry[]; livePrice: number | null; showTop10: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [entries, livePrice]);

  const width = 1200;
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

  function segmentColorClass(currentScore: number, prevScores: number[]) {
    if (prevScores.length < 3) return 'stroke-blue-400';
    if (currentScore <= 2) return 'stroke-blue-400';

    const avg = (prevScores[0] + prevScores[1] + prevScores[2]) / 3;
    const aboveAvg = currentScore - avg;

    if (aboveAvg > 3) return 'stroke-green-700';
    if (aboveAvg > 0) return 'stroke-green-300/50';
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
    
    if ((colorClass === 'stroke-green-700' || colorClass === 'stroke-green-300/50') && p.topwhale === 'y') {
      starredIndices.add(i);
    }
    return { x1: prev.x, y1: prev.y, x2: p.x, y2: p.y, colorClass };
  });

  if (livePoint) {
    const last = points[points.length - 1];
    segments.push({ x1: last.x, y1: last.y, x2: livePoint.x, y2: livePoint.y, colorClass: 'stroke-blue-400' });
  }

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
    <div className="overflow-x-auto" ref={scrollRef}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `${width}px`, height: 'auto' }}>
        {yTicks.map((t, i) => (
          <g key={i}>
            <text x={pad.left - 8} y={t.y} textAnchor="end" dominantBaseline="middle" className="fill-slate-500 text-[10px]">
              {formatPriceShort(t.price)}
            </text>
            <line x1={pad.left} y1={t.y} x2={width - pad.right} y2={t.y} className="stroke-slate-800" />
          </g>
        ))}
        {[...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].map((idx, i) => {
          const p = points[idx];
          if (!p) return null;
          const isLatest = idx === points.length - 1;
          return (
            <text
              key={`date-${i}`}
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
          <line
            key={i}
            x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2}
            className={s.colorClass}
            strokeWidth={s.colorClass.startsWith('stroke-green') ? 2.5 : 1.5}
          />
        ))}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} className="fill-blue-400">
            <title>{p.date}: {formatPriceShort(p.price)} (Score {p.scoreDisplay ?? '-'})</title>
          </circle>
        ))}
        {points.map((p, i) => {
          const y = p.y - 8;

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
              {showTop10 && p.top10 != null && (
                <>
                  <rect
                    x={p.x - (String(p.top10).length * 7 + 10) / 2}
                    y={p.y + 6}
                    width={String(p.top10).length * 7 + 10}
                    height={16}
                    rx={4}
                    fill="#05253b"
                    fillOpacity={1}
                    stroke="#1b043100"
                    strokeWidth={1}
                  />
                  <text x={p.x} y={p.y + 17} textAnchor="middle" className="fill-blue-500 text-[11px] font-semibold">
                    {p.top10}
                  </text>
                </>
              )}
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

function BaseIcon() {
  return (
    <svg viewBox="0 0 400 400" className="w-4 h-4 rounded-[3px] overflow-hidden">
      <rect width="400" height="400" fill="#FFFFFF" />
      <rect x="80" y="80" width="240" height="240" rx="28" ry="28" fill="#0052FF" />
    </svg>
  );
}

function RobinhoodIcon() {
  return (
    <svg viewBox="0 0 400 400" className="w-4 h-4 rounded-[3px] overflow-hidden">
      <rect width="400" height="400" fill="#ccff00" />
      <g fill="#211d19">
        <path d="M 185 133.5 L 170.5 148 C 142 176.5, 131 220, 131 245 C 131 260, 120 300, 106 321 L 115 321 C 137 280, 149 220, 172 172 Z" />
        <path d="M 249 80 C 275 80, 294 100, 294 130 C 294 150, 280 178, 252 206 L 252 145 L 237 130 L 185 122 Z" />
        <path d="M 238 145 L 238 215 L 150 272 C 175 235, 205 185, 238 145 Z" />
      </g>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5">
      <path d="M18.9 2H22l-7.6 8.7L23.3 22H16.7l-5.2-6.8L5.6 22H2.5l8.1-9.3L1.7 2h6.8l4.7 6.2L18.9 2Zm-1.2 18h1.7L7.4 3.9H5.6L17.7 20Z" />
    </svg>
  );
}

function WebsiteIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="w-3.5 h-3.5">
      <path fillRule="evenodd" clipRule="evenodd" d="M10.27 14.1a6.5 6.5 0 0 0 3.67-3.45q-1.24.21-2.7.34-.31 1.83-.97 3.1M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16m.48-1.52a7 7 0 0 1-.96 0H7.5a4 4 0 0 1-.84-1.32q-.38-.89-.63-2.08a40 40 0 0 0 3.92 0q-.25 1.2-.63 2.08a4 4 0 0 1-.84 1.31zm2.94-4.76q1.66-.15 2.95-.43a7 7 0 0 0 0-2.58q-1.3-.27-2.95-.43a18 18 0 0 1 0 3.44m-1.27-3.54a17 17 0 0 1 0 3.64 39 39 0 0 1-4.3 0 17 17 0 0 1 0-3.64 39 39 0 0 1 4.3 0m1.1-1.17q1.45.13 2.69.34a6.5 6.5 0 0 0-3.67-3.44q.65 1.26.98 3.1M8.48 1.5l.01.02q.41.37.84 1.31.38.89.63 2.08a40 40 0 0 0-3.92 0q.25-1.2.63-2.08a4 4 0 0 1 .85-1.32 7 7 0 0 1 .96 0m-2.75.4a6.5 6.5 0 0 0-3.67 3.44 29 29 0 0 1 2.7-.34q.31-1.83.97-3.1M4.58 6.28q-1.66.16-2.95.43a7 7 0 0 0 0 2.58q1.3.27 2.95.43a18 18 0 0 1 0-3.44m.17 4.71q-1.45-.12-2.69-.34a6.5 6.5 0 0 0 3.67 3.44q-.65-1.27-.98-3.1"/>
    </svg>
  );
}