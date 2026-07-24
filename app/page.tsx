export default function Home() {
  return (
    <main className="max-w-5xl mx-auto p-6 space-y-16">
      <section className="text-center py-16 space-y-4">
        <h1 className="text-5xl font-extrabold text-blue-500">WYCK CLUB</h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          24/7 token tracking on the Base network. WyckClub scans and surfaces tokens accumulated by
          strong players using Wyckoff-style patterns, before the crowd notices.
        </p>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <FeatureCard
          title="24/7 Tracking"
          desc="Continuous monitoring of token activity across the Base ecosystem, no downtime."
        />
        <FeatureCard
          title="Wyckoff Detection"
          desc="Spot accumulation and distribution patterns driven by strong holders."
        />
        <FeatureCard
          title="Actionable Signals"
          desc="A live scoring system ranks tokens so you focus only on the strongest setups."
        />
      </section>

      <section className="grid md:grid-cols-2 gap-6">
        <PlanCard
          name="Pro Plan"
          requirement="Hold 10,000,000+ WYCK tokens"
          desc="Unlock the full token tracker table, combining data from all monitored categories."
        />
        <PlanCard
          name="Vip Plan"
          requirement="Hold 50,000,000+ WYCK tokens"
          desc="Premium features, coming soon."
        />
      </section>
    </main>
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