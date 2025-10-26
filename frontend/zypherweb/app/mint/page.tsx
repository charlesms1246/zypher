"use client";

import React, { useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import MintForm from '@/components/MintForm';
import { useWallet } from '@solana/wallet-adapter-react';
import { Toaster } from 'react-hot-toast';
import dynamic from 'next/dynamic';

// Dynamically import 3D preview with no SSR
const DynamicThreeDPreview = dynamic(() => import('@/components/ThreeDPreview'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-96 flex items-center justify-center bg-surface rounded-lg">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
        <p className="text-text-secondary">Loading 3D preview...</p>
      </div>
    </div>
  )
});

/**
 * Mint Page
 * Dedicated page for minting $ZYP stablecoin with RWA collateral
 * Includes interactive 3D preview and secure form with oracle price feeds
 */
export default function MintPage() {
  const { publicKey } = useWallet();
  const [selectedCollateral, setSelectedCollateral] = useState<number>(0);

  return (
    <ProtectedRoute>
      <main
        className="min-h-screen bg-gradient-to-br from-[#050505] via-abyss to-[#050505] p-4 md:p-8"
        role="main"
      >
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-primary mb-2 font-display">
              Mint $ZYP Stablecoin
            </h1>
            <p className="text-text-secondary">
              Deposit real-world asset collateral and mint privacy-preserving stablecoins powered by zero-knowledge proofs
            </p>
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* Left Column - Mint Form */}
            <div className="order-2 lg:order-1">
              <MintForm onCollateralChange={setSelectedCollateral} />
            </div>

            {/* Right Column - 3D Preview */}
            <div className="order-1 lg:order-2">
              <div className="bg-surface/50 rounded-lg p-6 h-full">
                <DynamicThreeDPreview selectedCollateral={selectedCollateral} />
              </div>
            </div>
          </div>

          {/* Footer Info */}
          <div className="mt-8 p-6 bg-surface/30 rounded-lg border border-text-secondary/20">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h3 className="text-sm font-semibold text-primary mb-2">
                  Overcollateralized
                </h3>
                <p className="text-sm text-text-secondary">
                  All positions maintain 150% collateralization ratio for stability and security.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-primary mb-2">
                  Real-time Oracles
                </h3>
                <p className="text-sm text-text-secondary">
                  Powered by Pyth Network oracles for accurate, decentralized price feeds.
                </p>
              </div>
              <div>
                <h3 className="text-sm font-semibold text-primary mb-2">
                  Zero-Knowledge Proofs
                </h3>
                <p className="text-sm text-text-secondary">
                  Your transactions are private by default. Silent proofs, loud impact.
                </p>
              </div>
            </div>
          </div>

          {/* Connected Wallet Info */}
          {publicKey && (
            <div className="mt-4 text-center text-sm text-text-secondary">
              Connected: {publicKey.toBase58().slice(0, 8)}...{publicKey.toBase58().slice(-8)}
            </div>
          )}
        </div>

        {/* Toast Notifications */}
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#121212',
              color: '#F5F5F5',
              border: '1px solid #00FFB3',
            },
            success: {
              iconTheme: {
                primary: '#00FFB3',
                secondary: '#121212',
              },
            },
            error: {
              iconTheme: {
                primary: '#FF3B3B',
                secondary: '#121212',
              },
            },
          }}
        />
      </main>
    </ProtectedRoute>
  );
}
