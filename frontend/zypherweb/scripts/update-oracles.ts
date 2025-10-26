import { Connection, PublicKey, Keypair } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';

/**
 * Update Global Config with Real Pyth Oracle Accounts
 * 
 * Pyth Devnet Price Feed IDs:
 * - Gold (XAU/USD): J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix
 * - Treasury Bonds: We'll use SOL/USD as placeholder: J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix
 * - Real Estate: Use BTC/USD as placeholder: HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J
 * - Commodities: Use ETH/USD as placeholder: EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw
 * - Equity: Use USDC/USD as placeholder: 5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7
 */

async function main() {
  // Load keypair
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("Payer:", payer.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL");

  if (balance < 0.1 * 1e9) {
    console.log("⚠️  Low balance, requesting airdrop...");
    const sig = await connection.requestAirdrop(payer.publicKey, 1e9);
    await connection.confirmTransaction(sig);
    console.log("✅ Airdrop successful");
  }

  // Real Pyth Devnet Oracle Accounts
  const PYTH_ORACLES = [
    new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // Gold/USD
    new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // SOL/USD (Treasury placeholder)
    new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J"), // BTC/USD (Real Estate placeholder)
    new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"), // ETH/USD (Commodities)
    new PublicKey("5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7"), // USDC/USD (Equity)
  ];

  // Verify oracle accounts exist
  console.log("\nVerifying oracle accounts...");
  for (let i = 0; i < PYTH_ORACLES.length; i++) {
    const info = await connection.getAccountInfo(PYTH_ORACLES[i]);
    if (info) {
      console.log(`✅ Oracle ${i}: ${PYTH_ORACLES[i].toBase58()} (${info.data.length} bytes)`);
    } else {
      console.log(`❌ Oracle ${i}: ${PYTH_ORACLES[i].toBase58()} - NOT FOUND`);
    }
  }

  // Program ID
  const programId = new PublicKey("6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK");

  // Load IDL
  const idlPath = path.join(__dirname, '../public/idl/zypher.json');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf-8'));

  // Create provider and program
  const wallet = new Wallet(payer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new Program({ ...idl, address: programId.toBase58() } as any, provider);

  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config_v2")],
    programId
  );

  console.log("\nConfig PDA:", configPda.toBase58());

  // Fetch current config
  const config = await (program.account as any).globalConfig.fetch(configPda);
  console.log("\nCurrent oracle accounts:");
  for (let i = 0; i < config.oracleAccounts.length; i++) {
    console.log(`  [${i}]: ${config.oracleAccounts[i].toBase58()}`);
  }

  // Update config with real oracles
  console.log("\nUpdating config with real Pyth oracles...");
  try {
    const tx = await program.methods
      .updateOracleAccounts(PYTH_ORACLES)
      .accounts({
        config: configPda,
        admin: payer.publicKey,
      })
      .rpc();

    console.log("✅ Update successful!");
    console.log("Transaction:", tx);
    console.log("Explorer:", `https://explorer.solana.com/tx/${tx}?cluster=devnet`);

    // Verify update
    const updatedConfig = await (program.account as any).globalConfig.fetch(configPda);
    console.log("\nUpdated oracle accounts:");
    for (let i = 0; i < updatedConfig.oracleAccounts.length; i++) {
      console.log(`  [${i}]: ${updatedConfig.oracleAccounts[i].toBase58()}`);
    }

  } catch (error) {
    console.error("❌ Error updating config:", error);
    console.log("\n⚠️  The update_oracle_accounts instruction might not exist in your program.");
    console.log("You'll need to redeploy the program or manually reinitialize the config.");
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
