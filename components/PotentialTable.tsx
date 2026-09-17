'use client';

import { useState } from 'react';
import { formatCap, formatPriceShort, formatAge } from '@/lib/format';
import { ScoreBadge } from '@/components/ScoreBadge';
import { PlatformBadge } from '@/components/PlatformBadge';
import { NetworkIcon } from '@/components/NetworkIcon';
import { PriceChartModal, trendUpDown, bullBearTrend, netBullTrendState, trendTextClassHtml } from '@/components/PriceChartModal';
import { PotentialRow } from '@/lib/potentialFilters';
import type { PotentialApiItem } from '@/app/api/potential/route';

interface ChartTarget {
  category: number;
  ca: string;
  symbol: string;
  chain: 'base' | 'robinhood' | 'arc';
  platform: string | null;
}

function relativeTimeLong(ts: number): string {
  const diffMs = Date.now() - ts;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 minute ago';
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.floor(mins / 60);
  if (hours === 1) return '1 hour ago';
  if (hours < 24) return `${hours} hours ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

function StarIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill={filled ? '#facc15' : 'none'}
      stroke={filled ? '#facc15' : 'currentColor'}
      strokeWidth={1.5}
      className="w-5 h-5 shrink-0"
    >
      <path d="M12 2.5l3.09 6.26 6.91 1-5 4.87 1.18 6.88L12 17.98l-6.18 3.53L7 14.63l-5-4.87 6.91-1L12 2.5z" />
    </svg>
  );
}

function fmtPlain(v: number | null | undefined) {
  if (v == null) return '-';
  const rounded = Math.round(v * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

function fmtSigned(v: number | null | undefined) {
  if (v == null) return '-';
  const rounded = Math.round(v * 10) / 10;
  return `${rounded > 0 ? '+' : ''}${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`;
}

function change24hClass(v: number | null) {
  return v == null ? 'text-slate-500' : v >= 0 ? 'text-green-400' : 'text-red-400';
}

function change24hText(v: number | null) {
  return v == null ? 'N/A' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

function followPriceColor(follow: NonNullable<PotentialRow['follow']>, item: PotentialApiItem): string {
  if (follow.priceUsd == null || item.priceUsd == null) return 'text-slate-400';
  if (item.priceUsd > follow.priceUsd) return 'text-green-400';
  if (item.priceUsd < follow.priceUsd) return 'text-red-400';
  return 'text-slate-400';
}

function followPctText(follow: NonNullable<PotentialRow['follow']>, item: PotentialApiItem): string {
  if (follow.priceUsd == null || item.priceUsd == null || follow.priceUsd === 0) return '';
  const pct = Math.abs(((item.priceUsd - follow.priceUsd) / follow.priceUsd) * 100);
  const rounded = pct < 10 ? pct.toFixed(1) : Math.round(pct).toString();
  return ` (${rounded}%)`;
}

function followTooltip(f: NonNullable<PotentialRow['follow']>) {
  const netBull = f.bull != null && f.bear != null ? f.bull - f.bear : f.netBull;
  return [
    `Followed ${relativeTimeLong(f.followedAt)}`,
    `Price: ${formatPriceShort(f.priceUsd)}`,
    `W.A.I: ${f.wai ?? '-'}`,
    `Bull: ${fmtPlain(f.bull)}`,
    `Bear: ${fmtPlain(f.bear)}`,
    `NetBull: ${fmtSigned(netBull)}`,
  ].join('\n');
}

function RowCells({
  row,
  onToggleFollow,
  onOpenChart,
}: {
  row: PotentialRow;
  onToggleFollow: () => void;
  onOpenChart: (item: PotentialApiItem) => void;
}) {
  const { item } = row;
  const e0 = item.entries[0];
  const e1 = item.entries[1];
  const priceColor =
    e0?.price != null && e1?.price != null
      ? e0.price > e1.price
        ? 'text-green-400'
        : e0.price < e1.price
        ? 'text-red-400'
        : 'text-slate-300'
      : 'text-slate-300';
  const waiDiff = e0?.top10 != null && e1?.top10 != null ? e0.top10 - e1.top10 : null;
  const strongBuy = e0?.display?.endsWith('+');
  const hasWhale = e0?.topwhale === 'y';
  const netBull = e0?.incBull != null && e0?.decBear != null ? e0.incBull - e0.decBear : null;
  const bullBearColorClass = trendTextClassHtml(
    bullBearTrend(e0?.incBull ?? null, e0?.decBear ?? null, e1?.incBull ?? null, e1?.decBear ?? null, !e1)
  );
  const netBullColorClass = trendTextClassHtml(
    netBullTrendState(e0?.incBull ?? null, e0?.decBear ?? null, e1?.incBull ?? null, e1?.decBear ?? null)
  );
  const bigWhaleColorClass = trendTextClassHtml(trendUpDown(e0?.bigwhale ?? null, e1?.bigwhale ?? null));
  const detailHref = `/${item.chain}/${item.ca}`;

  function handleStarClick(e: React.MouseEvent) {
    e.stopPropagation();
    onToggleFollow();
  }

  return (
    <>
      <td className="p-2.5">
        <button onClick={handleStarClick} aria-label="Toggle follow">
          <StarIcon filled={row.isFollowed} />
        </button>
      </td>
      <td className="p-2.5 min-w-[190px]">
        <div className="flex items-center gap-2">
          <div className="relative w-8 h-8 shrink-0">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.symbol} className="w-8 h-8 rounded-full object-cover" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-800" />
            )}
            <span className="absolute -bottom-1 -right-1 ring-1 ring-slate-900 rounded-[3px] overflow-hidden">
              <NetworkIcon chain={item.chain} className="w-3 h-3" />
            </span>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); onOpenChart(item); }}
                className="text-sm font-bold text-blue-400 hover:text-blue-300 truncate"
              >
                {item.symbol}
              </button>
              {row.isNew && (
                <span className="text-[9px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  New
                </span>
              )}
            </div>
            {row.isFollowed && row.follow ? (
              <div
                className={`text-[11px] truncate cursor-help ${followPriceColor(row.follow, item)}`}
                title={followTooltip(row.follow)}
              >
                Following · at {formatPriceShort(row.follow.priceUsd)}
                {followPctText(row.follow, item)}
              </div>
            ) : (
              item.name && <div className="text-[11px] text-slate-500 truncate">{item.name}</div>
            )}
          </div>
        </div>
      </td>
      <td className="p-2.5 whitespace-nowrap">
        <button
          onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(item.ca); }}
          className="font-mono text-xs text-slate-400 hover:text-blue-300"
          title="Click to copy"
        >
          {item.ca.slice(0, 6)}...{item.ca.slice(-4)}
        </button>
      </td>
      <td className="p-2.5 whitespace-nowrap text-sm text-slate-400">{formatAge(item.pairCreatedAt)}</td>
      <td className="p-2.5 whitespace-nowrap">
        <PlatformBadge platform={item.platform} size="sm" />
      </td>
      <td className={`p-2.5 whitespace-nowrap font-mono text-sm ${priceColor}`}>{formatPriceShort(item.priceUsd)}</td>
      <td className={`p-2.5 whitespace-nowrap text-sm ${change24hClass(item.change24h)}`}>{change24hText(item.change24h)}</td>
      <td className="p-2.5 whitespace-nowrap text-sm">{formatCap(item.marketCap)}</td>
      <td className="p-2.5 whitespace-nowrap text-sm">{formatCap(item.liq)}</td>
      <td className="p-2.5 whitespace-nowrap text-sm">{formatCap(item.vol1h)}</td>
      <td className="p-2.5 whitespace-nowrap text-sm">{formatCap(item.vol6h)}</td>
      <td className="p-2.5 whitespace-nowrap text-sm">{formatCap(item.vol24h)}</td>
      <td className="p-2.5 whitespace-nowrap">
        <div className="flex items-center gap-1">
          <ScoreBadge scoreDisplay={e0?.display ?? '0'} score={e0?.score ?? 0} />
          {hasWhale && <span title="Has Whale">🐋</span>}
          {strongBuy && (
            <span className="text-green-500 font-bold" title="Strong buying">
              ▲
            </span>
          )}
        </div>
      </td>
      <td className="p-2.5 whitespace-nowrap text-sm cursor-help" title="Whale Accumulation Index">
        {e0?.top10 ?? '-'}
        {waiDiff != null && waiDiff !== 0 && (
          <span className={`ml-1 text-[11px] ${waiDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
            ({waiDiff > 0 ? '+' : ''}
            {waiDiff})
          </span>
        )}
      </td>
      <td className={`p-2.5 whitespace-nowrap text-sm ${bullBearColorClass}`}>
        {fmtPlain(e0?.incBull)} / {fmtPlain(e0?.decBear)}
      </td>
      <td className={`p-2.5 whitespace-nowrap text-sm ${netBullColorClass}`}>{fmtSigned(netBull)}</td>
      <td className={`p-2.5 whitespace-nowrap text-sm ${bigWhaleColorClass}`}>{fmtPlain(e0?.bigwhale)}</td>
      <td className="p-2.5 whitespace-nowrap">
        <a
          href={detailHref}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-block px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300"
        >
          Detail
        </a>
      </td>
    </>
  );
}

