'use client';

import { formatCap, formatPriceShort, formatAge } from '@/lib/format';
import { VerifyBadge } from '@/components/VerifyBadge';
import type { FullPairInfo } from '@/lib/dexData';

function StatRow({ label, value, valueClass = 'text-white' }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between text-sm py-1.5 border-b border-slate-800/60 last:border-0">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}
const pctClass = (v: number | null) => (v == null ? 'text-slate-500' : v >= 0 ? 'text-green-400' : 'text-red-400');
const pctText = (v: number | null) => (v == null ? 'N/A' : `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`);

export function TokenInfoPanel({
  info, ca, symbol, verified,
}: { info: FullPairInfo | null; ca: string; chainId: string; symbol: string; verified?: boolean | null }) {
  if (!info) {
    return <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-500 text-sm">Dex loading...</div>;
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3">
        {info.imageUrl ? (
          <img src={info.imageUrl} alt={symbol} className="w-12 h-12 rounded-full object-cover shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-slate-800 shrink-0" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-white truncate">{info.symbol ?? symbol}</span>
            {verified != null && <VerifyBadge verified={verified} className="w-4 h-4" />}
          </div>
          {info.name && <div className="text-xs text-slate-500 truncate">{info.name}</div>}
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs">
        {info.website && <a href={info.website} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Website</a>}
        {info.twitter && <a href={info.twitter} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">X (Twitter)</a>}
        {info.telegram && <a href={info.telegram} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">Telegram</a>}
        <a href={info.url} target="_blank" rel="noopener noreferrer" className="text-slate-400 hover:underline ml-auto">Dexscreener ↗</a>
      </div>

      <div className="text-2xl font-extrabold text-white font-mono">{formatPriceShort(info.priceUsd)}</div>

      <div className="grid grid-cols-4 gap-1.5 text-center">
        {(['m5', 'h1', 'h6', 'h24'] as const).map((k) => (
          <div key={k} className="bg-slate-950 rounded-lg py-1.5">
            <div className="text-[10px] text-slate-500 uppercase">{k}</div>
            <div className={`text-xs font-bold ${pctClass(info.priceChange[k])}`}>{pctText(info.priceChange[k])}</div>
          </div>
        ))}
      </div>

      <div className="space-y-0.5">
        <StatRow label="Market Cap" value={formatCap(info.marketCap)} />
        <StatRow label="FDV" value={formatCap(info.fdv)} />
        <StatRow label="Liquidity" value={formatCap(info.liq)} />
        <StatRow label="Vol 24h" value={formatCap(info.volume.h24)} />
        <StatRow label="Vol 6h" value={formatCap(info.volume.h6)} />
        <StatRow label="Vol 1h" value={formatCap(info.volume.h1)} />
        <StatRow
          label="Buys/Sells 24h"
          value={`${info.txns.h24.buys} / ${info.txns.h24.sells}`}
          valueClass={info.txns.h24.buys >= info.txns.h24.sells ? 'text-green-400' : 'text-red-400'}
        />
        <StatRow label="DEX" value={info.dexId ?? 'N/A'} />
        {info.pairCreatedAt && <StatRow label="Pair Created" value={formatAge(info.pairCreatedAt)} />}
      </div>

      <div className="flex items-center gap-2 pt-1">
        <span className="text-[11px] text-slate-500">CA:</span>
        <span className="font-mono text-[11px] text-blue-400 break-all">{ca}</span>
      </div>
    </div>
  );
}