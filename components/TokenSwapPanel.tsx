'use client';

import { useEffect, useState } from 'react';
import { LiFiWidget, WidgetConfig } from '@lifi/widget';

const CHAIN_IDS: Record<string, number> = { base: 8453, robinhood: 4663 };
const SWAP_VISIBLE_KEY = 'wyck_show_swap';

export function TokenSwapPanel({ chainId, ca }: { chainId: string; ca: string }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(SWAP_VISIBLE_KEY);
    if (saved != null) setVisible(saved === '1');
  }, []);

  function toggle() {
    setVisible((v) => {
      const next = !v;
      localStorage.setItem(SWAP_VISIBLE_KEY, next ? '1' : '0');
      return next;
    });
  }

  const widgetConfig: WidgetConfig = {
    integrator: 'wyck.pro',
    toChain: CHAIN_IDS[chainId] ?? 8453,
    toToken: ca,
    appearance: 'dark',
    theme: { container: { border: '1px solid rgb(30,41,59)', borderRadius: '16px' } },
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800">
        <span className="text-sm font-bold text-blue-400">Exchange</span>
        <button
          onClick={toggle}
          className="text-[11px] px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200"
        >
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
      {visible && <LiFiWidget integrator="wyck.pro" config={widgetConfig} />}
    </div>
  );
}