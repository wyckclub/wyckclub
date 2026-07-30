'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/pro', label: 'Pro Plan' },
  { href: '/vip', label: 'Vip Plan' },
];

export function Header() {
  const pathname = usePathname();
  const { isConnected, address } = useAccount();
  const wasConnected = useRef(false);

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

  return (
    <header className="w-full border-b border-slate-800 px-6 py-4 flex justify-between items-center bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xl">W</div>
          <span className="text-xl font-bold tracking-wide">WYCKSCORE</span>
        </Link>
        <nav className="hidden md:flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm font-medium transition-colors ${
                pathname === item.href ? 'text-blue-400' : 'text-slate-400 hover:text-blue-300'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <ConnectButton chainStatus="icon" showBalance={false} />
    </header>
  );
}