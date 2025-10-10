use anchor_lang::prelude::*;
use pyth_sdk_solana::load_price_feed_from_account_info;
use crate::errors::AegisError;

const MAX_ORACLE_STALENESS: i64 = 60; // 60 seconds max staleness

/// Fetches and validates price from Pyth oracle
pub fn fetch_oracle_price(
    oracle_account: &AccountInfo,
    current_timestamp: i64,
) -> Result<u64> {
    let price_feed = load_price_feed_from_account_info(oracle_account)
        .map_err(|_| AegisError::InvalidOracle)?;

    let price_data = price_feed
        .get_current_price()
        .ok_or(AegisError::InvalidOracle)?;

    // Check if price is stale
    let publish_time = price_data.publish_time;
    require!(
        current_timestamp - publish_time <= MAX_ORACLE_STALENESS,
        AegisError::StaleOraclePrice
    );

    // Pyth prices have an exponent, normalize to 8 decimals (matching our ratio precision)
    let price = price_data.price;
    let expo = price_data.expo;
    
    require!(price > 0, AegisError::InvalidOracle);

    // Convert to u64 with 8 decimal precision
    let normalized_price = if expo >= 0 {
        (price as u128)
            .checked_mul(10u128.pow(expo as u32))
            .ok_or(AegisError::Overflow)?
            .checked_mul(100_000_000)
            .ok_or(AegisError::Overflow)?
    } else {
        let divisor = 10u128.pow(expo.abs() as u32);
        (price as u128)
            .checked_mul(100_000_000)
            .ok_or(AegisError::Overflow)?
            .checked_div(divisor)
            .ok_or(AegisError::Overflow)?
    };

    require!(
        normalized_price <= u64::MAX as u128,
        AegisError::Overflow
    );

    Ok(normalized_price as u64)
}

/// Fetches oracle outcome for prediction market settlement
pub fn fetch_oracle_outcome(oracle_account: &AccountInfo) -> Result<bool> {
    let price_feed = load_price_feed_from_account_info(oracle_account)
        .map_err(|_| AegisError::InvalidOracle)?;

    let price_data = price_feed
        .get_current_price()
        .ok_or(AegisError::InvalidOracle)?;

    // Simple outcome determination: price > 0 = true, else false
    // In production, this would use more sophisticated logic
    Ok(price_data.price > 0)
}

/// Calculates time-weighted average price (TWAP) from multiple oracle readings
/// This helps prevent flash loan attacks and price manipulation
pub fn calculate_twap(
    oracle_account: &AccountInfo,
    time_window: i64,
) -> Result<u64> {
    // In a real implementation, this would:
    // 1. Fetch historical price data from the oracle
    // 2. Calculate weighted average over the time window
    // 3. Return the TWAP value
    
    // For now, we use current price as placeholder
    // Pyth provides TWAP functionality through their EMA price
    let price_feed = load_price_feed_from_account_info(oracle_account)
        .map_err(|_| AegisError::InvalidOracle)?;

    let ema_price = price_feed
        .get_ema_price()
        .ok_or(AegisError::InvalidOracle)?;

    let current_timestamp = Clock::get()?.unix_timestamp;
    require!(
        current_timestamp - ema_price.publish_time <= time_window,
        AegisError::StaleOraclePrice
    );

    // Normalize EMA price to 8 decimals
    let price = ema_price.price;
    let expo = ema_price.expo;
    
    require!(price > 0, AegisError::InvalidOracle);

    let normalized_price = if expo >= 0 {
        (price as u128)
            .checked_mul(10u128.pow(expo as u32))
            .ok_or(AegisError::Overflow)?
            .checked_mul(100_000_000)
            .ok_or(AegisError::Overflow)?
    } else {
        let divisor = 10u128.pow(expo.abs() as u32);
        (price as u128)
            .checked_mul(100_000_000)
            .ok_or(AegisError::Overflow)?
            .checked_div(divisor)
            .ok_or(AegisError::Overflow)?
    };

    require!(
        normalized_price <= u64::MAX as u128,
        AegisError::Overflow
    );

    Ok(normalized_price as u64)
}

/// Validates that an oracle account is properly configured
pub fn validate_oracle_account(oracle_account: &AccountInfo) -> Result<()> {
    let price_feed = load_price_feed_from_account_info(oracle_account)
        .map_err(|_| AegisError::InvalidOracle)?;

    // Ensure oracle is active and publishing
    let current_price = price_feed
        .get_current_price()
        .ok_or(AegisError::InvalidOracle)?;

    require!(current_price.price != 0, AegisError::InvalidOracle);

    Ok(())
}