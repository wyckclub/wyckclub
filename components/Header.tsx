'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Image from 'next/image';
import { GATE_TOKEN_ADDRESS } from '@/lib/tokenGate';

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}

function ProIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />
    </svg>
  );
}

function WhaleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M2 14c1-4 4-7 9-7 5.5 0 9 3.5 10 6.5-1.2 1-3 1.5-4 1-0.5 1.3-1.8 2.5-3.5 2.5-1 0-1.8-.4-2.5-1-1 .7-2.3 1-3.5 1-3 0-5-1.5-5.5-3Z" />
      <path d="M9 10.2V8" />
      <circle cx="7" cy="11" r="0.6" fill="currentColor" stroke="none" />
      <path d="M17.5 8c.8-1 2-1.5 3.5-1-1 1.5-1 2.5 0 4-1.7.3-2.8-.2-3.5-1" />
    </svg>
  );
}

function PortfolioIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M3 12h18" />
      <path d="M12 10.5v3" />
    </svg>
  );
}

function GuideIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
      <path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5v-17Z" />
      <path d="M4 19a2.5 2.5 0 0 1 2.5-2.5H20" />
    </svg>
  );
}

const navItems = [
  { href: '/', label: 'Home', suffix: '', icon: HomeIcon },
  { href: '/pro', label: 'Pro Tracker', suffix: '(Free Beta)', icon: ProIcon },
  { href: '/robinhood', label: 'Robinhood Tracker', suffix: '(Beta)', icon: ProIcon },
  { href: '/whale-hub', label: 'Whale Hub', suffix: '(Beta)', icon: WhaleIcon },
  { href: '/vip', label: 'Portfolio', suffix: '(Beta)', icon: PortfolioIcon },
  { href: '/guide', label: 'Guide', suffix: '', icon: GuideIcon },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected, address } = useAccount();
  const wasConnected = useRef(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (isConnected && address && !wasConnected.current) {
      fetch('/api/stats/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'connect', address }),
      }).catch(() => {});
    }
    wasConnected.current = isConnected;
  }, [isConnected, address]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <header className="w-full border-b border-slate-800 px-6 py-4 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/w.png"
              alt="WYCKSCORE"
              width={32}
              height={32}
              className="rounded-full"
            />
            <span className="text-xl font-bold tracking-wide">WYCKSCORE</span>
          </Link>
          <nav className="hidden md:flex gap-6">
            {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-1.5 text-sm font-bold transition-colors ${
                pathname === item.href ? 'text-blue-400' : 'text-slate-400 hover:text-blue-300'
              }`}
            >
              <item.icon />
              {item.label}
              {item.suffix && <span className="ml-1 text-[10px] font-normal align-middle">{item.suffix}</span>}
            </Link>
            ))}
          </nav>          
        </div>
        <div className="flex items-center gap-3">
          <ConnectButton chainStatus="icon" showBalance={false} />
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="md:hidden text-slate-300 hover:text-white p-1"
            aria-label="Toggle menu"
          >
            {menuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="md:hidden mt-3 flex flex-col gap-1 border-t border-slate-800 pt-3">
          {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-2 text-sm font-bold px-2 py-2 rounded-lg transition-colors ${
              pathname === item.href ? 'text-blue-400 bg-slate-900' : 'text-slate-400 hover:text-blue-300'
            }`}
          >
            <item.icon />
            {item.label}
            {item.suffix && <span className="ml-1 text-[10px] font-normal align-middle">{item.suffix}</span>}
          </Link>
          ))}
        </nav>
      )}
    </header>
  );
}