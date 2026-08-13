'use client';

import React, { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useTokenGate, VIP_THRESHOLD } from '@/lib/tokenGate';
import { BuyTokenPrompt } from '@/components/BuyTokenPrompt';
import { fetchAllCategories, fetchRobinhoodTokens, TokenEntry, CATEGORY_LABELS } from '@/lib/tokenApi';
import { prefetchDexDataBatch, getCachedDexData } from '@/lib/dexData';
import { PriceChartModal } from '@/components/PriceChartModal';
import { VerifyBadge } from '@/components/VerifyBadge';
import { formatCap } from '@/lib/format';
import { base, robinhood } from '@/app/config';

const erc20Abi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

interface Holding {
  token: TokenEntry;
  qty: number;
  valueUsd: number | null;
}

type ChainKey = 'base' | 'robinhood';

function BaseIcon() {
  return (
    <svg viewBox="0 0 400 400" className="w-6 h-6 rounded-[5px] overflow-hidden shrink-0">
      <rect width="400" height="400" fill="#FFFFFF" />
      <rect x="80" y="80" width="240" height="240" rx="28" ry="28" fill="#0052FF" />
    </svg>
  );
}

function RobinhoodIcon() {
  return (
    <svg viewBox="0 0 400 400" className="w-6 h-6 rounded-[5px] overflow-hidden shrink-0">
      <rect width="400" height="400" fill="#ccff00" />
      <g fill="#211d19">
        <path d="M 185 133.5 
                 L 170.5 148 
                 C 142 176.5, 131 220, 131 245 
                 C 131 260, 120 300, 106 321 
                 L 115 321 
                 C 137 280, 149 220, 172 172 
                 Z" />
        <path d="M 249 80 
                 C 275 80, 294 100, 294 130 
                 C 294 150, 280 178, 252 206 
                 L 252 145 
                 L 237 130 
                 L 185 122 
                 Z" />
        <path d="M 238 145 
                 L 238 215 
                 L 150 272 
                 C 175 235, 205 185, 238 145 
                 Z" />
      </g>
    </svg>
  );
}

const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES = 500;
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

async function multicallWithRetry(publicClient: any, contracts: any[], retries = 3, delay = 800): Promise<any[]> {
  try {
    return await publicClient.multicall({ contracts, allowFailure: true });
  } catch (e: any) {
    const is429 = e?.message?.includes('429') || e?.details?.includes('429');
    if (retries > 0 && is429) {
      await new Promise((r) => setTimeout(r, delay));
      return multicallWithRetry(publicClient, contracts, retries - 1, delay * 2);
    }
    // Multicall3 có thể chưa deploy trên chain -> fallback gọi trực tiếp từng contract
    return Promise.all(
      contracts.map((c) =>
        publicClient
          .readContract(c)
          .then((result: any) => ({ status: 'success', result }))
          .catch(() => ({ status: 'failure', result: undefined }))
      )
    );
  }
}

function hasEnoughLiq(ca: string): boolean {
  const liq = getCachedDexData(ca)?.liq;
  return liq == null || liq >= 20000;
}

