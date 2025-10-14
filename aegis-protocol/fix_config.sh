#!/bin/bash
#
# Quick fix for config account deserialization error
# This script closes the old config account and reinitializes with new structure
#

set -e

echo "🔧 Aegis Protocol - Config Account Fix Script"
echo "=============================================="
echo ""

# Get config PDA address
PROGRAM_ID="3AT5kUMBhHHFkc7Th21Hk3H6JGHLvA6MAJxUwUU7aDJW"
echo "Program ID: $PROGRAM_ID"
echo ""

# The config PDA is deterministic: seeds = [b"config"]
# We need to calculate it or get it from the program
echo "Step 1: Finding config PDA address..."
cd /home/aditya/web3/aegis-protocol/aegis-protocol

# Run node script to get PDA
CONFIG_PDA=$(npx ts-node -e "
import * as anchor from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
const programId = new PublicKey('$PROGRAM_ID');
const [pda] = PublicKey.findProgramAddressSync([Buffer.from('config')], programId);
console.log(pda.toBase58());
")

echo "Config PDA: $CONFIG_PDA"
echo ""

# Step 2: Check if account exists
echo "Step 2: Checking if old config account exists..."
if solana account $CONFIG_PDA --url devnet &> /dev/null; then
    echo "✓ Old config account found"
    echo ""
    
    # Step 3: Close the account
    echo "Step 3: Closing old config account (this may fail if protected)..."
    echo "Running: solana program close $CONFIG_PDA --url devnet"
    
    # Try to close - this might fail for PDA accounts
    if solana program close $CONFIG_PDA --url devnet --keypair ~/.config/solana/id.json; then
        echo "✅ Account closed successfully!"
        echo ""
    else
        echo "⚠️  Direct close failed (expected for PDA). Trying alternative..."
        echo ""
        echo "The account needs to be closed via the program itself."
        echo "Since we don't have a close instruction, we'll use --force on init."
        echo ""
    fi
else
    echo "✓ No old config account found. Ready to initialize."
    echo ""
fi

# Step 4: Reinitialize with new structure
echo "Step 4: Initializing new config with hedge_interval parameter..."
echo "Running: npx ts-node scripts/fix_config.ts"
echo ""

npx ts-node scripts/fix_config.ts

echo ""
echo "✅ Fix complete!"
echo ""
echo "Next steps:"
echo "1. Test the agent: cd ../offchain/agents && python agent.py"
echo "2. If agent works, proceed with testing"
echo ""
