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

function ArcIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={`${className} rounded-[6px] overflow-hidden shrink-0`}>
      <rect width="500" height="500" rx="250" fill="#1B3158"/>
      <path d="M250.466 85C291.387 85 327.762 120.453 352.899 184.828C365.973 218.31 375.592 258.091 381.291 301.368C381.801 305.233 382.234 309.161 382.679 313.081C382.824 313.323 382.911 313.548 382.881 313.731C382.881 313.731 386.231 334.649 386.942 371.001H386.564C381.597 366.924 323.011 320.889 225.894 334.219C227.359 317.784 229.374 301.793 231.978 286.465C232.111 285.682 232.265 284.925 232.4 284.147C270.491 282.999 303.831 287.422 329.397 293.219C329.302 292.612 329.223 291.988 329.126 291.384C323.871 258.658 316.118 228.697 306.121 203.093C289.776 161.227 268.447 135.216 250.466 135.216C232.486 135.216 211.157 161.228 194.812 203.093C190.856 213.219 187.254 224.019 184.024 235.41C179.483 251.372 175.668 268.484 172.621 286.464C168.112 313.017 165.295 341.496 164.257 371.001H114C116.319 300.984 128.19 235.639 148.033 184.828C173.165 120.453 209.545 85.0002 250.466 85Z" fill="white"/>
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
          🐋 Smart Money Tracking tool 🐋 on Base and Robinhood networks.
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
          <StatCard label="Tracker" value={totalChartViews.toLocaleString()} />
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