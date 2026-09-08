'use client';

import { useEffect, useMemo, useState } from 'react';
import { useAccount, usePublicClient, useBalance, useSendTransaction, useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { parseUnits, formatUnits, maxUint256 } from 'viem';
import { getCachedDexData } from '@/lib/dexData';

const CHAIN_IDS: Record<string, number> = { base: 8453, robinhood: 4663 };
const NATIVE = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';
const USDG_ROBINHOOD = '0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168';
const USDC_BASE = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const NATIVE_GAS_BUFFER = parseUnits('0.0005', 18);

const ETH_LOGO = '/eth.svg';
const USDC_LOGO = '/usdc.svg';
const USDG_LOGO = '/usdg.svg';

const erc20Abi = [
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ type: 'bool' }] },
] as const;

interface Asset {
  key: 'ETH' | 'USDG' | 'USDC' | 'TOKEN';
  address: string;
  symbol: string;
  decimals: number;
  logoUrl: string | null;
}

interface QuoteResp {
  buyAmount: string;
  sellAmount?: string;
  maxSellAmount?: string;
  transaction?: { to: `0x${string}`; data: `0x${string}`; value: string; gas: string | null };
  issues?: { allowance?: { spender: `0x${string}` } | null; balance?: unknown };
  fees?: { integratorFee?: { amount: string; token: string; type: string } | null };
  estimatedPriceImpact?: string | null;
  reason?: string;
  message?: string;
}

type Side = 'pay' | 'receive';

