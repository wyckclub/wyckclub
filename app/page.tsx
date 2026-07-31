import Link from 'next/link';
import { getConnectedWalletsCount, getChartViews, getTotalTokens } from '@/lib/stats';

export default async function Home() {
  const [totalTokens, totalConnects, totalChartViews] = await Promise.all([
    getTotalTokens(),
    getConnectedWalletsCount(),
    getChartViews(),
  ]);

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-16">
      <section className="text-center py-16 space-y-6">
        <h1 className="text-5xl font-extrabold text-blue-500">WYCKSCORE</h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          24/7 token tracking on the Base network. WyckClub scans and surfaces tokens accumulated by
          strong players using Wyckoff-style patterns, before the crowd notices.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link
            href="/pro"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Open Pro App
          </Link>
          <Link
            href="/vip"
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 font-semibold rounded-xl border border-slate-700 transition-all"
          >
            Vip App
          </Link>
          <Link
            href="/guide"
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-800 transition-all"
          >
            Guide
          </Link>
          <a
            href="https://x.com/WYCKSCORE"
            target="_blank"
            rel="noopener noreferrer"
            className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold rounded-xl border border-slate-800 transition-all"
          >
            X
          </a>
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <FeatureCard title="24/7 Tracking" desc="Continuous monitoring of token activity across the Base ecosystem, no downtime." />
        <FeatureCard title="Wyckoff Detection" desc="Spot accumulation and distribution patterns driven by strong holders." />
        <FeatureCard title="Actionable Signals" desc="A live scoring system ranks tokens so you focus only on the strongest setups." />
      </section>

      {/* PHẦN THỐNG KÊ ĐÃ ĐƯỢC THÊM TIÊU ĐỀ */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center text-white">Statistics</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <StatCard label="Tokens analyzed in depth" value={totalTokens.toLocaleString()} />
          <StatCard label="Total Users" value={totalConnects.toLocaleString()} />
          <StatCard label="Tracker Views" value={totalChartViews.toLocaleString()} />
        </div>
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <PlanCard name="Pro Plan" requirement="WYCK tokens" desc="Unlock the full token tracker table, combining data from all monitored categories." />
        <PlanCard name="Vip Plan" requirement="WYCK tokens" desc="Premium features." />
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-1">
      <div className="text-3xl font-extrabold text-blue-400">{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
      <h3 className="text-blue-400 font-bold text-lg">{title}</h3>
      <p className="text-slate-400 text-sm">{desc}</p>
    </div>
  );
}

function PlanCard({ name, requirement, desc }: { name: string; requirement: string; desc: string }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
      <h3 className="text-xl font-bold text-blue-400">{name}</h3>
      <p className="text-blue-300 text-xs font-mono">{requirement}</p>
      <p className="text-slate-400 text-sm">{desc}</p>
    </div>
  );
}