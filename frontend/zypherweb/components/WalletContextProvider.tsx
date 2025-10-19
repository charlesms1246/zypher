"use client";

import React, { useMemo } from 'react';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

/**
 * WalletContextProvider
 * Provides Solana wallet connection context to the entire app
 * Configured for Phantom wallet on Solana devnet
 */
export default function WalletContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  // Devnet RPC endpoint
  const endpoint = useMemo(() => "https://api.devnet.solana.com", []);

  // Only support Phantom wallet for MVP
  const wallets = useMemo(
    () => [new PhantomWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
