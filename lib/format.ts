export function formatCap(cap: number | null | undefined) {
  if (cap == null || isNaN(cap)) return 'N/A';
  const n = Number(cap);
  if (n >= 1_000_000) return '$' + (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return '$' + (n / 1_000).toFixed(1) + 'K';
  return '$' + n.toFixed(0);
}

export function formatPriceShort(price: number | null | undefined) {
  if (price == null || isNaN(price) || price === 0) return '-';
  const sig = 3;
  const exponent = Math.floor(Math.log10(Math.abs(price)));
  if (exponent >= 0) return Number(price.toPrecision(sig)).toString();
  const decimals = sig - exponent - 1;
  return price.toFixed(decimals);
}

export function getScoreColorClass(score: number) {
  if (score >= 9) return 'text-green-400';
  if (score >= 7) return 'text-yellow-300';
  if (score >= 5) return 'text-orange-300';
  if (score >= 3) return 'text-orange-500';
  return 'text-red-500';
}

export function formatDateShort(timestamp: string | null | undefined) {
  if (!timestamp) return '';
  const d = new Date(timestamp);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

export function getWhaleStarredScore(latestScoreDisplay: string, last7: { score: number; topwhale?: string }[]) {
  if (!last7 || last7.length < 4) return latestScoreDisplay;
  const current = last7[0];
  const prevScores = [last7[1]?.score, last7[2]?.score, last7[3]?.score].filter(
    (s): s is number => s != null
  );
  if (prevScores.length < 3) return latestScoreDisplay;
  if (current.score <= 2) return latestScoreDisplay;
  const avg = (prevScores[0] + prevScores[1] + prevScores[2]) / 3;
  const aboveAvg = current.score - avg;
  const isWhaleColor = aboveAvg > 0;
  return isWhaleColor && current.topwhale === 'y' ? `🐋${latestScoreDisplay}` : latestScoreDisplay;
}

export function getChartScoreTextColorClass(
  latestScore: number,
  last7: { score: number }[]
) {
  const prevScores = [last7[1]?.score, last7[2]?.score, last7[3]?.score].filter(
    (s): s is number => s != null
  );
  const avg = prevScores.length === 3 ? (prevScores[0] + prevScores[1] + prevScores[2]) / 3 : null;
  const isTripleAvg = avg != null && avg > 0 && latestScore > 5 && latestScore > avg * 3;
  return latestScore > 8 || isTripleAvg ? 'text-yellow-400' : 'text-slate-300';
}