"use client";

import React, { useState, useEffect } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { mintZypher } from '@/lib/solana';
import toast from 'react-hot-toast';

/**
 * Pyth Oracle Asset IDs for different collateral types
 */
const PYTH_ASSET_IDS = [
  process.env.NEXT_PUBLIC_PYTH_GOLD_ID || '',
  process.env.NEXT_PUBLIC_PYTH_TREASURY_ID || '',
  process.env.NEXT_PUBLIC_PYTH_REALESTATE_ID || '',
  process.env.NEXT_PUBLIC_PYTH_COMMODITY_ID || '',
  process.env.NEXT_PUBLIC_PYTH_EQUITY_ID || ''
];

/**
 * Collateral type definitions
 */
const COLLATERAL_TYPES = [
  { name: "Gold RWA", symbol: "GOLD", decimals: 9 },
  { name: "Treasury Bonds", symbol: "TBOND", decimals: 9 },
  { name: "Real Estate", symbol: "REALT", decimals: 9 },
  { name: "Commodities", symbol: "CMDTY", decimals: 9 },
  { name: "Equity Tokens", symbol: "EQUITY", decimals: 9 }
];

interface MintFormProps {
  onCollateralChange?: (index: number) => void;
}

/**
 * MintForm Component
 * Form for minting $ZYP stablecoin with RWA collateral
 */
