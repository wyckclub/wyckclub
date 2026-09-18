'use client';

import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useTokenGate, VIP_THRESHOLD } from '@/lib/tokenGate';
import { BuyTokenPrompt } from '@/components/BuyTokenPrompt';
import { fetchAllCategories, fetchRobinhoodTokens, fetchArcTokens, TokenEntry } from '@/lib/tokenApi';
import { getWalletHeldTokens, WalletToken } from '@/lib/walletTokens';
import { prefetchDexDataBatch, getCachedDexData } from '@/lib/dexData';
import { PriceChartModal, trendUpDown, bullBearTrend, netBullTrendState, trendTextClassHtml } from '@/components/PriceChartModal';
import { PlatformBadge } from '@/components/PlatformBadge';
import { NetworkIcon } from '@/components/NetworkIcon';
import { formatCap, formatPriceShort, formatAge } from '@/lib/format';
import { ScoreBadge } from '@/components/ScoreBadge';
import type { PotentialApiItem } from '@/app/api/potential/route';
import Link from 'next/link';

type ChainKey = 'base' | 'robinhood' | 'arc';

interface Holding {
  chainKey: ChainKey;
  ca: string;
  symbol: string;
  qty: number;
  category: number | null;
  platform: string;
  valueUsd: number | null;
  score: number | null;
  scoreDisplay: string | null;
}

const HOLDINGS_TTL = 60 * 1000;

function loadHoldingsCache(key: string): Holding[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: { data: Holding[]; timestamp: number } = JSON.parse(raw);
    if (Date.now() - parsed.timestamp >= HOLDINGS_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function saveHoldingsCache(key: string, data: Holding[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ data, timestamp: Date.now() }));
  } catch {}
}

function hasEnoughLiq(ca: string): boolean {
  const liq = getCachedDexData(ca)?.liq;
  return liq == null || liq >= 1000;
}

function toHolding(chainKey: ChainKey, t: WalletToken): Holding {
  const dex = getCachedDexData(t.CA);
  const valueUsd = dex?.priceUsd != null ? t.qty * dex.priceUsd : null;
  return {
    chainKey, ca: t.CA, symbol: t.symbol, qty: t.qty,
    category: t.category, platform: t.platform, valueUsd,
    score: t.score, scoreDisplay: t.scoreDisplay,
  };
}

function useWalletHoldings(address?: string) {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!address) return;
    let cancelled = false;
    const cacheKey = `wyck_holdings_v5_${address.toLowerCase()}`;

    async function run() {
      if (!address) return;
      const addr: string = address;

      const cached = loadHoldingsCache(cacheKey);
      if (cached) {
        setHoldings(cached);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const [baseCats, rhTokens, arcTokens] = await Promise.all([
          fetchAllCategories(), fetchRobinhoodTokens(), fetchArcTokens(),
        ]);
        const arcKnown = new Map(arcTokens.map((t) => [t.CA.toLowerCase(), t] as [string, TokenEntry]));
        const baseKnown = new Map(baseCats.map((t) => [t.CA.toLowerCase(), t] as [string, TokenEntry]));
        const rhKnown = new Map(rhTokens.map((t) => [t.CA.toLowerCase(), t] as [string, TokenEntry]));

        let baseErr = '', rhErr = '', arcErr = '';
        const [baseHeld, rhHeld, arcHeld] = await Promise.all([
          getWalletHeldTokens('base', addr, baseKnown).catch((e) => {
            console.error('Base wallet tokens failed', e);
            baseErr = e.message || 'Base fetch failed';
            return [] as WalletToken[];
          }),
          getWalletHeldTokens('robinhood', addr, rhKnown).catch((e) => {
            console.error('Robinhood wallet tokens failed', e);
            rhErr = e.message || 'Robinhood fetch failed';
            return [] as WalletToken[];
          }),
          getWalletHeldTokens('arc', addr, arcKnown).catch((e) => {
            console.error('Arc wallet tokens failed', e);
            arcErr = e.message || 'Arc fetch failed';
            return [] as WalletToken[];
          }),
        ]);

        if (!baseHeld.length && !rhHeld.length && !arcHeld.length && (baseErr || rhErr || arcErr)) {
          setError([baseErr, rhErr, arcErr].filter(Boolean).join(' | '));
        }

        if (cancelled) return;

        await Promise.all([
          baseHeld.length
            ? prefetchDexDataBatch(baseHeld.map((t) => t.CA), undefined, 'base')
                .catch((e) => console.error('Base dex prefetch failed', e))
            : Promise.resolve(),
          rhHeld.length
            ? prefetchDexDataBatch(rhHeld.map((t) => t.CA), undefined, 'robinhood')
                .catch((e) => console.error('Robinhood dex prefetch failed', e))
            : Promise.resolve(),
          arcHeld.length
            ? prefetchDexDataBatch(arcHeld.map((t) => t.CA), undefined, 'arc')
                .catch((e) => console.error('Arc dex prefetch failed', e))
            : Promise.resolve(),
        ]);

        const combined = [
          ...baseHeld.map((t) => toHolding('base', t)),
          ...rhHeld.map((t) => toHolding('robinhood', t)),
          ...arcHeld.map((t) => toHolding('arc', t)),
        ].sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));

        setHoldings(combined);
        saveHoldingsCache(cacheKey, combined);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load wallet holdings');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [address]);

  return { holdings, loading, error };
}

