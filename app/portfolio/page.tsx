'use client';

import React, { useEffect, useState } from 'react';
import { useAccount } from 'wagmi';
import { useTokenGate, VIP_THRESHOLD } from '@/lib/tokenGate';
import { BuyTokenPrompt } from '@/components/BuyTokenPrompt';
import { fetchAllCategories, fetchRobinhoodTokens, fetchArcTokens, TokenEntry } from '@/lib/tokenApi';
import { getWalletHeldTokens, WalletToken } from '@/lib/walletTokens';
import { prefetchDexDataBatch, getCachedDexData } from '@/lib/dexData';
import { PriceChartModal } from '@/components/PriceChartModal';
import { PlatformBadge } from '@/components/PlatformBadge';
import { formatCap } from '@/lib/format';
import { ScoreBadge } from '@/components/ScoreBadge';
import Link from 'next/link';

type ChainKey = 'base' | 'robinhood' | 'arc';

function BaseIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={`${className} rounded-[5px] overflow-hidden shrink-0`}>
      <rect width="400" height="400" fill="#FFFFFF" />
      <rect x="80" y="80" width="240" height="240" rx="28" ry="28" fill="#0052FF" />
    </svg>
  );
}

function RobinhoodIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={`${className} rounded-[5px] overflow-hidden shrink-0`}>
      <rect width="400" height="400" fill="#ccff00" />
      <g fill="#211d19">
        <path d="M 185 133.5 L 170.5 148 C 142 176.5, 131 220, 131 245 C 131 260, 120 300, 106 321 L 115 321 C 137 280, 149 220, 172 172 Z" />
        <path d="M 249 80 C 275 80, 294 100, 294 130 C 294 150, 280 178, 252 206 L 252 145 L 237 130 L 185 122 Z" />
        <path d="M 238 145 L 238 215 L 150 272 C 175 235, 205 185, 238 145 Z" />
      </g>
    </svg>
  );
}

function ArcIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={`${className} rounded-[5px] overflow-hidden shrink-0`}>
      <rect width="500" height="500" rx="250" fill="#1B3158"/>
      <path d="M250.466 85C291.387 85 327.762 120.453 352.899 184.828C365.973 218.31 375.592 258.091 381.291 301.368C381.801 305.233 382.234 309.161 382.679 313.081C382.824 313.323 382.911 313.548 382.881 313.731C382.881 313.731 386.231 334.649 386.942 371.001H386.564C381.597 366.924 323.011 320.889 225.894 334.219C227.359 317.784 229.374 301.793 231.978 286.465C232.111 285.682 232.265 284.925 232.4 284.147C270.491 282.999 303.831 287.422 329.397 293.219C329.302 292.612 329.223 291.988 329.126 291.384C323.871 258.658 316.118 228.697 306.121 203.093C289.776 161.227 268.447 135.216 250.466 135.216C232.486 135.216 211.157 161.228 194.812 203.093C190.856 213.219 187.254 224.019 184.024 235.41C179.483 251.372 175.668 268.484 172.621 286.464C168.112 313.017 165.295 341.496 164.257 371.001H114C116.319 300.984 128.19 235.639 148.033 184.828C173.165 120.453 209.545 85.0002 250.466 85Z" fill="white"/>
    </svg>
  );
}

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

export default function PortfolioPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(VIP_THRESHOLD);
  const { address } = useAccount();
  const { holdings, loading, error } = useWalletHoldings(hasAccess ? address : undefined);
  const [chartToken, setChartToken] = useState<{ category: number; ca: string; symbol: string; chainId: ChainKey; platform?: string | null } | null>(null);

  console.log('[portfolio] holdings:', holdings.length, 'error:', error, 'loading:', loading, holdings);

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

  console.log('[portfolio] filtered:', filtered.length);

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
                <th className="text-left p-3 whitespace-nowrap"></th>
                <th className="text-left p-3 whitespace-nowrap">Token</th>
                <th className="text-left p-3 whitespace-nowrap">Platform</th>
                <th className="text-left p-3 whitespace-nowrap">CA</th>
                <th className="text-left p-3 whitespace-nowrap">Market Cap</th>
                <th className="text-left p-3 whitespace-nowrap">Liquidity</th>
                <th className="text-left p-3 whitespace-nowrap">Vol 24h</th>
                <th className="text-left p-3 whitespace-nowrap">Change 24h</th>
                <th className="text-left p-3 whitespace-nowrap">Balance</th>
                <th className="text-left p-3 whitespace-nowrap">Value (USD)</th>
                <th className="text-left p-3 whitespace-nowrap">WYCKSCORE</th>
              </tr>
            </thead>
            <tbody>
            {filtered.map((h) => {
              const dex = getCachedDexData(h.ca);
              const change24h = dex?.h24;
              const valueUsd = dex?.priceUsd != null ? h.qty * dex.priceUsd : null;

              console.log('[row]', h.symbol, h.ca, JSON.stringify({
                priceUsd: dex?.priceUsd,
                marketCap: dex?.marketCap,
                qty: h.qty,
                valueUsd,
              }));

              const dexscreenerSlug = h.chainKey;
                return (
                  <tr key={`${h.chainKey}-${h.ca}`} className="border-t border-slate-800">
                    <td className="p-3">
                      <div className="relative w-6 h-6 shrink-0">
                        {dex?.imageUrl ? (
                          <img src={dex.imageUrl} alt={h.symbol} className="w-6 h-6 rounded object-cover" />
                        ) : (
                          <div className="w-6 h-6 rounded bg-slate-800" />
                        )}
                        <span className="absolute -bottom-1 -right-1 ring-1 ring-slate-900 rounded-[3px] overflow-hidden">
                          {h.chainKey === 'base' ? (
                            <BaseIcon className="w-3 h-3" />
                          ) : h.chainKey === 'arc' ? (
                            <ArcIcon className="w-3 h-3" />
                          ) : (
                            <RobinhoodIcon className="w-3 h-3" />
                          )}
                        </span>
                      </div>
                    </td>
                    <td className="p-3 font-semibold whitespace-nowrap">
                      <Link href={`/${h.chainKey}/${h.ca}`} className="text-blue-400 hover:text-blue-300 underline decoration-dotted">
                        {h.symbol}
                      </Link>
                    </td>
                    <td className="p-3">
                      <PlatformBadge platform={h.platform} />
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <Link href={`/${h.chainKey}/${h.ca}`} className="text-blue-400 hover:underline text-xs">
                        View Chart
                      </Link>
                      {' '}
                      <Link href={`/${h.chainKey}/${h.ca}`} className="font-mono text-xs text-blue-400 hover:underline">
                        {h.ca.slice(0, 6)}...{h.ca.slice(-4)}
                      </Link>
                    </td>
                    <td className="p-3 whitespace-nowrap">{dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}</td>
                    <td className="p-3 whitespace-nowrap">{dex?.liq == null ? 'N/A' : formatCap(dex.liq)}</td>
                    <td className="p-3 whitespace-nowrap">{dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</td>
                    <td className={`p-3 whitespace-nowrap ${change24h == null ? 'text-slate-500' : change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change24h == null ? 'N/A' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
                    </td>
                    <td className="p-3 whitespace-nowrap">{h.qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="p-3 whitespace-nowrap">{valueUsd == null ? 'N/A' : formatCap(valueUsd)}</td>
                    <td className="p-3 whitespace-nowrap">
                      {h.score != null && h.scoreDisplay ? (
                        <ScoreBadge scoreDisplay={h.scoreDisplay} score={h.score} />
                      ) : (
                        <span className="text-slate-500 text-xs">N/A</span>
                      )}
                    </td>
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