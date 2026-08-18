import { Resvg } from '@resvg/resvg-js';
import { formatPriceShort, formatDateShort } from '@/lib/format';

export interface ChartEntry {
  date: string;
  price: number | null;
  score: number | null;
  scoreDisplay: string | null;
  topwhale?: string;
  top10?: number | null;
  timestamp?: string;
}

const COLORS = {
  bg: '#0f172a',
  border: '#1e293b',
  grid: '#1e293b',
  axisText: '#64748b',
  blue: '#60a5fa',
  greenDark: '#15803d',
  greenLight: '#86efac',
  yellow: '#facc15',
  slate300: '#cbd5e1',
  red: '#ef4444',
  top10Box: '#05253b',
  top10Text: '#3b82f6',
  springFill: '#363603',
  springStroke: '#ffde3a',
};

function segmentColor(currentScore: number | null, prevScores: number[]): { stroke: string; opacity: number } {
  if (prevScores.length < 3 || currentScore == null) return { stroke: COLORS.blue, opacity: 1 };
  if (currentScore <= 2) return { stroke: COLORS.blue, opacity: 1 };
  const avg = (prevScores[0] + prevScores[1] + prevScores[2]) / 3;
  const aboveAvg = currentScore - avg;
  if (aboveAvg > 3) return { stroke: COLORS.greenDark, opacity: 1 };
  if (aboveAvg > 0) return { stroke: COLORS.greenLight, opacity: 0.5 };
  return { stroke: COLORS.blue, opacity: 1 };
}