// ---- dữ liệu bổ sung (Age, Vol1h/6h, W.A.I, Bull/Bear, Net, BigWhale) lấy từ /api/potential (dữ liệu thật, cùng nguồn với trang Potential) ----
function usePotentialMap() {
  const [map, setMap] = useState<Record<string, PotentialApiItem>>({});
  useEffect(() => {
    let cancelled = false;
    fetch('/api/potential', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const items: PotentialApiItem[] = Array.isArray(d.items) ? d.items : [];
        const m: Record<string, PotentialApiItem> = {};
        items.forEach((i) => { m[`${i.chain}:${i.ca.toLowerCase()}`] = i; });
        setMap(m);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return map;
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

function change24hClass(v: number | null | undefined) {
  return v == null ? 'text-slate-500' : v >= 0 ? 'text-green-400' : 'text-red-400';
}
function change24hText(v: number | null | undefined) {
  return v == null ? 'N/A' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`;
}

export default function PortfolioPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(VIP_THRESHOLD);
  const { address } = useAccount();
  const { holdings, loading, error } = useWalletHoldings(hasAccess ? address : undefined);
  const potentialMap = usePotentialMap();
  const [chartToken, setChartToken] = useState<{ category: number; ca: string; symbol: string; chainId: ChainKey; platform?: string | null } | null>(null);

  if (!isConnected) return <GateMessage title="Connect your wallet" message="Connect your wallet to check Portfolio access." />;
  if (isLoading) return <GateMessage title="Checking balance..." message="" />;
  if (!hasAccess) {
    return (
      <GateMessage
        title="Portfolio Locked"
        message={`You need at least ${VIP_THRESHOLD.toLocaleString()} tokens. Your balance: ${amount.toLocaleString()}.`}
        showBuyPrompt
      />
    );
  }

  const filtered = holdings.filter((h) => hasEnoughLiq(h.ca));

  return (
    <div className="w-full px-4 py-6 space-y-6">
      <h2 className="text-2xl font-bold text-blue-400">Portfolio - Wallet Holdings</h2>
      {error && <p className="text-red-400">{error}</p>}
      {loading && <p className="text-slate-400">Tracking Your Wallet...</p>}
      {!loading && !error && filtered.length === 0 && (
        <p className="text-slate-400">No tracked tokens found in this wallet.</p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-blue-400">
                <th className="text-left p-2.5 whitespace-nowrap"></th>
                <th className="text-left p-2.5 whitespace-nowrap">Token</th>
                <th className="text-left p-2.5 whitespace-nowrap">CA</th>
                <th className="text-left p-2.5 whitespace-nowrap">Age</th>
                <th className="text-left p-2.5 whitespace-nowrap">Platform</th>
                <th className="text-left p-2.5 whitespace-nowrap">Price</th>
                <th className="text-left p-2.5 whitespace-nowrap">Change24h</th>
                <th className="text-left p-2.5 whitespace-nowrap">MCap</th>
                <th className="text-left p-2.5 whitespace-nowrap">Liq</th>
                <th className="text-left p-2.5 whitespace-nowrap">Vol 1h</th>
                <th className="text-left p-2.5 whitespace-nowrap">Vol 6h</th>
                <th className="text-left p-2.5 whitespace-nowrap">Vol 24h</th>
                <th className="text-left p-2.5 whitespace-nowrap">WYCKSCORE</th>
                <th className="text-left p-2.5 whitespace-nowrap cursor-help" title="Whale Accumulation Index">W.A.I</th>
                <th className="text-left p-2.5 whitespace-nowrap">Bull / Bear</th>
                <th className="text-left p-2.5 whitespace-nowrap">Net</th>
                <th className="text-left p-2.5 whitespace-nowrap">BigWhale</th>
                <th className="text-left p-2.5 whitespace-nowrap"></th>
                <th className="text-left p-2.5 whitespace-nowrap">Balance</th>
                <th className="text-left p-2.5 whitespace-nowrap">Value (USD)</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => {
                const dex = getCachedDexData(h.ca);
                const item = potentialMap[`${h.chainKey}:${h.ca.toLowerCase()}`];
                const e0 = item?.entries[0];
                const e1 = item?.entries[1];
                const valueUsd = dex?.priceUsd != null ? h.qty * dex.priceUsd : null;

                const netBull = e0?.incBull != null && e0?.decBear != null ? e0.incBull - e0.decBear : null;
                const bullBearColorClass = trendTextClassHtml(
                  bullBearTrend(e0?.incBull ?? null, e0?.decBear ?? null, e1?.incBull ?? null, e1?.decBear ?? null, !e1)
                );
                const netBullColorClass = trendTextClassHtml(
                  netBullTrendState(e0?.incBull ?? null, e0?.decBear ?? null, e1?.incBull ?? null, e1?.decBear ?? null)
                );
                const bigWhaleColorClass = trendTextClassHtml(trendUpDown(e0?.bigwhale ?? null, e1?.bigwhale ?? null));
                const waiDiff = e0?.top10 != null && e1?.top10 != null ? e0.top10 - e1.top10 : null;
                const hasWhale = e0?.topwhale === 'y';
                const strongBuy = e0?.display?.endsWith('+');
                const change24h = item?.change24h ?? dex?.h24 ?? null;
                const detailHref = `/${h.chainKey}/${h.ca}`;

                return (
                  <tr
                    key={`${h.chainKey}-${h.ca}`}
                    onClick={() => item && setChartToken({ category: item.category, ca: h.ca, symbol: h.symbol, chainId: h.chainKey, platform: h.platform })}
                    className="border-t border-slate-800 hover:bg-slate-800/50 cursor-pointer"
                  >
                    <td className="p-2.5">
                      <div className="relative w-7 h-7 shrink-0">
                        {dex?.imageUrl ? (
                          <img src={dex.imageUrl} alt={h.symbol} className="w-7 h-7 rounded-full object-cover" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800" />
                        )}
                        <span className="absolute -bottom-1 -right-1 ring-1 ring-slate-900 rounded-[3px] overflow-hidden">
                          <NetworkIcon chain={h.chainKey} className="w-3 h-3" />
                        </span>
                      </div>
                    </td>
                    <td className="p-2.5 font-semibold whitespace-nowrap">
                      <Link
                        href={detailHref}
                        onClick={(e) => e.stopPropagation()}
                        className="text-blue-400 hover:text-blue-300 underline decoration-dotted"
                      >
                        {h.symbol}
                      </Link>
                    </td>
                    <td className="p-2.5 whitespace-nowrap">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigator.clipboard?.writeText(h.ca); }}
                        className="font-mono text-xs text-slate-400 hover:text-blue-300"
                        title="Click to copy"
                      >
                        {h.ca.slice(0, 6)}...{h.ca.slice(-4)}
                      </button>
                    </td>
                    <td className="p-2.5 whitespace-nowrap text-slate-400">{formatAge(item?.pairCreatedAt ?? dex?.pairCreatedAt ?? null)}</td>
                    <td className="p-2.5 whitespace-nowrap"><PlatformBadge platform={h.platform} size="sm" /></td>
                    <td className="p-2.5 whitespace-nowrap">{formatPriceShort(dex?.priceUsd)}</td>
                    <td className={`p-2.5 whitespace-nowrap ${change24hClass(change24h)}`}>{change24hText(change24h)}</td>
                    <td className="p-2.5 whitespace-nowrap">{dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}</td>
                    <td className="p-2.5 whitespace-nowrap">{dex?.liq == null ? 'N/A' : formatCap(dex.liq)}</td>
                    <td className="p-2.5 whitespace-nowrap">{item?.vol1h == null ? 'N/A' : formatCap(item.vol1h)}</td>
                    <td className="p-2.5 whitespace-nowrap">{item?.vol6h == null ? 'N/A' : formatCap(item.vol6h)}</td>
                    <td className="p-2.5 whitespace-nowrap">{dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</td>
                    <td className="p-2.5 whitespace-nowrap">
                      {h.score != null && h.scoreDisplay ? (
                        <div className="flex items-center gap-1">
                          <ScoreBadge scoreDisplay={h.scoreDisplay} score={h.score} />
                          {hasWhale && <span title="Has Whale">🐋</span>}
                          {strongBuy && <span className="text-green-500 font-bold" title="Strong buying">▲</span>}
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs">N/A</span>
                      )}
                    </td>
                    <td className="p-2.5 whitespace-nowrap cursor-help" title="Whale Accumulation Index">
                      {e0?.top10 ?? '-'}
                      {waiDiff != null && waiDiff !== 0 && (
                        <span className={`ml-1 text-[11px] ${waiDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          ({waiDiff > 0 ? '+' : ''}{waiDiff})
                        </span>
                      )}
                    </td>
                    <td className={`p-2.5 whitespace-nowrap ${bullBearColorClass}`}>
                      {fmtPlain(e0?.incBull)} / {fmtPlain(e0?.decBear)}
                    </td>
                    <td className={`p-2.5 whitespace-nowrap ${netBullColorClass}`}>{fmtSigned(netBull)}</td>
                    <td className={`p-2.5 whitespace-nowrap ${bigWhaleColorClass}`}>{fmtPlain(e0?.bigwhale)}</td>
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
                    <td className="p-2.5 whitespace-nowrap">{h.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="p-2.5 whitespace-nowrap">{valueUsd == null ? 'N/A' : formatCap(valueUsd)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {chartToken && (
        <PriceChartModal
          category={chartToken.category}
          ca={chartToken.ca}
          symbol={chartToken.symbol}
          onClose={() => setChartToken(null)}
          chainId={chartToken.chainId}
          platform={chartToken.platform ?? null}
        />
      )}
    </div>
  );
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