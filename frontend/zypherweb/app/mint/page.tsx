"use client";

import React from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import { useWallet } from '@solana/wallet-adapter-react';

/**
 * Mint Page (Placeholder)
 * Protected route that requires wallet connection
 * Will be fully implemented in the next step
 */
export default function MintPage() {
  const { publicKey } = useWallet();

  return (
    <ProtectedRoute>
      <main className="min-h-screen bg-gradient-to-b from-[#050505] to-[#0A2540] p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold text-primary mb-4">
            Mint $AEGIS
          </h1>
          
          <div className="bg-surface rounded-lg p-6 mb-6">
            <p className="text-text-secondary mb-4">
              Connected wallet: {publicKey?.toBase58().slice(0, 8)}...
              {publicKey?.toBase58().slice(-8)}
            </p>
            
            <div className="border-2 border-dashed border-text-secondary/30 rounded-lg p-8 text-center">
              <p className="text-xl text-text-secondary">
                🚧 Mint UI Coming Soon
              </p>
              <p className="text-sm text-text-secondary/60 mt-2">
                This page will feature the full minting interface with collateral inputs and 3D previews
              </p>
            </div>
          </div>
        </div>
      </main>
    </ProtectedRoute>
  );
}
