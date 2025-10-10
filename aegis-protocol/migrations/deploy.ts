const anchor = require("@coral-xyz/anchor");
const { PublicKey, SystemProgram } = require("@solana/web3.js");
const { TOKEN_PROGRAM_ID, createMint } = require("@solana/spl-token");

module.exports = async function (provider) {
  anchor.setProvider(provider);
  
  const program = anchor.workspace.AegisProtocol;
  const wallet = provider.wallet;

  console.log("🚀 Starting Aegis Protocol deployment...");
  console.log("📍 Cluster:", provider.connection.rpcEndpoint);
  console.log("👛 Wallet:", wallet.publicKey.toString());
  console.log("📦 Program ID:", program.programId.toString());

  try {
    // Step 1: Create AEGIS mint
    console.log("\n📝 Step 1: Creating AEGIS stablecoin mint...");
    const aegisMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      9, // 9 decimals for USD precision
    );
    console.log("✅ AEGIS Mint:", aegisMint.toString());

    // Step 2: Set up mock RWA collateral mint (for testing)
    console.log("\n📝 Step 2: Creating mock RWA collateral mint...");
    const collateralMint = await createMint(
      provider.connection,
      wallet.payer,
      wallet.publicKey,
      null,
      9,
    );
    console.log("✅ Collateral Mint:", collateralMint.toString());

    // Step 3: Derive config PDA
    console.log("\n📝 Step 3: Deriving config PDA...");
    const [configPda, configBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId
    );
    console.log("✅ Config PDA:", configPda.toString());
    console.log("   Bump:", configBump);

    // Step 4: Prepare oracle accounts
    console.log("\n📝 Step 4: Setting up oracle accounts...");
    // For devnet, use Pyth SOL/USD oracle as placeholder
    // Replace with actual RWA oracle addresses in production
    const pythSolUsdOracle = new PublicKey(
      "J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix" // Devnet SOL/USD
    );
    const oracleAccounts = [pythSolUsdOracle];
    console.log("✅ Oracle Accounts:", oracleAccounts.map(o => o.toString()));

    // Step 5: Initialize protocol config
    console.log("\n📝 Step 5: Initializing protocol configuration...");
    const minRatio = new anchor.BN(150_000_000); // 150%
    const approvedCollaterals = [collateralMint];

    try {
      const tx = await program.methods
        .initializeConfig(minRatio, approvedCollaterals, oracleAccounts)
        .accounts({
          config: configPda,
          admin: wallet.publicKey,
          aegisMint: aegisMint,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      console.log("✅ Config initialized!");
      console.log("   Transaction:", tx);

      // Fetch and display config
      const config = await program.account.globalConfig.fetch(configPda);
      console.log("\n📊 Protocol Configuration:");
      console.log("   Admin:", config.admin.toString());
      console.log("   Min Ratio:", config.minCollateralRatio.toString(), "(150%)");
      console.log("   AEGIS Mint:", config.aegisMint.toString());
      console.log("   Approved Collaterals:", config.approvedCollaterals.length);
      console.log("   Oracle Accounts:", config.oracleAccounts.length);

    } catch (err) {
      if (err.toString().includes("already in use")) {
        console.log("⚠️  Config already initialized");
        const config = await program.account.globalConfig.fetch(configPda);
        console.log("   Existing Admin:", config.admin.toString());
      } else {
        throw err;
      }
    }

    // Step 6: Create vault token accounts
    console.log("\n📝 Step 6: Creating vault token accounts...");
    const { createAccount } = require("@solana/spl-token");
    
    for (let i = 0; i < approvedCollaterals.length; i++) {
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), approvedCollaterals[i].toBuffer()],
        program.programId
      );
      
      try {
        const vault = await createAccount(
          provider.connection,
          wallet.payer,
          approvedCollaterals[i],
          vaultPda,
          undefined
        );
        console.log(`✅ Vault ${i + 1}:`, vault.toString());
      } catch (err) {
        if (err.toString().includes("already in use")) {
          console.log(`⚠️  Vault ${i + 1} already exists:`, vaultPda.toString());
        } else {
          console.log(`⚠️  Could not create vault ${i + 1}:`, err.message);
        }
      }
    }

    // Step 7: Deployment summary
    console.log("\n" + "=".repeat(60));
    console.log("🎉 AEGIS Protocol Deployment Complete!");
    console.log("=".repeat(60));
    console.log("\n📋 Deployment Summary:");
    console.log("   Program ID:", program.programId.toString());
    console.log("   Config PDA:", configPda.toString());
    console.log("   AEGIS Mint:", aegisMint.toString());
    console.log("   Collateral Mint:", collateralMint.toString());
    console.log("   Network:", provider.connection.rpcEndpoint);
    console.log("   Admin:", wallet.publicKey.toString());

    console.log("\n📝 Next Steps:");
    console.log("   1. Fund user wallets with collateral tokens");
    console.log("   2. Users can mint AEGIS via mint_aegis instruction");
    console.log("   3. Create prediction markets for hedging");
    console.log("   4. Monitor positions and trigger liquidations");

    console.log("\n⚠️  Important Notes:");
    console.log("   - This deployment uses mock oracles for testing");
    console.log("   - Replace with actual Pyth RWA oracles for production");
    console.log("   - ZK proof verification is placeholder implementation");
    console.log("   - Complete security audit required before mainnet");

    console.log("\n🔗 Useful Commands:");
    console.log(`   solana program show ${program.programId.toString()}`);
    console.log(`   solana account ${configPda.toString()}`);
    console.log(`   spl-token accounts ${aegisMint.toString()}`);

    // Save deployment info to file
    const fs = require("fs");
    const deploymentInfo = {
      network: provider.connection.rpcEndpoint,
      programId: program.programId.toString(),
      configPda: configPda.toString(),
      aegisMint: aegisMint.toString(),
      collateralMints: approvedCollaterals.map(c => c.toString()),
      oracleAccounts: oracleAccounts.map(o => o.toString()),
      admin: wallet.publicKey.toString(),
      timestamp: new Date().toISOString(),
    };

    fs.writeFileSync(
      "deployment-info.json",
      JSON.stringify(deploymentInfo, null, 2)
    );
    console.log("\n💾 Deployment info saved to deployment-info.json");

  } catch (error) {
    console.error("\n❌ Deployment failed:");
    console.error(error);
    throw error;
  }

  console.log("\n✨ Deployment script finished successfully!");
};