"use client";

import React from 'react';
import WalletConnect from '@/components/WalletConnect';
import { useRouter } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';

/**
 * Wallet Page
 * Dedicated page for wallet connection management
 * Redirects to home after successful connection
 */
export default function WalletPage() {
  const { connected, connect } = useWallet();
  const router = useRouter();
  const [redirecting, setRedirecting] = React.useState(false);

  /**
   * Auto-redirect to home after successful connection
   * Includes 500ms delay to show confirmation
   */
  React.useEffect(() => {
    if (connected && !redirecting) {
      setRedirecting(true);
      setTimeout(() => {
        router.push('/');
      }, 500);
    }
  }, [connected, redirecting, router]);

  const handleRetryConnect = () => {
    if (connect) {
      connect().catch((error) => {
        console.error("Connection retry failed:", error);
      });
    }
  };

  return (
    <main
      className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-b from-[#050505] to-[#0A2540]"
      role="main"
    >
      <div className="bg-surface rounded-lg shadow-md p-6 w-full max-w-md sm:max-w-full md:max-w-md">
        <h1 className="text-2xl md:text-3xl font-bold mb-4 text-center text-primary font-display">
          Connect Your Wallet
        </h1>
        
        <p className="mb-6 text-center text-text-secondary">
          Connect your Phantom wallet to access Zypher features including
          minting, trading, and AI-powered hedging.
        </p>

        {redirecting ? (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mb-4" />
            <p className="text-primary font-medium">Connected! Redirecting...</p>
          </div>
        ) : (
          <>
            <WalletConnect showBalance={true} />

            {!connected && (
              <div className="mt-6 text-center">
                <button
                  onClick={handleRetryConnect}
                  className="text-sm text-secondary hover:text-secondary/80 underline transition-colors"
                  aria-label="Retry wallet connection"
                >
                  Having trouble? Retry connection
                </button>
              </div>
            )}
          </>
        )}

        <div className="mt-8 pt-6 border-t border-text-secondary/20">
          <h2 className="text-sm font-semibold mb-3 text-text-primary">
            Need Help?
          </h2>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li>
              <a
                href="https://docs.phantom.app"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary underline transition-colors"
              >
                Phantom Wallet Documentation
              </a>
            </li>
            <li>
              <a
                href="https://phantom.app/download"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-primary underline transition-colors"
              >
                Download Phantom Wallet
              </a>
            </li>
            <li>
              <span className="text-text-secondary/60">
                Currently on Solana Devnet
              </span>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-text-secondary max-w-md">
        <p>
          Your private keys never leave your wallet. Zypher uses
          zero-knowledge proofs to ensure your privacy is protected at all times.
        </p>
      </div>
    </main>
  );
}
