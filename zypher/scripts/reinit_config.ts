/**
 * Script to close old config account and reinitialize with new structure
 * USE ONLY ON DEVNET - This will reset all configuration
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { AegisProtocol } from "../target/types/aegis_protocol";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import * as fs from "fs";

async function main() {
  // Setup provider
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.AegisProtocol as Program<AegisProtocol>;
  const admin = provider.wallet.publicKey;

  console.log("🔧 Reinitializing Config Account with New Structure");
  console.log("⚠️  WARNING: This will close and recreate the config account!");
  console.log(`Program ID: ${program.programId.toBase58()}`);
  console.log(`Admin: ${admin.toBase58()}\n`);

  // Derive config PDA
  const [configPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    program.programId
  );

  console.log(`Config PDA: ${configPDA.toBase58()}`);

  // Step 1: Check if config account exists
  try {
    const configAccount = await program.account.globalConfig.fetch(configPDA);
    console.log("✓ Old config account found");
    console.log(`  Admin: ${configAccount.admin.toBase58()}`);
    console.log(`  Min Collateral Ratio: ${configAccount.minCollateralRatio.toString()}`);
    console.log(`  Approved Collaterals: ${configAccount.approvedCollaterals.length}`);
    console.log(`  Oracle Accounts: ${configAccount.oracleAccounts.length}`);
    console.log(`  AEGIS Mint: ${configAccount.aegisMint.toBase58()}\n`);

    // Step 2: Close old account (recover rent)
    console.log("🗑️  Closing old config account...");
    
    // We need to close the account manually since there's no close instruction
    // The only way is to transfer ownership or let it be overwritten by a new init
    // Anchor's init will fail if account exists, so we need to use anchor deploy --force
    
    console.log("⚠️  Cannot close account directly. Options:");
    console.log("   1. Use 'anchor deploy --program-id <keypair> --provider.cluster devnet'");
    console.log("   2. Or manually close using solana CLI:");
    console.log(`      solana program close ${configPDA.toBase58()} --url devnet\n`);
    
    console.log("❌ Old config account exists. Please close it first using one of the above methods.");
    console.log("   Then run this script again to reinitialize.\n");
    
  } catch (err) {
    if (err.message.includes("Account does not exist")) {
      console.log("✓ No existing config account found. Proceeding with initialization...\n");
      
      // Step 3: Initialize with new structure
      await initializeNewConfig(program, admin);
    } else {
      console.error("❌ Error checking config account:", err);
      throw err;
    }
  }
}

async function initializeNewConfig(
  program: Program<AegisProtocol>,
  admin: PublicKey
) {
  console.log("🚀 Initializing new config with hedge_interval_seconds field...");

  // Create a dummy AEGIS mint for testing (or reuse existing)
  // For now, we'll create a new one
  const aegisMintKeypair = Keypair.generate();
  
  // Test parameters
  const minCollateralRatio = new anchor.BN(150_000_000); // 150%
  const hedgeInterval = new anchor.BN(3600); // 1 hour default
  
  // Dummy collaterals and oracles for testing
  const testCollateral = Keypair.generate().publicKey;
  const testOracle = Keypair.generate().publicKey;
  
  const approvedCollaterals = [testCollateral];
  const oracleAccounts = [testOracle];

  console.log("\nConfiguration:");
  console.log(`  Min Collateral Ratio: ${minCollateralRatio.toString()} (150%)`);
  console.log(`  Hedge Interval: ${hedgeInterval.toString()}s (1 hour)`);
  console.log(`  Approved Collaterals: ${approvedCollaterals.length}`);
  console.log(`  Oracle Accounts: ${oracleAccounts.length}`);
  console.log(`  AEGIS Mint: ${aegisMintKeypair.publicKey.toBase58()}\n`);

  try {
    // Note: We need to create the mint first
    // For simplicity, we'll use a dummy mint
    // In production, this should be the actual AEGIS token mint
    
    const [configPDA] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );

    console.log("📝 Submitting initialize_config transaction...");
    
    const tx = await program.methods
      .initializeConfig(
        minCollateralRatio,
        hedgeInterval,
        approvedCollaterals,
        oracleAccounts
      )
      .accounts({
        config: configPDA,
        admin: admin,
        aegisMint: aegisMintKeypair.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("✅ Config initialized successfully!");
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // Verify new config
    const newConfig = await program.account.globalConfig.fetch(configPDA);
    console.log("✓ Verified new config structure:");
    console.log(`  Admin: ${newConfig.admin.toBase58()}`);
    console.log(`  Min Collateral Ratio: ${newConfig.minCollateralRatio.toString()}`);
    console.log(`  Hedge Interval Seconds: ${newConfig.hedgeIntervalSeconds.toString()}`); // NEW FIELD
    console.log(`  Approved Collaterals: ${newConfig.approvedCollaterals.length}`);
    console.log(`  Oracle Accounts: ${newConfig.oracleAccounts.length}`);
    console.log(`  AEGIS Mint: ${newConfig.aegisMint.toBase58()}\n`);

    console.log("🎉 Reinitialization complete!\n");

  } catch (err) {
    console.error("❌ Error during initialization:", err);
    throw err;
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
