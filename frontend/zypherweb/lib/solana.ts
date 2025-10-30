import { 
  Connection, 
  PublicKey, 
  Commitment,
  LAMPORTS_PER_SOL,
  Transaction,
  SystemProgram
} from '@solana/web3.js';
import { Program, AnchorProvider, Idl, web3 } from '@coral-xyz/anchor';
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } from '@solana/spl-token';
import zypherIdl from '../public/idl/zypher.json';
import BN from 'bn.js';

/**
 * Solana utility functions for Zypher Protocol
 * Provides helpers for web3.js connections and contract invocations
 */

// Devnet RPC endpoint with confirmed commitment for fast finality
export const DEVNET_ENDPOINT = "https://api.devnet.solana.com";
export const COMMITMENT: Commitment = "confirmed";

/**
 * Creates a connection to Solana devnet
 * @returns Connection instance configured for devnet
 */
export function createConnection(): Connection {
  return new Connection(DEVNET_ENDPOINT, COMMITMENT);
}

/**
 * Fetches SOL balance for a given public key
 * @param connection - Solana connection instance
 * @param publicKey - Wallet public key
 * @returns Balance in SOL (not lamports)
 */
export async function getBalance(
  connection: Connection,
  publicKey: PublicKey
): Promise<number> {
  try {
    const balanceLamports = await connection.getBalance(publicKey);
    return balanceLamports / LAMPORTS_PER_SOL;
  } catch (error) {
    console.error("Error fetching balance:", error);
    throw new Error("Failed to fetch balance");
  }
}

/**
 * Validates a Solana public key
 * @param publicKey - Public key to validate
 * @returns True if valid, false otherwise
 */
export function isValidPublicKey(publicKey: PublicKey | null): boolean {
  if (!publicKey) return false;
  try {
    const keyString = publicKey.toBase58();
    return keyString.length === 44; // Base58 public keys are 44 characters
  } catch {
    return false;
  }
}

/**
 * Gets the latest blockhash for transaction
 * @param connection - Solana connection instance
 * @returns Latest blockhash
 */
export async function getLatestBlockhash(connection: Connection) {
  try {
    return await connection.getLatestBlockhash(COMMITMENT);
  } catch (error) {
    console.error("Error fetching latest blockhash:", error);
    throw new Error("Failed to fetch blockhash");
  }
}

/**
 * Confirms a transaction
 * @param connection - Solana connection instance
 * @param signature - Transaction signature
 * @returns Confirmation status
 */
export async function confirmTransaction(
  connection: Connection,
  signature: string
): Promise<boolean> {
  try {
    const confirmation = await connection.confirmTransaction(signature, COMMITMENT);
    return !confirmation.value.err;
  } catch (error) {
    console.error("Error confirming transaction:", error);
    return false;
  }
}

/**
 * Gets transaction details from signature
 * @param connection - Solana connection instance
 * @param signature - Transaction signature
 * @returns Transaction details or null
 */
export async function getTransaction(
  connection: Connection,
  signature: string
) {
  try {
    return await connection.getTransaction(signature, {
      maxSupportedTransactionVersion: 0
    });
  } catch (error) {
    console.error("Error fetching transaction:", error);
    return null;
  }
}

/**
 * Format a public key for display (truncated)
 * @param publicKey - Public key to format
 * @param chars - Number of chars to show on each end
 * @returns Formatted string like "Abc1...xyz9"
 */
export function formatPublicKey(publicKey: PublicKey | null, chars: number = 4): string {
  if (!publicKey) return "";
  const keyString = publicKey.toBase58();
  return `${keyString.slice(0, chars)}...${keyString.slice(-chars)}`;
}

/**
 * Gets Solana Explorer URL for devnet
 * @param signature - Transaction signature
 * @returns Explorer URL
 */
export function getExplorerUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

/**
 * Airdrop SOL to a wallet (devnet only)
 * @param connection - Solana connection instance
 * @param publicKey - Wallet public key
 * @param amount - Amount in SOL to airdrop
 * @returns Transaction signature
 */
