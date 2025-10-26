/**
 * Initialize Zypher Protocol Config On-Chain
 * Run with: ts-node scripts/initialize-config.ts
 * 
 * This script:
 * 1. Creates the Zypher mint token
 * 2. Initializes the global config with approved collaterals
 * 3. Outputs addresses for .env.local
 */

import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  createMint,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import BN from "bn.js";

const { Program, AnchorProvider, Wallet } = anchor;

// ES module equivalents for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load IDL
const idlPath = path.join(__dirname, "../public/idl/zypher.json");
const zypherIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));

async function main() {
  console.log("🚀 Initializing Zypher Protocol Config...\n");

  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load wallet from Solana CLI default keypair
  const walletPath = path.join(process.env.HOME!, ".config/solana/id.json");
  if (!fs.existsSync(walletPath)) {
    throw new Error("Wallet not found at ~/.config/solana/id.json. Run 'solana-keygen new' first.");
  }
  
  const keypairData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log(`📍 Using wallet: ${wallet.publicKey.toBase58()}`);
  
  // Check balance
  const balance = await connection.getBalance(wallet.publicKey);
  console.log(`💰 Balance: ${balance / 1e9} SOL`);
  if (balance < 0.1 * 1e9) {
    console.warn("⚠️  Low balance! Airdrop with: solana airdrop 2");
  }
  
  // Setup provider
  const anchorWallet = new Wallet(wallet);
  const provider = new AnchorProvider(connection, anchorWallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  
  // Load program
  const programId = new PublicKey("6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK");
  const program = new Program(zypherIdl as any, provider);
  console.log(`📜 Program ID: ${programId.toBase58()}\n`);
  
  // Step 1: Create Zypher mint
  console.log("1️⃣  Creating Zypher Mint ($ZYP)...");
  const zypherMint = await createMint(
    connection,
    wallet,
    wallet.publicKey, // mint authority
    null, // freeze authority
    6, // decimals
    undefined,
    { commitment: "confirmed" },
    TOKEN_PROGRAM_ID
  );
  console.log(`✅ Zypher Mint: ${zypherMint.toBase58()}\n`);
  
  // Step 2: Setup approved collaterals (using placeholder mints for MVP)
  console.log("2️⃣  Setting up approved collaterals...");
  const collateralMints = [];
  const collateralNames = ["Gold", "Treasury Bond", "Real Estate", "Commodity Index", "Equity Token"];
  
  for (let i = 0; i < 5; i++) {
    const collateralMint = await createMint(
      connection,
      wallet,
      wallet.publicKey,
      null,
      6,
      undefined,
      { commitment: "confirmed" },
      TOKEN_PROGRAM_ID
    );
    collateralMints.push(collateralMint);
    console.log(`  ✅ ${collateralNames[i]}: ${collateralMint.toBase58()}`);
  }
  console.log();
  
  // Step 3: Setup oracle accounts (Pyth devnet - REAL ORACLES)
  console.log("3️⃣  Setting up oracle accounts (Pyth Devnet)...");
  // These are actual Pyth price feed accounts on Solana Devnet
  // Source: https://pyth.network/developers/price-feed-ids#solana-devnet
  const oracleAccounts = [
    new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // Gold/USD (XAU/USD)
    new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // SOL/USD (as Treasury placeholder)
    new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J"), // BTC/USD (as Real Estate placeholder)
    new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"), // ETH/USD (Commodity)
    new PublicKey("5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7"), // USDC/USD (Equity)
  ];
  oracleAccounts.forEach((oracle, i) => {
    console.log(`  ✅ ${collateralNames[i]}: ${oracle.toBase58()}`);
  });
  console.log();
  
  // Step 4: Initialize config
  console.log("4️⃣  Initializing global config...");
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config_v2")],
    programId
  );
  console.log(`📍 Config PDA: ${configPda.toBase58()}`);
  
  try {
    const tx = await program.methods
      .initializeConfig(
        new BN(150_000_000), // min_ratio (150% with 8 decimals)
        new BN(3600), // hedge_interval (1 hour default)
        collateralMints,
        oracleAccounts
      )
      .accounts({
        config: configPda,
        admin: wallet.publicKey,
        zypherMint: zypherMint,
        systemProgram: SystemProgram.programId,
      })
      .rpc({ commitment: "confirmed" });
    
    console.log(`✅ Config initialized! Tx: ${tx}\n`);
  } catch (err: any) {
    if (err.message.includes("already in use")) {
      console.log(`⚠️  Config already exists at ${configPda.toBase58()}\n`);
    } else {
      throw err;
    }
  }
  
  // Step 5: Output .env.local updates
  console.log("5️⃣  Update your .env.local with these values:\n");
  console.log("=" .repeat(70));
  console.log(`NEXT_PUBLIC_ZYPHER_MINT=${zypherMint.toBase58()}`);
  console.log(`NEXT_PUBLIC_COLLATERAL_MINT=${collateralMints[0].toBase58()} # Gold collateral`);
  console.log(`NEXT_PUBLIC_ORACLE_ACCOUNT=${oracleAccounts[0].toBase58()} # Gold oracle`);
  console.log("=" .repeat(70));
  console.log("\n📝 All collateral mints:");
  collateralMints.forEach((mint, i) => {
    console.log(`  ${collateralNames[i]}: ${mint.toBase58()}`);
  });
  
  console.log("\n✨ Initialization complete!");
  console.log("Next steps:");
  console.log("  1. Copy the values above to frontend/zypherweb/.env.local");
  console.log("  2. Restart your dev server: npm run dev");
  console.log("  3. Test minting at http://localhost:3000/mint");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
