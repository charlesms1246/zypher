/**
 * Script to create prediction markets on-chain
 * Usage: ts-node scripts/create_markets.ts
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import { Zypher } from "../target/types/zypher";
import fs from "fs";

async function main() {
  // Configure the client to use devnet
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const programId = new PublicKey("6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK");
  const program = anchor.workspace.Zypher as Program<Zypher>;

  console.log("Creating prediction markets on devnet...");
  console.log("Program ID:", programId.toBase58());
  console.log("Creator:", provider.wallet.publicKey.toBase58());

  // Markets to create
  const markets = [
    {
      id: 1n,
      question: "Will BTC exceed $70,000 by December 2025?",
      resolutionTime: Math.floor(Date.now() / 1000) + (30 * 24 * 3600), // 30 days from now
    },
    {
      id: 2n,
      question: "Will Gold volatility stay below 10% this quarter?",
      resolutionTime: Math.floor(Date.now() / 1000) + (90 * 24 * 3600), // 90 days from now
    },
    {
      id: 3n,
      question: "Will SOL staking yield exceed 6% by year end?",
      resolutionTime: Math.floor(Date.now() / 1000) + (60 * 24 * 3600), // 60 days from now
    },
    {
      id: 4n,
      question: "Will hedge trigger within 24 hours?",
      resolutionTime: Math.floor(Date.now() / 1000) + (1 * 24 * 3600), // 1 day from now
    },
    {
      id: 5n,
      question: "Will yield rates drop below 5% this week?",
      resolutionTime: Math.floor(Date.now() / 1000) + (7 * 24 * 3600), // 7 days from now
    },
  ];

  // Use Pyth oracle as resolution oracle (placeholder)
  const resolutionOracle = new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix");

  for (const market of markets) {
    try {
      // Derive market PDA
      const [marketPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("market"), new anchor.BN(market.id.toString()).toArrayLike(Buffer, "le", 8)],
        programId
      );

      console.log(`\nCreating market ${market.id}...`);
      console.log(`Question: ${market.question}`);
      console.log(`Market PDA: ${marketPda.toBase58()}`);
      console.log(`Resolution Time: ${new Date(market.resolutionTime * 1000).toISOString()}`);

      // Check if market already exists
      try {
        const existingMarket = await program.account.predictionMarket.fetch(marketPda);
        console.log(`Market ${market.id} already exists, skipping...`);
        continue;
      } catch {
        // Market doesn't exist, create it
      }

      // Create the market
      const tx = await program.methods
        .createPredictionMarket(
          new anchor.BN(market.id.toString()),
          new anchor.BN(market.resolutionTime),
          market.question
        )
        .accounts({
          market: marketPda,
          creator: provider.wallet.publicKey,
          resolutionOracle: resolutionOracle,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      console.log(`✅ Market ${market.id} created successfully!`);
      console.log(`Transaction: https://explorer.solana.com/tx/${tx}?cluster=devnet`);

      // Wait a bit between transactions
      await new Promise(resolve => setTimeout(resolve, 2000));

    } catch (error) {
      console.error(`❌ Failed to create market ${market.id}:`, error);
      if (error instanceof Error) {
        console.error("Error message:", error.message);
      }
    }
  }

  console.log("\n✨ All prediction markets created!");
  console.log("\nMarket PDAs:");
  markets.forEach(market => {
    const [marketPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("market"), new anchor.BN(market.id.toString()).toArrayLike(Buffer, "le", 8)],
      programId
    );
    console.log(`Market ${market.id}: ${marketPda.toBase58()}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error);
    process.exit(1);
  });