export function PotentialTable({
  rows,
  onToggleFollow,
  emptyMessage = 'No tokens match current filters yet. Set your criteria above and click "Filter tokens".',
}: {
  rows: PotentialRow[];
  onToggleFollow: (row: PotentialRow) => void;
  emptyMessage?: string;
}) {
  const [chartTarget, setChartTarget] = useState<ChartTarget | null>(null);

  function openChart(item: PotentialApiItem) {
    setChartTarget({ category: item.category, ca: item.ca, symbol: item.symbol, chain: item.chain, platform: item.platform });
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto rounded-xl border border-slate-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-900 text-blue-400">
              <th className="text-left p-2.5"></th>
              <th className="text-left p-2.5">Token</th>
              <th className="text-left p-2.5">CA</th>
              <th className="text-left p-2.5">Age</th>
              <th className="text-left p-2.5">Platform</th>
              <th className="text-left p-2.5">Price</th>
              <th className="text-left p-2.5">Change24h</th>
              <th className="text-left p-2.5">Market Cap</th>
              <th className="text-left p-2.5">Liquidity</th>
              <th className="text-left p-2.5">Vol 1h</th>
              <th className="text-left p-2.5">Vol 6h</th>
              <th className="text-left p-2.5">Vol 24h</th>
              <th className="text-left p-2.5">WYCKSCORE</th>
              <th className="text-left p-2.5 cursor-help" title="Whale Accumulation Index">
                W.A.I
              </th>
              <th className="text-left p-2.5">Bull / Bear</th>
              <th className="text-left p-2.5">Net</th>
              <th className="text-left p-2.5">BigWhale</th>
              <th className="text-left p-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.item.chain}-${row.item.ca}`}
                onClick={() => openChart(row.item)}
                className={`border-t border-slate-800 hover:bg-slate-800/50 transition-colors cursor-pointer ${
                  row.isFollowed ? 'bg-yellow-500/[0.06]' : ''
                }`}
              >
                <RowCells row={row} onToggleFollow={() => onToggleFollow(row)} onOpenChart={openChart} />
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={18} className="p-6 text-center text-slate-500">
                  {emptyMessage}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="lg:hidden space-y-2">
        {rows.length === 0 && (
          <p className="text-slate-500 text-sm text-center py-6">{emptyMessage}</p>
        )}
        {rows.map((row) => {
          const { item } = row;
          const e0 = item.entries[0];
          const e1 = item.entries[1];
          const hasWhale = e0?.topwhale === 'y';
          const strongBuy = e0?.display?.endsWith('+');
          const waiDiff = e0?.top10 != null && e1?.top10 != null ? e0.top10 - e1.top10 : null;
          const priceColor =
            e0?.price != null && e1?.price != null
              ? e0.price > e1.price
                ? 'text-green-400'
                : e0.price < e1.price
                ? 'text-red-400'
                : 'text-slate-300'
              : 'text-slate-300';
          const netBull = e0?.incBull != null && e0?.decBear != null ? e0.incBull - e0.decBear : null;
          const bullBearColorClass = trendTextClassHtml(
            bullBearTrend(e0?.incBull ?? null, e0?.decBear ?? null, e1?.incBull ?? null, e1?.decBear ?? null, !e1)
          );
          const netBullColorClass = trendTextClassHtml(
            netBullTrendState(e0?.incBull ?? null, e0?.decBear ?? null, e1?.incBull ?? null, e1?.decBear ?? null)
          );
          const bigWhaleColorClass = trendTextClassHtml(trendUpDown(e0?.bigwhale ?? null, e1?.bigwhale ?? null));
          const detailHref = `/${item.chain}/${item.ca}`;

          return (
            <div
              key={`${item.chain}-${item.ca}`}
              onClick={() => openChart(item)}
              className={`rounded-xl border border-slate-800 p-3 space-y-2 transition-colors hover:bg-slate-800/40 cursor-pointer ${
                row.isFollowed ? 'bg-yellow-500/[0.06]' : 'bg-slate-900'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="relative w-8 h-8 shrink-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.symbol} className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-slate-800" />
                    )}
                    <span className="absolute -bottom-1 -right-1 ring-1 ring-slate-900 rounded-[3px] overflow-hidden">
                      <NetworkIcon chain={item.chain} className="w-3 h-3" />
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <button onClick={(e) => { e.stopPropagation(); openChart(item); }} className="text-sm font-bold text-blue-400 truncate">
                        {item.symbol}
                      </button>
                      {row.isNew && (
                        <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          New
                        </span>
                      )}
                    </div>
                    {row.isFollowed && row.follow ? (
                      <div className={`text-[11px] ${followPriceColor(row.follow, item)}`} title={followTooltip(row.follow)}>
                        Following · at {formatPriceShort(row.follow.priceUsd)}
                {followPctText(row.follow, item)}
                      </div>
                    ) : (
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(item.ca); }}
                        className="text-[11px] text-slate-500 font-mono"
                      >
                        {item.ca.slice(0, 6)}...{item.ca.slice(-4)}
                      </button>
                    )}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onToggleFollow(row); }} className="shrink-0">
                  <StarIcon filled={row.isFollowed} />
                </button>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-slate-500">{formatAge(item.pairCreatedAt)}</span>
                <PlatformBadge platform={item.platform} size="sm" />
                <ScoreBadge scoreDisplay={e0?.display ?? '0'} score={e0?.score ?? 0} />
                {hasWhale && <span>🐋</span>}
                {strongBuy && <span className="text-green-500 font-bold">▲</span>}
              </div>

              <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">Price</div>
                  <div className={`font-bold font-mono ${priceColor}`}>{formatPriceShort(item.priceUsd)}</div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">Change24h</div>
                  <div className={`font-bold ${change24hClass(item.change24h)}`}>{change24hText(item.change24h)}</div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">MCap</div>
                  <div className="font-bold">{formatCap(item.marketCap)}</div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">Liq</div>
                  <div className="font-bold">{formatCap(item.liq)}</div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">Vol1h</div>
                  <div className="font-bold">{formatCap(item.vol1h)}</div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">Vol6h</div>
                  <div className="font-bold">{formatCap(item.vol6h)}</div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">Vol24h</div>
                  <div className="font-bold">{formatCap(item.vol24h)}</div>
                </div>
                <div className="bg-slate-950 rounded-md py-1 cursor-help" title="Whale Accumulation Index">
                  <div className="text-slate-500">W.A.I</div>
                  <div className="font-bold">
                    {e0?.top10 ?? '-'}
                    {waiDiff != null && waiDiff !== 0 && (
                      <span className={waiDiff > 0 ? 'text-green-400' : 'text-red-400'}>
                        {' '}
                        {waiDiff > 0 ? '+' : ''}
                        {waiDiff}
                      </span>
                    )}
                  </div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">Bull/Bear</div>
                  <div className={bullBearColorClass}>
                    {fmtPlain(e0?.incBull)} / {fmtPlain(e0?.decBear)}
                  </div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">Net</div>
                  <div className={netBullColorClass}>{fmtSigned(netBull)}</div>
                </div>
                <div className="bg-slate-950 rounded-md py-1">
                  <div className="text-slate-500">BigWhale</div>
                  <div className={bigWhaleColorClass}>{fmtPlain(e0?.bigwhale)}</div>
                </div>
              </div>

              <a
                href={detailHref}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="block text-center w-full py-1.5 text-xs font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-blue-400"
              >
                Detail
              </a>
            </div>
          );
        })}
      </div>

      {chartTarget && (
        <PriceChartModal
          category={chartTarget.category}
          ca={chartTarget.ca}
          symbol={chartTarget.symbol}
          onClose={() => setChartTarget(null)}
          chainId={chartTarget.chain}
          platform={chartTarget.platform}
        />
      )}
    </>
  );
}