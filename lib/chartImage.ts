import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';
import { formatPriceShort, formatDateShort, formatCap } from '@/lib/format';
import { DEJAVU_SANS_BOLD_BASE64 } from '@/lib/fontData';
import { PLATFORM_LABELS } from '@/lib/platforms';

const FONT_FAMILY = 'DejaVu Sans';
const FONT_TMP_PATH = path.join('/tmp', 'wyck-chart-font.ttf');

function ensureFontFile(): string {
  if (!fs.existsSync(FONT_TMP_PATH)) {
    fs.writeFileSync(FONT_TMP_PATH, Buffer.from(DEJAVU_SANS_BOLD_BASE64, 'base64'));
  }
  return FONT_TMP_PATH;
}

export interface ChartEntry {
  date: string;
  price: number | null;
  score: number | null;
  scoreDisplay: string | null;
  topwhale?: string;
  top10?: number | null;
  timestamp?: string;
}

export interface ChartHeader {
  chain: 'base' | 'robinhood';
  tokenImageDataUri: string | null;
  name: string | null;
  symbol: string;
  platform: string | null; // null -> don't render platform badge
  marketCap: number | null;
  liq: number | null;
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
  white: '#ffffff',
  mutedText: '#94a3b8',
  avatarFallback: '#1e293b',
};

const CHART_W = 1200;
const CHART_H = 520;
const HEADER_H = 110;
const TOTAL_W = CHART_W;
const TOTAL_H = HEADER_H + CHART_H;

function buildWhaleIcon(x: number, y: number, size: number, color: string): string {
  const scale = size / 24;
  return `<g transform="translate(${x},${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M2 14c1-4 4-7 9-7 5.5 0 9 3.5 10 6.5-1.2 1-3 1.5-4 1-0.5 1.3-1.8 2.5-3.5 2.5-1 0-1.8-.4-2.5-1-1 .7-2.3 1-3.5 1-3 0-5-1.5-5.5-3Z"/>
    <path d="M9 10.2V8"/>
    <circle cx="7" cy="11" r="0.6" fill="${color}" stroke="none"/>
    <path d="M17.5 8c.8-1 2-1.5 3.5-1-1 1.5-1 2.5 0 4-1.7.3-2.8-.2-3.5-1"/>
  </g>`;
}

