'use client';

import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useBalance } from 'wagmi';

export default function Home() {
  const { address, isConnected } = useAccount();
  const { data: balance } = useBalance({ address });

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      {/* HEADER: Navigation bar with Connect Wallet button on the top-right */}
      <header className="w-full border-b border-slate-800 px-6 py-4 flex justify-between items-center">
        {/* Brand Logo / Title */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xl">
            W
          </div>
          <span className="text-xl font-bold tracking-wide">WYCK CLUB</span>
        </div>

        {/* Connect Wallet Button (Top-Right) */}
        <div>
          <ConnectButton 
            chainStatus="icon" 
            showBalance={false}
          />
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        {!isConnected ? (
          <div className="max-w-md space-y-4">
            <h1 className="text-4xl font-extrabold text-blue-500">Connect EVM Wallet</h1>
            <p className="text-slate-400">
              Please click the button at the top-right corner to connect your wallet to Base Network.
            </p>
          </div>
        ) : (
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl max-w-md w-full text-left space-y-4 shadow-xl">
            <h2 className="text-xl font-bold text-green-400 flex items-center gap-2">
              <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></span>
              Wallet Connected
            </h2>
            <div className="space-y-2 text-sm text-slate-300">
              <p><strong className="text-slate-500">Address:</strong></p>
              <p className="font-mono bg-slate-950 p-2 rounded text-xs text-blue-400 break-all">
                {address}
              </p>
              <p className="pt-2">
                <strong className="text-slate-500">ETH Balance:</strong>{' '}
                {balance ? `${parseFloat(balance.formatted).toFixed(4)} ${balance.symbol}` : 'Loading...'}
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}