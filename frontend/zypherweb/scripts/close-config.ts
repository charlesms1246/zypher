import { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

async function main() {
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));
  
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const configPda = new PublicKey("4UtbZ6x2ugbWiYrKTRj3zJyu9RNfZX9q99aqjBfLz599");
  
  console.log("Closing config account:", configPda.toBase58());
  
  const instruction = {
    programId: new PublicKey("11111111111111111111111111111111"),
    keys: [
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: payer.publicKey, isSigner: false, isWritable: true },
    ],
    data: Buffer.from([]),
  };
  
  // Actually, we can't close a PDA without the program's help.
  // We need to redeploy the program with a close_config instruction.
  // OR use the reinit-config script instead
  console.log("❌ Cannot close PDA without program support.");
  console.log("✅ Solution: Use the reinit-config.ts script instead");
}

main();
