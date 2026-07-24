'use client';

import { useEffect, useState } from 'react';
import { useTokenGate, PRO_THRESHOLD } from '@/lib/tokenGate';
import { fetchAllCategories, TokenEntry } from '@/lib/tokenApi';

function formatCap(cap: number | null) {
  if (cap == null || isNaN(cap)) return 'N/A';
  if (cap >= 1_000_000) return '$' + (cap / 1_000_000).toFixed(2) + 'M';
  if (cap >= 1_000) return '$' + (cap / 1_000).toFixed(1) + 'K';
  return '$' + cap.toFixed(0);
}

export default function ProPlanPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(PRO_THRESHOLD);
  const [tokens, setTokens] = useState<TokenEntry[]>([]);
  const [loadError, setLoadError] = useState('');
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!hasAccess) return;
    setLoadingData(true);
    fetchAllCategories()
      .then(setTokens)
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoadingData(false));
  }, [hasAccess]);

  if (!isConnected) return <GateMessage title="Connect your wallet" message="Connect your wallet to check Pro Plan access." />;
  if (isLoading) return <GateMessage title="Checking balance..." message="" />;
  if (!hasAccess) {
    return (
      <GateMessage
        title="Pro Plan Locked"
        message={`You need at least ${PRO_THRESHOLD.toLocaleString()} tokens. Your balance: ${amount.toLocaleString()}.`}
      />
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-blue-400 mb-4">Pro Plan - Token Tracker</h1>
      {loadingData && <p className="text-slate-400">Loading data...</p>}
      {loadError && <p className="text-red-400">{loadError}</p>}
      {!loadingData && !loadError && (
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-900 text-blue-400">
                <th className="text-left p-3">Symbol</th>
                <th className="text-left p-3">CA</th>
                <th className="text-left p-3">Category</th>
                <th className="text-left p-3">Market Cap</th>
                <th className="text-left p-3">Score</th>
                <th className="text-left p-3">Last Update</th>
              </tr>
            </thead>
            <tbody>
              {tokens.map((t) => (
                <tr key={t.CA} className="border-t border-slate-800">
                  <td className="p-3 font-semibold">{t.symbol}</td>
                  <td className="p-3 font-mono text-xs text-blue-400">{t.CA.slice(0, 6)}...{t.CA.slice(-4)}</td>
                  <td className="p-3">{t.category}</td>
                  <td className="p-3">{formatCap(t.latestMarketCap)}</td>
                  <td className="p-3">{t.latestScoreDisplay}</td>
                  <td className="p-3">{t.latestDate}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GateMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="max-w-md text-center space-y-3">
        <h1 className="text-2xl font-bold text-blue-400">{title}</h1>
        <p className="text-slate-400">{message}</p>
      </div>
    </div>
  );
}