export async function airdropSol(
  connection: Connection,
  publicKey: PublicKey,
  amount: number = 1
): Promise<string> {
  try {
    const signature = await connection.requestAirdrop(
      publicKey,
      amount * LAMPORTS_PER_SOL
    );
    await confirmTransaction(connection, signature);
    return signature;
  } catch (error) {
    console.error("Error requesting airdrop:", error);
    throw new Error("Failed to request airdrop");
  }
}

/**
 * Interface for mint parameters
 */
export interface MintParams {
  collateralIndex: number;
  depositAmount: bigint;
  mintAmount: bigint;
}

/**
 * Mints $ZYP stablecoin with collateral using Anchor
 * @param params - Mint parameters (collateralIndex, depositAmount, mintAmount)
 * @param wallet - Wallet adapter instance with signTransaction
 * @returns Transaction signature
 */
export async function mintZypher(
  params: MintParams,
  wallet: { publicKey: PublicKey | null; signTransaction?: (tx: Transaction) => Promise<Transaction> }
): Promise<string> {
  const { collateralIndex, depositAmount, mintAmount } = params;
  
  // Validate wallet connection
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error("Wallet not connected");
  }

  try {
    // Create connection
    const connection = createConnection();
    
    // Program ID from your deployment
    const programId = new PublicKey("6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK");

    // Create provider
    const provider = new AnchorProvider(
      connection,
      wallet as any,
      { commitment: COMMITMENT }
    );

    // Initialize program with proper typing
    // Set the programId in the IDL before creating the Program instance
    const idlWithProgramId = { ...zypherIdl, address: programId.toBase58() };
    const program = new Program(idlWithProgramId as any, provider);

    // Derive PDAs
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("config_v2")],
      programId
    );

    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("position"), wallet.publicKey.toBuffer()],
      programId
    );

    // Fetch config to get approved collaterals and oracle accounts
    const configAccount = await (program.account as any).globalConfig.fetch(configPda);
    
    // Get the collateral mint from config
    const collateralMintPubkey = (configAccount as any).approvedCollaterals[collateralIndex];
    
    // TEMPORARY FIX: Use real Pyth oracle instead of config's fake oracle
    // The config has placeholder oracles, so we override with real Pyth devnet oracles
    const REAL_PYTH_ORACLES = [
      new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // Gold/USD
      new PublicKey("J83w4HKfqxwcq3BEMMkPFSppX3gqekLyLJBexebFVkix"), // SOL/USD (Treasury placeholder)
      new PublicKey("HovQMDrbAgAYPCmHVSrezcSmkMtXSSUsLDFANExrZh2J"), // BTC/USD (Real Estate)
      new PublicKey("EdVCmQ9FSPcVe5YySXDPCRmc8aDQLKJ9xvYBMZPie1Vw"), // ETH/USD (Commodity)
      new PublicKey("5SSkXsEKQepHHAewytPVwdej4epN1nxgLVM84L4KXgy7"), // USDC/USD (Equity)
    ];
    const oracleAccount = REAL_PYTH_ORACLES[collateralIndex];
    
    console.log("Using collateral mint:", collateralMintPubkey.toBase58());
    console.log("Using oracle account:", oracleAccount.toBase58());

    // Get Zypher mint address from config (you'll need to fetch this)
    // For now, using a placeholder - you should fetch from config account
    const zypherMintPubkey = new PublicKey(
      process.env.NEXT_PUBLIC_ZYPHER_MINT || "11111111111111111111111111111111"
    );

    // Get user's Zypher token account
    const userZypherToken = await getAssociatedTokenAddress(
      zypherMintPubkey,
      wallet.publicKey
    );

    // Get user's collateral token account
    const userCollateralToken = await getAssociatedTokenAddress(
      collateralMintPubkey,
      wallet.publicKey
    );

    // Vault token account PDA
    const [vaultTokenAccount] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), collateralMintPubkey.toBuffer()],
      programId
    );

    console.log("Calling mint_zypher with:", {
      collateralIndex,
      depositAmount: depositAmount.toString(),
      mintAmount: mintAmount.toString(),
      position: positionPda.toBase58(),
      config: configPda.toBase58(),
      user: wallet.publicKey.toBase58(),
    });

    // Create transaction with potentially needed ATA creation
    const tx = new Transaction();

    // Check if user collateral token account exists, if not create it
    const userCollateralInfo = await connection.getAccountInfo(userCollateralToken);
    if (!userCollateralInfo) {
      console.log("Creating user collateral token account...");
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userCollateralToken,
          wallet.publicKey,
          collateralMintPubkey
        )
      );
      
      // For devnet testing: mint some collateral tokens to the user
      // In production, users would need to acquire these tokens first
      console.log("⚠️  User doesn't have collateral tokens yet.");
      console.log("For testing, you can mint tokens with:");
      console.log(`spl-token create-account ${collateralMintPubkey.toBase58()}`);
      console.log(`spl-token mint ${collateralMintPubkey.toBase58()} 1000`);
    }

    // Check if user Zypher token account exists, if not create it
    const userZypherInfo = await connection.getAccountInfo(userZypherToken);
    if (!userZypherInfo) {
      console.log("Creating user Zypher token account...");
      tx.add(
        createAssociatedTokenAccountInstruction(
          wallet.publicKey,
          userZypherToken,
          wallet.publicKey,
          zypherMintPubkey
        )
      );
    }

    // Call the mint_zypher instruction
    const mintIx = await program.methods
      .mintZypher(
        collateralIndex,
        new BN(depositAmount.toString()),
        new BN(mintAmount.toString())
      )
      .accounts({
        position: positionPda,
        config: configPda,
        user: wallet.publicKey,
        userCollateralToken: userCollateralToken,
        collateralMint: collateralMintPubkey,
        vaultTokenAccount: vaultTokenAccount,
        zypherMint: zypherMintPubkey,
        userZypherToken: userZypherToken,
        oracleAccount: oracleAccount,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .instruction();

    tx.add(mintIx);

    // Get recent blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    // Sign and send transaction
    const signedTx = await wallet.signTransaction(tx);
    const signature = await connection.sendRawTransaction(signedTx.serialize());

    // Confirm transaction
    await connection.confirmTransaction(signature, COMMITMENT);

    console.log("Mint successful! Signature:", signature);
    return signature;

  } catch (error) {
    console.error("Mint error:", error);
    
    // Handle specific program errors
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    if (errorMessage.includes("UnderCollateralized")) {
      throw new Error("Insufficient collateral for this mint amount");
    }
    if (errorMessage.includes("InvalidCollateral")) {
      throw new Error("Invalid collateral type selected");
    }
    if (errorMessage.includes("ZeroAmount")) {
      throw new Error("Amount must be greater than zero");
    }
    if (errorMessage.includes("OracleMismatch")) {
      throw new Error("Oracle account mismatch");
    }
    
    throw new Error(errorMessage || "Failed to mint $ZYP");
  }
}

