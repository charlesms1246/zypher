"use client";

import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { Connection, LAMPORTS_PER_SOL } from '@solana/web3.js';

interface WalletConnectProps {
  showBalance?: boolean;
}

/**
 * WalletConnect Component
 * Provides Phantom wallet connection interface with optional balance display
 * @param showBalance - Whether to display SOL balance after connection
 */
export default function WalletConnect({ showBalance = false }: WalletConnectProps) {
  const { publicKey, connected } = useWallet();
  const [balance, setBalance] = React.useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = React.useState<boolean>(false);
  const [walletError, setWalletError] = React.useState<string | null>(null);

  // Memoized connection instance for Solana devnet
  const connection = React.useMemo(
    () => new Connection("https://api.devnet.solana.com", "confirmed"),
    []
  );

  /**
   * Fetches balance on connect
   * Runs when wallet connects and publicKey becomes available
   */
  React.useEffect(() => {
    const fetchBalance = async () => {
      if (connected && publicKey) {
        setBalanceLoading(true);
        setWalletError(null);
        try {
          const balanceLamports = await connection.getBalance(publicKey);
          setBalance(balanceLamports / LAMPORTS_PER_SOL);
        } catch (error) {
          console.error("Balance fetch failed:", error);
          setBalance(null);
          setWalletError("Failed to fetch balance. Please check your connection.");
        } finally {
          setBalanceLoading(false);
        }
      } else {
        // Clear balance when disconnected
        setBalance(null);
        setBalanceLoading(false);
      }
    };

    fetchBalance();
  }, [connected, publicKey, connection]);

  // Check if Phantom wallet is installed
  React.useEffect(() => {
    if (typeof window !== 'undefined' && !window.solana?.isPhantom) {
      setWalletError("Phantom wallet not detected. Please install it to continue.");
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-4 bg-surface rounded-lg" role="region" aria-label="Wallet connection">
      {walletError && !connected && (
        <div className="mb-4 p-3 bg-error/10 border border-error rounded-md text-error text-sm">
          {walletError}
          {walletError.includes("Phantom") && (
            <a
              href="https://phantom.app/download"
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 underline hover:text-error/80"
            >
              Download Phantom Wallet
            </a>
          )}
        </div>
      )}

      <div className="wallet-adapter-button-trigger">
        <WalletMultiButton />
      </div>

      {connected && publicKey && (
        <div className="mt-4 text-center">
          <p className="text-sm text-text-secondary" aria-live="polite">
            Connected: {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
          </p>
          
          {showBalance && (
            <div className="mt-2">
              {balanceLoading ? (
                <div className="flex items-center justify-center space-x-2">
                  <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                  <span className="text-sm text-text-secondary">Loading balance...</span>
                </div>
              ) : balance !== null ? (
                <p className="text-lg font-numeric text-primary" aria-live="polite">
                  Balance: {balance.toFixed(2)} SOL
                </p>
              ) : walletError ? (
                <p className="text-sm text-error">{walletError}</p>
              ) : null}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
