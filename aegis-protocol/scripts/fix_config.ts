/**
 * Close old config account and reinitialize with new structure
 * Run this after deploying the updated program
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AegisProtocol } from "../target/types/aegis_protocol";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AegisProtocol as Program<AegisProtocol>;
  const admin = provider.wallet.publicKey;

  console.log("🔧 Fixing Config Account Deserialization Issue");
  console.log(`Program ID: ${program.programId.toBase58()}`);
  console.log(`Admin: ${admin.toBase58()}\n`);

  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log(`Config PDA: ${configPDA.toBase58()}\n`);

  // Step 1: Try to close old account (get rent back)
  try {
    const accountInfo = await provider.connection.getAccountInfo(configPDA);
    if (accountInfo) {
      console.log("❌ Old config account exists and is blocking initialization");
      console.log(`   Account size: ${accountInfo.data.length} bytes`);
      console.log(`   Rent lamports: ${accountInfo.lamports}\n`);

      console.log("🗑️  Attempting to close old account...");
      
      // Transfer all lamports to admin to close the account
      const ix = SystemProgram.transfer({
        fromPubkey: configPDA,
        toPubkey: admin,
        lamports: accountInfo.lamports,
      });

      try {
        const tx = await provider.sendAndConfirm(new anchor.web3.Transaction().add(ix));
        console.log(`✅ Account closed: ${tx}\n`);
      } catch (err) {
        console.log("❌ Cannot close account directly (PDA protection)");
        console.log("   Solution: The init instruction will fail if account exists.");
        console.log("   Manually close using:\n");
        console.log(`   solana program close ${configPDA.toBase58()} --url devnet\n`);
        console.log("   OR wait for account garbage collection if data is zeroed.\n");
        process.exit(1);
      }
    } else {
      console.log("✓ No existing config account. Ready to initialize.\n");
    }
  } catch (err) {
    console.log("✓ No existing config account found.\n");
  }

  // Step 2: Initialize with new structure
  console.log("🚀 Initializing new config with hedge_interval_seconds...\n");

  const aegisMint = Keypair.generate().publicKey; // Dummy mint for testing
  const testCollateral = Keypair.generate().publicKey;
  const testOracle = Keypair.generate().publicKey;

  const minRatio = new anchor.BN(150_000_000);
  const hedgeInterval = new anchor.BN(3600); // 1 hour

  console.log("Configuration:");
  console.log(`  Min Collateral Ratio: ${minRatio.toString()} (150%)`);
  console.log(`  Hedge Interval: ${hedgeInterval.toString()}s (1 hour)`);
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
    console.log("✓ Verified new config:");
    console.log(`  Admin: ${config.admin.toBase58()}`);
    console.log(`  Min Collateral Ratio: ${config.minCollateralRatio.toString()}`);
    console.log(`  Hedge Interval Seconds: ${config.hedgeIntervalSeconds.toString()}`);
    console.log(`  Approved Collaterals: ${config.approvedCollaterals.length}`);
    console.log(`  Oracle Accounts: ${config.oracleAccounts.length}\n`);

    console.log("🎉 Fix complete! Agent can now submit transactions.\n");

  } catch (err) {
    console.error("❌ Initialization failed:");
    console.error(err);
    console.error("\nIf error is 'account already in use', manually close it first:");
    console.error(`solana program close ${configPDA.toBase58()} --url devnet --keypair ~/.config/solana/id.json\n`);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
