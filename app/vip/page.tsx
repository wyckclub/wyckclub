'use client';

import { useTokenGate, VIP_THRESHOLD } from '@/lib/tokenGate';

export default function VipPlanPage() {
  const { isConnected, isLoading, amount, hasAccess } = useTokenGate(VIP_THRESHOLD);

  if (!isConnected) return <GateMessage title="Connect your wallet" message="Connect your wallet to check Vip Plan access." />;
  if (isLoading) return <GateMessage title="Checking balance..." message="" />;
  if (!hasAccess) {
    return (
      <GateMessage
        title="Vip Plan Locked"
        message={`You need at least ${VIP_THRESHOLD.toLocaleString()} tokens. Your balance: ${amount.toLocaleString()}.`}
      />
    );
  }

  return <GateMessage title="Vip Plan" message="Vip content is coming soon." />;
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