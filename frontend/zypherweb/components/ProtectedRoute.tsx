"use client";

import React, { useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useRouter } from 'next/navigation';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

/**
 * ProtectedRoute Component
 * HOC that protects pages requiring wallet connection
 * Redirects to /wallet if user is not connected
 */
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { connected } = useWallet();
  const router = useRouter();
  const [isChecking, setIsChecking] = React.useState(true);

  useEffect(() => {
    // Give wallet adapter time to initialize
    const timer = setTimeout(() => {
      if (!connected) {
        router.push('/wallet');
      } else {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [connected, router]);

  if (isChecking || !connected) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-text-secondary">Checking wallet connection...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
