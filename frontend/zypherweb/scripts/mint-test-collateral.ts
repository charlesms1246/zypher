/**
 * Mint Test Collateral Tokens
 * Run with: npx ts-node scripts/mint-test-collateral.ts
 * 
 * This script mints test collateral tokens to your wallet for testing the mint functionality
 */

import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import {
  mintTo,
  getOrCreateAssociatedTokenAccount,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("🪙 Minting test collateral tokens...\n");

  // Setup connection
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load wallet from Solana CLI default keypair
  const walletPath = path.join(process.env.HOME!, ".config/solana/id.json");
  if (!fs.existsSync(walletPath)) {
    throw new Error("Wallet not found at ~/.config/solana/id.json");
  }
  
  const keypairData = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const wallet = Keypair.fromSecretKey(new Uint8Array(keypairData));
  console.log(`📍 Using wallet: ${wallet.publicKey.toBase58()}`);
  
  // Get collateral mint from .env.local
  const envPath = path.join(__dirname, "../.env.local");
  const envContent = fs.readFileSync(envPath, "utf-8");
  const collateralMintMatch = envContent.match(/NEXT_PUBLIC_COLLATERAL_MINT=(\w+)/);
  
  if (!collateralMintMatch) {
    throw new Error("NEXT_PUBLIC_COLLATERAL_MINT not found in .env.local");
  }
  
  const collateralMint = new PublicKey(collateralMintMatch[1]);
  console.log(`💰 Collateral Mint: ${collateralMint.toBase58()}\n`);
  
  // Get or create associated token account
  console.log("Creating/getting token account...");
  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    wallet,
    collateralMint,
    wallet.publicKey
  );
  
  console.log(`✅ Token Account: ${tokenAccount.address.toBase58()}\n`);
  
  // Mint 1000 tokens (with 6 decimals = 1,000,000,000 smallest units)
  const amount = 1000 * 1e6; // 1000 tokens
  console.log(`Minting ${amount / 1e6} tokens...`);
  
  const signature = await mintTo(
    connection,
    wallet,
    collateralMint,
    tokenAccount.address,
    wallet.publicKey, // mint authority
    amount
  );
  
  console.log(`✅ Minted! Signature: ${signature}\n`);
  console.log("🎉 Success! You now have test collateral tokens.");
  console.log("You can now mint $ZYP at http://localhost:3000/mint");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
