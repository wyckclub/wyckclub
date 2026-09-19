'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useBalance, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { getCachedDexData } from '@/lib/dexData';

const ethPriceCache: Record<string, { price: number; timestamp: number }> = {};
const ETH_PRICE_TTL = 60000;
const CHAIN_IDS: Record<string, number> = { base: 8453, robinhood: 4663, arc: 5042 };
const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const NATIVE_ARC_USDC = '0x3600000000000000000000000000000000000000';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

const QUOTE_ASSET: Record<string, { address: string; symbol: string; decimals: number }> = {
  base: { address: NATIVE, symbol: 'ETH', decimals: 18 },
  robinhood: { address: NATIVE, symbol: 'ETH', decimals: 18 },
  arc: { address: NATIVE_ARC_USDC, symbol: 'USDC', decimals: 6 },
};

const BUY_PRESETS = [10, 50, 100, 200];
const SELL_PRESETS = [25, 50, 100];

const erc20Abi = [
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

interface QuoteResp {
  buyAmount: string;
  sellAmount?: string;
  transaction?: { to: `0x${string}`; data: `0x${string}`; value: string; gas: string | null };
  issues?: { allowance?: { spender: `0x${string}` } | null };
  estimatedPriceImpact?: string | null;
  reason?: string;
  message?: string;
}

export function InlineSwapPanel({
  chain, ca, symbol, side, onClose,
}: { chain: 'base' | 'robinhood' | 'arc'; ca: string; symbol: string; side: 'buy' | 'sell'; onClose: () => void }) {
  const numericChainId = CHAIN_IDS[chain];
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: numericChainId });
  const quoteAsset = QUOTE_ASSET[chain];

  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [quoteUsdPrice, setQuoteUsdPrice] = useState<number | null>(quoteAsset.symbol === 'USDC' ? 1 : null);

  useEffect(() => {
    if (!publicClient) return;
    publicClient.readContract({ address: ca as `0x${string}`, abi: erc20Abi, functionName: 'decimals' })
      .then((d) => setTokenDecimals(Number(d))).catch(() => setTokenDecimals(18));
  }, [ca, publicClient]);

    useEffect(() => {
    if (quoteAsset.symbol !== 'ETH') return;
    const cacheKey = String(numericChainId);
    const cached = ethPriceCache[cacheKey];
    if (cached && Date.now() - cached.timestamp < ETH_PRICE_TTL) {
        setQuoteUsdPrice(cached.price);
    }
    let active = true;
    function load() {
        const params = new URLSearchParams({
        chainId: '8453',
        sellToken: NATIVE,
        buyToken: USDC_BASE,
        sellAmount: parseUnits('1', 18).toString(),
        });
        fetch(`/api/zeroex/price?${params}`).then((r) => r.json())
        .then((d) => {
            if (active && d?.buyAmount) {
            const price = Number(formatUnits(BigInt(d.buyAmount), 6));
            setQuoteUsdPrice(price);
            ethPriceCache[cacheKey] = { price, timestamp: Date.now() };
            }
        })
        .catch(() => {});
    }
    load();
    const id = setInterval(load, 60000);
    return () => { active = false; clearInterval(id); };
    }, [quoteAsset.symbol, numericChainId]);

  const payAsset = side === 'buy' ? quoteAsset : { address: ca, symbol, decimals: tokenDecimals ?? 18 };
  const receiveAsset = side === 'buy' ? { address: ca, symbol, decimals: tokenDecimals ?? 18 } : quoteAsset;

  const [amount, setAmount] = useState('');
  const [quote, setQuote] = useState<QuoteResp | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'idle' | 'approving' | 'swapping'>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [slippage, setSlippage] = useState('1');
  const [confirming, setConfirming] = useState(false);

  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHash, chainId: numericChainId });
  const { sendTransactionAsync } = useSendTransaction();
  const { writeContractAsync } = useWriteContract();

    const payBalance = useBalance({
    address,
    token: payAsset.address === NATIVE ? undefined : (payAsset.address as `0x${string}`),
    chainId: numericChainId,
    });
    const receiveBalance = useBalance({
    address,
    token: receiveAsset.address === NATIVE ? undefined : (receiveAsset.address as `0x${string}`),
    chainId: numericChainId,
    });

  function buildParams(taker: string) {
    const params = new URLSearchParams({
      chainId: String(numericChainId),
      sellToken: payAsset.address,
      buyToken: receiveAsset.address,
      taker,
    });
    const sellAmount = parseUnits(amount || '0', payAsset.decimals);
    if (sellAmount <= BigInt(0)) throw new Error('Amount too small');
    params.set('sellAmount', sellAmount.toString());
    const bps = Math.round(Number(slippage) * 100);
    if (bps > 0 && bps <= 1000) params.set('slippageBps', String(bps));
    return params;
  }

  function fetchQuote(silent = false) {
    if (!amount || Number(amount) <= 0 || !address || tokenDecimals == null) return;
    let params: URLSearchParams;
    try { params = buildParams(address); } catch (e: any) { if (!silent) setError(e.message); return; }
    if (!silent) setLoadingQuote(true);
    fetch(`/api/zeroex/price?${params}`).then((r) => r.json())
      .then((d: QuoteResp & { validationErrors?: { reason: string }[] }) => {
        if (d.buyAmount) { setQuote(d); if (!silent) setError(''); }
        else if (!silent) setError(d.validationErrors?.[0]?.reason || d.reason || d.message || 'No route found');
      })
      .catch(() => { if (!silent) setError('Failed to fetch price'); })
      .finally(() => { if (!silent) setLoadingQuote(false); });
  }

  useEffect(() => {
    setQuote(null); setError('');
    if (!amount || Number(amount) <= 0 || !address || tokenDecimals == null) return;
    const id = setTimeout(() => fetchQuote(false), 500);
    return () => clearTimeout(id);
  }, [amount, address, tokenDecimals, slippage, payAsset.address, receiveAsset.address]);

  function applyBuyPreset(usd: number) {
    if (quoteUsdPrice == null) return;
    setAmount((usd / quoteUsdPrice).toFixed(payAsset.decimals === 6 ? 2 : 8));
  }

  function applySellPreset(pct: number) {
    if (!payBalance.data) return;
    const raw = (payBalance.data.value * BigInt(pct)) / BigInt(100);
    setAmount(formatUnits(raw, payAsset.decimals));
  }

  const receiveAmountDisplay = quote?.buyAmount ? formatUnits(BigInt(quote.buyAmount), receiveAsset.decimals) : '';

  function knownUsdPrice(a: { symbol: string }) {
    if (a.symbol === quoteAsset.symbol) return quoteUsdPrice;
    if (a.symbol === symbol) return getCachedDexData(ca)?.priceUsd ?? null;
    return null;
  }

  const payUsd = knownUsdPrice(payAsset);
  const receiveUsd = knownUsdPrice(receiveAsset);
  const payUsdTotal = payUsd != null ? payUsd * Number(amount || 0) : null;
  const receiveUsdTotal = receiveUsd != null ? receiveUsd * Number(receiveAmountDisplay || 0) : null;
  const usdDiffPct = payUsdTotal && receiveUsdTotal ? ((receiveUsdTotal - payUsdTotal) / payUsdTotal) * 100 : null;

  const insufficientBalance = useMemo(() => {
    if (!payBalance.data || !amount) return false;
    try { return parseUnits(amount, payAsset.decimals) > payBalance.data.value; } catch { return false; }
  }, [amount, payAsset.decimals, payBalance.data]);

  async function executeSwap() {
    if (!address || !amount || tokenDecimals == null) return;
    setError(''); setConfirming(false);
    try {
      setStep('approving');
      const res = await fetch(`/api/zeroex/quote?${buildParams(address)}`);
      const q: QuoteResp = await res.json();
      if (!q.transaction) throw new Error(q.reason || q.message || 'Quote failed');
      if (q.issues?.allowance) {
        await writeContractAsync({
          address: payAsset.address as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [q.issues.allowance.spender, maxUint256],
          chainId: numericChainId,
        });
      }
      setStep('swapping');
      const hash = await sendTransactionAsync({
        to: q.transaction.to, data: q.transaction.data,
        value: BigInt(q.transaction.value || '0'), chainId: numericChainId,
      });
      setTxHash(hash); setAmount(''); setQuote(null);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Swap failed');
    } finally { setStep('idle'); }
  }

  function formatUsd(v: number | null) {
    if (v == null || isNaN(v)) return null;
    return v < 0.01 ? `~$${v.toFixed(6)}` : `~$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  return (
    <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-blue-400">{side === 'buy' ? `Buy ${symbol}` : `Sell ${symbol}`}</span>
        <button onClick={onClose} className="text-slate-500 hover:text-white text-xs">✕ Close</button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {side === 'buy'
          ? BUY_PRESETS.map((usd) => (
              <button key={usd} onClick={() => applyBuyPreset(usd)} className="text-xs font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">${usd}</button>
            ))
          : SELL_PRESETS.map((pct) => (
              <button key={pct} onClick={() => applySellPreset(pct)} className="text-xs font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200">{pct}%</button>
            ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-col gap-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 min-w-[140px]">
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 shrink-0">From</span>
                <span className="text-[10px] text-slate-500 truncate">
                Balance: {payBalance.data ? Number(payBalance.data.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                </span>
            </div>
            <div className="flex items-center gap-1.5">
                <input type="text" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.0"
                className="bg-transparent outline-none text-sm font-bold w-20 min-w-0" />
                <span className="text-xs font-bold text-slate-300 shrink-0">{payAsset.symbol}</span>
            </div>
            </div>

            <span className="text-slate-600">→</span>

            <div className="flex flex-col gap-0.5 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1.5 min-w-[160px]">
            <div className="flex items-center justify-between">
                <span className="text-[10px] text-slate-500 shrink-0">To</span>
                <span className="text-[10px] text-slate-500 truncate">
                Balance: {receiveBalance.data ? Number(receiveBalance.data.formatted).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '0'}
                </span>
            </div>
            <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold truncate">
                {loadingQuote ? '...' : receiveAmountDisplay ? Number(receiveAmountDisplay).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0.0'}
                </span>
                <span className="text-xs font-bold text-slate-300 shrink-0">{receiveAsset.symbol}</span>
                {receiveUsdTotal != null && (
                <span className="text-[11px] text-slate-500 shrink-0">
                    {formatUsd(receiveUsdTotal)}
                    {usdDiffPct != null && (
                    <span className={usdDiffPct >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {' '}({usdDiffPct >= 0 ? '+' : ''}{usdDiffPct.toFixed(1)}%)
                    </span>
                    )}
                </span>
                )}
            </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[10px] text-slate-500">Slippage</span>
          {(['1', '2', '5'] as const).map((p) => (
            <button key={p} onClick={() => setSlippage(p)}
              className={`px-1.5 py-1 rounded text-[11px] font-bold ${slippage === p ? 'bg-[#ccff00] text-[#211d19]' : 'bg-slate-800 text-slate-400'}`}>
              {p}%
            </button>
          ))}
        </div>

        {!isConnected && <span className="text-xs text-slate-500">Connect wallet to swap.</span>}
        {isConnected && (
          <button
            onClick={() => setConfirming(true)}
            disabled={!quote || step !== 'idle' || !amount || Number(amount) <= 0}
            className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-xs font-bold text-white"
          >
            {step === 'approving' ? 'Approving...' : step === 'swapping' ? 'Swapping...' : side === 'buy' ? 'Buy' : 'Sell'}
          </button>
        )}
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
      {receipt && txHash && <p className="text-xs text-green-400">Confirmed: {txHash.slice(0, 10)}...</p>}

      {confirming && quote && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60]" onClick={(e) => { if (e.target === e.currentTarget) setConfirming(false); }}>
          <div className="bg-slate-900 border border-slate-700 rounded-xl p-4 max-w-sm w-[90%] space-y-3">
            <h3 className="text-sm font-bold text-blue-400">Confirm {side === 'buy' ? 'Buy' : 'Sell'}</h3>
            <p className="text-sm text-slate-300">
              You receive (incl. fee) {Number(receiveAmountDisplay).toLocaleString(undefined, { maximumFractionDigits: 6 })} {receiveAsset.symbol}
              {receiveUsd != null && <span className="text-slate-500"> ({formatUsd(receiveUsdTotal)})</span>}
            </p>
            {insufficientBalance && <p className="text-xs text-red-400 font-bold">Insufficient balance for this trade.</p>}
            {usdDiffPct != null && Math.abs(usdDiffPct) > 5 && (
              <p className="text-xs text-yellow-400 font-bold">
                Warning: USD value gap between what you pay and receive exceeds 5%, please double-check before swapping.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setConfirming(false)} className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 text-xs font-bold">Cancel</button>
              <button onClick={executeSwap} disabled={insufficientBalance}
                className="px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-white text-xs font-bold">
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}