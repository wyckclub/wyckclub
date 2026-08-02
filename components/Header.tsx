'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import Image from 'next/image';

const navItems = [
  { href: '/', label: 'Home', suffix: '' },
  { href: '/pro', label: 'Pro', suffix: '(Free Beta)' },
  { href: '/vip', label: 'Portfolio', suffix: '(Free Beta)' },
  { href: '/guide', label: 'Guide', suffix: '' },
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
              className={`text-sm font-bold transition-colors ${
                pathname === item.href ? 'text-blue-400' : 'text-slate-400 hover:text-blue-300'
              }`}
            >
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
            className={`text-sm font-bold px-2 py-2 rounded-lg transition-colors ${
              pathname === item.href ? 'text-blue-400 bg-slate-900' : 'text-slate-400 hover:text-blue-300'
            }`}
          >
            {item.label}
            {item.suffix && <span className="ml-1 text-[10px] font-normal align-middle">{item.suffix}</span>}
          </Link>
          ))}
        </nav>
      )}
    </header>
  );
}