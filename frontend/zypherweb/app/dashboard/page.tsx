"use client";

import React, { useEffect, useState } from 'react';
import HedgeDashboard from '@/components/HedgeDashboard';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import { Toaster } from 'react-hot-toast';

export default function DashboardPage() {
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !connected) {
      const timer = setTimeout(() => {
        router.push('/wallet');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [connected, router, mounted]);

  // Don't render anything until mounted (prevents hydration issues)
  if (!mounted) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-[#050505] to-[#0A2540]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-[#050505] to-[#0A2540]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-text-secondary">Checking wallet connection...</p>
        </div>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-b from-[#050505] to-[#0A2540]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050505] to-[#0A2540]">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-background">
        Skip to content
      </a>
      
      <header className="bg-surface/80 backdrop-blur-sm shadow-lg border-b border-primary/20 p-6 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-primary mb-2">Zypher Dashboard</h1>
          <p className="text-text-secondary">Monitor your positions, hedges, and predictions.</p>
        </div>
      </header>

      <main id="main-content" role="main" className="p-6 max-w-6xl mx-auto">
        <HedgeDashboard publicKey={publicKey!} />
      </main>

      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: '#121212',
            color: '#F5F5F5',
            border: '1px solid #00FFB3',
          },
        }}
      />
    </div>
  );
}
