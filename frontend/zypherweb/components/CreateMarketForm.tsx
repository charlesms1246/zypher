'use client';

import { useState } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { Connection, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import { Program, AnchorProvider, BN } from '@coral-xyz/anchor';
import toast from 'react-hot-toast';
import idl from '../public/idl/zypher.json';

/**
 * Component to create prediction markets on-chain
 */
export default function CreateMarketForm() {
  const { publicKey, signTransaction } = useWallet();
  const [isCreating, setIsCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [daysUntilResolution, setDaysUntilResolution] = useState(7);

  const createMarket = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!publicKey || !signTransaction) {
      toast.error('Please connect your wallet first');
      return;
    }

    if (!question || question.length > 64) {
      toast.error('Question must be 1-64 characters');
      return;
    }

    setIsCreating(true);

    try {
      const connection = new Connection(
        process.env.NEXT_PUBLIC_RPC_URL || 'https://api.devnet.solana.com',
        'confirmed'
      );
      const programId = new PublicKey(
        process.env.NEXT_PUBLIC_PROGRAM_ID || '6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK'
      );

      // Create provider
      const provider = new AnchorProvider(
        connection,
        { publicKey, signTransaction } as any,
        { commitment: 'confirmed' }
      );

      // Generate random market ID (in production, use a counter or hash)
      const marketId = Date.now();
      
      // Calculate resolution time
      const resolutionTime = Math.floor(Date.now() / 1000) + (daysUntilResolution * 24 * 3600);

      // Derive market PDA
      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('market'), new BN(marketId).toArrayLike(Buffer, 'le', 8)],
        programId
      );

      // Use Pyth oracle as resolution oracle (placeholder)
      const resolutionOracle = new PublicKey('J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix');

      // Initialize program
      const idlWithProgramId = { ...idl, address: programId.toBase58() };
      const program = new Program(idlWithProgramId as any, provider);

      // Create transaction
      const tx = await program.methods
        .createPredictionMarket(
          new BN(marketId),
          new BN(resolutionTime),
          question
        )
        .accounts({
          market: marketPda,
          creator: publicKey,
          resolutionOracle: resolutionOracle,
          systemProgram: SystemProgram.programId,
        })
        .transaction();

      // Get recent blockhash
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      // Sign and send
      const signed = await signTransaction(tx);
      const signature = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      toast.success('Market created successfully!');
      console.log('Market PDA:', marketPda.toBase58());
      console.log('Transaction:', signature);
      console.log('Explorer:', `https://explorer.solana.com/tx/${signature}?cluster=devnet`);

      // Reset form
      setQuestion('');
      setDaysUntilResolution(7);

    } catch (error) {
      console.error('Failed to create market:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to create market');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto p-6 bg-[#121212] border border-[#00FFB3]/20 rounded-2xl">
      <h2 className="text-2xl font-bold mb-6 text-[#00FFB3]">
        Create Prediction Market
      </h2>

      <form onSubmit={createMarket} className="space-y-6">
        <div>
          <label htmlFor="question" className="block text-sm font-medium text-[#F5F5F5] mb-2">
            Market Question (max 64 characters)
          </label>
          <input
            type="text"
            id="question"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            maxLength={64}
            placeholder="Will BTC exceed $70k by December 2025?"
            className="w-full px-4 py-3 bg-[#0A2540] border border-[#00FFB3]/30 rounded-lg text-[#F5F5F5] placeholder-[#B8B8B8] focus:outline-none focus:border-[#00FFB3] transition-colors"
            required
          />
          <p className="mt-1 text-xs text-[#B8B8B8]">{question.length}/64 characters</p>
        </div>

        <div>
          <label htmlFor="days" className="block text-sm font-medium text-[#F5F5F5] mb-2">
            Days Until Resolution
          </label>
          <input
            type="number"
            id="days"
            value={daysUntilResolution}
            onChange={(e) => setDaysUntilResolution(parseInt(e.target.value))}
            min={1}
            max={365}
            className="w-full px-4 py-3 bg-[#0A2540] border border-[#00FFB3]/30 rounded-lg text-[#F5F5F5] focus:outline-none focus:border-[#00FFB3] transition-colors"
            required
          />
          <p className="mt-1 text-xs text-[#B8B8B8]">
            Resolution date: {new Date(Date.now() + daysUntilResolution * 24 * 3600 * 1000).toLocaleDateString()}
          </p>
        </div>

        <button
          type="submit"
          disabled={isCreating || !publicKey}
          className="w-full py-3 px-6 bg-gradient-to-r from-[#00FFB3] to-[#8A2EFF] text-[#050505] font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
        >
          {isCreating ? 'Creating Market...' : 'Create Market'}
        </button>

        {!publicKey && (
          <p className="text-center text-sm text-[#FF6B00]">
            Please connect your wallet to create a market
          </p>
        )}
      </form>

      <div className="mt-6 p-4 bg-[#0A2540]/50 rounded-lg">
        <h3 className="text-sm font-semibold text-[#00FFB3] mb-2">Quick Examples:</h3>
        <div className="space-y-2">
          <button
            onClick={() => {
              setQuestion('Will BTC exceed $70,000 by December 2025?');
              setDaysUntilResolution(60);
            }}
            className="w-full text-left text-sm text-[#B8B8B8] hover:text-[#00FFB3] transition-colors"
          >
            📈 BTC Price Prediction
          </button>
          <button
            onClick={() => {
              setQuestion('Will Gold volatility stay below 10% this quarter?');
              setDaysUntilResolution(90);
            }}
            className="w-full text-left text-sm text-[#B8B8B8] hover:text-[#00FFB3] transition-colors"
          >
            🥇 Gold Volatility
          </button>
          <button
            onClick={() => {
              setQuestion('Will SOL staking yield exceed 6% by year end?');
              setDaysUntilResolution(120);
            }}
            className="w-full text-left text-sm text-[#B8B8B8] hover:text-[#00FFB3] transition-colors"
          >
            ⚡ SOL Staking Yield
          </button>
        </div>
      </div>
    </div>
  );
}
