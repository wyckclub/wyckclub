'use client';

import { useEffect, useState } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { useTokenGate, VIP_THRESHOLD } from '@/lib/tokenGate';
import { BuyTokenPrompt } from '@/components/BuyTokenPrompt';
import { fetchAllCategories, TokenEntry, CATEGORY_LABELS } from '@/lib/tokenApi';
import { prefetchDexDataBatch, getCachedDexData } from '@/lib/dexData';
import { PriceChartModal } from '@/components/PriceChartModal';
import { formatCap, formatPriceShort, getWhaleStarredScore, getChartScoreTextColorClass, hasWhaleAtE0E1 } from '@/lib/format';

const erc20Abi = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ name: '', type: 'uint8' }] },
] as const;

interface Holding {
  token: TokenEntry;
  qty: number;
  valueUsd: number | null;
}

const BATCH_SIZE = 20;
const DELAY_BETWEEN_BATCHES = 500;
const HOLDINGS_TTL = 1 * 60 * 1000;
const HOLDINGS_CACHE_KEY = 'wyck_holdings_cache_v1';

type StrongSortCol = 'marketCap' | 'liq' | 'vol24h' | 'score' | 'change24h' | 'snapshot' | null;

function loadHoldingsCache(address: string): Holding[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${HOLDINGS_CACHE_KEY}_${address.toLowerCase()}`);
    if (!raw) return null;
    const parsed: { data: Holding[]; timestamp: number } = JSON.parse(raw);
    if (Date.now() - parsed.timestamp >= HOLDINGS_TTL) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function saveHoldingsCache(address: string, data: Holding[]) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${HOLDINGS_CACHE_KEY}_${address.toLowerCase()}`,
      JSON.stringify({ data, timestamp: Date.now() })
    );
  } catch {}
}

async function multicallWithRetry(
  publicClient: any,
  contracts: any[],
  retries = 4,
  delay = 1000
): Promise<any[]> {
  try {
    return await publicClient.multicall({ contracts, allowFailure: true });
  } catch (e: any) {
    const is429 = e?.message?.includes('429') || e?.details?.includes('429');
    if (retries > 0 && is429) {
      await new Promise((r) => setTimeout(r, delay));
      return multicallWithRetry(publicClient, contracts, retries - 1, delay * 2);
    }
    throw e;
  }
}

function getTier(t: TokenEntry): number {
  const scoreWithWhale = getWhaleStarredScore(t.latestScoreDisplay, t.last7);
  const hasWhale = scoreWithWhale.includes('🐋');
  const isYellow = getChartScoreTextColorClass(t.latestScore, t.last7) === 'text-yellow-400';
  const hasPlus = t.latestScoreDisplay.endsWith('+');
  const streakWithScore = hasWhaleAtE0E1(t.last7, true);
  const streak = hasWhaleAtE0E1(t.last7, false);

  if (streakWithScore) return 1;
  if (hasWhale && isYellow && hasPlus) return 2;
  if (streak) return 3;
  return 4;
}

function getStrongSortValue(t: TokenEntry, col: StrongSortCol): number {
  const d = getCachedDexData(t.CA);
  if (col === 'marketCap') return d?.marketCap ?? -Infinity;
  if (col === 'liq') return d?.liq ?? -Infinity;
  if (col === 'vol24h') return d?.vol24h ?? -Infinity;
  if (col === 'score') return t.latestScore ?? -Infinity;
  if (col === 'change24h') return d?.h24 ?? -Infinity;
  if (col === 'snapshot') {
    if (d?.priceUsd == null || !t.latestPrice) return -Infinity;
    return (d.priceUsd - t.latestPrice) / t.latestPrice;
  }
  return 0;
}

const SHARE_CATEGORIES: { category: number; label: string; title: string }[] = [
  { category: 3, label: 'Virtuals', title: '#VIRTUALS' },
  { category: 1, label: 'Bankr & Clanker', title: '#BANKR & #CLANKER' },
  { category: 2, label: 'Other Base', title: '#BASE' },
];

function buildShareText(
  tokens: { symbol: string; price: string; marketCap: string; ca: string }[],
  title: string
) {
  const date = new Date();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');

  const tokenBlocks = tokens
    .map((t) => `$${t.symbol} / ${t.price} / Cap: ${t.marketCap}\nCA: ${t.ca}`)
    .join('\n\n');

  return `⛈️ ${title} Smart Money Tracker ⛈️\nBest Positioned Tokens by @WYCKSCORE (${mm}/${dd})\n\n${tokenBlocks}\n\nPowered by #WYCKSCORE on #BASE`;
}

