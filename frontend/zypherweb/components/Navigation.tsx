"use client";

import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

/**
 * Navigation Header
 * Top navigation bar with logo, links, and wallet connection
 */
export default function Navigation() {
  const { connected } = useWallet();

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/80 backdrop-blur-md border-b border-text-secondary/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2 group">
            <div className="text-2xl font-bold font-numeric bg-gradient-to-r from-primary to-violet bg-clip-text text-transparent group-hover:scale-110 transition-transform">
              ZYPHER
            </div>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center space-x-8">
            <Link 
              href="/#about" 
              className="text-text-secondary hover:text-primary transition-colors"
            >
              About
            </Link>
            <Link 
              href="/#technology" 
              className="text-text-secondary hover:text-primary transition-colors"
            >
              Technology
            </Link>
            {connected && (
              <>
                <Link 
                  href="/mint" 
                  className="text-text-secondary hover:text-primary transition-colors"
                >
                  Mint
                </Link>
                <Link 
                  href="/dashboard" 
                  className="text-text-secondary hover:text-primary transition-colors"
                >
                  Dashboard
                </Link>
              </>
            )}
          </div>

          {/* Wallet Button */}
          <div className="flex items-center space-x-4">
            <WalletMultiButton />
          </div>
        </div>
      </div>
    </nav>
  );
}
