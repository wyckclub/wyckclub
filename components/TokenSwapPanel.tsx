'use client';

import { LiFiWidget, WidgetConfig } from '@lifi/widget';

const CHAIN_IDS: Record<string, number> = { base: 8453, robinhood: 4663 };

export function TokenSwapPanel({ chainId, ca }: { chainId: string; ca: string }) {
  const widgetConfig: WidgetConfig = {
    integrator: 'wyck.pro',
    toChain: CHAIN_IDS[chainId] ?? 8453,
    toToken: ca,
    appearance: 'dark',
    theme: { container: { border: '1px solid rgb(30,41,59)', borderRadius: '16px' } },
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <LiFiWidget integrator="wyck.pro" config={widgetConfig} />
    </div>
  );
}
