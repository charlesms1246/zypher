/**
 * Simple script to initialize config with new hedge_interval_seconds field
 * Uses existing wallet (no airdrop needed)
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AegisProtocol } from "../target/types/aegis_protocol";
import { PublicKey, Keypair } from "@solana/web3.js";
import { createMint } from "@solana/spl-token";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AegisProtocol as Program<AegisProtocol>;
  const admin = provider.wallet.publicKey;

  console.log("🚀 Initializing Aegis Protocol Config");
  console.log(`Program ID: ${program.programId.toBase58()}`);
  console.log(`Admin: ${admin.toBase58()}\n`);

  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log(`Config PDA: ${configPDA.toBase58()}\n`);

  // Check if already initialized
  try {
    const existing = await program.account.globalConfig.fetch(configPDA);
    console.log("✓ Config already initialized:");
    console.log(`  Admin: ${existing.admin.toBase58()}`);
    console.log(`  Min Collateral Ratio: ${existing.minCollateralRatio.toString()}`);
    console.log(`  Hedge Interval Seconds: ${existing.hedgeIntervalSeconds.toString()}`);
    console.log(`  Approved Collaterals: ${existing.approvedCollaterals.length}`);
    console.log("\n✅ Config is ready. Agent can now submit transactions.\n");
    return;
  } catch (err) {
    console.log("Config not initialized yet. Proceeding...\n");
  }

  // Create AEGIS mint (actual SPL token)
  console.log("Creating AEGIS SPL token mint...");
  
  // Get payer keypair
  const payer = (provider.wallet as anchor.Wallet).payer;
  
  const aegisMint = await createMint(
    provider.connection,
    payer,
    admin,
    null,
    9 // 9 decimals
  );
  console.log(`✓ AEGIS Mint created: ${aegisMint.toBase58()}\n`);

  // Initialize fresh config
  const testCollateral = Keypair.generate().publicKey;
  const testOracle = Keypair.generate().publicKey;

  const minRatio = new anchor.BN(150_000_000); // 150%
  const hedgeInterval = new anchor.BN(3600); // 1 hour

  console.log("Configuration:");
  console.log(`  Min Collateral Ratio: ${minRatio.toString()} (150%)`);
  console.log(`  Hedge Interval: ${hedgeInterval.toString()}s (1 hour)`);
  console.log(`  Approved Collaterals: 1`);
  console.log(`  Oracle Accounts: 1`);
  console.log(`  AEGIS Mint: ${aegisMint.toBase58()}\n`);

  try {
    const tx = await program.methods
      .initializeConfig(
        minRatio,
        hedgeInterval,
        [testCollateral],
        [testOracle]
      )
      .accounts({
        aegisMint: aegisMint,
      })
      .rpc();

    console.log("✅ Config initialized successfully!");
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // Verify
    const config = await program.account.globalConfig.fetch(configPDA);
    console.log("✓ Verified config structure:");
    console.log(`  Admin: ${config.admin.toBase58()}`);
    console.log(`  Min Collateral Ratio: ${config.minCollateralRatio.toString()}`);
    console.log(`  Hedge Interval Seconds: ${config.hedgeIntervalSeconds.toString()}`);
    console.log(`  Approved Collaterals: ${config.approvedCollaterals.length}`);
    console.log(`  Oracle Accounts: ${config.oracleAccounts.length}\n`);

    console.log("🎉 Ready! You can now run the Python agent.\n");
    console.log("Run: cd ../offchain/agents && source env/bin/activate && python agent.py\n");

  } catch (err) {
    console.error("❌ Error:", err);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