function segmentColor(currentScore: number | null, prevScores: number[]): { stroke: string; opacity: number } {
  if (prevScores.length < 3 || currentScore == null) return { stroke: COLORS.blue, opacity: 1 };
  if (currentScore <= 2) return { stroke: COLORS.blue, opacity: 1 };
  const avg = (prevScores[0] + prevScores[1] + prevScores[2]) / 3;
  const aboveAvg = currentScore - avg;
  if (aboveAvg > 3) return { stroke: COLORS.greenDark, opacity: 1 };
  if (aboveAvg > 0) return { stroke: COLORS.greenLight, opacity: 0.5 };
  return { stroke: COLORS.blue, opacity: 1 };
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildChartInner(entries: ChartEntry[]): string {
  const s = 1.3;
  const width = CHART_W;
  const height = CHART_H;
  const pad = { left: 90, right: 60, top: 30, bottom: 46 };

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

  let svg = `<rect x="0" y="0" width="${width}" height="${height}" fill="${COLORS.bg}"/>`;

  for (const t of yTicks) {
    svg += `<text font-family="${FONT_FAMILY}" x="${pad.left - 1}" y="${t.y}" text-anchor="end" dominant-baseline="middle" fill="${COLORS.axisText}" font-size="${10 * s}">${formatPriceShort(t.price)}</text>`;
    svg += `<line x1="${pad.left}" y1="${t.y}" x2="${width - pad.right}" y2="${t.y}" stroke="${COLORS.grid}"/>`;
  }

  dateIdxs.forEach((idx, i) => {
    const p = points[idx];
    if (!p) return;
    const isLatest = idx === points.length - 1;
    const anchor = isLatest ? 'end' : idx === 0 ? 'start' : 'middle';
    svg += `<text font-family="${FONT_FAMILY}" x="${p.x}" y="${height - 12}" text-anchor="${anchor}" fill="${COLORS.axisText}" font-size="${10 * s}">${formatDateShort(p.timestamp)}${isLatest ? ' (UTC +0)' : ''}</text>`;
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
    const hasWhale = starred.has(i);
    const scoreText = p.scoreDisplay ?? '-';
    const iconSize = 14 * s;
    const iconGap = 3 * s;
    const textWidth = scoreText.length * 7.5 * s;
    const charWidth = hasWhale ? iconSize + iconGap + textWidth : textWidth;
    const spring = isSpring(i);
    const wyckSell = isWyckSell(i);
    const boxW = charWidth + 8 * s;
    const boxH = 18 * s;
    const startX = p.x - charWidth / 2;

    if (spring) {
      svg += `<rect x="${p.x - boxW / 2}" y="${y - boxH + 4 * s}" width="${boxW}" height="${boxH}" rx="4" fill="${COLORS.springFill}" fill-opacity="0.55" stroke="${COLORS.springStroke}" stroke-width="2"/>`;
    }
    if (hasWhale) {
      svg += buildWhaleIcon(startX, y - iconSize + 3 * s, iconSize, COLORS.blue);
    }
    svg += `<text font-family="${FONT_FAMILY}" x="${startX + (hasWhale ? iconSize + iconGap : 0)}" y="${y}" text-anchor="start" fill="${scoreColor}" font-weight="bold" font-size="${14 * s}">${scoreText}</text>`;

    if (p.top10 != null) {
      const bw = String(p.top10).length * 7 * s + 10 * s;
      svg += `<rect x="${p.x - bw / 2}" y="${p.y + 6 * s}" width="${bw}" height="${16 * s}" rx="4" fill="${COLORS.top10Box}"/>`;
      svg += `<text font-family="${FONT_FAMILY}" x="${p.x}" y="${p.y + 17 * s}" text-anchor="middle" fill="${COLORS.top10Text}" font-weight="600" font-size="${11 * s}">${p.top10}</text>`;
      if (wyckSell) {
        svg += `<text font-family="${FONT_FAMILY}" x="${p.x + charWidth / 2 + 6 * s}" y="${y}" text-anchor="middle" fill="${COLORS.red}" font-weight="bold" font-size="${14 * s}">\u25BC</text>`;
      }
    }
  });

  return svg;
}

function buildChainIcon(chain: 'base' | 'robinhood', x: number, y: number, size: number): string {
  if (chain === 'base') {
    const inset = size * 0.2;
    const innerSize = size - inset * 2;
    return `
      <rect x="${x}" y="${y}" width="${size}" height="${size}" rx="4" fill="#FFFFFF"/>
      <rect x="${x + inset}" y="${y + inset}" width="${innerSize}" height="${innerSize}" rx="2.8" fill="#0052FF"/>
    `;
  }
  const scale = size / 400;
  return `
    <g transform="translate(${x},${y}) scale(${scale})">
      <rect width="400" height="400" fill="#ccff00"/>
      <g fill="#211d19">
        <path d="M 185 133.5 L 170.5 148 C 142 176.5, 131 220, 131 245 C 131 260, 120 300, 106 321 L 115 321 C 137 280, 149 220, 172 172 Z"/>
        <path d="M 249 80 C 275 80, 294 100, 294 130 C 294 150, 280 178, 252 206 L 252 145 L 237 130 L 185 122 Z"/>
        <path d="M 238 145 L 238 215 L 150 272 C 175 235, 205 185, 238 145 Z"/>
      </g>
    </g>
  `;
}

function buildChainBadge(chain: 'base' | 'robinhood'): string {
  const label = chain === 'base' ? 'Base' : 'Robinhood';
  const color = chain === 'base' ? '#60a5fa' : '#ccff00';
  const iconSize = 26;
  const gap = 10;
  const fontSize = 19;
  const textWidth = label.length * (fontSize * 0.6);
  const padRight = 24;
  const totalW = iconSize + gap + textWidth;
  const startX = TOTAL_W - padRight - totalW;
  const iconY = 20;

  let svg = buildChainIcon(chain, startX, iconY, iconSize);
  svg += `<text font-family="${FONT_FAMILY}" x="${startX + iconSize + gap}" y="${iconY + iconSize - 5}" fill="${color}" font-weight="bold" font-size="${fontSize}">${label}</text>`;
  return svg;
}

// Same 2 icons used everywhere else in the app: shield = verified platform, warning triangle = not-verified
function buildShieldIcon(x: number, y: number, size: number): string {
  const scale = size / 24;
  return `
    <g transform="translate(${x},${y}) scale(${scale})">
      <path d="M12 2L3 6V12C3 17.55 6.84 22.74 12 24C17.16 22.74 21 17.55 21 12V6L12 2Z" fill="#0EA5E9"/>
      <path d="M10 15.5L7 12.5L8.41 11.09L10 12.67L15.59 7.08L17 8.5L10 15.5Z" fill="#ffffff"/>
    </g>
  `;
}

function buildWarningIcon(x: number, y: number, size: number): string {
  const scale = size / 24;
  return `
    <g transform="translate(${x},${y}) scale(${scale})">
      <path d="M12 2 23 21H1L12 2Z" fill="#FACC15"/>
      <path d="M12 9v5" stroke="#1a1a1a" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="12" cy="17.5" r="1.2" fill="#1a1a1a"/>
    </g>
  `;
}

function buildHeader(header: ChartHeader): string {
  const padLeft = 24;
  let svg = '';

  svg += buildChainBadge(header.chain);

  const avatarX = padLeft;
  const avatarY = 14;
  const avatarSize = 58;
  const cx = avatarX + avatarSize / 2;
  const cy = avatarY + avatarSize / 2;

  if (header.tokenImageDataUri) {
    svg += `<defs><clipPath id="avatarClip"><circle cx="${cx}" cy="${cy}" r="${avatarSize / 2}"/></clipPath></defs>`;
    svg += `<image x="${avatarX}" y="${avatarY}" width="${avatarSize}" height="${avatarSize}" href="${header.tokenImageDataUri}" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>`;
  } else {
    svg += `<circle cx="${cx}" cy="${cy}" r="${avatarSize / 2}" fill="${COLORS.avatarFallback}"/>`;
  }

  const textX = avatarX + avatarSize + 16;
  const symbol = escapeXml(header.symbol);
  const name = header.name ? escapeXml(header.name) : '';

  // line 1: symbol
  svg += `<text font-family="${FONT_FAMILY}" x="${textX}" y="32" fill="${COLORS.white}" font-weight="bold" font-size="23">${symbol}</text>`;

  // line 2: name (own line, no overlap with symbol)
  let nextY = 32;
  if (name) {
    nextY = 54;
    svg += `<text font-family="${FONT_FAMILY}" x="${textX}" y="${nextY}" fill="${COLORS.mutedText}" font-size="15">${name}</text>`;
  }

  // line 3: platform icon + label text
  if (header.platform) {
    nextY += 24;
    const badgeSize = 17;
    const isUnverified = header.platform.endsWith('_unverified');
    const label = escapeXml(PLATFORM_LABELS[header.platform] ?? header.platform);
    const labelColor = isUnverified ? COLORS.yellow : '#38bdf8';
    svg += isUnverified
      ? buildWarningIcon(textX, nextY - badgeSize + 3, badgeSize)
      : buildShieldIcon(textX, nextY - badgeSize + 3, badgeSize);
    svg += `<text font-family="${FONT_FAMILY}" x="${textX + badgeSize + 6}" y="${nextY}" fill="${labelColor}" font-weight="bold" font-size="14">${label}</text>`;
  }

  // line 4: Cap / Liq
  nextY += 24;
  svg += `<text font-family="${FONT_FAMILY}" x="${textX}" y="${nextY}" fill="${COLORS.mutedText}" font-size="16">Cap: ${escapeXml(formatCap(header.marketCap))}   Liq: ${escapeXml(formatCap(header.liq))}</text>`;

  svg += `<line x1="0" y1="${HEADER_H}" x2="${TOTAL_W}" y2="${HEADER_H}" stroke="${COLORS.border}"/>`;

  return svg;
}

function buildFullSvg(entries: ChartEntry[], header: ChartHeader): string {
  let svg = `<svg width="${TOTAL_W}" height="${TOTAL_H}" viewBox="0 0 ${TOTAL_W} ${TOTAL_H}" xmlns="http://www.w3.org/2000/svg">`;
  svg += `<rect x="0" y="0" width="${TOTAL_W}" height="${TOTAL_H}" fill="${COLORS.bg}"/>`;
  svg += buildHeader(header);
  svg += `<g transform="translate(0, ${HEADER_H})">${buildChartInner(entries)}</g>`;
  svg += `</svg>`;
  return svg;
}

export function renderChartPng(entries: ChartEntry[], header: ChartHeader): Buffer {
  const svg = buildFullSvg(entries, header);
  const fontPath = ensureFontFile();
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1600 },
    font: {
      fontFiles: [fontPath],
      loadSystemFonts: false,
      defaultFontFamily: FONT_FAMILY,
    },
  });
  return resvg.render().asPng();
}