function AssetIcon({ asset, size = 20 }: { asset: Asset; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!asset.logoUrl || failed) {
    return (
      <span
        className="rounded-full bg-slate-600 flex items-center justify-center font-bold shrink-0"
        style={{ width: size, height: size, fontSize: size * 0.4 }}
      >
        {asset.symbol.slice(0, 2).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      src={asset.logoUrl}
      alt={asset.symbol}
      onError={() => setFailed(true)}
      className="rounded-full object-cover shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

function AssetSelect({
  side, current, exclude, assets, onPick,
}: {
  side: Side;
  current: Asset;
  exclude: Asset['key'];
  assets: Asset[];
  onPick: (side: Side, key: Asset['key']) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative shrink-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 rounded-full px-2.5 py-1.5"
      >
        <AssetIcon asset={current} size={20} />
        <span className="text-sm font-bold">{current.symbol}</span>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-3 h-3 opacity-60">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 z-20 bg-slate-950 border border-slate-800 rounded-lg overflow-hidden w-36">
          {assets.filter((a) => a.key !== exclude).map((a) => (
            <button
              key={a.key}
              onClick={() => { onPick(side, a.key); setOpen(false); }}
              className="w-full text-left px-3 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 flex items-center gap-2"
            >
              <AssetIcon asset={a} size={20} />
              {a.symbol}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TokenSwapPanel({ chainId, ca }: { chainId: string; ca: string }) {
  const numericChainId = CHAIN_IDS[chainId] ?? 8453;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: numericChainId });

  const [tokenSymbol, setTokenSymbol] = useState<string>('TOKEN');
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [tokenLogo, setTokenLogo] = useState<string | null>(null);

  useEffect(() => {
    const dex = getCachedDexData(ca);
    if (dex?.symbol) setTokenSymbol(dex.symbol);
    if (dex?.imageUrl) setTokenLogo(dex.imageUrl);
    if (!publicClient) return;
    publicClient.readContract({ address: ca as `0x${string}`, abi: erc20Abi, functionName: 'decimals' })
      .then((d) => setTokenDecimals(Number(d))).catch(() => setTokenDecimals(18));
    if (!dex?.symbol) {
      publicClient.readContract({ address: ca as `0x${string}`, abi: erc20Abi, functionName: 'symbol' })
        .then((s) => setTokenSymbol(String(s))).catch(() => {});
    }
  }, [ca, publicClient]);

  const assets: Asset[] = useMemo(() => {
    const list: Asset[] = [{ key: 'ETH', address: NATIVE, symbol: 'ETH', decimals: 18, logoUrl: ETH_LOGO }];
    if (chainId === 'robinhood') {
      list.push({ key: 'USDG', address: USDG_ROBINHOOD, symbol: 'USDG', decimals: 6, logoUrl: USDG_LOGO });
    } else {
      list.push({ key: 'USDC', address: USDC_BASE, symbol: 'USDC', decimals: 6, logoUrl: USDC_LOGO });
    }
    list.push({ key: 'TOKEN', address: ca, symbol: tokenSymbol, decimals: tokenDecimals ?? 18, logoUrl: tokenLogo });
    return list;
  }, [chainId, ca, tokenSymbol, tokenDecimals, tokenLogo]);

  const [payKey, setPayKey] = useState<Asset['key']>('ETH');
  const [receiveKey, setReceiveKey] = useState<Asset['key']>('TOKEN');
  const payAsset = assets.find((a) => a.key === payKey)!;
  const receiveAsset = assets.find((a) => a.key === receiveKey)!;

  const [amount, setAmount] = useState('');
  const [activeSide, setActiveSide] = useState<Side>('pay');
  const [quote, setQuote] = useState<QuoteResp | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'idle' | 'approving' | 'swapping'>('idle');
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>();
  const [slippageMode, setSlippageMode] = useState<'auto' | 'custom'>('auto');
  const [slippagePct, setSlippagePct] = useState('5');
  const [gasPriceWei, setGasPriceWei] = useState<bigint | null>(null);

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

  function pickAsset(side: Side, key: Asset['key']) {
    if (side === 'pay') {
      if (key === receiveKey) setReceiveKey(payKey);
      setPayKey(key);
    } else {
      if (key === payKey) setPayKey(receiveKey);
      setReceiveKey(key);
    }
    setAmount('');
    setActiveSide('pay');
    setQuote(null);
  }

  function flip() {
    setPayKey(receiveKey);
    setReceiveKey(payKey);
    setActiveSide((s) => (s === 'pay' ? 'receive' : 'pay'));
    setQuote(null);
  }

  function applyPercent(pct: number) {
    if (!payBalance.data) return;
    let raw = (payBalance.data.value * BigInt(pct)) / BigInt(100);
    if (payAsset.address === NATIVE) {
      raw = raw > NATIVE_GAS_BUFFER ? raw - (pct === 100 ? NATIVE_GAS_BUFFER : BigInt(0)) : BigInt(0);
    }
    setActiveSide('pay');
    setAmount(formatUnits(raw, payAsset.decimals));
  }

  function knownUsdPrice(asset: Asset): number | null {
    if (asset.key === 'USDC' || asset.key === 'USDG') return 1;
    if (asset.key === 'TOKEN') return getCachedDexData(ca)?.priceUsd ?? null;
    return null;
  }

  function formatUsd(v: number | null) {
    if (v == null || isNaN(v)) return null;
    return v < 0.01 ? `~$${v.toFixed(6)}` : `~$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  const buildParams = (taker: string) => {
    const params = new URLSearchParams({
      chainId: String(numericChainId),
      sellToken: payAsset.address,
      buyToken: receiveAsset.address,
      taker,
    });
    if (activeSide === 'pay') {
      const sellAmount = parseUnits(amount, payAsset.decimals);
      if (sellAmount <= BigInt(0)) throw new Error('Amount too small for this token');
      params.set('sellAmount', sellAmount.toString());
    } else {
      const buyAmount = parseUnits(amount, receiveAsset.decimals);
      if (buyAmount <= BigInt(0)) throw new Error('Amount too small for this token');
      params.set('buyAmount', buyAmount.toString());
    }
    if (slippageMode === 'custom') {
      const bps = Math.round(Number(slippagePct) * 100);
      if (bps > 0 && bps <= 1000) params.set('slippageBps', String(bps));
    }
    return params;
  };

  useEffect(() => {
    setQuote(null);
    setError('');
    if (!amount || Number(amount) <= 0 || !address || tokenDecimals == null) return;
    const id = setTimeout(() => {
      setLoadingQuote(true);
      let params: URLSearchParams;
      try {
        params = buildParams(address);
      } catch (e: any) {
        setError(e.message);
        setLoadingQuote(false);
        return;
      }
      fetch(`/api/zeroex/price?${params}`)
        .then((r) => r.json())
        .then((d: QuoteResp & { validationErrors?: { field: string; reason: string }[] }) => {
          if (d.buyAmount) setQuote(d);
          else setError(d.validationErrors?.[0]?.reason || d.reason || d.message || 'No route found');
        })
        .catch(() => setError('Failed to fetch price'))
        .finally(() => setLoadingQuote(false));
    }, 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, activeSide, payKey, receiveKey, address, numericChainId, tokenDecimals, slippageMode, slippagePct]);

  useEffect(() => {
    if (!quote?.transaction?.gas || !publicClient) return;
    publicClient.getGasPrice().then(setGasPriceWei).catch(() => setGasPriceWei(null));
  }, [quote, publicClient]);

  async function handleSwap() {
    if (!address || !amount || tokenDecimals == null) return;
    setError('');
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
        to: q.transaction.to,
        data: q.transaction.data,
        value: BigInt(q.transaction.value || '0'),
        chainId: numericChainId,
      });
      setTxHash(hash);
      setAmount('');
      setQuote(null);
    } catch (e: any) {
      setError(e?.shortMessage || e?.message || 'Swap failed');
    } finally {
      setStep('idle');
    }
  }

  const payAmountDisplay = activeSide === 'pay'
    ? amount
    : (quote?.sellAmount ? formatUnits(BigInt(quote.sellAmount), payAsset.decimals) : '');
  const receiveAmountDisplay = activeSide === 'receive'
    ? amount
    : (quote?.buyAmount ? formatUnits(BigInt(quote.buyAmount), receiveAsset.decimals) : '');

  const minReceived = useMemo(() => {
    if (!quote || slippageMode !== 'custom' || activeSide !== 'pay') return null;
    const bps = Math.round(Number(slippagePct) * 100);
    const buy = BigInt(quote.buyAmount);
    const min = buy - (buy * BigInt(bps)) / BigInt(10000);
    return formatUnits(min, receiveAsset.decimals);
  }, [quote, slippageMode, slippagePct, receiveAsset.decimals, activeSide]);

  const maxYouPay = useMemo(() => {
    if (activeSide !== 'receive' || !quote?.maxSellAmount) return null;
    return formatUnits(BigInt(quote.maxSellAmount), payAsset.decimals);
  }, [activeSide, quote, payAsset.decimals]);

  const usdPrices = useMemo(() => {
    if (!quote) return { pay: null as number | null, receive: null as number | null };
    const sellAmountNum = Number(payAmountDisplay);
    const buyAmountNum = Number(receiveAmountDisplay);
    let payUsd = knownUsdPrice(payAsset);
    let receiveUsd = knownUsdPrice(receiveAsset);
    if (payUsd == null && receiveUsd != null && sellAmountNum > 0) {
      payUsd = (receiveUsd * buyAmountNum) / sellAmountNum;
    }
    if (receiveUsd == null && payUsd != null && buyAmountNum > 0) {
      receiveUsd = (payUsd * sellAmountNum) / buyAmountNum;
    }
    return { pay: payUsd, receive: receiveUsd };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote, payAmountDisplay, receiveAmountDisplay, payAsset, receiveAsset]);

  const insufficientBalance = useMemo(() => {
    if (!payBalance.data) return false;
    try {
      let requiredSell: bigint;
      if (activeSide === 'pay') {
        if (!amount) return false;
        requiredSell = parseUnits(amount, payAsset.decimals);
      } else {
        if (!quote?.sellAmount) return false;
        requiredSell = BigInt(quote.sellAmount);
      }
      return requiredSell > payBalance.data.value;
    } catch {
      return false;
    }
  }, [activeSide, amount, payAsset.decimals, payBalance.data, quote]);

  const tradeFeeDisplay = useMemo(() => {
    const fee = quote?.fees?.integratorFee;
    if (!fee || !fee.token || !fee.amount) return null;
    const feeAsset = [payAsset, receiveAsset].find(
      (a) => a.address.toLowerCase() === fee.token.toLowerCase()
    );
    const decimals = feeAsset?.decimals ?? payAsset.decimals;
    const symbol = feeAsset?.symbol ?? payAsset.symbol;
    const amountNum = Number(formatUnits(BigInt(fee.amount), decimals));
    const usd = feeAsset?.key === payAsset.key ? usdPrices.pay : usdPrices.receive;
    const usdStr = usd != null ? formatUsd(amountNum * usd) : null;
    return `${amountNum.toLocaleString(undefined, { maximumFractionDigits: 6 })} ${symbol}${usdStr ? ` (${usdStr})` : ''}`;
  }, [quote, payAsset, receiveAsset, usdPrices]);

  const networkFeeEth = useMemo(() => {
    if (!quote?.transaction?.gas || gasPriceWei == null) return null;
    const cost = BigInt(quote.transaction.gas) * gasPriceWei;
    return formatUnits(cost, 18);
  }, [quote, gasPriceWei]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <span className="text-sm font-bold text-blue-400">Exchange</span>
      </div>

      <div className="p-3 space-y-2">
        {/* PAY */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>You pay</span>
            <span>Balance: {payBalance.data ? Number(payBalance.data.formatted).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={activeSide === 'pay' ? amount : (loadingQuote ? '...' : payAmountDisplay)}
              onChange={(e) => { setActiveSide('pay'); setAmount(e.target.value); }}
              placeholder="0.0"
              className="bg-transparent outline-none text-2xl font-bold w-full min-w-0"
            />
            <AssetSelect side="pay" current={payAsset} exclude={receiveKey} assets={assets} onPick={pickAsset} />
          </div>
          <div className="flex gap-1.5">
            {[20, 50, 100].map((p) => (
              <button
                key={p}
                onClick={() => applyPercent(p)}
                className="text-[11px] font-bold px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
              >
                {p === 100 ? 'MAX' : `${p}%`}
              </button>
            ))}
          </div>
        </div>

        {/* FLIP */}
        <div className="flex justify-center -my-1 relative z-10">
          <button
            onClick={flip}
            className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 hover:bg-slate-700 flex items-center justify-center"
            aria-label="Flip"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="M17 3v18M17 3l-4 4M17 3l4 4M7 21V3M7 21l-4-4M7 21l4-4" />
            </svg>
          </button>
        </div>

        {/* RECEIVE */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>You receive</span>
            <span>Balance: {receiveBalance.data ? Number(receiveBalance.data.formatted).toLocaleString(undefined, { maximumFractionDigits: 6 }) : '0'}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <input
              type="text"
              inputMode="decimal"
              value={activeSide === 'receive' ? amount : (loadingQuote ? '...' : receiveAmountDisplay)}
              onChange={(e) => { setActiveSide('receive'); setAmount(e.target.value); }}
              placeholder="0.0"
              className="bg-transparent outline-none text-2xl font-bold w-full min-w-0"
            />
            <AssetSelect side="receive" current={receiveAsset} exclude={payKey} assets={assets} onPick={pickAsset} />
          </div>
        </div>

        {/* SLIPPAGE */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span>Max Slippage</span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setSlippageMode('auto')}
              className={`px-2 py-1 rounded font-bold ${slippageMode === 'auto' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'}`}
            >
              Auto
            </button>
            <input
              type="number"
              value={slippagePct}
              onFocus={() => setSlippageMode('custom')}
              onChange={(e) => { setSlippageMode('custom'); setSlippagePct(e.target.value); }}
              className={`w-14 text-right bg-slate-800 rounded px-1.5 py-1 outline-none ${slippageMode === 'custom' ? 'text-white' : 'text-slate-500'}`}
            />
            <span>%</span>
          </div>
        </div>

        {/* DETAILS */}
        {quote && (
          <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800">
            {minReceived && (
              <div className="flex justify-between">
                <span>Minimum received</span>
                <span className="text-slate-200">
                  {Number(minReceived).toLocaleString(undefined, { maximumFractionDigits: 6 })} {receiveAsset.symbol}
                  {usdPrices.receive != null && (
                    <span className="text-slate-500"> ({formatUsd(Number(minReceived) * usdPrices.receive)})</span>
                  )}
                </span>
              </div>
            )}
            {maxYouPay && (
              <div className="flex justify-between">
                <span>Maximum you pay</span>
                <span className="text-slate-200">
                  {Number(maxYouPay).toLocaleString(undefined, { maximumFractionDigits: 6 })} {payAsset.symbol}
                  {usdPrices.pay != null && (
                    <span className="text-slate-500"> ({formatUsd(Number(maxYouPay) * usdPrices.pay)})</span>
                  )}
                </span>
              </div>
            )}
            {tradeFeeDisplay && (
              <div className="flex justify-between"><span>Trade fees</span><span className="text-slate-200">{tradeFeeDisplay}</span></div>
            )}
            {networkFeeEth && (
              <div className="flex justify-between"><span>Network fees (est.)</span><span className="text-slate-200">{Number(networkFeeEth).toFixed(6)} ETH</span></div>
            )}
            {quote.estimatedPriceImpact && (
              <div className="flex justify-between"><span>Price impact</span><span className="text-slate-200">{quote.estimatedPriceImpact}%</span></div>
            )}
          </div>
        )}

        {insufficientBalance && (
          <p className="text-xs text-red-400">Insufficient balance for this trade.</p>
        )}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!isConnected && <p className="text-xs text-slate-500">Connect wallet to swap.</p>}

        {isConnected && (
          <button
            onClick={handleSwap}
            disabled={!quote || step !== 'idle' || insufficientBalance}
            className="w-full py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 disabled:opacity-50 text-sm font-bold text-white"
          >
            {insufficientBalance ? 'Insufficient balance' : step === 'approving' ? 'Approving...' : step === 'swapping' ? 'Swapping...' : 'Swap'}
          </button>
        )}

        {receipt && txHash && (
          <p className="text-xs text-green-400 text-center">
            Confirmed: <a href={`https://basescan.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer" className="underline">{txHash.slice(0, 10)}...</a>
          </p>
        )}
      </div>
    </div>
  );
}