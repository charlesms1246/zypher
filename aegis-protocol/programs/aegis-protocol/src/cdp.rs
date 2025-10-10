use anchor_lang::prelude::*;
use crate::errors::AegisError;
use crate::oracle_integration::*;
use crate::{GlobalConfig, UserPosition};

/// Verifies that a position maintains the minimum collateral ratio
pub fn verify_collateral_ratio(
    position: &UserPosition,
    config: &GlobalConfig,
    oracle_accounts: &[AccountInfo],
) -> Result<()> {
    require!(
        oracle_accounts.len() >= config.oracle_accounts.len(),
        AegisError::OracleMismatch
    );

    let current_time = Clock::get()?.unix_timestamp;
    let mut total_collateral_value: u128 = 0;

    for (i, amount) in position.collateral_amounts.iter().enumerate() {
        if *amount > 0 {
            let expected_oracle = config.oracle_accounts[i];
            let price = fetch_oracle_price(&oracle_accounts[i], current_time, expected_oracle)?;
            let value = (*amount as u128)
                .checked_mul(price as u128)
                .ok_or(AegisError::Overflow)?;
            total_collateral_value = total_collateral_value
                .checked_add(value)
                .ok_or(AegisError::Overflow)?;
        }
    }

    let required_value = (position.minted_aegis as u128)
        .checked_mul(config.min_collateral_ratio as u128)
        .ok_or(AegisError::Overflow)?;

    require!(
        total_collateral_value >= required_value,
        AegisError::UnderCollateralized
    );

    Ok(())
}

/// Checks if a position is eligible for liquidation using multi-oracle consensus
pub fn check_liquidation_condition(
    position: &UserPosition,
    config: &GlobalConfig,
    oracle_accounts: &[AccountInfo],
) -> Result<bool> {
    require!(
        oracle_accounts.len() >= config.oracle_accounts.len(),
        AegisError::OracleMismatch
    );

    let current_time = Clock::get()?.unix_timestamp;
    let mut total_collateral_value: u128 = 0;
    let mut oracle_prices: Vec<u64> = Vec::new();

    // Collect prices from all oracles
    for (i, amount) in position.collateral_amounts.iter().enumerate() {
        if *amount > 0 {
            let expected_oracle = config.oracle_accounts[i];
            let price = fetch_oracle_price(&oracle_accounts[i], current_time, expected_oracle)?;
            oracle_prices.push(price);
            
            let value = (*amount as u128)
                .checked_mul(price as u128)
                .ok_or(AegisError::Overflow)?;
            total_collateral_value = total_collateral_value
                .checked_add(value)
                .ok_or(AegisError::Overflow)?;
        }
    }

    // Multi-oracle consensus: require at least 2 oracles agree within 1%
    if oracle_prices.len() >= 2 {
        let consensus = check_oracle_consensus(&oracle_prices)?;
        require!(consensus, AegisError::OracleConsensusFailure);
    }

    let required_value = (position.minted_aegis as u128)
        .checked_mul(config.min_collateral_ratio as u128)
        .ok_or(AegisError::Overflow)?;

    Ok(total_collateral_value < required_value)
}

/// Checks if oracle prices are within 1% consensus
fn check_oracle_consensus(prices: &[u64]) -> Result<bool> {
    if prices.len() < 2 {
        return Ok(true);
    }

    let avg_price = prices.iter().map(|p| *p as u128).sum::<u128>() / prices.len() as u128;
    let threshold = avg_price / 100; // 1% threshold

    let mut consensus_count = 0;
    for price in prices {
        let diff = if *price as u128 > avg_price {
            (*price as u128) - avg_price
        } else {
            avg_price - (*price as u128)
        };

        if diff <= threshold {
            consensus_count += 1;
        }
    }

    Ok(consensus_count >= 2)
}

/// Calculates the health factor of a position (collateral_value / debt)
pub fn calculate_health_factor(
    position: &UserPosition,
    config: &GlobalConfig,
    oracle_accounts: &[AccountInfo],
) -> Result<u64> {
    let current_time = Clock::get()?.unix_timestamp;
    let mut total_collateral_value: u128 = 0;

    for (i, amount) in position.collateral_amounts.iter().enumerate() {
        if *amount > 0 && i < oracle_accounts.len() {
            let expected_oracle = config.oracle_accounts[i];
            let price = fetch_oracle_price(&oracle_accounts[i], current_time, expected_oracle)?;
            let value = (*amount as u128)
                .checked_mul(price as u128)
                .ok_or(AegisError::Overflow)?;
            total_collateral_value = total_collateral_value
                .checked_add(value)
                .ok_or(AegisError::Overflow)?;
        }
    }

    if position.minted_aegis == 0 {
        return Ok(u64::MAX); // Infinite health factor
    }

    let health_factor = total_collateral_value
        .checked_mul(100_000_000) // Scale for precision
        .ok_or(AegisError::Overflow)?
        .checked_div(position.minted_aegis as u128)
        .ok_or(AegisError::Overflow)?;

    Ok(health_factor as u64)
}

/// Calculates maximum AEGIS that can be minted given collateral amounts
pub fn calculate_max_mintable(
    collateral_amounts: &[u64],
    config: &GlobalConfig,
    oracle_accounts: &[AccountInfo],
) -> Result<u64> {
    let current_time = Clock::get()?.unix_timestamp;
    let mut total_collateral_value: u128 = 0;

    for (i, amount) in collateral_amounts.iter().enumerate() {
        if *amount > 0 && i < oracle_accounts.len() {
            let expected_oracle = config.oracle_accounts[i];
            let price = fetch_oracle_price(&oracle_accounts[i], current_time, expected_oracle)?;
            let value = (*amount as u128)
                .checked_mul(price as u128)
                .ok_or(AegisError::Overflow)?;
            total_collateral_value = total_collateral_value
                .checked_add(value)
                .ok_or(AegisError::Overflow)?;
        }
    }

    let max_mint = total_collateral_value
        .checked_div(config.min_collateral_ratio as u128)
        .ok_or(AegisError::Overflow)?;

    Ok(max_mint as u64)
}