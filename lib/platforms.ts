export const BASE_PLATFORMS = [
  'clanker', 'bankr', 'virtuals', 'o1exchange', 'flaunch', 'zora', 'basestonk', 'thestonks', 'base_verified', 'base_unverified'];

export const ROBINHOOD_PLATFORMS = [
  'ponsfamily', 'o1exchange', 'long', 'poolsfun', 'poolstrade', 'bankr', 'virtuals', 'clanker',
  'flap', 'noxa', 'stonkbrokers', 'feelcash', 'letscash', 'lunchfun', 'pairfund', 'sentry', 'lemon',
  'robinhood_verified', 'robinhood_unverified'
];

export const ARC_PLATFORMS = ['argus', 'o1exchange', 'arc_verified', 'arc_unverified'];

export const PLATFORM_LABELS: Record<string, string> = {
  clanker: 'Clanker',
  bankr: 'Bankr.bot',
  virtuals: 'Virtuals',
  o1exchange: 'o1.exchange',
  basestonk: 'BaseStonk',
  thestonks: 'TheStonks',
  flaunch: 'Flaunch.gg',
  zora: 'Zora',
  poolsfun: 'Pools.fun',
  poolstrade: 'Pools.trade',
  flap: 'Flap.sh',
  ponsfamily: 'PonsFamily',
  long: 'LONG.xyz',
  letscash: 'Lets.cash',
  noxa: 'Noxa.fi',
  stonkbrokers: 'StonkBrokers',
  lemon: 'Lemon.fun',
  feelcash: 'Feel.Cash',
  lunchfun: 'Lunch.fun',
  pairfund: 'Pair.fund',
  sentry: 'Sentry',

  // arc
  argus: 'Argus',
  
  base_verified: 'Other',
  base_unverified: 'Unknown',
  robinhood_verified: 'Other',
  robinhood_unverified: 'Unknown',
  arc_verified: 'Other',
  arc_unverified: 'Unknown',
};

export const FILTER_LABELS: Record<string, string> = {
  ...PLATFORM_LABELS,
  base_verified: 'Other - Verified',
  base_unverified: 'Unknown - Not Verified',
  robinhood_verified: 'Other - Verified',
  robinhood_unverified: 'Unknown - Not Verified',
  arc_verified: 'Other - Verified',
  arc_unverified: 'Unknown - Not Verified',
};

 export function platformShareLines(platform: string | null | undefined): string[] {
   if (!platform) return [];
   const isUnverified = platform.endsWith('_unverified');
   const label = PLATFORM_LABELS[platform] ?? platform;
   const hashtag = label.replace(/[^a-zA-Z0-9]/g, '');
   const verifiedLine = isUnverified ? '❌ Not Verified' : '✅ Verified';
   const platformLine = `🚀 Token Launcher: #${hashtag}`;
   return [verifiedLine, platformLine];
 }

export function formatPlatformLabel(p: string): string {
  return FILTER_LABELS[p] ?? p.charAt(0).toUpperCase() + p.slice(1);
}

function isCatchAllPlatform(p: string): boolean {
  return p.endsWith('_verified') || p.endsWith('_unverified');
}

export function derivePlatformOptions(items: { platform: string }[]): string[] {
  const counts = new Map<string, number>();
  for (const i of items) {
    counts.set(i.platform, (counts.get(i.platform) ?? 0) + 1);
  }

  return [...counts.keys()].sort((a, b) => {
    const aCatchAll = isCatchAllPlatform(a);
    const bCatchAll = isCatchAllPlatform(b);
    if (aCatchAll !== bCatchAll) return aCatchAll ? 1 : -1;

    const diff = (counts.get(b) ?? 0) - (counts.get(a) ?? 0);
    if (diff !== 0) return diff;

    return formatPlatformLabel(a).localeCompare(formatPlatformLabel(b));
  });
}