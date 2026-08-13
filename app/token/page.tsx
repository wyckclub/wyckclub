'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import Image from 'next/image';
import { GATE_TOKEN_ADDRESS } from '@/lib/tokenGate';

const TOTAL_SUPPLY = '1,000,000,000 WYCK';

function RobinhoodIcon() {
  return (
    <svg viewBox="0 0 400 400" className="w-5 h-5 rounded-[4px] overflow-hidden shrink-0">
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

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ExternalLinkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function StackIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="m12 2 9 5-9 5-9-5 9-5Z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </svg>
  );
}

function SparkleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export default function TokenPage() {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(GATE_TOKEN_ADDRESS);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const poolsUrl = `https://pools.trade/t/${GATE_TOKEN_ADDRESS}`;

  return (
    <div className="max-w-3xl mx-auto px-4 py-10 space-y-10">
      {/* HERO */}
      <div className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-8">
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#ccff00]/10 blur-3xl"
          aria-hidden
        />

        <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
          <div className="shrink-0 relative">
            <div className="absolute inset-0 rounded-full bg-blue-500/30 blur-xl" aria-hidden />
            <Image
              src="/wyck.png"
              alt="WYCKSCORE"
              width={96}
              height={96}
              className="relative rounded-full border-2 border-blue-500/50 shadow-lg shadow-blue-500/20"
            />
          </div>

          <div className="text-center sm:text-left space-y-2">
            <div className="flex items-center justify-center sm:justify-start gap-2">
              <h1 className="text-3xl font-extrabold text-white">WYCKSCORE</h1>
              <span className="px-2 py-0.5 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300 text-xs font-bold tracking-wide">
                $WYCK
              </span>
            </div>
            <p className="text-slate-400 text-sm max-w-md">
              The native access token powering the WYCKSCORE platform — real-time SmartMoney flow
              tracking and Wyckoff-style scoring across the Base and Robinhood networks.
            </p>
            <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
              <RobinhoodIcon />
              <span className="text-xs font-semibold text-slate-400">Launched on Robinhood Chain</span>
            </div>
          </div>
        </div>
      </div>

      {/* KEY INFO */}
      <div className="grid sm:grid-cols-2 gap-4">
        <InfoCard label="Name">WYCKSCORE</InfoCard>
        <InfoCard label="Symbol">WYCK</InfoCard>
        <InfoCard label="Total Supply">{TOTAL_SUPPLY}</InfoCard>
        <InfoCard label="Network">
          <span className="inline-flex items-center gap-1.5">
            <RobinhoodIcon />
            Robinhood Chain
          </span>
        </InfoCard>
      </div>

      {/* CONTRACT ADDRESS */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Contract Address</span>
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm text-blue-400 break-all">{GATE_TOKEN_ADDRESS}</span>
          <button
            onClick={handleCopy}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <a
          href={poolsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-blue-400 hover:text-blue-300"
        >
          View on Pools.trade <ExternalLinkIcon />
        </a>
      </div>

      {/* CREATED BY */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <StackIcon />
          <h2 className="text-lg font-bold text-blue-300">Created On</h2>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          $WYCK was created on{' '}
          <a href="https://pools.trade/" target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold hover:underline">
            Pools.trade
          </a>
          , a new way to launch and trade tokens — built by{' '}
          <a href="https://app.uniswap.org/" target="_blank" rel="noopener noreferrer" className="text-blue-400 font-semibold hover:underline">
            Uniswap
          </a>{' '}
          for Robinhood Chain.
        </p>
      </div>

      {/* UTILITY */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-3">
        <div className="flex items-center gap-2">
          <SparkleIcon />
          <h2 className="text-lg font-bold text-blue-300">Utility</h2>
        </div>
        <p className="text-slate-400 text-sm leading-relaxed">
          Holding $WYCK unlocks advanced features on{' '}
          <span className="text-white font-semibold">WYCK.PRO</span> once the beta phase concludes.
          Full details on token-gated features and access tiers will be announced soon.
        </p>
        <span className="inline-block px-2.5 py-1 rounded-full border border-yellow-400/30 bg-yellow-500/10 text-yellow-300 text-xs font-bold">
          Beta phase — details coming soon
        </span>
      </div>
    </div>
  );
}

function InfoCard({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-1">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-white font-semibold">{children}</div>
    </div>
  );
}