export default function MintForm({ onCollateralChange }: MintFormProps) {
  const wallet = useWallet();
  const { connected, publicKey } = wallet;
  
  // Form state
  const [collateralIndex, setCollateralIndex] = useState<number>(0);
  const [depositAmount, setDepositAmount] = useState<string>('');
  const [mintAmount, setMintAmount] = useState<number>(0);
  const [oraclePrice, setOraclePrice] = useState<number>(0);
  const [isMinting, setIsMinting] = useState<boolean>(false);
  const [isFetchingPrice, setIsFetchingPrice] = useState<boolean>(false);

  /**
   * Fetch oracle price from Pyth Network
   */
  const fetchOraclePrice = async (assetId: string) => {
    if (!assetId) {
      console.warn("No asset ID provided, using fallback price");
      return 1000; // Fallback price for testing
    }

    try {
      setIsFetchingPrice(true);
      const response = await fetch(
        `https://hermes.pyth.network/v2/updates/price/latest?ids%5B%5D=${assetId}`
      );
      
      if (!response.ok) {
        throw new Error("Failed to fetch price from oracle");
      }

      const data = await response.json();
      const priceData = data.parsed[0].price;
      const price = parseFloat(priceData.price) / Math.pow(10, Math.abs(priceData.expo));
      
      return price;
    } catch (error) {
      console.error("Oracle price fetch error:", error);
      toast.error("Failed to fetch price from oracle, using fallback");
      return 1000; // Fallback price
    } finally {
      setIsFetchingPrice(false);
    }
  };

  /**
   * Calculate mint amount based on deposit and oracle price
   * Uses 150% collateralization ratio
   */
  useEffect(() => {
    const calculateMintAmount = async () => {
      const deposit = parseFloat(depositAmount);
      
      if (!deposit || deposit <= 0) {
        setMintAmount(0);
        return;
      }

      // Fetch current price
      const price = await fetchOraclePrice(PYTH_ASSET_IDS[collateralIndex]);
      setOraclePrice(price);

      // Calculate mint amount with 150% collateralization ratio
      // mintAmount = (depositAmount * price) / 1.5
      const calculatedMint = (deposit * price) / 1.5;
      setMintAmount(calculatedMint);
    };

    calculateMintAmount();
  }, [depositAmount, collateralIndex]);

  /**
   * Handle collateral type change
   */
  const handleCollateralChange = (index: number) => {
    setCollateralIndex(index);
    if (onCollateralChange) {
      onCollateralChange(index);
    }
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate wallet connection
    if (!connected || !publicKey) {
      toast.error("Please connect your wallet first");
      return;
    }

    // Validate inputs
    const deposit = parseFloat(depositAmount);
    if (!deposit || deposit <= 0) {
      toast.error("Please enter a valid deposit amount");
      return;
    }

    if (mintAmount <= 0) {
      toast.error("Mint amount must be greater than 0");
      return;
    }

    // Validate collateral ratio
    if (deposit * oraclePrice < mintAmount * 1.5) {
      toast.error("Insufficient collateral for this mint amount");
      return;
    }

    setIsMinting(true);

    try {
      // Convert to smallest units (6 decimals for both collateral and Zypher)
      const depositLamports = BigInt(Math.floor(deposit * 1e6));
      const mintLamports = BigInt(Math.floor(mintAmount * 1e6));

      // Call mint function
      const signature = await mintZypher(
        {
          collateralIndex,
          depositAmount: depositLamports,
          mintAmount: mintLamports
        },
        wallet
      );

      // Show success message
      toast.success(
        <div>
          <p className="font-bold">Successfully minted $ZYP!</p>
          <p className="text-sm mt-1">Amount: {mintAmount.toFixed(2)} ZYP</p>
          <p className="text-xs text-text-secondary mt-1">Signature: {signature.slice(0, 8)}...</p>
        </div>,
        { duration: 5000 }
      );

      // Reset form
      setDepositAmount('');
      setMintAmount(0);

    } catch (error) {
      console.error("Mint error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to mint $ZYP";
      toast.error(errorMessage);
    } finally {
      setIsMinting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-surface/50 rounded-lg p-6 space-y-4">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold text-text-primary mb-2">
            Mint $ZYP Stablecoin
          </h2>
          <p className="text-sm text-text-secondary">
            Deposit RWA collateral to mint privacy-preserving stablecoins
          </p>
        </div>

        {/* Collateral Type Selection */}
        <div>
          <label htmlFor="collateral-type" className="block text-sm font-medium text-text-primary mb-2">
            Collateral Type
          </label>
          <select
            id="collateral-type"
            value={collateralIndex}
            onChange={(e) => handleCollateralChange(Number(e.target.value))}
            className="w-full p-3 border border-text-secondary/30 rounded-lg bg-surface text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            disabled={isMinting}
          >
            {COLLATERAL_TYPES.map((type, index) => (
              <option key={index} value={index}>
                {type.name} ({type.symbol})
              </option>
            ))}
          </select>
        </div>

        {/* Deposit Amount */}
        <div>
          <label htmlFor="deposit-amount" className="block text-sm font-medium text-text-primary mb-2">
            Deposit Amount
          </label>
          <div className="relative">
            <input
              id="deposit-amount"
              type="number"
              min="0"
              step="0.01"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              placeholder="0.00"
              className="w-full p-3 border border-text-secondary/30 rounded-lg bg-surface text-text-primary focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              disabled={isMinting}
              required
            />
            <span className="absolute right-3 top-3 text-text-secondary font-medium">
              {COLLATERAL_TYPES[collateralIndex].symbol}
            </span>
          </div>
          {oraclePrice > 0 && (
            <p className="text-xs text-text-secondary mt-1">
              Current price: ${oraclePrice.toFixed(2)} USD
            </p>
          )}
        </div>

        {/* Oracle Price Info */}
        {isFetchingPrice && (
          <div className="flex items-center space-x-2 text-sm text-text-secondary">
            <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
            <span>Fetching oracle price...</span>
          </div>
        )}

        {/* Mint Amount (Read-only) */}
        <div>
          <label htmlFor="mint-amount" className="block text-sm font-medium text-text-primary mb-2">
            You Will Receive
          </label>
          <div className="relative">
            <input
              id="mint-amount"
              type="number"
              value={mintAmount.toFixed(2)}
              readOnly
              className="w-full p-3 border border-text-secondary/30 rounded-lg bg-surface/50 text-text-primary cursor-not-allowed"
            />
            <span className="absolute right-3 top-3 text-primary font-bold font-numeric">
              $ZYP
            </span>
          </div>
          <p className="text-xs text-text-secondary mt-1">
            Collateralization Ratio: 150% (overcollateralized)
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={
            isMinting ||
            !connected ||
            !depositAmount ||
            parseFloat(depositAmount) <= 0 ||
            mintAmount <= 0
          }
          className="w-full bg-gradient-to-r from-primary to-secondary text-background font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-glow-primary hover:scale-[1.02] active:scale-[0.98]"
        >
          {isMinting ? (
            <span className="flex items-center justify-center space-x-2">
              <div className="animate-spin h-5 w-5 border-2 border-background border-t-transparent rounded-full" />
              <span>Minting...</span>
            </span>
          ) : (
            `Mint $ZYP`
          )}
        </button>

        {/* Info Box */}
        <div className="mt-4 p-4 bg-primary/10 border border-primary/30 rounded-lg">
          <p className="text-sm text-text-primary">
            <span className="font-semibold">🔒 Privacy Guaranteed:</span> All minting operations use zero-knowledge proofs to ensure your transaction details remain private.
          </p>
        </div>
      </div>
    </form>
  );
}