function handleShare(strongTokens: TokenEntry[], category: number) {
  const config = SHARE_CATEGORIES.find((c) => c.category === category);
  if (!config) return;

  const topTokens = strongTokens
    .filter((t) => t.category === category)
    .filter((t) => {
      const isYellow = getChartScoreTextColorClass(t.latestScore, t.last7) === 'text-yellow-400';
      return getTier(t) === 1 || getTier(t) === 2 || isYellow;
    })
    .map((t) => {
      const dex = getCachedDexData(t.CA);
      return {
        symbol: t.symbol,
        price: dex?.priceUsd == null ? null : `$${formatPriceShort(dex.priceUsd)}`,
        marketCap: dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap),
        ca: t.CA,
      };
    })
    .filter((t): t is { symbol: string; price: string; marketCap: string; ca: string } => t.price !== null);

  if (!topTokens.length) return;

  const text = buildShareText(topTokens, config.title);
  const url = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

export default function VipPlanPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(VIP_THRESHOLD);
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [dexReady, setDexReady] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [checkingBalances, setCheckingBalances] = useState(false);
  const [balanceError, setBalanceError] = useState('');
  const [chartToken, setChartToken] = useState<{ category: number; ca: string; symbol: string } | null>(null);
  const [shareMenuOpen, setShareMenuOpen] = useState(false);

  const [strongSortCol, setStrongSortCol] = useState<StrongSortCol>(null);
  const [strongSortDir, setStrongSortDir] = useState<1 | -1>(-1);

  function handleStrongSort(col: StrongSortCol) {
    setStrongSortDir(strongSortCol === col ? (strongSortDir === 1 ? -1 : 1) : 1);
    setStrongSortCol(col);
  }

  // 1. Load all tokens in data + dex prices
  useEffect(() => {
    if (!hasAccess) return;
    fetchAllCategories()
      .then(async (data) => {
        setTokens(data);
        await prefetchDexDataBatch(data.map((t) => t.CA));
        setDexReady(true);
      })
      .catch((e) => setLoadError(e.message));
  }, [hasAccess]);

  // 2. Check wallet balance for all tokens, batched + cached 10 minutes
  useEffect(() => {
    if (!address || !tokens.length || !publicClient || !dexReady) return;

    let cancelled = false;

    async function run() {
      const cached = loadHoldingsCache(address!);
      if (cached) {
        setHoldings(cached);
        return;
      }

      setCheckingBalances(true);
      setBalanceError('');
      const found: Holding[] = [];

      for (let i = 0; i < tokens.length; i += BATCH_SIZE) {
        if (cancelled) return;
        const batch = tokens.slice(i, i + BATCH_SIZE);
        const contracts = batch.flatMap((t) => [
          { address: t.CA as `0x${string}`, abi: erc20Abi, functionName: 'balanceOf' as const, args: [address as `0x${string}`] },
          { address: t.CA as `0x${string}`, abi: erc20Abi, functionName: 'decimals' as const },
        ]);

        try {
          const results = await multicallWithRetry(publicClient, contracts);
          batch.forEach((t, idx) => {
            const balRes = results[idx * 2];
            const decRes = results[idx * 2 + 1];
            if (balRes.status !== 'success' || decRes.status !== 'success') return;
            const raw = balRes.result as bigint;
            const decimals = decRes.result as number;
            if (raw === BigInt(0)) return;
            const qty = Number(raw) / 10 ** decimals;
            const dex = getCachedDexData(t.CA);
            const valueUsd = dex?.priceUsd != null ? qty * dex.priceUsd : null;
            found.push({ token: t, qty, valueUsd });
          });
        } catch (e) {
          console.error('Multicall batch error', i, e);
          setBalanceError('Some tokens failed to check, results may be incomplete.');
        }

        if (i + BATCH_SIZE < tokens.length) {
          await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES));
        }
      }

      if (!cancelled) {
        found.sort((a, b) => (b.valueUsd ?? 0) - (a.valueUsd ?? 0));
        setHoldings(found);
        saveHoldingsCache(address!, found);
        setCheckingBalances(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [address, tokens, dexReady, publicClient]);

  if (!isConnected) return <GateMessage title="Connect your wallet" message="Connect your wallet to check Vip Plan access." />;
  if (isLoading) return <GateMessage title="Checking balance..." message="" />;
  if (!hasAccess) {
    return (
      <GateMessage
        title="Vip Plan Locked"
        message={`You need at least ${VIP_THRESHOLD.toLocaleString()} tokens. Your balance: ${amount.toLocaleString()}.`}
        showBuyPrompt
      />
    );
  }

  const holdingsLoading = !dexReady || checkingBalances;
  const whaleLoading = !dexReady;

  const strongHeaders: { col: Exclude<StrongSortCol, null>; label: string }[] = [
    { col: 'marketCap', label: 'Market Cap' },
    { col: 'liq', label: 'Liquidity' },
    { col: 'vol24h', label: 'Vol 24h' },
    { col: 'score', label: 'WYCKSCORE' },
    { col: 'change24h', label: 'Change 24h' },
    { col: 'snapshot', label: 'Snapshot Change' },
  ];

  return (
    <div className="w-full px-4 py-6">
      <h2 className="text-2xl font-bold text-blue-400 mb-4">Vip Plan - Wallet Holdings</h2>
      {loadError && <p className="text-red-400">{loadError}</p>}
      {balanceError && <p className="text-yellow-400 text-sm mb-2">{balanceError}</p>}
      {holdingsLoading && <p className="text-slate-400">Tracking Your Wallet...</p>}
      {!holdingsLoading && holdings.length === 0 && (
        <p className="text-slate-400">Your wallet doesn't contain any tracked tokens</p>
      )}
      {!holdingsLoading && holdings.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-blue-400">
                <th className="text-left p-3 whitespace-nowrap">Token</th>
                <th className="text-left p-3 whitespace-nowrap">CA</th>
                <th className="text-left p-3 whitespace-nowrap">Market Cap</th>
                <th className="text-left p-3 whitespace-nowrap">Liquidity</th>
                <th className="text-left p-3 whitespace-nowrap">Vol 24h</th>
                <th className="text-left p-3 whitespace-nowrap">WYCKSCORE</th>
                <th className="text-left p-3 whitespace-nowrap">Change 24h</th>
                <th className="text-left p-3 whitespace-nowrap">Snapshot Change</th>
                <th className="text-left p-3 whitespace-nowrap">Balance</th>
                <th className="text-left p-3 whitespace-nowrap">Value (USD)</th>
                <th className="text-left p-3 whitespace-nowrap">Category</th>
              </tr>
            </thead>
            <tbody>
              {holdings.filter((h) => hasEnoughLiq(h.token.CA)).map(({ token: t, qty, valueUsd }) => {
                const dex = getCachedDexData(t.CA);
                const change24h = dex?.h24;
                const snapshot =
                  dex?.priceUsd != null && t.latestPrice
                    ? ((dex.priceUsd - t.latestPrice) / t.latestPrice) * 100
                    : null;
                const scoreWithWhale = getWhaleStarredScore(t.latestScoreDisplay, t.last7);

                return (
                  <tr key={t.CA} className="border-t border-slate-800">
                    <td
                      className="p-3 font-semibold whitespace-nowrap cursor-pointer text-blue-400 hover:text-blue-300 underline decoration-dotted"
                      onClick={() => setChartToken({ category: t.category, ca: t.CA, symbol: t.symbol })}
                    >
                      {t.symbol}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <a href={`https://dexscreener.com/base/${t.CA}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-blue-400 hover:underline">
                        {t.CA.slice(0, 6)}...{t.CA.slice(-4)}
                      </a>
                    </td>
                    <td className="p-3 whitespace-nowrap">{dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}</td>
                    <td className="p-3 whitespace-nowrap">{dex?.liq == null ? 'N/A' : formatCap(dex.liq)}</td>
                    <td className="p-3 whitespace-nowrap">{dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</td>
                    <td className="p-3 whitespace-nowrap">
                      <span className={`font-bold text-sm ${getChartScoreTextColorClass(t.latestScore, t.last7)}`}>
                        {scoreWithWhale}
                      </span>
                    </td>
                    <td
                      className={`p-3 whitespace-nowrap ${
                        change24h == null ? 'text-slate-500' : change24h >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {change24h == null ? 'N/A' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
                    </td>
                    <td
                      className={`p-3 whitespace-nowrap ${
                        snapshot == null ? 'text-slate-500' : snapshot >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {snapshot == null ? 'N/A' : `${snapshot >= 0 ? '+' : ''}${snapshot.toFixed(0)}%`}
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

      {!whaleLoading && (() => {
        const strongTokens = tokens
          .filter((t) => {
            const scoreWithWhale = getWhaleStarredScore(t.latestScoreDisplay, t.last7);
            const colorClass = getChartScoreTextColorClass(t.latestScore, t.last7);
            return (scoreWithWhale.includes('🐋') || colorClass === 'text-yellow-400') && hasEnoughLiq(t.CA);
          })
          .sort((a, b) => {
            const diff = getTier(a) - getTier(b);
            if (diff !== 0) return diff;
            return b.latestScore - a.latestScore;
          });

        if (!strongTokens.length) return null;

        const displayedStrongTokens = strongSortCol
          ? [...strongTokens].sort(
              (a, b) => (getStrongSortValue(a, strongSortCol) - getStrongSortValue(b, strongSortCol)) * strongSortDir
            )
          : strongTokens;

        return (
          <div className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-blue-400">Whale Activity - Strong Momentum</h2>
            <div className="relative">
              <button
                onClick={() => setShareMenuOpen((v) => !v)}
                className="px-3 py-1.5 text-sm rounded-lg bg-slate-900 border border-slate-800 text-blue-400 hover:text-blue-300 hover:border-blue-500"
              >
                Share ▾
              </button>
              {shareMenuOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShareMenuOpen(false)} />
                  <div className="absolute right-0 mt-1 w-44 z-20 rounded-lg border border-slate-800 bg-slate-900 shadow-lg overflow-hidden">
                    {SHARE_CATEGORIES.map((c) => (
                      <button
                        key={c.category}
                        onClick={() => {
                          handleShare(strongTokens, c.category);
                          setShareMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-blue-300"
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-blue-400">
                    <th className="text-left p-3 whitespace-nowrap">Token</th>
                    <th className="text-left p-3 whitespace-nowrap">CA</th>
                    {strongHeaders.map((h) => (
                      <th
                        key={h.col}
                        onClick={() => handleStrongSort(h.col)}
                        className={`text-left p-3 whitespace-nowrap cursor-pointer select-none ${
                          strongSortCol === h.col ? 'text-white' : ''
                        }`}
                      >
                        {h.label}
                      </th>
                    ))}
                    <th className="text-left p-3 whitespace-nowrap">Category</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedStrongTokens.map((t) => {
                    const dex = getCachedDexData(t.CA);
                    const change24h = dex?.h24;
                    const snapshot =
                      dex?.priceUsd != null && t.latestPrice
                        ? ((dex.priceUsd - t.latestPrice) / t.latestPrice) * 100
                        : null;
                    const scoreWithWhale = getWhaleStarredScore(t.latestScoreDisplay, t.last7);
                    const colorClass = getChartScoreTextColorClass(t.latestScore, t.last7);

                    const isTopCombo =
                      scoreWithWhale.includes('🐋') &&
                      colorClass === 'text-yellow-400' &&
                      t.latestScoreDisplay.endsWith('+');

                    return (
                      <tr
                        key={t.CA}
                        className={`border-t border-slate-800 transition-colors hover:bg-slate-800/60 ${
                          isTopCombo ? 'bg-amber-500/[0.08]' : ''
                        }`}
                      >
                        <td
                          className="p-3 font-semibold whitespace-nowrap cursor-pointer text-blue-400 hover:text-blue-300 underline decoration-dotted"
                          onClick={() => setChartToken({ category: t.category, ca: t.CA, symbol: t.symbol })}
                        >
                          {t.symbol}
                        </td>
                        <td className="p-3 whitespace-nowrap">
                          <a href={`https://dexscreener.com/base/${t.CA}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs text-blue-400 hover:underline">
                            {t.CA.slice(0, 6)}...{t.CA.slice(-4)}
                          </a>
                        </td>
                        <td className="p-3 whitespace-nowrap">{dex?.marketCap == null ? 'N/A' : formatCap(dex.marketCap)}</td>
                        <td className="p-3 whitespace-nowrap">{dex?.liq == null ? 'N/A' : formatCap(dex.liq)}</td>
                        <td className="p-3 whitespace-nowrap">{dex?.vol24h == null ? 'N/A' : formatCap(dex.vol24h)}</td>
                        <td className="p-3 whitespace-nowrap">
                          <span className={`font-bold text-sm ${getChartScoreTextColorClass(t.latestScore, t.last7)}`}>
                            {scoreWithWhale}
                          </span>
                        </td>
                        <td
                          className={`p-3 whitespace-nowrap ${
                            change24h == null ? 'text-slate-500' : change24h >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {change24h == null ? 'N/A' : `${change24h >= 0 ? '+' : ''}${change24h.toFixed(1)}%`}
                        </td>
                        <td
                          className={`p-3 whitespace-nowrap ${
                            snapshot == null ? 'text-slate-500' : snapshot >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {snapshot == null ? 'N/A' : `${snapshot >= 0 ? '+' : ''}${snapshot.toFixed(0)}%`}
                        </td>
                        <td className="p-3 whitespace-nowrap text-slate-400 text-xs">{CATEGORY_LABELS[t.category] ?? t.category}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {chartToken && (
        <PriceChartModal
          category={chartToken.category}
          ca={chartToken.ca}
          symbol={chartToken.symbol}
          onClose={() => setChartToken(null)}
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

function hasEnoughLiq(ca: string): boolean {
  const liq = getCachedDexData(ca)?.liq;
  return liq == null || liq >= 20000;
}