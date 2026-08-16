'use client';

import { TokenSidebar } from '@/components/TokenSidebar';

type Chain = 'base' | 'robinhood';

export function TokenDetailShell({
  chain, activeCa, children,
}: { chain: Chain; activeCa: string; children: React.ReactNode }) {
  return (
    <div className="w-full px-3 py-3 h-[calc(100vh-73px)] overflow-hidden">
      <div className="flex flex-col lg:flex-row gap-3 h-full">
        <div className="h-full overflow-hidden lg:w-80 shrink-0">
          <TokenSidebar chain={chain} activeCa={activeCa} />
        </div>
        {children}
      </div>
    </div>
  );
}