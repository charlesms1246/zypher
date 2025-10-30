'use client';

import { useEffect, useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';
import CreateMarketForm from '../../components/CreateMarketForm';
import toast, { Toaster } from 'react-hot-toast';

/**
 * Create Prediction Market Page
 * Protected route that requires wallet connection
 */
export default function CreateMarketPage() {
  const { publicKey, connected } = useWallet();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !connected) {
      const timer = setTimeout(() => {
        toast.error('Please connect your wallet to create markets');
        router.push('/wallet');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [connected, mounted, router]);

  if (!mounted || !connected) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-[#050505] to-[#0A2540] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-[#00FFB3] mx-auto mb-4"></div>
          <p className="text-[#B8B8B8]">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#050505] to-[#0A2540] py-12 px-4">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#121212',
            color: '#F5F5F5',
            border: '1px solid #00FFB3',
          },
          success: {
            iconTheme: {
              primary: '#00FFB3',
              secondary: '#050505',
            },
          },
          error: {
            iconTheme: {
              primary: '#FF3B3B',
              secondary: '#050505',
            },
          },
        }}
      />

      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#F5F5F5] mb-2">
            Create Prediction Market
          </h1>
          <p className="text-[#B8B8B8]">
            Launch a new ZK-powered prediction market on Solana devnet
          </p>
        </div>

        <CreateMarketForm />

        <div className="mt-8 p-6 bg-[#121212]/50 border border-[#00FFB3]/10 rounded-2xl">
          <h3 className="text-lg font-semibold text-[#00FFB3] mb-4">How it works:</h3>
          <div className="space-y-3 text-sm text-[#B8B8B8]">
            <div className="flex items-start gap-3">
              <span className="text-[#00FFB3] font-bold">1.</span>
              <p>Enter your prediction market question (max 64 characters)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#00FFB3] font-bold">2.</span>
              <p>Set the resolution time (when the market will be settled)</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#00FFB3] font-bold">3.</span>
              <p>Your market will be created on-chain with ZK privacy features</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#00FFB3] font-bold">4.</span>
              <p>Users can bet $ZYP on YES or NO outcomes</p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-[#00FFB3] font-bold">5.</span>
              <p>After resolution time, oracle settles the market and winners claim payouts</p>
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[#00FFB3] hover:text-[#8A2EFF] transition-colors"
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
