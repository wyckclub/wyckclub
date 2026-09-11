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
const FEE_RATE = 0.0025;

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
type SlippagePreset = '1' | '2' | '5' | 'custom';

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

function WarningTriangleIcon() {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} className="shrink-0 mt-0.5" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2 23 21H1L12 2Z" fill="#FACC15" />
      <path d="M12 9v5" stroke="#1a1a1a" strokeWidth={2.5} strokeLinecap="round" />
      <circle cx="12" cy="17.5" r="1.2" fill="#1a1a1a" />
    </svg>
  );
}

export function TokenSwapPanel({ chainId, ca, platform }: { chainId: string; ca: string; platform?: string | null }) {
  const numericChainId = CHAIN_IDS[chainId] ?? 8453;
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: numericChainId });
  const isUnverified = !!platform && platform.endsWith('_unverified');
  const [tokenSymbol, setTokenSymbol] = useState<string>('TOKEN');
  const [tokenDecimals, setTokenDecimals] = useState<number | null>(null);
  const [tokenLogo, setTokenLogo] = useState<string | null>(null);
  const [ethUsdPrice, setEthUsdPrice] = useState<number | null>(null);

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

  useEffect(() => {
    let active = true;
    function loadEthPrice() {
      const params = new URLSearchParams({
        chainId: '8453', // Base — luôn dùng Base để lấy giá ETH tham chiếu, thanh khoản USDC/ETH ở đây rất sâu
        sellToken: NATIVE,
        buyToken: USDC_BASE,
        sellAmount: parseUnits('1', 18).toString(), // 1 ETH
      });
      fetch(`/api/zeroex/price?${params}`)
        .then((r) => r.json())
        .then((d) => {
          if (active && d?.buyAmount) {
            setEthUsdPrice(Number(formatUnits(BigInt(d.buyAmount), 6))); // USDC decimals = 6
          }
        })
        .catch(() => {});
    }
    loadEthPrice();
    const id = setInterval(loadEthPrice, 60000);
    return () => { active = false; clearInterval(id); };
  }, []);

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
  const [slippagePreset, setSlippagePreset] = useState<SlippagePreset>('1');
  const [customSlippage, setCustomSlippage] = useState('');
  const [gasPriceWei, setGasPriceWei] = useState<bigint | null>(null);
  const [refreshTick, setRefreshTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setRefreshTick((v) => v + 1), 10000); // 10s
    return () => clearInterval(id);
  }, []);

  const effectiveSlippagePct = slippagePreset === 'custom' ? customSlippage : slippagePreset;

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
    if (asset.key === 'ETH') return ethUsdPrice;
    if (asset.key === 'USDC' || asset.key === 'USDG') return 1;
    if (asset.key === 'TOKEN') return getCachedDexData(ca)?.priceUsd ?? null;
    return null;
  }

  function formatUsd(v: number | null) {
    if (v == null || isNaN(v)) return null;
    return v < 0.01 ? `~$${v.toFixed(6)}` : `~$${v.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  }

  function SlippageIcon() {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
        <path d="M7 16V4M7 4L4 7M7 4L10 7" />
        <path d="M17 8V20M17 20L14 17M17 20L20 17" />
        <path d="M3 20H11" />
        <path d="M13 4H21" />
      </svg>
    );
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
    const bps = Math.round(Number(effectiveSlippagePct) * 100);
    if (bps > 0 && bps <= 1000) params.set('slippageBps', String(bps));
    return params;
  };

  useEffect(() => {
    setQuote(null);
    setError('');
    if (!amount || Number(amount) <= 0 || !address || tokenDecimals == null) return;
    const id = setTimeout(() => fetchQuotePrice(false), 500);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, activeSide, payKey, receiveKey, address, numericChainId, tokenDecimals, effectiveSlippagePct]);

  useEffect(() => {
    const id = setInterval(() => fetchQuotePrice(true), 10000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amount, activeSide, payKey, receiveKey, numericChainId, tokenDecimals, effectiveSlippagePct, address]);

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
  }, [quote, payAmountDisplay, receiveAmountDisplay, payAsset, receiveAsset, ethUsdPrice]);

  const usdDiffPct = useMemo(() => {
    if (usdPrices.pay == null || usdPrices.receive == null) return null;
    const payUsdTotal = usdPrices.pay * Number(payAmountDisplay || 0);
    const receiveUsdTotal = usdPrices.receive * Number(receiveAmountDisplay || 0);
    if (!payUsdTotal) return null;
    return ((receiveUsdTotal - payUsdTotal) / payUsdTotal) * 100;
  }, [usdPrices, payAmountDisplay, receiveAmountDisplay]);

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

  function formatUsd2(v: number | null) {
    if (v == null || isNaN(v)) return '$0.00';
    return `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function fetchQuotePrice(silent = false) {
    if (!amount || Number(amount) <= 0 || !address || tokenDecimals == null) return;
    let params: URLSearchParams;
    try {
      params = buildParams(address);
    } catch (e: any) {
      if (!silent) setError(e.message);
      return;
    }
    if (!silent) setLoadingQuote(true);
    fetch(`/api/zeroex/price?${params}`)
      .then((r) => r.json())
      .then((d: QuoteResp & { validationErrors?: { field: string; reason: string }[] }) => {
        if (d.buyAmount) {
          setQuote(d);
          if (!silent) setError('');
        } else if (!silent) {
          setError(d.validationErrors?.[0]?.reason || d.reason || d.message || 'No route found');
        }
        // silent refresh: nếu lỗi thì bỏ qua, giữ nguyên quote cũ, không làm phiền UI
      })
      .catch(() => { if (!silent) setError('Failed to fetch price'); })
      .finally(() => { if (!silent) setLoadingQuote(false); });
  }

  const networkFeeEth = useMemo(() => {
    if (!quote?.transaction?.gas || gasPriceWei == null) return null;
    const cost = BigInt(quote.transaction.gas) * gasPriceWei;
    return formatUnits(cost, 18);
  }, [quote, gasPriceWei]);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <span className="flex items-center gap-1.5 text-sm font-bold text-slate-400">
          <img
            src={chainId === 'robinhood' ? '/robinhood.svg' : '/base.svg'}
            alt={chainId}
            className="w-4 h-4 rounded-[3px]"
          />
          <img src="/0x.svg" alt="0x" className="w-4 h-4" />
          SWAP
        </span>
      </div>

      <div className="p-3 space-y-2">
        {isUnverified && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-400/30 rounded-lg px-3 py-2">
            <WarningTriangleIcon />
            <span className="text-yellow-400 font-bold text-xs leading-snug">
              Warning: This token has not been verified, please trade with caution.
            </span>
          </div>
        )}

        {/* PAY */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-s text-slate-500">
            <span>From</span>
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
          <div className="flex items-center justify-between">
            <span className="text-[14px] font-bold text-slate-600">
              {formatUsd2(usdPrices.pay != null ? usdPrices.pay * Number(payAmountDisplay || 0) : null)}
            </span>
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
        </div>

        {/* FLIP */}
<div className="flex justify-center -my-1 relative z-10">
  <button
    onClick={flip}
    className="w-[39px] h-[39px] hover:opacity-80 transition-opacity flex items-center justify-center"
    aria-label="Flip"
  >
    <svg width="39" height="39" viewBox="0 0 39 39" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="39" height="39" rx="11" fill="#3c4569" />
      <path d="M12.19 16.46C12.19 13.76 14.38 11.58 17.07 11.58H26.19M26.19 11.58L22.53 7.92M26.19 11.58L22.53 15.23" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26.81 22.53C26.81 25.23 24.62 27.42 21.93 27.42H12.81M12.81 27.42L16.47 23.77M12.81 27.42L16.47 31.08" stroke="#FFFFFF" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  </button>
</div>

        {/* RECEIVE */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between text-s text-slate-500">
            <span>To</span>
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
          <div className="flex justify-start">
            <span className="text-[14px] font-bold text-slate-500">
              {formatUsd2(usdPrices.receive != null ? usdPrices.receive * Number(receiveAmountDisplay || 0) : null)}
              {usdDiffPct != null && (
                <span className={`ml-1 ${usdDiffPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  ({usdDiffPct >= 0 ? '+' : ''}{usdDiffPct.toFixed(1)}%)
                </span>
              )}
            </span>
          </div>
        </div>

        {usdDiffPct != null && Math.abs(usdDiffPct) > 5 && (
          <div className="flex items-start gap-2 bg-yellow-500/10 border border-yellow-400/30 rounded-lg px-3 py-2">
            <WarningTriangleIcon />
            <span className="text-yellow-400 font-bold text-xs leading-snug">
              Warning: USD value gap between what you pay and receive exceeds 5%, please double-check before swapping.
            </span>
          </div>
        )}

        {/* SLIPPAGE */}
        <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
          <span className="flex items-center gap-1"><SlippageIcon /> Max Slippage</span>
          <div className="flex items-center gap-1.5">
            {(['1', '2', '5'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setSlippagePreset(p)}
                className={`px-2 py-1 rounded font-bold ${
                  slippagePreset === p ? 'bg-[#ccff00] text-[#211d19]' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {p}%
              </button>
            ))}
            <input
              type="text"
              inputMode="decimal"
              value={slippagePreset === 'custom' ? customSlippage : ''}
              onFocus={() => setSlippagePreset('custom')}
              onChange={(e) => { setSlippagePreset('custom'); setCustomSlippage(e.target.value); }}
              placeholder="Custom"
              className={`w-16 text-right bg-slate-800 rounded px-1.5 py-1 outline-none placeholder:text-slate-500 ${
                slippagePreset === 'custom' ? 'text-white' : 'text-slate-500'
              }`}
            />
          </div>
        </div>

        {/* DETAILS */}
        {quote && (
          <div className="text-xs text-slate-400 space-y-1 pt-2 border-t border-slate-800">
          <div className="flex justify-between">
            <span>You receive (incl. fee)</span>
            <span className="text-slate-200">
              {Number(formatUnits(BigInt(quote.buyAmount), receiveAsset.decimals)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {receiveAsset.symbol}
              {usdPrices.receive != null && (
                <span className="text-slate-500">
                  {' '}({formatUsd2(Number(formatUnits(BigInt(quote.buyAmount), receiveAsset.decimals)) * usdPrices.receive)})
                </span>
              )}
            </span>
          </div>
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
            <div className="flex justify-between">
              <span>Route</span>
              <span className="text-slate-200">0x API</span>
            </div>
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

function GasIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
      <path d="M4 20V5C4 3.9 4.9 3 6 3H13C14.1 3 15 3.9 15 5V20M3 20H16" />
      <rect x="7" y="6" width="5" height="4" rx="1" fill="currentColor" stroke="none" />
      <path d="M15 9H17C18.1 9 19 9.9 19 11V14.5C19 15.3 19.7 16 20.5 16C21.3 16 22 15.3 22 14.5V11L20 8" />
    </svg>
  );
}