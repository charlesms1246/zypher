/**
 * Initialize Vault Token Account
 * Run with: npx ts-node scripts/initialize-vault.ts
 * 
 * This script creates the vault token account that holds collateral deposits
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  createAccount,
  getMinimumBalanceForRentExemptAccount,
  TOKEN_PROGRAM_ID,
  ACCOUNT_SIZE,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("🏦 Initializing vault token account...\n");

  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load wallet from Solana CLI default keypair
  const walletPath = path.join(process.env.HOME!, ".config/solana/id.json");
  if (!fs.existsSync(walletPath)) {
    throw new Error("Wallet not found at ~/.config/solana/id.json");
  }
  
  const keypairData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log(`📍 Payer: ${payer.publicKey.toBase58()}`);
  
  // Get addresses from .env.local
  const envPath = path.join(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  
  const programIdMatch = envContent.match(/NEXT_PUBLIC_PROGRAM_ID=(\w+)/);
  const collateralMintMatch = envContent.match(/NEXT_PUBLIC_COLLATERAL_MINT=(\w+)/);
  
  if (!programIdMatch || !collateralMintMatch) {
    throw new Error("Required env vars not found in .env.local");
  }
  
  const programId = new PublicKey(programIdMatch[1]);
  const collateralMint = new PublicKey(collateralMintMatch[1]);
  
  console.log(`📜 Program ID: ${programId.toBase58()}`);
  console.log(`💰 Collateral Mint: ${collateralMint.toBase58()}\n`);
  
  // Derive vault PDA
  const [vaultPda, vaultBump] = PublicKey.findProgramAddressSync(
    [Buffer.from("vault"), collateralMint.toBuffer()],
    programId
  );
  
  console.log(`🔑 Vault PDA: ${vaultPda.toBase58()}`);
  console.log(`   Bump: ${vaultBump}\n`);
  
  // Check if vault already exists
  const vaultInfo = await connection.getAccountInfo(vaultPda);
  if (vaultInfo) {
    console.log("✅ Vault account already exists!");
    console.log(`   Owner: ${vaultInfo.owner.toBase58()}`);
    console.log(`   Data length: ${vaultInfo.data.length} bytes`);
    return;
  }
  
  // Create the vault token account
  console.log("Creating vault token account...");
  
  // Get rent-exempt balance
  const rentExemptBalance = await getMinimumBalanceForRentExemptAccount(connection);
  console.log(`Rent-exempt balance: ${rentExemptBalance / 1e9} SOL\n`);
  
  try {
    // Create account instruction
    const createAccountIx = SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: vaultPda,
      lamports: rentExemptBalance,
      space: ACCOUNT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    });
    
    // Initialize account instruction
    const initAccountIx = {
      keys: [
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: collateralMint, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: false }, // owner = vault itself (PDA)
      ],
      programId: TOKEN_PROGRAM_ID,
      data: Buffer.from([1]), // InitializeAccount instruction
    };
    
    const tx = new Transaction().add(createAccountIx, initAccountIx);
    
    const signature = await connection.sendTransaction(tx, [payer], {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    
    await connection.confirmTransaction(signature, "confirmed");
    
    console.log(`✅ Vault created! Signature: ${signature}`);
    
  } catch (error: any) {
    console.error("❌ Error creating vault:", error.message);
    
    // If PDA creation fails, we need the program to initialize it
    console.log("\n⚠️  The vault account must be initialized by the program.");
    console.log("The program needs to handle vault initialization in the mint instruction.");
    console.log("\nThe vault PDA should be created with these seeds:");
    console.log(`  ["vault", collateral_mint_pubkey]`);
    console.log(`\nVault address: ${vaultPda.toBase58()}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
