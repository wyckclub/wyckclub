import { getScoreColorClass } from '@/lib/format';

export function ScoreBadge({ scoreDisplay, score }: { scoreDisplay: string; score: number }) {
  const hasPlus = scoreDisplay.endsWith('+');
  const numberPart = hasPlus ? scoreDisplay.slice(0, -1) : scoreDisplay;
  return (
    <span className={`font-bold text-sm ${getScoreColorClass(score)}`}>
      {numberPart}
      {hasPlus && <span className="text-yellow-300">+</span>}
    </span>
  );
}