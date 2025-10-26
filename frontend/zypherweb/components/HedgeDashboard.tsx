"use client";

import React, { useState, useEffect } from 'react';
import { triggerHedge } from '@/lib/solana';
import toast from 'react-hot-toast';
import { PublicKey } from '@solana/web3.js';

interface HedgeDashboardProps {
  publicKey: PublicKey;
}

interface Prediction {
  id: number;
  question: string;
  outcome: boolean | null;
  resolved: boolean;
}

interface PositionStats {
  mintedZyp: number;
  collateralValue: number;
}

export default function HedgeDashboard({ publicKey }: HedgeDashboardProps) {
  const [hedgeDecision, setHedgeDecision] = useState<boolean | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [positionStats, setPositionStats] = useState<PositionStats | null>(null);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  /**
   * Polls oracles and program for dashboard data
   * Fetches: hedge decision from oracle volatility, position stats from program, predictions
   */
  const fetchData = async () => {
    try {
      // Oracle Poll - Fetch Pyth prices for volatility calculation
      // These are the actual Pyth Price Feed IDs (not Solana account addresses)
      const pythPriceFeedIds = [
        '0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2', // Gold/USD
        '0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e', // Silver/USD  
        '0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43', // BTC/USD
        '0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace', // ETH/USD
        '0x2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f', // BNB/USD
      ];

      // Fetch historical prices for volatility (stored in localStorage)
      const priceHistoryKey = 'zypher_price_history';
      const storedHistory = localStorage.getItem(priceHistoryKey);
      const priceHistory: Record<string, number[]> = storedHistory ? JSON.parse(storedHistory) : {};

      // Fetch current prices from Pyth
      const pricePromises = pythPriceFeedIds.map(async (feedId) => {
        try {
          const response = await fetch(`https://hermes.pyth.network/v2/updates/price/latest?ids[]=${feedId}`);
          if (!response.ok) {
            console.error(`Failed to fetch price for ${feedId}: HTTP ${response.status}`);
            return null;
          }
          const data = await response.json();
          const priceData = data.parsed?.[0]?.price;
          if (priceData) {
            const price = parseFloat(priceData.price) * Math.pow(10, priceData.expo);
            
            // Update history (keep last 5 prices)
            if (!priceHistory[feedId]) priceHistory[feedId] = [];
            priceHistory[feedId].push(price);
            if (priceHistory[feedId].length > 5) priceHistory[feedId].shift();
            
            return { id: feedId, price, history: priceHistory[feedId] };
          }
        } catch (err) {
          console.error(`Failed to fetch price for ${feedId}:`, err);
        }
        return null;
      });

      const prices = (await Promise.all(pricePromises)).filter(p => p !== null);
      
      // Save updated history
      localStorage.setItem(priceHistoryKey, JSON.stringify(priceHistory));

      // Calculate volatility (standard deviation) and hedge decision
      let totalVolatility = 0;
      let volatilityCount = 0;

      prices.forEach((priceData) => {
        if (priceData && priceData.history.length >= 2) {
          const mean = priceData.history.reduce((sum, p) => sum + p, 0) / priceData.history.length;
          const variance = priceData.history.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / priceData.history.length;
          const stdDev = Math.sqrt(variance);
          const volatility = stdDev / mean; // Normalized volatility
          totalVolatility += volatility;
          volatilityCount++;
        }
      });

      const avgVolatility = volatilityCount > 0 ? totalVolatility / volatilityCount : 0;
      
      // Sigmoid decision: x = (volatility * 0.7) + (threshold_factor * 0.3)
      const threshold = 1.05; // 5% threshold proxy
      const currentPrice = prices[0]?.price || 1;
      const thresholdFactor = (threshold - currentPrice / currentPrice) / threshold;
      const x = (avgVolatility * 0.7) + (thresholdFactor * 0.3);
      const decision = 1 / (1 + Math.exp(-x)) > 0.5;
      
      setHedgeDecision(decision);

      // Position Fetch - Get user's position from program
      try {
        const { Connection, PublicKey: SolPublicKey } = await import('@solana/web3.js');
        const { getAssociatedTokenAddress } = await import('@solana/spl-token');
        
        const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
        const programId = new SolPublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK');
        
        // Get user's ZYP token balance first (this is the real indicator)
        const zypherMint = new SolPublicKey(process.env.NEXT_PUBLIC_ZYPHER_MINT || 'F7NeLHxuJ1LYBGHZ8Gfq4E5JD64YXa2H7vKmRorGBDu7');
        const userZypAta = await getAssociatedTokenAddress(zypherMint, publicKey);
        
        try {
          const zypBalance = await connection.getTokenAccountBalance(userZypAta);
          const mintedZyp = zypBalance.value.uiAmount || 0;
          
          if (mintedZyp > 0) {
            // User has minted ZYP! Show their position
            // Calculate collateral value from oracle prices (estimate)
            const collateralValue = prices.length > 0 ? mintedZyp * prices[0].price * 0.67 : mintedZyp * 2000 * 0.67;
            
            setPositionStats({ mintedZyp, collateralValue });
          } else {
            // No ZYP minted yet
            setPositionStats(null);
          }
        } catch (err) {
          // ZYP token account doesn't exist - user hasn't minted
          console.log('No ZYP token account found');
          setPositionStats(null);
        }
      } catch (err) {
        console.error('Failed to fetch position:', err);
        setPositionStats(null);
      }

      // Predictions Fetch - Mock for MVP
      setPredictions([
        { id: 1, question: 'Yield drop >5%?', outcome: null, resolved: false },
        { id: 2, question: 'BTC volatility spike?', outcome: true, resolved: true },
        { id: 3, question: 'Collateral ratio safe?', outcome: null, resolved: false },
      ]);

      setLastUpdate(new Date());
      setIsLoading(false);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      toast.error('Data refresh failed');
      setIsLoading(false);
      
      // Retry after 5s
      setTimeout(() => { void fetchData(); }, 5000);
    }
  };

  const handleTrigger = async () => {
    if (!hedgeDecision) return;
    
    setIsTriggering(true);
    try {
      const sig = await triggerHedge({ userPubkey: publicKey, decision: hedgeDecision });
      if (sig) {
        toast.success(`Hedge triggered! Sig: ${sig.slice(0, 8)}...`);
        void fetchData(); // Refresh data
      }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(`Trigger failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsTriggering(false);
    }
  };

  useEffect(() => {
    if (!publicKey) {
      throw new Error('PublicKey required');
    }

    // Initial fetch
    void fetchData();

    // Poll every 60s
    const intervalId = setInterval(() => { void fetchData(); }, 60000);

    // Cleanup
    return () => clearInterval(intervalId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Empty state - only show if we've confirmed no position exists
  if (positionStats === null) {
    return (
      <div className="text-center py-12 bg-surface/50 backdrop-blur-sm rounded-lg border border-violet/30 p-8">
        <div className="text-6xl mb-4">🏦</div>
        <p className="text-text-secondary text-lg mb-4">No position found. Mint $ZYP to get started.</p>
        <a 
          href="/mint" 
          className="inline-block bg-primary text-background font-semibold px-6 py-3 rounded-lg hover:bg-primary/80 transition-colors"
        >
          Go to Mint
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Last Update Time */}
      <div aria-live="polite" className="text-sm text-text-secondary text-right">
        Updated at {lastUpdate?.toLocaleTimeString() || 'N/A'}
      </div>

      {/* Hedge Section */}
      <section className="mb-6 p-6 bg-surface/50 backdrop-blur-sm rounded-lg border border-violet/30 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Current Hedge Decision</h2>
        {hedgeDecision === null ? (
          <div className="animate-pulse text-text-secondary">Loading hedge analysis...</div>
        ) : (
          <div className={`p-6 rounded-lg border-2 ${
            hedgeDecision 
              ? 'bg-primary/10 border-primary' 
              : 'bg-error/10 border-error'
          }`}>
            <span className="font-medium text-lg">
              {hedgeDecision ? '✅ Hedge Recommended' : '❌ No Hedge Needed'}
            </span>
            <button
              onClick={handleTrigger}
              disabled={!hedgeDecision || isTriggering}
              className="ml-4 bg-primary text-background font-semibold px-6 py-3 rounded-lg hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all transform hover:scale-105 disabled:hover:scale-100"
              aria-label="Trigger hedge transaction"
            >
              {isTriggering ? 'Triggering...' : 'Trigger Hedge'}
            </button>
          </div>
        )}
      </section>

      {/* Position Stats */}
      <section className="mb-6 p-6 bg-surface/50 backdrop-blur-sm rounded-lg border border-violet/30 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Position Stats</h2>
        <div className="grid grid-cols-1 sm:grid-cols-1 md:grid-cols-2 gap-4">
          {positionStats ? (
            <>
              <div className="p-6 bg-gradient-to-br from-primary/20 to-violet/20 rounded-lg border border-primary/50">
                <h3 className="text-sm font-medium text-text-secondary mb-2">Minted $ZYP</h3>
                <p className="text-3xl font-bold text-primary font-[Orbitron]">{positionStats.mintedZyp.toFixed(2)}</p>
              </div>
              <div className="p-6 bg-gradient-to-br from-secondary/20 to-violet/20 rounded-lg border border-secondary/50">
                <h3 className="text-sm font-medium text-text-secondary mb-2">Collateral Value</h3>
                <p className="text-3xl font-bold text-secondary font-[Orbitron]">${positionStats.collateralValue.toFixed(2)}</p>
              </div>
            </>
          ) : (
            <div className="col-span-2 text-center py-4 text-text-secondary">Loading stats...</div>
          )}
        </div>
      </section>

      {/* Predictions List */}
      <section className="p-6 bg-surface/50 backdrop-blur-sm rounded-lg border border-violet/30 shadow-lg">
        <h2 className="text-2xl font-semibold mb-4 text-primary">Active Predictions</h2>
        {predictions.length === 0 ? (
          <p className="text-text-secondary">No predictions yet.</p>
        ) : (
          <ul className="space-y-3">
            {predictions.map((p) => (
              <li key={p.id} className="p-4 bg-background/50 border border-violet/20 rounded-lg hover:border-primary/50 transition-all">
                <div className="flex justify-between items-center">
                  <div className="font-medium text-text-primary">{p.question}</div>
                  <div
                    className={`text-sm font-semibold px-3 py-1 rounded-full ${
                      p.resolved
                        ? p.outcome
                          ? 'bg-primary/20 text-primary'
                          : 'bg-error/20 text-error'
                        : 'bg-text-secondary/20 text-text-secondary'
                    }`}
                  >
                    {p.resolved ? (p.outcome ? 'Resolved Yes' : 'Resolved No') : 'Pending'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
