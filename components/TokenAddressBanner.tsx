'use client';

import { useState } from 'react';
import { WYCK_TOKEN_NETWORKS, WYCK_EVM_ADDRESS, WYCK_SOLANA_ADDRESS, TokenNetworkKey } from '@/lib/tokenGate';
import { BaseNetworkIcon, RobinhoodNetworkIcon } from '@/components/NetworkIcon';

function BscIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={`${className} rounded-[4px] overflow-hidden shrink-0`}>
      <rect width="400" height="400" fill="#F0B90B" />
      <g fill="#1E2026">
        <rect x="170" y="170" width="60" height="60" transform="rotate(45 200 200)" />
        <rect x="180" y="80" width="40" height="40" transform="rotate(45 200 100)" />
        <rect x="180" y="280" width="40" height="40" transform="rotate(45 200 300)" />
        <rect x="80" y="180" width="40" height="40" transform="rotate(45 100 200)" />
        <rect x="280" y="180" width="40" height="40" transform="rotate(45 300 200)" />
      </g>
    </svg>
  );
}

function SolanaIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 400" className={`${className} rounded-[4px] overflow-hidden shrink-0`}>
      <defs>
        <linearGradient id="solGrad" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#9945FF" />
          <stop offset="100%" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="#0b0b14" />
      <g fill="url(#solGrad)">
        <path d="M95 105 H320 L295 145 H70 Z" />
        <path d="M70 175 H295 L320 215 H95 Z" />
        <path d="M95 245 H320 L295 285 H70 Z" />
      </g>
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-3 h-3">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
    </svg>
  );
}

function NetIcon({ k, className }: { k: TokenNetworkKey; className?: string }) {
  switch (k) {
    case 'base': return <BaseNetworkIcon className={className} />;
    case 'robinhood': return <RobinhoodNetworkIcon className={className} />;
    case 'bsc': return <BscIcon className={className} />;
    case 'solana': return <SolanaIcon className={className} />;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function handle() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  }
  return (
    <button
      onClick={handle}
      className="shrink-0 inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function AddressCard({
  title, address, networks, accent,
}: {
  title: string;
  address: string;
  networks: typeof WYCK_TOKEN_NETWORKS;
  accent: string;
}) {
  return (
    <div className={`rounded-2xl border bg-slate-950/70 p-5 space-y-3 ${accent}`}>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex -space-x-1.5">
          {networks.map((n) => (
            <span key={n.key} className="ring-2 ring-slate-950 rounded-[5px] overflow-hidden">
              <NetIcon k={n.key} className="w-6 h-6" />
            </span>
          ))}
        </div>
        <span className="text-sm font-bold text-slate-200">{title}</span>
      </div>

      {address ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-sm sm:text-base text-blue-300 break-all flex-1 min-w-0">{address}</span>
          <CopyButton text={address} />
        </div>
      ) : (
        <p className="text-sm font-semibold text-yellow-300">Coming soon</p>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {networks.map((n) => (
          <a
            key={n.key}
            href={address ? `${n.explorerUrl}${address}` : undefined}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full border border-slate-700 bg-slate-900 text-slate-300 ${
              address ? 'hover:border-blue-500 hover:text-blue-300' : 'opacity-50 pointer-events-none'
            }`}
          >
            <NetIcon k={n.key} className="w-4 h-4" />
            {n.label}
            <ExternalIcon />
          </a>
        ))}
      </div>
    </div>
  );
}

export function TokenAddressBanner() {
  const evm = WYCK_TOKEN_NETWORKS.filter((n) => n.key !== 'solana');
  const sol = WYCK_TOKEN_NETWORKS.filter((n) => n.key === 'solana');

  return (
    <section className="relative overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 p-6 sm:p-8 shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)]">
      <div className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full bg-blue-600/20 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-[#ccff00]/10 blur-3xl" aria-hidden />

      <div className="relative space-y-5">
        <div className="text-center space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/40 bg-blue-500/10 text-blue-300 text-xs font-bold tracking-wide">
            $WYCK
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Official Token Address</h2>
          <p className="text-slate-400 text-sm">Always verify the contract address before you buy.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-4">
          <AddressCard
            title="EVM · Base / Robinhood / BSC"
            address={WYCK_EVM_ADDRESS}
            networks={evm}
            accent="border-blue-500/40"
          />
          <AddressCard
            title="Solana"
            address={WYCK_SOLANA_ADDRESS}
            networks={sol}
            accent="border-purple-500/40"
          />
        </div>
      </div>
    </section>
  );
}
