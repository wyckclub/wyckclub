'use client';

import { useState } from 'react';
import { TokenSidebar } from '@/components/TokenSidebar';
import { TokenDataProvider } from '@/components/TokenDataContext';

type Chain = 'base' | 'robinhood';

export function TokenDetailShell({
  chain, children,
}: { chain: Chain; children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <TokenDataProvider chain={chain}>
      <div className="w-full px-3 py-3 lg:h-[calc(100vh-73px)] lg:overflow-hidden">
        <div className="flex flex-col lg:flex-row gap-3 lg:h-full">
          {/* mobile */}
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden flex items-center justify-between px-3 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm font-bold text-blue-400"
          >
            Select token
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>

          {/* Sidebar desktop */}
          <div className="hidden lg:block h-full overflow-hidden lg:w-80 shrink-0">
            <TokenSidebar chain={chain} />
          </div>

          {/* Drawer mobile */}
          {sidebarOpen && (
            <div className="lg:hidden fixed inset-0 z-50 flex">
              <div className="absolute inset-0 bg-black/60" onClick={() => setSidebarOpen(false)} />
              <div className="relative ml-auto w-[88%] max-w-sm h-full bg-slate-950 flex flex-col">
                <div className="flex items-center justify-between px-3 py-3 border-b border-slate-800 shrink-0">
                  <span className="text-sm font-bold text-blue-400">All token</span>
                  <button onClick={() => setSidebarOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
                </div>
                <div className="flex-1 min-h-0">
                  <TokenSidebar chain={chain} onSelect={() => setSidebarOpen(false)} />
                </div>
              </div>
            </div>
          )}

          {children}
        </div>
      </div>
    </TokenDataProvider>
  );
}