function useChainHoldings(chainKey: ChainKey, chainId: number, tokens: TokenEntry[], dexReady: boolean) {
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId });
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!address || !tokens.length || !publicClient || !dexReady) return;
    let cancelled = false;
    const cacheKey = `wyck_holdings_${chainKey}_v2_${address.toLowerCase()}`;

    async function run() {
      const cached = loadHoldingsCache(cacheKey);
      if (cached) {
        setHoldings(cached);
        return;
      }

      setLoading(true);
      setError('');

      const found: Holding[] = [];

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const contracts = batch.flatMap((t) => [
          { address: t.CA as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf' as const, args: [address as `0x${string}`] },
          { address: t.CA as `0x${string}`, abi: erc20Abi, functionName: 'decimals' as const },
        ]);

        try {
          const res = await multicallWithRetry(publicClient, contracts);
          batch.forEach((t, idx) => {
            const balRes = res[idx * 2];
            const decRes = res[idx * 2 + 1];
            if (balRes.status !== 'success' || decRes.status !== 'success') return;
            const raw = balRes.result as bigint;
            if (raw === BigInt(0)) return;
            const decimals = decRes.result as number;
            const qty = Number(raw) / 10 ** decimals;
            const dex = getCachedDexData(t.CA);
            const valueUsd = dex?.priceUsd != null ? qty * dex.priceUsd : null;
            found.push({ token: t, qty, valueUsd });
          });
        } catch (e) {
          console.error('Balance check error', chainKey, i, e);
          setError('Some tokens failed to check, results may be incomplete.');
        }

        if (i + BATCH_SIZE < tokens.length) {
          await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
        }
      }

      if (!cancelled) {
        found.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
        setHoldings(found);
        saveHoldingsCache(cacheKey, found);
        setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [address, tokens, dexReady, publicClient, chainKey]);

  return { holdings, loading, error };
}

export default function PortfolioPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(VIP_THRESHOLD);

  const [baseTokens, setBaseTokens] = useState<TokenEntry[]>([]);
  const [baseDexReady, setBaseDexReady] = useState(false);
  const [rhTokens, setRhTokens] = useState<TokenEntry[]>([]);
  const [rhDexReady, setRhDexReady] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [chartToken, setChartToken] = useState<{ category: number; ca: string; symbol: string; chainId: ChainKey; verified?: boolean } | null>(null);

  useEffect(() => {
    if (!hasAccess) return;

    fetchAllCategories()
      .then(async (data) => {
        setBaseTokens(data);
        try {
          await prefetchDexDataBatch(data.map((t) => t.CA));
        } catch (e) {
          console.error('Dex prefetch (base) failed', e);
        } finally {
          setBaseDexReady(true);
        }
      })
      .catch((e) => setLoadError(e.message));

    fetchRobinhoodTokens()
      .then(async (data) => {
        setRhTokens(data);
        try {
          await prefetchDexDataBatch(data.map((t) => t.CA), undefined, 'robinhood');
        } catch (e) {
          console.error('Dex prefetch (robinhood) failed', e);
        } finally {
          setRhDexReady(true);
        }
      })
      .catch((e) => setLoadError(e.message));
  }, [hasAccess]);

  const baseHoldings = useChainHoldings('base', base.id, baseTokens, baseDexReady);
  const rhHoldings = useChainHoldings('robinhood', robinhood.id, rhTokens, rhDexReady);

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

  return (
    <div className="w-full px-4 py-6 space-y-10">
      <h2 className="text-2xl font-bold text-blue-400">Portfolio - Wallet Holdings</h2>
      {loadError && <p className="text-red-400">{loadError}</p>}

      <HoldingsTable
        title="Base"
        icon={<BaseIcon />}
        chainKey="base"
        dexscreenerSlug="base"
        loading={!baseDexReady || baseHoldings.loading}
        error={baseHoldings.error}
        holdings={baseHoldings.holdings}
        showVerify={false}
        onOpenChart={(t) => setChartToken({ category: t.category, ca: t.CA, symbol: t.symbol, chainId: 'base' })}
      />

      <HoldingsTable
        title="Robinhood"
        icon={<RobinhoodIcon />}
        chainKey="robinhood"
        dexscreenerSlug="robinhood"
        loading={!rhDexReady || rhHoldings.loading}
        error={rhHoldings.error}
        holdings={rhHoldings.holdings}
        showVerify
        onOpenChart={(t) => setChartToken({ category: t.category, ca: t.CA, symbol: t.symbol, chainId: 'robinhood', verified: t.verified })}
      />

      {chartToken && (
        <PriceChartModal
          category={chartToken.category}
          ca={chartToken.ca}
          symbol={chartToken.symbol}
          onClose={() => setChartToken(null)}
          chainId={chartToken.chainId}
          verified={chartToken.verified ?? null}
        />
      )}
    </div>
  );
}