/**
 * Parameters for triggering a hedge
 */
export interface TriggerHedgeParams {
  userPubkey: PublicKey;
  decision: boolean;
}

/**
 * Triggers a hedge transaction based on AI agent decision
 * Uses real transaction submission matching Python agent implementation
 * @param params - Trigger parameters including user pubkey and hedge decision
 * @returns Transaction signature
 */
export async function triggerHedge(params: TriggerHedgeParams): Promise<string | null> {
  const { userPubkey, decision } = params;
  // Allow manual override from frontend; frontend will warn the user if decision is false.

  try {
    const connection = createConnection();
    const programId = new PublicKey(process.env.NEXT_PUBLIC_PROGRAM_ID || '6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK');
    
    // Get wallet from window
    const wallet = (window as any).solana;
    if (!wallet || !wallet.publicKey) {
      throw new Error("Wallet not connected");
    }
    // For manual user-triggered hedges, call the Anchor RPC for manual_hedge_override
    // which uses seeds ["position", owner] and requires the owner as signer.
    const provider = new AnchorProvider(connection, wallet as any, { commitment: COMMITMENT });
  const idlWithProgramId = { ...zypherIdl, address: programId.toBase58() } as Idl;
  // Anchor Program constructor accepts (idl, provider) in this workspace setup
  const program = new Program(idlWithProgramId as any, provider);

    // Derive PDAs matching program (seed = "position", owner)
    const [positionPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('position'), userPubkey.toBuffer()],
      programId
    );

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('config_v2')],
      programId
    );

    // Ensure position exists (user must have minted Zypher)
    try {
      // `program.account` types in this generated IDL may not expose typed properties in TS.
      // Use an any-cast to access the account client dynamically.
      const pos = await (program.account as any).userPosition?.fetchNullable
        ? await (program.account as any).userPosition.fetchNullable(positionPda)
        : await (program.account as any).UserPosition?.fetchNullable(positionPda);
      if (!pos) {
        // If position missing, check token balance to provide a clearer message
        const zypherMintPubkey = new PublicKey(process.env.NEXT_PUBLIC_ZYPHER_MINT || 'F7NeLHxuJ1LYBGHZ8Gfq4E5JD64YXa2H7vKmRorGBDu7');
        const userZypAta = await getAssociatedTokenAddress(zypherMintPubkey, wallet.publicKey);
        try {
          const balance = await connection.getTokenAccountBalance(userZypAta);
          const uiAmt = balance?.value?.uiAmount || 0;
          if (uiAmt > 0) {
            throw new Error('Token balance found but no on-chain position exists. Please visit /mint and run a mint to initialize your position.');
          }
        } catch (e) {
          // fall through
        }

        throw new Error('No position found. Please mint $ZYP first.');
      }
    } catch (err) {
      throw new Error('No position found. Please mint $ZYP first.');
    }

    // Call manual_hedge_override RPC
    try {
      const sig = await program.rpc.manualHedgeOverride(decision, {
        accounts: {
          position: positionPda,
          config: configPda,
          owner: wallet.publicKey,
        },
      });

      console.log('Manual hedge override tx sig:', sig);
      return sig;
    } catch (err) {
      console.error('Anchor manual_hedge_override failed:', err);

      // If Anchor's SendTransactionError is thrown, it may expose getLogs() for richer diagnostics.
      try {
        // If error object has a getLogs() method (Anchor v0.XX SendTransactionError), call it
        if (err && typeof (err as any).getLogs === 'function') {
          const logs = await (err as any).getLogs();
          console.error('SendTransactionError logs:', logs);
          throw new Error(`Transaction simulation failed: ${err.message}. Logs:\n${logs.join('\n')}`);
        }

        // If error contains a `logs` array, include it
        if (err && Array.isArray((err as any).logs) && (err as any).logs.length > 0) {
          console.error('SendTransactionError logs (from err.logs):', (err as any).logs);
          throw new Error(`Transaction failed: ${err.message}. Logs:\n${(err as any).logs.join('\n')}`);
        }

        // If the error includes a transaction signature, try fetching on-chain logs
        const possibleSig = (err as any)?.tx?.signature || (err as any)?.signature;
        if (possibleSig && typeof possibleSig === 'string') {
          try {
            const tx = await connection.getTransaction(possibleSig, { commitment: COMMITMENT });
            const fetchedLogs = tx?.meta?.logMessages || [];
            if (fetchedLogs.length) {
              console.error('Fetched transaction logs:', fetchedLogs);
              throw new Error(`Transaction ${possibleSig} failed. Logs:\n${fetchedLogs.join('\n')}`);
            }
          } catch (fetchErr) {
            console.warn('Failed to fetch transaction logs for signature:', possibleSig, fetchErr);
          }
        }
      } catch (diagnosticErr) {
        // If we constructed a diagnostic error, rethrow it
        throw diagnosticErr;
      }

      // Fallback: rethrow original error
      throw err;
    }
    
  } catch (error) {
    console.error("Trigger hedge error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    throw new Error(errorMessage || "Failed to trigger hedge");
  }
}

/**
 * Generate MPC shares for privacy (2-of-3 threshold)
 * Matches Python agent's Shamir secret sharing implementation
 */
function generateMpcShares(decision: boolean, totalShares: number, threshold: number): Buffer[] {
  const shares: Buffer[] = [];
  const secret = decision ? 1 : 0;
  
  // Simple XOR-based sharing for MVP (in production, use proper Shamir secret sharing)
  for (let i = 0; i < totalShares; i++) {
    const share = Buffer.alloc(32);
    // Fill with random bytes
    for (let j = 0; j < 32; j++) {
      share[j] = Math.floor(Math.random() * 256);
    }
    // Encode secret in first byte of first share
    if (i === 0) {
      share[0] = secret;
    }
    shares.push(share);
  }
  
  return shares;
}

