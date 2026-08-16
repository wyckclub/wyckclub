import Link from 'next/link';
import { getConnectedWalletsCount, getChartViews, getBaseTotalTokens, getRobinhoodTotalTokens } from '@/lib/stats';
import Image from 'next/image';

function BaseIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={`${className} rounded-[6px] overflow-hidden shrink-0`}>
      <rect width="400" height="400" fill="#FFFFFF" />
      <rect x="80" y="80" width="240" height="240" rx="28" ry="28" fill="#0052FF" />
    </svg>
  );
}

function RobinhoodIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={`${className} rounded-[6px] overflow-hidden shrink-0`}>
      <rect width="400" height="400" fill="#ccff00" />
      <g fill="#211d19">
        <path d="M 185 133.5 
                 L 170.5 148 
                 C 142 176.5, 131 220, 131 245 
                 C 131 260, 120 300, 106 321 
                 L 115 321 
                 C 137 280, 149 220, 172 172 
                 Z" />
        <path d="M 249 80 
                 C 275 80, 294 100, 294 130 
                 C 294 150, 280 178, 252 206 
                 L 252 145 
                 L 237 130 
                 L 185 122 
                 Z" />
        <path d="M 238 145 
                 L 238 215 
                 L 150 272 
                 C 175 235, 205 185, 238 145 
                 Z" />
      </g>
    </svg>
  );
}

export default async function Home() {
  const [baseTokens, robinhoodTokens, totalConnects, totalChartViews] = await Promise.all([
    getBaseTotalTokens(),
    getRobinhoodTotalTokens(),
    getConnectedWalletsCount(),
    getChartViews(),
  ]);

  const totalTokens = baseTokens + robinhoodTokens;

  return (
    <main className="max-w-5xl mx-auto p-6 space-y-16">
      <section className="text-center py-16 space-y-6">
      <h1 className="flex items-center justify-center gap-3 text-5xl font-extrabold text-blue-500">
        <Image src="/w.png" alt="WYCK.Pro" width={48} height={48} />
        WYCKSCORE
      </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          🐋 Smart Money Tracking tool 🐋
          Scanning tokens across the Base and Robinhood networks.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link
            href="/base"
            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-blue-600/20"
          >
            Open BASE Tracker
          </Link>
          <Link
            href="/robinhood"
            className="px-6 py-3 bg-[#ccff00] hover:bg-[#b8e600] text-[#211d19] font-semibold rounded-xl transition-all"
          >
            Robinhood Tracker
          </Link>
          <Link
            href="/whale-hub"
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-blue-400 font-semibold rounded-xl border border-slate-700 transition-all"
          >
            Whale Hub
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

      {/* NETWORKS */}
      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center text-white">Networks We Track</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <NetworkCard
            icon={<BaseIcon />}
            name="Base"
            desc="Coinbase's L2 network built on the OP Stack. WYCKSCORE covers Clanker & Bankr launches, Virtuals agent tokens, and general Base-native tokens, scoring accumulation and whale activity in real time."
            href="/base"
            cta="Open BASE Tracker"
            accent="text-blue-400"
          />
          <NetworkCard
            icon={<RobinhoodIcon />}
            name="Robinhood"
            desc="Robinhood's onchain network for tokenized assets. WYCKSCORE applies the same Wyckoff-style scoring and SmartMoney flow detection to tokens launched and traded on Robinhood's chain."
            href="/robinhood"
            cta="Open Robinhood Tracker"
            accent="text-[#ccff00]"
          />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <FeatureCard title="24/7 Tracking" desc="Continuous monitoring of token activity across Base and Robinhood, no downtime." />
        <FeatureCard title="Wyckoff Detection" desc="Spot accumulation and distribution patterns driven by strong holders." />
        <FeatureCard title="Actionable Signals" desc="A live scoring system ranks tokens so you focus only on the strongest setups." />
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center text-white">Statistics</h2>
        <div className="grid md:grid-cols-2 gap-6">
          <StatCard icon={<BaseIcon className="w-6 h-6" />} label="Base tokens tracked" value={baseTokens.toLocaleString()} accent="text-blue-400" />
          <StatCard icon={<RobinhoodIcon className="w-6 h-6" />} label="Robinhood tokens tracked" value={robinhoodTokens.toLocaleString()} accent="text-[#ccff00]" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <StatCard label="Total tokens analyzed" value={totalTokens.toLocaleString()} />
          <StatCard label="Total Users" value={totalConnects.toLocaleString()} />
          <StatCard label="Tracker Views" value={totalChartViews.toLocaleString()} />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <PlanCard name="BASE Tracker" requirement="WYCK · Base" desc="Unlock the full token tracker table, combining data from all monitored Base categories." />
        <PlanCard name="Robinhood Tracker" requirement="WYCK · Robinhood" desc="Track tokens launched and traded on the Robinhood network." />
        <PlanCard name="VIP Plan" requirement="WYCK" desc="Premium portfolio tracking and strong-momentum whale features." />
      </section>
    </main>
  );
}

function NetworkCard({
  icon,
  name,
  desc,
  href,
  cta,
  accent,
}: {
  icon: React.ReactNode;
  name: string;
  desc: string;
  href: string;
  cta: string;
  accent: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
      <div className="flex items-center gap-3">
        {icon}
        <h3 className={`text-xl font-bold ${accent}`}>{name}</h3>
      </div>
      <p className="text-slate-400 text-sm leading-relaxed">{desc}</p>
      <Link href={href} className={`inline-block text-sm font-semibold ${accent} hover:underline`}>
        {cta} →
      </Link>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent = 'text-blue-400',
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-1">
      {icon && <div className="flex justify-center mb-1">{icon}</div>}
      <div className={`text-3xl font-extrabold ${accent}`}>{value}</div>
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