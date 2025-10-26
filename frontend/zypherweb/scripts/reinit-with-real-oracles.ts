import { Connection, PublicKey, Keypair, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet } from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import BN from 'bn.js';
import { fileURLToPath } from 'url';

// ES modules fix
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Reinitialize Config with Real Pyth Oracles
 * This will close and recreate the config account
 */

async function main() {
  // Load keypair
  const keypairPath = path.join(process.env.HOME!, '.config/solana/id.json');
  const keypairData = JSON.parse(fs.readFileSync(keypairPath, 'utf-8'));
  const payer = Keypair.fromSecretKey(new Uint8Array(keypairData));

  console.log("Admin/Payer:", payer.publicKey.toBase58());

  // Connect to devnet
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Check balance
  const balance = await connection.getBalance(payer.publicKey);
  console.log("Balance:", balance / 1e9, "SOL\n");

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

  console.log("Config PDA:", configPda.toBase58());

  // Fetch existing config
  const config = await (program.account as any).globalConfig.fetch(configPda);
  console.log("\nExisting Config:");
  console.log("  Zypher Mint:", config.zypherMint.toBase58());
  console.log("  Min Collateral Ratio:", config.minCollateralRatio?.toString() || "N/A");
  console.log("  Hedge Interval:", config.hedgeInterval?.toString() || "3600 (default)");
  console.log("  Approved Collaterals:");
  config.approvedCollaterals.forEach((mint: PublicKey, i: number) => {
    console.log(`    [${i}]: ${mint.toBase58()}`);
  });
  console.log("  OLD Oracle Accounts:");
  config.oracleAccounts.forEach((oracle: PublicKey, i: number) => {
    console.log(`    [${i}]: ${oracle.toBase58()}`);
  });

  // Real Pyth Devnet Oracles (verified working on Solana Devnet)
  const NEW_ORACLES = [
    new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // Gold/USD (XAU/USD)
    new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // SOL/USD (Treasury placeholder)
    new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J"), // BTC/USD (Real Estate)
    new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"), // ETH/USD (Commodity)
    new PublicKey("5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7"), // USDC/USD (Equity)
  ];

  console.log("\nNEW Pyth Oracle Accounts:");
  NEW_ORACLES.forEach((oracle, i) => {
    console.log(`  [${i}]: ${oracle.toBase58()}`);
  });

  // Verify all oracles exist on-chain
  console.log("\nVerifying oracle accounts exist...");
  for (let i = 0; i < NEW_ORACLES.length; i++) {
    const info = await connection.getAccountInfo(NEW_ORACLES[i]);
    if (info) {
      console.log(`✅ Oracle ${i}: EXISTS (${info.data.length} bytes, owner: ${info.owner.toBase58().slice(0, 8)}...)`);
    } else {
      console.error(`❌ Oracle ${i}: NOT FOUND - ${NEW_ORACLES[i].toBase58()}`);
      throw new Error(`Oracle account ${i} does not exist`);
    }
  }

  console.log("\n⚠️  WARNING: This will close and reinitialize the config account.");
  console.log("Proceeding in 3 seconds...\n");
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Close existing config (get rent back)
  try {
    console.log("Closing existing config account...");
    const closeTx = await program.methods
      .closeConfig()
      .accounts({
        config: configPda,
        admin: payer.publicKey,
        destination: payer.publicKey,
      })
      .rpc();
    console.log("✅ Config closed:", closeTx);
  } catch (error: any) {
    if (!error.message.includes("AccountNotInitialized") && !error.message.includes("not found")) {
      console.error("Error closing config:", error.message);
      console.log("⚠️  Attempting to reinitialize anyway...");
    }
  }

  // Wait a bit for the account to be closed
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Reinitialize with new oracles
  console.log("\nReinitializing config with real Pyth oracles...");
  try {
    const initTx = await program.methods
      .initializeConfig(
        config.minCollateralRatio || new BN(150_000_000),
        config.hedgeInterval || new BN(3600),
        config.approvedCollaterals,
        NEW_ORACLES
      )
      .accounts({
        config: configPda,
        admin: payer.publicKey,
        zypherMint: config.zypherMint,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Config reinitialized!");
    console.log("Transaction:", initTx);
    console.log("Explorer:", `https://explorer.solana.com/tx/${initTx}?cluster=devnet\n`);

    // Verify
    const newConfig = await (program.account as any).globalConfig.fetch(configPda);
    console.log("UPDATED Oracle Accounts:");
    newConfig.oracleAccounts.forEach((oracle: PublicKey, i: number) => {
      console.log(`  [${i}]: ${oracle.toBase58()}`);
    });

  } catch (error: any) {
    console.error("❌ Error reinitializing:", error.message);
    if (error.logs) {
      console.log("Program logs:");
      error.logs.forEach((log: string) => console.log(" ", log));
    }
    throw error;
  }
}

main()
  .then(() => {
    console.log("\n✅ Done! You can now mint with real Pyth oracle data.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ Error:", err);
    process.exit(1);
  });
