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
   * Fetches: hedge decision from AI agent API, position stats from program, predictions from on-chain
   */
  const fetchData = async () => {
    try {
      // Fetch AI Agent Decision from API endpoint
      try {
        const agentResponse = await fetch('/api/agent');
        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          setHedgeDecision(agentData.hedgeDecision);
          console.log('Agent decision:', agentData);
        } else {
          console.error('Agent API failed, using local fallback');
          setHedgeDecision(false); // Default to no hedge
        }
      } catch (err) {
        console.error('Agent API error:', err);
        setHedgeDecision(false); // Default to no hedge
      }

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
            // Estimate collateral value (using $2000 average price for MVP)
            const collateralValue = mintedZyp * 2000 * 0.67; // 150% collateral ratio
            
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

      // Predictions Fetch - Query prediction markets from program
      try {
        const { Connection, PublicKey: SolPublicKey } = await import('@solana/web3.js');
        const connection = new Connection(process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com', 'confirmed');
        const programId = new SolPublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK');
        
        console.log('Fetching prediction markets for program:', programId.toBase58());
        
        // Fetch ALL accounts owned by our program
        const accounts = await connection.getProgramAccounts(programId, {
          encoding: 'base64',
        });
        
        console.log(`Found ${accounts.length} total program accounts`);
        
        // For each account, log its size and first 8 bytes (discriminator) to debug
        const knownDiscriminators = {
          '95089ccaa0fcb0d9': 'Position',
          '184662bf3a907b9e': 'GlobalConfig',
          'fbf8d1f553ea111b': 'Unknown',
        };
        
        accounts.forEach((account, idx) => {
          const data = Buffer.from(account.account.data as any, 'base64');
          const discriminator = data.slice(0, 8).toString('hex');
          const accountType = knownDiscriminators[discriminator as keyof typeof knownDiscriminators] || 'Unknown';
          console.log(`Account ${idx}: ${account.pubkey.toBase58().slice(0, 8)}..., size: ${data.length}, type: ${accountType}, discriminator: ${discriminator}`);
        });
        
        // Filter for prediction market accounts by checking discriminator
        // PredictionMarket discriminator would be SHA256("account:PredictionMarket")[0..8]
        // Since we know the discriminators for Position and GlobalConfig, exclude those
        const predictionMarkets = accounts.filter(account => {
          const data = Buffer.from(account.account.data as any, 'base64');
          if (data.length < 8) return false;
          
          const discriminator = data.slice(0, 8).toString('hex');
          // Exclude known account types
          return !['95089ccaa0fcb0d9', '184662bf3a907b9e', 'fbf8d1f553ea111b'].includes(discriminator);
        });
        
        console.log(`Found ${predictionMarkets.length} prediction market accounts`);
        
        if (predictionMarkets.length > 0) {
          // Parse real prediction market data
          const parsedPredictions = predictionMarkets.slice(0, 5).map((account, index) => {
            try {
              const data = Buffer.from(account.account.data as any, 'base64');
              let offset = 8; // Skip discriminator
              
              // Read description (String)
              const descLength = data.readUInt32LE(offset);
              offset += 4;
              
              // Validate length before reading
              if (descLength > 1000 || offset + descLength > data.length) {
                throw new Error('Invalid description length');
              }
              
              const description = data.slice(offset, offset + descLength).toString('utf8');
              offset += descLength;
              
              // Skip creator and oracle pubkeys
              offset += 64;
              
              // Read outcome_yes and outcome_no
              const outcomeYes = Number(data.readBigUInt64LE(offset));
              offset += 8;
              const outcomeNo = Number(data.readBigUInt64LE(offset));
              offset += 8;
              
              // Skip total_staked
              offset += 8;
              
              // Read resolved flag
              const resolved = data.readUInt8(offset) !== 0;
              offset += 1;
              
              // Read winning_outcome (Option<bool>)
              const hasOutcome = data.readUInt8(offset) !== 0;
              offset += 1;
              let winningOutcome = null;
              if (hasOutcome) {
                winningOutcome = data.readUInt8(offset) !== 0;
              }
              
              return {
                id: index + 1,
                question: description,
                outcome: resolved ? winningOutcome : null,
                resolved,
              };
            } catch (err) {
              console.error('Failed to parse prediction market:', err);
              return null;
            }
          }).filter(p => p !== null) as { id: number; question: string; outcome: boolean | null; resolved: boolean }[];
          
          if (parsedPredictions.length > 0) {
            setPredictions(parsedPredictions);
          } else {
            // Parsing failed, show demo
            console.log('No valid prediction markets, showing demo data');
            setPredictions([
              { id: 1, question: 'BTC >$70k by Dec 2025?', outcome: null, resolved: false },
              { id: 2, question: 'Gold volatility <10%?', outcome: true, resolved: true },
              { id: 3, question: 'SOL staking yield >6%?', outcome: null, resolved: false },
            ]);
          }
        } else {
          // No markets found - show demo markets for MVP
          console.log('No prediction markets created yet, showing demo data');
          setPredictions([
            { id: 1, question: 'BTC >$70k by Dec 2025?', outcome: null, resolved: false },
            { id: 2, question: 'Gold volatility <10%?', outcome: true, resolved: true },
            { id: 3, question: 'SOL staking yield >6%?', outcome: null, resolved: false },
          ]);
        }
      } catch (err) {
        console.error('Failed to fetch predictions:', err);
        // Fallback to demo markets
        setPredictions([
          { id: 1, question: 'BTC >$70k by Dec 2025?', outcome: null, resolved: false },
          { id: 2, question: 'Gold volatility <10%?', outcome: true, resolved: true },
          { id: 3, question: 'SOL staking yield >6%?', outcome: null, resolved: false },
        ]);
      }

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
