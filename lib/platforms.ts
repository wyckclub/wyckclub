export const BASE_PLATFORMS = ['clanker', 'bankr', 'virtuals', 'flaunch', 'zora', 'base_verified', 'base_unverified'];

export const ROBINHOOD_PLATFORMS = [
  'robinhood_verified', 'robinhood_unverified', 'bankr', 'pools.fun', 'pools.trade', 'clanker', 'virtuals',
  'flaunch', 'flap', 'hood.fun', 'ponsfamily', 'letscash', 'noxa',
];

// Label shown INSIDE the badge (icon + text) next to the token
export const PLATFORM_LABELS: Record<string, string> = {
  clanker: 'Clanker',
  bankr: 'Bankr',
  virtuals: 'Virtuals',
  flaunch: 'Flaunch.gg',
  zora: 'Zora',
  base_verified: 'Other',
  base_unverified: 'Unknown',
  robinhood_verified: 'Other',
  robinhood_unverified: 'Unknown',
  'pools.fun': 'Pools.fun',
  'pools.trade': 'Pools.trade',
  flap: 'Flap.sh',
  'hood.fun': 'Hood.fun',
  ponsfamily: 'PonsFamily',
  letscash: 'LetsCash',
  noxa: 'Noxa',
};

// Label shown in the filter <select> dropdown (needs to distinguish verified/not verified)
export const FILTER_LABELS: Record<string, string> = {
  ...PLATFORM_LABELS,
  base_verified: 'Other - Verified',
  base_unverified: 'Unknown - Not Verified',
  robinhood_verified: 'Other - Verified',
  robinhood_unverified: 'Unknown - Not Verified',
};

// Two share-text lines: verified status line + platform hashtag line
export function platformShareLines(platform: string | null | undefined): string[] {
  if (!platform) return [];
  const isUnverified = platform.endsWith('_unverified');
  const label = PLATFORM_LABELS[platform] ?? platform;
  const hashtag = label.replace(/[^a-zA-Z0-9]/g, '');
  const verifiedLine = isUnverified ? '❌ Not Verified' : '✅ Verified';
  const platformLine = `✅ Platform: #${hashtag}`;
  return [verifiedLine, platformLine];
}