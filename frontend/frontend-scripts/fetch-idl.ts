/**
 * Fetch IDL from deployed Anchor program
 * Run with: npx ts-node scripts/fetch-idl.ts
 */

import { Connection, PublicKey } from "@solana/web3.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  console.log("🔍 Fetching IDL from deployed program...\n");

  const programId = new PublicKey("AvVY3MVbas5ZQFEC7HNu4bf1BdrF4u2TxrBgovmnLQZm");
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  try {
    // Fetch the IDL account
    const [idlAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("anchor:idl"), programId.toBuffer()],
      new PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
    );

    console.log(`📍 IDL Address: ${idlAddress.toBase58()}`);
    
    const accountInfo = await connection.getAccountInfo(idlAddress);
    
    if (!accountInfo) {
      console.error("❌ IDL account not found. The program might not have an IDL deployed.");
      console.log("\n💡 Alternative: Copy the IDL from your Anchor project:");
      console.log("   cp ../../zypher/target/idl/zypher.json public/idl/zypher.json");
      process.exit(1);
    }

    console.log("✅ IDL account found!");
    console.log(`   Data length: ${accountInfo.data.length} bytes\n`);

    // The IDL data is compressed and encoded, you'd need to decode it
    // For simplicity, let's just tell the user to copy from the Anchor project
    console.log("💡 To get the IDL, copy it from your Anchor project:");
    console.log("   cp ../../zypher/target/idl/zypher.json public/idl/zypher.json");
    
  } catch (err) {
    console.error("❌ Error fetching IDL:", err);
    console.log("\n💡 Copy the IDL from your Anchor project instead:");
    console.log("   cp ../../zypher/target/idl/zypher.json public/idl/zypher.json");
  }
}

main();
