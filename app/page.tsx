import Link from 'next/link';
import Image from 'next/image';
import {
  getConnectedWalletsCount,
  getChartViews,
  getBaseTotalTokens,
  getRobinhoodTotalTokens,
  getArcTotalTokens,
} from '@/lib/stats';

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
        <path d="M 185 133.5 L 170.5 148 C 142 176.5, 131 220, 131 245 C 131 260, 120 300, 106 321 L 115 321 C 137 280, 149 220, 172 172 Z" />
        <path d="M 249 80 C 275 80, 294 100, 294 130 C 294 150, 280 178, 252 206 L 252 145 L 237 130 L 185 122 Z" />
        <path d="M 238 145 L 238 215 L 150 272 C 175 235, 205 185, 238 145 Z" />
      </g>
    </svg>
  );
}

function ArcIcon({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg viewBox="0 0 500 500" className={`${className} rounded-[6px] overflow-hidden shrink-0`}>
      <rect width="500" height="500" rx="250" fill="#1B3158" />
      <path d="M250.466 85C291.387 85 327.762 120.453 352.899 184.828C365.973 218.31 375.592 258.091 381.291 301.368C381.801 305.233 382.234 309.161 382.679 313.081C382.824 313.323 382.911 313.548 382.881 313.731C382.881 313.731 386.231 334.649 386.942 371.001H386.564C381.597 366.924 323.011 320.889 225.894 334.219C227.359 317.784 229.374 301.793 231.978 286.465C232.111 285.682 232.265 284.925 232.4 284.147C270.491 282.999 303.831 287.422 329.397 293.219C329.302 292.612 329.223 291.988 329.126 291.384C323.871 258.658 316.118 228.697 306.121 203.093C289.776 161.227 268.447 135.216 250.466 135.216C232.486 135.216 211.157 161.228 194.812 203.093C190.856 213.219 187.254 224.019 184.024 235.41C179.483 251.372 175.668 268.484 172.621 286.464C168.112 313.017 165.295 341.496 164.257 371.001H114C116.319 300.984 128.19 235.639 148.033 184.828C173.165 120.453 209.545 85.0002 250.466 85Z" fill="white" />
    </svg>
  );
}

function LayersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}

function UsersIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

function PulseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2 8 4-16 2 8h6" />
    </svg>
  );
}

