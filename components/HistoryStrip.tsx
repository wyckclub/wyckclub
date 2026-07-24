import { formatPriceShort, getScoreColorClass } from '@/lib/format';

interface HistoryEntry {
  date: string;
  price: number | null;
  score: number;
  scoreDisplay: string;
}

export function HistoryStrip({ last7 }: { last7: HistoryEntry[] }) {
  if (!last7 || !last7.length) return <span>-</span>;

  return (
    <div className="flex gap-1.5">
      {last7.map((h, i) => {
        const prevEntry = last7[i + 1];
        const newerEntry = last7[i - 1];

        let priceColorClass = 'text-slate-500';
        if (h.price != null && prevEntry?.price != null) {
          if (h.price > prevEntry.price) priceColorClass = 'text-green-400';
          else if (h.price < prevEntry.price) priceColorClass = 'text-red-400';
        }

        let borderClass = 'border-transparent';
        if (i === 0 && prevEntry && h.price != null && prevEntry.price != null) {
          const scoreUpOrEqual = h.score >= prevEntry.score;
          const scoreDown = h.score < prevEntry.score;
          const priceDown = h.price < prevEntry.price;
          const priceUp = h.price > prevEntry.price;
          if (scoreUpOrEqual && h.score > 0 && priceDown) borderClass = 'border-green-500';
          else if (scoreDown && h.score <= 6 && priceUp) borderClass = 'border-red-500';
        }

        if (newerEntry && h.price != null && newerEntry.price != null && newerEntry.score === h.score) {
          const diffPct = (Math.abs(h.price - newerEntry.price) / newerEntry.price) * 100;
          if (diffPct < 2) borderClass = 'border-blue-500';
        }

        if (prevEntry && h.price != null && prevEntry.price != null) {
          const priceDownVsPrev = h.price < prevEntry.price;
          const scoreJumpUp = h.score - prevEntry.score > 2;
          if (priceDownVsPrev && scoreJumpUp) borderClass = 'border-purple-500';
        }

        return (
          <div
            key={h.date + i}
            className={`flex flex-col items-center bg-slate-900 rounded px-1 py-1 text-[11px] w-[76px] border ${borderClass}`}
          >
            <div className={`text-[10px] font-mono ${priceColorClass}`}>{formatPriceShort(h.price)}</div>
            <div className={getScoreColorClass(h.score)}>{h.scoreDisplay}</div>
          </div>
        );
      })}
    </div>
  );
}