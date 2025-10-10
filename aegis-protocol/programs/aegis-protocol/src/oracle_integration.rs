use anchor_lang::prelude::*;
use pyth_sdk_solana::load_price_feed_from_account_info;
use crate::errors::AegisError;

const MAX_ORACLE_STALENESS: u64 = 60; // seconds

/// Fetches and validates the latest Pyth price feed on-chain.
pub fn fetch_oracle_price(
    oracle_account: &AccountInfo,
    current_timestamp: i64,
    expected_oracle_pubkey: Pubkey, // recommended: verify oracle identity
) -> Result<u64> {
    // Ensure the provided account is the correct oracle
    require_keys_eq!(oracle_account.key(), expected_oracle_pubkey, AegisError::InvalidOracle);

    // Load the Pyth price feed from the Solana account info
    let price_feed = load_price_feed_from_account_info(oracle_account)
        .map_err(|_| AegisError::InvalidOracle)?;

    // Retrieve the current price, ensuring it’s fresh
    let price_data = price_feed
        .get_price_no_older_than(current_timestamp, MAX_ORACLE_STALENESS)
        .ok_or(AegisError::StaleOraclePrice)?;

    require!(price_data.price > 0, AegisError::InvalidOracle);

    // Normalize to 8 decimals (e.g. 1.23456789 → 123456789)
    let normalized_price = normalize_to_8_decimals(price_data.price, price_data.expo)?;

    Ok(normalized_price)
}

/// Fetches oracle-derived outcome for prediction settlement.
/// Here we simply check if the price is above 0.
pub fn fetch_oracle_outcome(
    oracle_account: &AccountInfo,
    current_timestamp: i64,
    expected_oracle_pubkey: Pubkey,
) -> Result<bool> {
    require_keys_eq!(oracle_account.key(), expected_oracle_pubkey, AegisError::InvalidOracle);

    let price_feed = load_price_feed_from_account_info(oracle_account)
        .map_err(|_| AegisError::InvalidOracle)?;

    let price_data = price_feed
        .get_price_no_older_than(current_timestamp, MAX_ORACLE_STALENESS)
        .ok_or(AegisError::StaleOraclePrice)?;

    Ok(price_data.price > 0)
}

/// Calculates the time-weighted average price (TWAP) using Pyth’s EMA price feed.
pub fn calculate_twap(
    oracle_account: &AccountInfo,
    current_timestamp: i64,
    expected_oracle_pubkey: Pubkey,
) -> Result<u64> {
    require_keys_eq!(oracle_account.key(), expected_oracle_pubkey, AegisError::InvalidOracle);

    let price_feed = load_price_feed_from_account_info(oracle_account)
        .map_err(|_| AegisError::InvalidOracle)?;

    let ema_price = price_feed
        .get_ema_price_no_older_than(current_timestamp, MAX_ORACLE_STALENESS)
        .ok_or(AegisError::StaleOraclePrice)?;

    require!(ema_price.price > 0, AegisError::InvalidOracle);

    let normalized_price = normalize_to_8_decimals(ema_price.price, ema_price.expo)?;

    Ok(normalized_price)
}

/// Ensures oracle account is valid and actively publishing.
pub fn validate_oracle_account(
    oracle_account: &AccountInfo,
    current_timestamp: i64,
    expected_oracle_pubkey: Pubkey,
) -> Result<()> {
    require_keys_eq!(oracle_account.key(), expected_oracle_pubkey, AegisError::InvalidOracle);

    let price_feed = load_price_feed_from_account_info(oracle_account)
        .map_err(|_| AegisError::InvalidOracle)?;

    let price_data = price_feed
        .get_price_no_older_than(current_timestamp, MAX_ORACLE_STALENESS)
        .ok_or(AegisError::StaleOraclePrice)?;

    require!(price_data.price != 0, AegisError::InvalidOracle);

    Ok(())
}

/// Converts Pyth's fixed-point price (a × 10^e) to a u64 with 8 decimal precision.
fn normalize_to_8_decimals(price: i64, expo: i32) -> Result<u64> {
    require!(price > 0, AegisError::InvalidOracle);

    let price_u128 = price as i128;
    let scaled = if expo < 0 {
        // expo = -8 → divide by 10^8 to normalize
        let divisor = 10u128
            .checked_pow((-expo) as u32)
            .ok_or(AegisError::Overflow)?;
        (price_u128 as u128)
            .checked_mul(100_000_000) // target 8 decimals
            .ok_or(AegisError::Overflow)?
            .checked_div(divisor)
            .ok_or(AegisError::Overflow)?
    } else {
        // expo >= 0 → multiply by 10^expo
        let multiplier = 10u128
            .checked_pow(expo as u32)
            .ok_or(AegisError::Overflow)?;
        (price_u128 as u128)
            .checked_mul(multiplier)
            .ok_or(AegisError::Overflow)?
            .checked_mul(100_000_000)
            .ok_or(AegisError::Overflow)?
    };

    require!(scaled <= u64::MAX as u128, AegisError::Overflow);
    Ok(scaled as u64)
}
