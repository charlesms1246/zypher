/**
 * Read Config Account
 * Run with: npx ts-node scripts/read-config.ts
 */

import { Connection, PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const { Program, AnchorProvider, Wallet } = anchor;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("📖 Reading GlobalConfig account...\n");

  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  
  // Load IDL
  const idlPath = path.join(__dirname, "../public/idl/zypher.json");
  const zypherIdl = JSON.parse(fs.readFileSync(idlPath, "utf-8"));
  
  const programId = new PublicKey("6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK");
  
  // Derive config PDA
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("config_v2")],
    programId
  );
  
  console.log(`Config PDA: ${configPda.toBase58()}\n`);
  
  // Fetch account
  const accountInfo = await connection.getAccountInfo(configPda);
  
  if (!accountInfo) {
    console.log("❌ Config account not found!");
    console.log("Run: npx ts-node scripts/initialize-config.ts");
    return;
  }
  
  console.log("✅ Config account exists");
  console.log(`   Owner: ${accountInfo.owner.toBase58()}`);
  console.log(`   Data length: ${accountInfo.data.length} bytes\n`);
  
  // Create a dummy wallet for the provider
  const dummyKeypair = anchor.web3.Keypair.generate();
  const dummyWallet = new Wallet(dummyKeypair);
  const provider = new AnchorProvider(connection, dummyWallet, {});
  
  const program = new Program(zypherIdl as any, provider);
  
  try {
    const config: any = await (program.account as any).globalConfig.fetch(configPda);
    
    console.log("📋 Config Data:");
    console.log("================");
    console.log(`Admin: ${config.admin.toBase58()}`);
    console.log(`Min Collateral Ratio: ${config.minCollateralRatio.toString()} (${config.minCollateralRatio.toNumber() / 1e8}x)`);
    console.log(`Hedge Interval: ${config.hedgeIntervalSeconds.toString()}s`);
    console.log(`Zypher Mint: ${config.zypherMint.toBase58()}\n`);
    
    console.log("📦 Approved Collaterals:");
    config.approvedCollaterals.forEach((mint: any, i: number) => {
      console.log(`  ${i}: ${mint.toBase58()}`);
    });
    
    console.log("\n🔮 Oracle Accounts:");
    config.oracleAccounts.forEach((oracle: any, i: number) => {
      console.log(`  ${i}: ${oracle.toBase58()}`);
    });
    
  } catch (err) {
    console.error("Error decoding config:", err);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Error:", err);
    process.exit(1);
  });
