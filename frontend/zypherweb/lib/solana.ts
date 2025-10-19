import { 
  Connection, 
  PublicKey, 
  Commitment,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
// Transaction and TransactionInstruction will be imported when implementing mint functionality

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
 * Interface for mint parameters (to be implemented in mint step)
 */
export interface MintParams {
  collateralIndex: number;
  depositAmount: number;
  mintAmount: number;
}

/**
 * Placeholder for mint function (to be implemented with Anchor IDL)
 * @param params - Mint parameters
 * @returns Transaction signature
 */
export async function mintAegis(params: MintParams): Promise<string> {
  // TODO: Implement with Anchor IDL in mint UI step
  console.log("Mint params:", params);
  throw new Error("Mint function not yet implemented - will be added in mint UI step");
}
