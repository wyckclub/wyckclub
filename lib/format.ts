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