function HoldingsTable({
  title,
  icon,
  dexscreenerSlug,
  loading,
  error,
  holdings,
  showVerify,
  onOpenChart,
}: {
  title: string;
  icon: React.ReactNode;
  chainKey: ChainKey;
  dexscreenerSlug: string;
  loading: boolean;
  error: string;
  holdings: Holding[];
  showVerify: boolean;
  onOpenChart: (t: TokenEntry) => void;
}) {
  const filtered = holdings.filter((h) => hasEnoughLiq(h.token.CA));

  return (
    <div>
      <h3 className="flex items-center gap-2 text-xl font-bold text-blue-300 mb-3">
        {icon}
        {title}
      </h3>
      {error && <p className="text-yellow-400 text-sm mb-2">{error}</p>}
      {loading && <p className="text-slate-400">Tracking Your Wallet...</p>}
      {!loading && filtered.length === 0 && <p className="text-slate-400">No tracked tokens found in this wallet.</p>}
      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-blue-400">
                <th className="text-left p-3 whitespace-nowrap"></th>
                <th className="text-left p-3 whitespace-nowrap">Token</th>
                {showVerify && <th className="text-left p-3 whitespace-nowrap">Verify</th>}
                <th className="text-left p-3 whitespace-nowrap">CA</th>
                <th className="text-left p-3 whitespace-nowrap">Market Cap</th>
                <th className="text-left p-3 whitespace-nowrap">Liquidity</th>
                <th className="text-left p-3 whitespace-nowrap">Vol 24h</th>
                <th className="text-left p-3 whitespace-nowrap">Change 24h</th>
                <th className="text-left p-3 whitespace-nowrap">Balance</th>
                <th className="text-left p-3 whitespace-nowrap">Value (USD)</th>
                <th className="text-left p-3 whitespace-nowrap">Category</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ token: t, qty, valueUsd }) => {
                const dex = getCachedDexData(t.CA);
                const change24h = dex?.h24;
                return (
                  <tr key={t.CA} className="border-t border-slate-800">
                    <td className="p-3">
                      {dex?.imageUrl ? (
                        <img src={dex.imageUrl} alt={t.symbol} className="w-6 h-6 rounded object-cover" />
                      ) : (
                        <div className="w-6 h-6 rounded bg-slate-800" />
                      )}
                    </td>
                    <td
                      className="p-3 font-semibold whitespace-nowrap cursor-pointer text-blue-400 hover:text-blue-300 underline decoration-dotted"
                      onClick={() => onOpenChart(t)}
                    >
                      {t.symbol}
                    </td>
                    {showVerify && (
                      <td className="p-3">
                        <VerifyBadge verified={t.verified} className="w-5 h-5" />
                      </td>
                    )}
                    <td className="p-3 whitespace-nowrap">
                      <a href={`https://dexscreener.com/${dexscreenerSlug}/${t.CA}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-blue-400 hover:underline">
                        {t.CA.slice(0, 6)}...{t.CA.slice(-4)}
                      </a>
                    </td>
                    <td className="p-3 whitespace-nowrap">{dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}</td>
                    <td className="p-3 whitespace-nowrap">{dex?.liq == null ? 'N/A' : formatCap(dex.liq)}</td>
                    <td className="p-3 whitespace-nowrap">{dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</td>
                    <td className={`p-3 whitespace-nowrap ${change24h == null ? 'text-slate-500' : change24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {change24h == null ? 'N/A' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
                    </td>
                    <td className="p-3 whitespace-nowrap">{qty.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                    <td className="p-3 whitespace-nowrap">{valueUsd == null ? 'N/A' : formatCap(valueUsd)}</td>
                    <td className="p-3 whitespace-nowrap text-slate-400 text-xs">{CATEGORY_LABELS[t.category] ?? t.category}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
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