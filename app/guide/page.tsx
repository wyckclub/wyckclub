// app/guide/page.tsx
import Image from "next/image"

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-blue-400">WYCKS.PRO Guide</h1>
        <p className="text-slate-400">
          How to use the platform and read the WYCKSCORE chart, on a scale from -2 to 10.
        </p>
      </div>

      <div className="relative w-full overflow-hidden rounded-xl border border-slate-800 shadow-lg pt-2">
        <Image
          src="/wyck_help.png"
          alt="WYCKSCORE Chart Preview"
          width={800}
          height={400}
          className="w-full h-auto object-cover"
          priority
        />
      </div>

      {/* PAGES */}
      <section className="space-y-6">
        <h2 className="text-xl font-bold text-blue-300">Pages & Features</h2>

        <PageCard
          title="Pro Tracker"
          desc="The main token table covering all monitored categories on Base (Clanker & Bankr, Other Base, Virtuals, New Tokens)."
          points={[
            "Sortable columns: Market Cap, Liquidity, Vol 24h, WYCKSCORE, Change 24h, Snapshot Change.",
            "Search by symbol or contract address (CA).",
            "Filter by category, hide low-liquidity tokens automatically.",
            "GitHub activity columns (stars/forks, commits/repos, 30-day contributions) for projects with a public repo.",
            "Watchlist: star a token to pin it to the top of the table.",
            "Click any symbol to open the price/score chart.",
          ]}
        />

        <PageCard
          title="Whale Hub"
          desc="A live feed of SmartMoney alerts — notified as soon as a token's WYCKSCORE jumps or whale activity is detected."
          points={[
            "Notifications grouped by day, sorted by most recent.",
            "Each alert shows signal strength (Inflow / Medium / Strong / Super Strong), current vs previous score, and the Whale Accumulation Index change.",
            "Auto-refreshes every 5 minutes; relative timestamps (e.g. '4m ago').",
            "Share any alert directly to X with price and market cap included.",
          ]}
        />

        <PageCard
          title="Portfolio"
          desc="Connect your wallet to see your holdings and the market's strongest momentum tokens in one place."
          points={[
            "Wallet Holdings table: automatically detects which tracked tokens you hold, with live value in USD.",
            "Whale Activity - Strong Momentum table: tokens currently showing a whale signal and/or yellow (elevated) score, ranked by signal tier.",
            "Independent refresh for each table.",
            "Share top tokens by category (Virtuals / Bankr & Clanker / Other Base) directly to X.",
          ]}
        />
      </section>

      {/* CHART COLORS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-blue-300">Chart Segment Colors</h2>
        <div className="space-y-3">
          <GuideItem
            colorDot="bg-green-600"
            title="Dark green segment"
            desc="Strong accumulation. The score is well above the recent rolling average — a significant shift in buying pressure."
          />
          <GuideItem
            colorDot="bg-green-300"
            title="Light green segment"
            desc="Mild accumulation. The score is trending above the recent average."
          />
          <GuideItem
            colorDot="bg-blue-400"
            title="Blue segment"
            desc="Neutral / baseline zone. No notable accumulation signal for that period."
          />
        </div>
      </section>

      {/* CHART MARKERS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-blue-300">Chart Markers</h2>
        <div className="space-y-3">
          <GuideItem
            colorDot="bg-yellow-400"
            title="Yellow score"
            desc="Score is unusually high compared to normal levels — stronger-than-usual smart money activity."
          />
          <GuideItem
            colorDot="bg-slate-300"
            title="Score with a + sign"
            desc="Marks a point where strong capital inflow is entering the token."
          />
          <GuideItem
            colorDot="bg-blue-400"
            title="🐋 Whale icon"
            desc="A smart investor may have already completed accumulation. Can signal the accumulation phase is nearing its end."
          />
          <GuideItem
            colorDot="bg-yellow-300"
            title="Yellow-bordered box (Spring point)"
            desc="A Wyckoff 'Spring' — price dips below a recent low while score rises sharply, or a repeated whale streak. Often marks the final shakeout before markup."
          />
          <GuideItem
            colorDot="bg-purple-500"
            title="Whale Accumulation Index (toggle)"
            desc="Optional purple overlay showing the Whale Accumulation Index at each point. A higher score indicates stronger whale accumulation. Each token is evaluated using its own relative scoring scale, making the index specific to each token.  "
          />
        </div>
      </section>

      {/* SMARTMONEY SIGNAL LEVELS */}
      <section className="space-y-4">
        <h2 className="text-xl font-bold text-blue-300">SmartMoney Signal Levels</h2>
        <p className="text-slate-400 text-sm">
          Used in Whale Hub alerts and the Portfolio strong-momentum table. Levels are ranked from an early hint to the strongest confirmed signal.
        </p>
        <div className="space-y-3">
          <SignalItem
            badgeClass="border-slate-500/40 text-slate-300 bg-slate-800/40"
            label="Inflow"
            desc="Early sign only — a sharp score jump or a '+' with a moderate score. Capital is starting to move in, but not yet confirmed by whale or high-score activity."
          />
          <SignalItem
            badgeClass="border-yellow-400/40 text-yellow-300 bg-yellow-500/10"
            label="Medium"
            desc="Either a whale accumulation point (🐋) or an elevated (yellow) score, but not both. A moderate-confidence signal."
          />
          <SignalItem
            badgeClass="border-green-300/50 text-green-400 bg-green-300/10"
            label="Strong"
            desc="Whale accumulation (🐋) combined with either a '+' inflow or an elevated score. A higher-confidence signal that smart money is actively building a position."
          />
          <SignalItem
            badgeClass="border-green-600/60 text-green-500 bg-green-500/20"
            label="Super Strong"
            desc="Whale accumulation (🐋), elevated score, and '+' inflow all present together. The highest-confidence signal — strong, confirmed smart money buying."
          />
        </div>
      </section>

      <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-2">
        <h2 className="text-lg font-bold text-blue-300">Recommendation</h2>
        <p className="text-slate-400 text-sm leading-relaxed">
          Combine multiple signals from the WYCKSCORE chart together, and cross-check with the underlying
          price chart on Dexscreener, to form the most accurate assessment before making any decision.
        </p>
      </section>
    </div>
  );
}

function PageCard({ title, desc, points }: { title: string; desc: string; points: string[] }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
      <h3 className="text-blue-400 font-bold text-lg">{title}</h3>
      <p className="text-slate-400 text-sm">{desc}</p>
      <ul className="space-y-1.5">
        {points.map((p, i) => (
          <li key={i} className="text-slate-300 text-sm flex gap-2">
            <span className="text-blue-500 shrink-0">•</span>
            {p}
          </li>
        ))}
      </ul>
    </div>
  );
}

function GuideItem({ colorDot, title, desc }: { colorDot: string; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`mt-1.5 w-3 h-3 rounded-full shrink-0 ${colorDot}`} />
      <div>
        <p className="font-semibold text-slate-200 text-sm">{title}</p>
        <p className="text-slate-400 text-sm">{desc}</p>
      </div>
    </div>
  );
}

function SignalItem({ badgeClass, label, desc }: { badgeClass: string; label: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className={`shrink-0 text-xs font-bold uppercase tracking-wider border rounded px-2 py-1 ${badgeClass}`}>
        {label}
      </span>
      <p className="text-slate-400 text-sm pt-1">{desc}</p>
    </div>
  );
}