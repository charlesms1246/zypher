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
  const [agentDetails, setAgentDetails] = useState<{
    hedgeDecision: boolean;
    price: number | null;
    volatility: number | null;
    yieldRate: number | null;
    timestamp: number | null;
  } | null>(null);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [positionStats, setPositionStats] = useState<PositionStats | null>(null);
  const [autoMode, setAutoMode] = useState<boolean>(false);
  const [isTriggering, setIsTriggering] = useState<boolean>(false);
  const [lastHedgeTs, setLastHedgeTs] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const AUTO_HEDGE_COOLDOWN = 1000 * 60 * 60; // 1 hour cooldown

  /**
   * Polls oracles and program for dashboard data
   * Fetches: hedge decision from AI agent API, position stats from program, predictions from on-chain
   */
  const fetchData = async () => {
    try {
      // Fetch AI Agent Decision from API endpoint
    const promiseWithTimeout = async <T,>(p: Promise<T>, ms = 12000): Promise<T> => {
      return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Timeout')), ms);
        p.then((res) => {
          clearTimeout(timer);
          resolve(res);
        }).catch((err) => {
          clearTimeout(timer);
          reject(err);
        });
      });
    };
      try {
        const agentResponse = await fetch('/api/agent');
        if (agentResponse.ok) {
          const agentData = await agentResponse.json();
          setHedgeDecision(Boolean(agentData.hedgeDecision));
          setAgentDetails({
            hedgeDecision: Boolean(agentData.hedgeDecision),
            price: typeof agentData.price === 'number' ? agentData.price : null,
            volatility: typeof agentData.volatility === 'number' ? agentData.volatility : null,
            yieldRate: typeof agentData.yieldRate === 'number' ? agentData.yieldRate : null,
            timestamp: typeof agentData.timestamp === 'number' ? agentData.timestamp : Date.now(),
          });
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

            // Additionally, fetch the on-chain UserPosition PDA to read last_hedge_timestamp
            try {
              const programId = new SolPublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK');
              const [positionPda] = SolPublicKey.findProgramAddressSync([
                Buffer.from('position'),
                publicKey.toBuffer(),
              ], programId);

              const posAcct = await connection.getAccountInfo(positionPda);
              if (posAcct && posAcct.data) {
                const data = Buffer.from(posAcct.data);
                // Parse Borsh-like layout: discriminator(8) | owner(32) | vec<u64> (4 + n*8) | minted_zypher u64 | encrypted hash 32 | last_hedge_timestamp i64
                let off = 8; // skip discriminator
                off += 32; // owner

                // read vec<u64> length
                if (off + 4 <= data.length) {
                  const vecLen = data.readUInt32LE(off);
                  off += 4;
                  // skip vec entries
                  off += vecLen * 8;
                }

                // minted_zypher
                if (off + 8 <= data.length) {
                  off += 8;
                }

                // encrypted position hash
                if (off + 32 <= data.length) {
                  off += 32;
                }

                // last_hedge_timestamp
                if (off + 8 <= data.length) {
                  const lastTs = Number(data.readBigInt64LE(off));
                  setLastHedgeTs(lastTs > 0 ? lastTs * 1000 : null); // convert to ms
                } else {
                  setLastHedgeTs(null);
                }
              }
            } catch (err) {
              console.warn('Unable to read on-chain position PDA for last_hedge_timestamp', err);
            }
          } else {
            // No ZYP minted yet
            setPositionStats(null);
            setLastHedgeTs(null);
          }
        } catch (err) {
          // ZYP token account doesn't exist - user hasn't minted
          console.log('No ZYP token account found');
          setPositionStats(null);
          setLastHedgeTs(null);
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

              // Read creator (Pubkey)
              const creator = data.slice(offset, offset + 32);
              offset += 32;

              // Heuristic: question string was added later. Peek a u32 length to see if question is present.
              let questionText = '';
              let oracle: Buffer | null = null;
              let yesPool = 0;
              let noPool = 0;
              let zkCommitment = '';
              let proofRequired = false;
              let resolved = false;
              let winningOutcome: boolean | null = null;
              let resolutionTime = 0;

              // Only attempt to read a question length if there's at least 4 bytes available
              if (offset + 4 <= data.length) {
                const potentialQLen = data.readUInt32LE(offset);
                // Sanity-check qlen: must be small (<= 128) and the buffer must be large enough to contain the whole new layout
                const maxQuestionLen = 128; // tolerate slightly larger but still safe
                const estimatedRemainingAfterQuestion = 32 + 8 + 8 + 32 + 1 + 1 + 1 + 8; // oracle + pools + commitment + flags + opt + time
                if (potentialQLen >= 0 && potentialQLen <= maxQuestionLen && offset + 4 + potentialQLen + estimatedRemainingAfterQuestion <= data.length) {
                  // New layout with question
                  const qLen = potentialQLen;
                  offset += 4;
                  questionText = data.slice(offset, offset + qLen).toString('utf8');
                  offset += qLen;

                  oracle = data.slice(offset, offset + 32);
                  offset += 32;

                  yesPool = Number(data.readBigUInt64LE(offset));
                  offset += 8;
                  noPool = Number(data.readBigUInt64LE(offset));
                  offset += 8;

                  zkCommitment = data.slice(offset, offset + 32).toString('hex');
                  offset += 32;

                  proofRequired = data.readUInt8(offset) !== 0;
                  offset += 1;

                  resolved = data.readUInt8(offset) !== 0;
                  offset += 1;

                  const hasOutcome = data.readUInt8(offset) !== 0;
                  offset += 1;
                  if (hasOutcome) {
                    winningOutcome = data.readUInt8(offset) !== 0;
                    offset += 1;
                  }

                  resolutionTime = Number(data.readBigInt64LE(offset));
                  offset += 8;
                } else {
                  // Old layout without question: next is oracle directly
                  oracle = data.slice(offset, offset + 32);
                  offset += 32;

                  yesPool = Number(data.readBigUInt64LE(offset));
                  offset += 8;
                  noPool = Number(data.readBigUInt64LE(offset));
                  offset += 8;

                  zkCommitment = data.slice(offset, offset + 32).toString('hex');
                  offset += 32;

                  proofRequired = data.readUInt8(offset) !== 0;
                  offset += 1;

                  resolved = data.readUInt8(offset) !== 0;
                  offset += 1;

                  const hasOutcome = data.readUInt8(offset) !== 0;
                  offset += 1;
                  if (hasOutcome) {
                    winningOutcome = data.readUInt8(offset) !== 0;
                    offset += 1;
                  }

                  resolutionTime = Number(data.readBigInt64LE(offset));
                  offset += 8;
                }
              } else {
                throw new Error('Account too small to parse PredictionMarket');
              }

              // Use on-chain question if available, else fall back to commitment-based label
              const questionLabel = questionText || `Market ${account.pubkey.toBase58().slice(0, 8)} (commit ${zkCommitment.slice(0,8)})`;

              return {
                id: index + 1,
                question: questionLabel,
                outcome: resolved ? Boolean(winningOutcome) : null,
                resolved,
                yesPool,
                noPool,
                resolutionTime,
                proofRequired,
                oracle: new PublicKey(oracle).toBase58(),
              };
            } catch (err) {
              console.error('Failed to parse prediction market:', err);
              return null;
            }
          }).filter(p => p !== null) as any[];
          
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
    // Allow manual triggers regardless of agent recommendation.
    if (hedgeDecision === null) {
      const confirmProceed = window.confirm('Agent decision not available yet. Do you want to proceed and trigger a hedge manually?');
      if (!confirmProceed) return;
    }
    // If agent recommends NO, ask for confirmation before proceeding
    if (hedgeDecision === false) {
      const confirmProceed = window.confirm('Agent recommends NOT to hedge right now. Do you want to force trigger a hedge anyway?');
      if (!confirmProceed) return;
    }

    // Enforce frontend cooldown (1 hour) using on-chain last_hedge_timestamp when available, else localStorage fallback
    const HEDGE_COOLDOWN_MS = 1000 * 60 * 60; // 1 hour
    const now = Date.now();
    let last = Number(localStorage.getItem('zypher_last_hedge') || '0');
    if (lastHedgeTs) {
      // lastHedgeTs is stored in ms already
      last = lastHedgeTs;
    }
    if (last && now - last < HEDGE_COOLDOWN_MS) {
      const remaining = Math.ceil((HEDGE_COOLDOWN_MS - (now - last)) / 1000);
      toast.error(`Rate limit: next hedge available in ${remaining} seconds`);
      return;
    }
    
    setIsTriggering(true);
    try {
  const decisionToSend = hedgeDecision ?? true;
  const sig = await triggerHedge({ userPubkey: publicKey, decision: decisionToSend });
      if (sig) {
        toast.success(`Hedge triggered! Sig: ${sig.slice(0, 8)}...`);
        localStorage.setItem('zypher_last_hedge', String(Date.now()));
        setLastHedgeTs(Date.now());
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

  // Initialize automatic mode from localStorage
  useEffect(() => {
    try {
      const val = localStorage.getItem('zypher_auto_mode');
      setAutoMode(val === '1');
    } catch (err) {
      // ignore
    }
  }, []);

  // Automatic hedging effect: when autoMode is enabled and agent recommends hedge,
  // trigger the hedge automatically respecting a local cooldown.
  useEffect(() => {
    if (!autoMode || !agentDetails || !agentDetails.hedgeDecision) return;

    const last = Number(localStorage.getItem('zypher_auto_last') || '0');
    const now = Date.now();
    if (now - last < AUTO_HEDGE_COOLDOWN) {
      console.log('Auto-hedge cooldown active, skipping automatic trigger');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        setIsTriggering(true);
        const sig = await triggerHedge({ userPubkey: publicKey, decision: true });
        if (sig) {
          toast.success(`Auto-hedge triggered: ${sig.slice(0,8)}...`);
          localStorage.setItem('zypher_auto_last', String(Date.now()));
          void fetchData();
        }
      } catch (err: any) {
        console.error('Auto-hedge failed:', err);
        toast.error(`Auto-hedge failed: ${err?.message || 'Unknown'}`);
      } finally {
        if (!cancelled) setIsTriggering(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoMode, agentDetails]);

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
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="font-medium text-lg">
                  {hedgeDecision ? '✅ Hedge Recommended' : '❌ No Hedge Needed'}
                </span>
                <div className="text-sm text-text-secondary mt-2">
                  {agentDetails ? (
                    <div className="space-y-1">
                      <div>Price: ${agentDetails.price ? agentDetails.price.toFixed(2) : '—'}</div>
                      <div>Volatility: {agentDetails.volatility ? (agentDetails.volatility * 100).toFixed(2) + '%' : '—'}</div>
                      <div>Yield rate: {agentDetails.yieldRate ? (agentDetails.yieldRate * 100).toFixed(2) + '%' : '—'}</div>
                      <div className="text-xs text-text-secondary">Updated: {agentDetails.timestamp ? new Date(agentDetails.timestamp).toLocaleString() : '—'}</div>
                    </div>
                  ) : (
                    <div>Agent data unavailable</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-text-secondary">
                  <input
                    type="checkbox"
                    checked={autoMode}
                    onChange={(e) => {
                      const enabled = e.target.checked;
                      setAutoMode(enabled);
                      localStorage.setItem('zypher_auto_mode', enabled ? '1' : '0');
                      if (enabled) toast.success('Automatic hedging enabled');
                    }}
                    className="w-4 h-4"
                  />
                  <span>Automatic mode</span>
                </label>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void handleTrigger()}
                    disabled={isTriggering || (lastHedgeTs !== null && (Date.now() - lastHedgeTs) < AUTO_HEDGE_COOLDOWN)}
                    className="ml-2 bg-primary text-background font-semibold px-4 py-2 rounded-lg hover:bg-primary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    {isTriggering ? 'Triggering...' : 'Trigger Hedge'}
                  </button>
                  {lastHedgeTs !== null && (Date.now() - lastHedgeTs) < AUTO_HEDGE_COOLDOWN && (
                    <div className="text-sm text-text-secondary">
                      Cooldown: {Math.ceil((AUTO_HEDGE_COOLDOWN - (Date.now() - lastHedgeTs)) / 1000)}s
                    </div>
                  )}
                </div>
              </div>
            </div>
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
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold text-primary">Active Predictions</h2>
          <a
            href="/create-market"
            className="bg-gradient-to-r from-primary to-violet text-background font-semibold px-4 py-2 rounded-lg hover:opacity-90 transition-opacity text-sm"
          >
            + Create Market
          </a>
        </div>
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
