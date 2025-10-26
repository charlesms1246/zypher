import { Connection, PublicKey, Keypair, Transaction, SystemProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

/**
 * Close the old config account by transferring all lamports out
 * This requires the account to be owned by SystemProgram (which it's not - it's owned by our program)
 * So this will FAIL - we need a close_config instruction in the Rust program
 */

async function main() {
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const configPda = new PublicKey("4UtbZ6x2ugbWiYrKTRj3zJyu9RNfZX9q99aqjBfLz599");
  const programId = new PublicKey("6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK");
  
  console.log("❌ Cannot close PDA owned by program without program support");
  console.log("\n✅ SOLUTION: Modify lib.rs to use a different PDA seed");
  console.log("Change from:");
  console.log('  [Buffer.from("config_v2")]');
  console.log("To:");
  console.log('  [Buffer.from("config_v2")]');
  console.log("\nThen rebuild and redeploy the program.");
}

main();