export function buildChartSvg(entries: ChartEntry[]): string {
  const s = 1.3;
  const width = 1200;
  const height = 520;
  const pad = { left: 90, right: 16, top: 30, bottom: 46 };

  const logPrices = entries.map((e) => Math.log10(e.price as number));
  let minLog = Math.min(...logPrices);
  let maxLog = Math.max(...logPrices);
  if (minLog === maxLog) { minLog -= 0.1; maxLog += 0.1; }

  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  const xStep = entries.length > 1 ? innerW / (entries.length - 1) : 0;

  const points = entries.map((e, i) => ({
    x: pad.left + i * xStep,
    y: pad.top + innerH * (1 - (Math.log10(e.price as number) - minLog) / (maxLog - minLog)),
    ...e,
  }));

  const starred = new Set<number>();
  const segments: { x1: number; y1: number; x2: number; y2: number; stroke: string; opacity: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const prevScores = [points[i - 1]?.score, points[i - 2]?.score, points[i - 3]?.score].filter(
      (sc): sc is number => sc != null
    );
    const c = segmentColor(points[i].score, prevScores);
    if ((c.stroke === COLORS.greenDark || c.stroke === COLORS.greenLight) && points[i].topwhale === 'y') starred.add(i);
    segments.push({ x1: points[i - 1].x, y1: points[i - 1].y, x2: points[i].x, y2: points[i].y, ...c });
  }

  function isSpring(idx: number) {
    const p = points[idx], prev = points[idx - 1], prev2 = points[idx - 2];
    const springCond = !!(p && prev && prev2 && p.score != null && prev.score != null &&
      p.price != null && prev2.price != null && p.score - prev.score > 3 && p.price < prev2.price);
    const whaleCount = [idx - 1, idx - 2, idx - 3].filter((i) => starred.has(i)).length;
    const whaleStreak = starred.has(idx) && whaleCount >= 2;
    return springCond || whaleStreak;
  }

  function isWyckSell(idx: number) {
    const p = points[idx], prev = points[idx - 1];
    if (!p || !prev) return false;
    if (p.score == null || ![-2, -1, 0, 1].includes(p.score)) return false;
    if (p.price == null || prev.price == null || !(prev.price < p.price)) return false;
    if (p.top10 == null || prev.top10 == null || !(prev.top10 > p.top10)) return false;
    return true;
  }

  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, i) => {
    const price = Math.pow(10, minLog + (maxLog - minLog) * (i / tickCount));
    return { y: pad.top + innerH * (1 - i / tickCount), price };
  });

  const dateIdxs = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  let svg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0" y="0" width="${width}" height="${height}" fill="${COLORS.bg}"/>`;

  for (const t of yTicks) {
    svg += `<text x="${pad.left - 1}" y="${t.y}" text-anchor="end" dominant-baseline="middle" fill="${COLORS.axisText}" font-size="${10 * s}">${formatPriceShort(t.price)}</text>`;
    svg += `<line x1="${pad.left}" y1="${t.y}" x2="${width - pad.right}" y2="${t.y}" stroke="${COLORS.grid}"/>`;
  }

  dateIdxs.forEach((idx, i) => {
    const p = points[idx];
    if (!p) return;
    const isLatest = idx === points.length - 1;
    const anchor = isLatest ? 'end' : idx === 0 ? 'start' : 'middle';
    svg += `<text x="${p.x}" y="${height - 12}" text-anchor="${anchor}" fill="${COLORS.axisText}" font-size="${10 * s}">${formatDateShort(p.timestamp)}${isLatest ? ' (UTC +0)' : ''}</text>`;
  });

  for (const sg of segments) {
    svg += `<line x1="${sg.x1}" y1="${sg.y1}" x2="${sg.x2}" y2="${sg.y2}" stroke="${sg.stroke}" stroke-opacity="${sg.opacity}" stroke-width="${1.5 * s}"/>`;
  }

  for (const p of points) {
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${3 * s}" fill="${COLORS.blue}"/>`;
  }

  points.forEach((p, i) => {
    const y = p.y - 8 * s;
    const prevScores = [points[i - 1]?.score, points[i - 2]?.score, points[i - 3]?.score].filter(
      (sc): sc is number => sc != null
    );
    const avg = prevScores.length === 3 ? (prevScores[0] + prevScores[1] + prevScores[2]) / 3 : null;
    const isTripleAvg = avg != null && avg > 0 && p.score != null && p.score > 5 && p.score > avg * 3;
    const scoreColor = (p.score ?? 0) > 8 || isTripleAvg ? COLORS.yellow : COLORS.slate300;
    const label = `${starred.has(i) ? '\u{1F40B}' : ''}${p.scoreDisplay ?? '-'}`;
    const spring = isSpring(i);
    const wyckSell = isWyckSell(i);
    const charWidth = (starred.has(i) ? 14 + (label.length - 1) * 7.5 : label.length * 7.5) * s;
    const boxW = charWidth + 8 * s;
    const boxH = 18 * s;

    if (spring) {
      svg += `<rect x="${p.x - boxW / 2}" y="${y - boxH + 4 * s}" width="${boxW}" height="${boxH}" rx="4" fill="${COLORS.springFill}" fill-opacity="0.55" stroke="${COLORS.springStroke}" stroke-width="2"/>`;
    }
    svg += `<text x="${p.x}" y="${y}" text-anchor="middle" fill="${scoreColor}" font-weight="bold" font-size="${14 * s}">${label}</text>`;

    if (p.top10 != null) {
      const bw = String(p.top10).length * 7 * s + 10 * s;
      svg += `<rect x="${p.x - bw / 2}" y="${p.y + 6 * s}" width="${bw}" height="${16 * s}" rx="4" fill="${COLORS.top10Box}"/>`;
      svg += `<text x="${p.x}" y="${p.y + 17 * s}" text-anchor="middle" fill="${COLORS.top10Text}" font-weight="600" font-size="${11 * s}">${p.top10}</text>`;
      if (wyckSell) {
        svg += `<text x="${p.x + charWidth / 2 + 6 * s}" y="${y}" text-anchor="middle" fill="${COLORS.red}" font-weight="bold" font-size="${14 * s}">\u25BC</text>`;
      }
    }
  });

  svg += `</svg>`;
  return svg;
}

export function renderChartPng(entries: ChartEntry[]): Buffer {
  const svg = buildChartSvg(entries);
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1600 } });
  return resvg.render().asPng();
}