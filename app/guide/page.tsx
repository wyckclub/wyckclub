import Image from "next/image"

export default function GuidePage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      <div className="space-y-2">
        <h1 className="text-3xl font-extrabold text-blue-400">WYCKSCORE Guide</h1>
        <p className="text-slate-400">
          How to read the WYCKSCORE chart and scoring system, on a scale from -2 to 10.
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

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-blue-300">Chart Colors</h2>
        <div className="space-y-3">
          <GuideItem
            colorDot="bg-green-600"
            title="Dark green segments"
            desc="Strong accumulation activity. Score is well above the recent rolling average, signaling a significant shift in buying pressure."
          />
          <GuideItem
            colorDot="bg-green-300"
            title="Light green segments"
            desc="Accumulation activity is present, with the score trending above the recent average."
          />
          <GuideItem
            colorDot="bg-blue-400"
            title="Blue segments"
            desc="Neutral / baseline zone. No notable accumulation signal detected for that period."
          />
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold text-blue-300">Score Markers</h2>
        <div className="space-y-3">
          <GuideItem
            colorDot="bg-yellow-400"
            title="Yellow score"
            desc="Indicates stronger accumulation activity from smart money compared to normal levels."
          />
          <GuideItem
            colorDot="bg-slate-300"
            title="Score with a + sign"
            desc="Marks a point where strong capital inflow is entering the token."
          />
          <GuideItem
            colorDot="bg-blue-400"
            title="🐋 Whale icon"
            desc="Appears where a smart investor may have already completed their accumulation. This can signal that the accumulation phase is nearing its end."
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