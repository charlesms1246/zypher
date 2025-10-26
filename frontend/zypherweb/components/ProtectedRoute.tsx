"use client";

import React, { useEffect, useRef } from 'react';
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
  const { connected, publicKey } = useWallet();
  const router = useRouter();
  const [isChecking, setIsChecking] = React.useState(true);
  const hasRedirected = useRef(false);

  useEffect(() => {
    // Give wallet adapter time to initialize
    const timer = setTimeout(() => {
      setIsChecking(false);
    }, 1000); // Increased timeout to 1 second for more stability

    return () => clearTimeout(timer);
  }, []); // Run only once on mount

  useEffect(() => {
    // Redirect if not connected after initial check
    // Use publicKey as more stable indicator than connected
    if (!isChecking && !publicKey && !hasRedirected.current) {
      hasRedirected.current = true;
      router.push('/wallet');
    }
  }, [publicKey, isChecking, router]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-text-secondary">Checking wallet connection...</p>
        </div>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#050505]">
        <div className="text-center">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-text-secondary">Redirecting to wallet connection...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}