function WhaleGlyph({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 120" className={className} fill="none" stroke="currentColor" strokeWidth={1.1}>
      <path d="M8 68c8-30 34-52 74-52 44 0 72 26 82 50-10 8-24 12-32 8-4 10-14 19-28 19-8 0-14-3-20-8-8 6-18 8-28 8-24 0-40-11-48-25Z" />
      <path d="M60 16v18" />
      <circle cx="42" cy="46" r="2.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

function NetworkGrid({ className = '' }: { className?: string }) {
  return (
    <svg className={className} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <pattern id="wyckGrid" width="46" height="46" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1.3" fill="#60a5fa" />
          <path d="M1 1 L46 1 M1 1 L1 46" stroke="#60a5fa" strokeWidth="0.5" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#wyckGrid)" />
    </svg>
  );
}

const outlineBtn =
  'group relative inline-flex items-center gap-2 px-6 py-3 rounded-xl border font-semibold ' +
  'transition-all duration-300 ease-out hover:-translate-y-0.5';

export default async function Home() {
  const [baseTokens, robinhoodTokens, arcTokens, totalConnects, totalChartViews] = await Promise.all([
    getBaseTotalTokens(),
    getRobinhoodTotalTokens(),
    getArcTotalTokens(),
    getConnectedWalletsCount(),
    getChartViews(),
  ]);

  const totalTokens = baseTokens + robinhoodTokens + arcTokens;

  return (
    <main className="relative max-w-5xl mx-auto p-6 space-y-16 overflow-hidden">
      {/* ---- Nền trang trí: ánh sáng + lưới mạng + cá voi mờ ---- */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <NetworkGrid className="absolute inset-0 w-full h-full opacity-[0.05]" />
        <div className="absolute -top-32 left-1/3 w-[420px] h-[420px] rounded-full bg-blue-600/20 blur-3xl animate-pulse [animation-duration:6s]" />
        <div className="absolute top-40 -right-24 w-[360px] h-[360px] rounded-full bg-[#ccff00]/10 blur-3xl" />
        <div className="absolute bottom-0 left-0 w-[380px] h-[380px] rounded-full bg-purple-600/10 blur-3xl" />
        <WhaleGlyph className="absolute bottom-6 right-0 w-[420px] h-auto text-blue-400/[0.06]" />
      </div>

      <section className="text-center py-16 space-y-6">
        <h1 className="flex items-center justify-center gap-3 text-5xl font-extrabold text-blue-500">
          <Image src="/w.png" alt="WYCK.Pro" width={48} height={48} />
          WYCKSCORE
        </h1>
        <p className="text-slate-400 max-w-2xl mx-auto text-lg">
          🐋 Smart Money Tracking tool 🐋 on Base, Robinhood and Arc networks.
        </p>

        <div className="flex flex-wrap justify-center gap-4 pt-4">
          <Link
            href="/base"
            className={`${outlineBtn} border-blue-500 bg-blue-600 text-white hover:bg-blue-500 hover:shadow-[0_0_25px_-4px_rgba(59,130,246,0.6)]`}
          >
            Open BASE Tracker
          </Link>
          <Link
            href="/robinhood"
            className={`${outlineBtn} border-[#ccff00]/50 text-[#ccff00] hover:bg-[#ccff00]/10 hover:border-[#ccff00] hover:shadow-[0_0_25px_-4px_rgba(204,255,0,0.4)]`}
          >
            Robinhood Tracker
          </Link>
          <Link
            href="/arc"
            className={`${outlineBtn} border-purple-500/50 text-purple-300 hover:bg-purple-500/10 hover:border-purple-400 hover:shadow-[0_0_25px_-4px_rgba(168,85,247,0.45)]`}
          >
            Arc Tracker
          </Link>
          <Link
            href="/whale-hub"
            className={`${outlineBtn} border-slate-700 bg-slate-900/60 text-blue-400 hover:border-blue-500 hover:bg-slate-800`}
          >
            Whale Hub
          </Link>
          <Link
            href="/guide"
            className={`${outlineBtn} border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800`}
          >
            Guide
          </Link>
          <a
            href="https://x.com/WYCKSCORE"
            target="_blank"
            rel="noopener noreferrer"
            className={`${outlineBtn} border-slate-800 bg-slate-900/60 text-slate-300 hover:border-slate-600 hover:bg-slate-800`}
          >
            X
          </a>
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center text-white">Networks We Track</h2>
        <div className="grid md:grid-cols-3 gap-6">
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
        <NetworkCard
          icon={<ArcIcon />}
          name="Arc"
          desc="A new L2 network with native USDC liquidity. WYCKSCORE extends its accumulation and SmartMoney flow detection to tokens launched on Arc."
          href="/arc"
          cta="Open Arc Tracker"
          accent="text-purple-300"
        />
        </div>
      </section>

      <section className="grid md:grid-cols-3 gap-6">
        <FeatureCard title="24/7 Tracking" desc="Continuous monitoring of token activity across Base, Robinhood and Arc, no downtime." />
        <FeatureCard title="Wyckoff Detection" desc="Spot accumulation and distribution patterns driven by strong holders." />
        <FeatureCard title="Actionable Signals" desc="A live scoring system ranks tokens so you focus only on the strongest setups." />
      </section>

      <section className="space-y-6">
        <h2 className="text-3xl font-bold text-center text-white">Statistics</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <StatCard icon={<BaseIcon className="w-6 h-6" />} label="Base tokens tracked" value={baseTokens.toLocaleString()} accent="text-blue-400" />
          <StatCard icon={<RobinhoodIcon className="w-6 h-6" />} label="Robinhood tokens tracked" value={robinhoodTokens.toLocaleString()} accent="text-[#ccff00]" />
          <StatCard icon={<ArcIcon className="w-6 h-6" />} label="Arc tokens tracked" value={arcTokens.toLocaleString()} accent="text-purple-300" />
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          <StatCard icon={<LayersIcon />} label="Total tokens analyzed" value={totalTokens.toLocaleString()} />
          <StatCard icon={<UsersIcon />} label="Total Users" value={totalConnects.toLocaleString()} />
          <StatCard icon={<PulseIcon />} label="Tracker" value={totalChartViews.toLocaleString()} />
        </div>
      </section>

      <section className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
        <PlanCard name="BASE Tracker" requirement="WYCK · Base" desc="Unlock the full token tracker table, combining data from all monitored Base categories." />
        <PlanCard name="Robinhood Tracker" requirement="WYCK · Robinhood" desc="Track tokens launched and traded on the Robinhood network." />
        <PlanCard name="Arc Tracker" requirement="WYCK · Arc" desc="Track tokens on the Arc network using the same SmartMoney scoring system." />
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
    <div className="group bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4 transition-all duration-300 hover:border-slate-700 hover:-translate-y-1">
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
    <div className="relative bg-slate-900/80 border border-slate-800 rounded-2xl p-6 text-center space-y-1 overflow-hidden transition-colors duration-300 hover:border-slate-700">
      {icon && <div className={`flex justify-center mb-1 ${accent}`}>{icon}</div>}
      <div className={`text-3xl font-extrabold ${accent}`}>{value}</div>
      <div className="text-slate-400 text-sm">{label}</div>
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-2">
      <h3 className="text-blue-400 font-bold text-lg">{title}</h3>
      <p className="text-slate-400 text-sm">{desc}</p>
    </div>
  );
}

function PlanCard({ name, requirement, desc }: { name: string; requirement: string; desc: string }) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-2">
      <h3 className="text-xl font-bold text-blue-400">{name}</h3>
      <p className="text-blue-300 text-xs font-mono">{requirement}</p>
      <p className="text-slate-400 text-sm">{desc}</p>
    </div>
  );
}