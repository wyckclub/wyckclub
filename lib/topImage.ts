import { Resvg } from '@resvg/resvg-js';
import { formatCap } from '@/lib/format';
import { PLATFORM_LABELS } from '@/lib/platforms';
import { ensureFontFile, buildChainBadge, escapeXml, FONT_FAMILY } from '@/lib/chartImage';

export interface TopItem {
  imageDataUri: string | null;
  name: string | null;
  symbol: string;
  platform: string;
  marketCap: number | null;
  liq: number;
}

type Chain = 'base' | 'robinhood' | 'arc';
const W = 1200, H = 675, CARD_W = 208, GAP = 16;
const THEME: Record<Chain, { color: string; label: string }> = {
  base: { color: '#3b82f6', label: 'Base' },
  robinhood: { color: '#84cc16', label: 'Robinhood' },
  arc: { color: '#a855f7', label: 'Arc' },
};

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + '…' : s);

export function renderTopPng(chain: Chain, items: TopItem[]): Buffer {
  const { color, label } = THEME[chain];
  const startX = (W - (items.length * CARD_W + (items.length - 1) * GAP)) / 2;

  let svg = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="9"/></filter>
    <radialGradient id="bg" cx="50%" cy="0%" r="90%"><stop offset="0%" stop-color="${color}" stop-opacity="0.18"/><stop offset="60%" stop-color="#000" stop-opacity="1"/></radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="#000"/>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="24" fill="none" stroke="${color}" stroke-width="7" opacity="0.85" filter="url(#glow)"/>
  <rect x="12" y="12" width="${W - 24}" height="${H - 24}" rx="24" fill="none" stroke="${color}" stroke-width="2"/>`;

  svg += buildChainBadge(chain);
  svg += `<text font-family="${FONT_FAMILY}" x="${W / 2}" y="140" text-anchor="middle" fill="#fff" font-weight="bold" font-size="34">Tokens with accumulation potential on #${label}</text>`;
  svg += `<line x1="${W / 2 - 160}" y1="162" x2="${W / 2 + 160}" y2="162" stroke="${color}" stroke-width="3" filter="url(#glow)"/>`;

  items.forEach((it, i) => {
    const x = startX + i * (CARD_W + GAP);
    const cx = x + CARD_W / 2;
    const plat = PLATFORM_LABELS[it.platform] ?? it.platform;
    svg += `<rect x="${x}" y="200" width="${CARD_W}" height="390" rx="16" fill="#0a0f1a" stroke="${color}" stroke-opacity="0.5" stroke-width="1.5"/>`;
    if (it.imageDataUri) {
      svg += `<defs><clipPath id="c${i}"><circle cx="${cx}" cy="272" r="48"/></clipPath></defs>
      <image x="${cx - 48}" y="224" width="96" height="96" href="${it.imageDataUri}" clip-path="url(#c${i})" preserveAspectRatio="xMidYMid slice"/>`;
    } else {
      svg += `<circle cx="${cx}" cy="272" r="48" fill="#1e293b"/>`;
    }
    svg += `<circle cx="${cx}" cy="272" r="50" fill="none" stroke="${color}" stroke-width="2"/>`;
    const t = (y: number, size: number, fill: string, txt: string) =>
      `<text font-family="${FONT_FAMILY}" x="${cx}" y="${y}" text-anchor="middle" fill="${fill}" font-weight="bold" font-size="${size}">${escapeXml(txt)}</text>`;
    svg += t(362, 17, '#fff', cut(it.name ?? it.symbol, 16));
    svg += t(392, 20, color, '$' + cut(it.symbol, 10));
    svg += t(424, 15, '#94a3b8', cut(plat, 18));
    svg += t(468, 13, '#64748b', 'MarketCap');
    svg += t(496, 22, '#fff', formatCap(it.marketCap));
    svg += t(536, 13, '#64748b', 'Liquidity');
    svg += t(564, 22, '#fff', formatCap(it.liq));
  });

  svg += `<text font-family="${FONT_FAMILY}" x="${W / 2}" y="635" text-anchor="middle" fill="#64748b" font-size="15">wyck.pro</text></svg>`;

  return new Resvg(svg, {
    fitTo: { mode: 'width', value: 1600 },
    font: { fontFiles: [ensureFontFile()], loadSystemFonts: false, defaultFontFamily: FONT_FAMILY },
  }).render().asPng();
}