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
  base_unverified: 'Other',
  robinhood_verified: 'Other',
  robinhood_unverified: 'Other',
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
  base_unverified: 'Other - Not Verified',
  robinhood_verified: 'Other - Verified',
  robinhood_unverified: 'Other - Not Verified',
};