use anchor_lang::prelude::*;
use crate::errors::ZypherError;

/// Calculates payout for a winning bet in a prediction market
pub fn calculate_payout(
    user_stake: u64,
    winning_pool: u64,
    losing_pool: u64,
) -> Result<u64> {
    if winning_pool == 0 {
        return Ok(0);
    }

    // Payout = (user_stake / winning_pool) * (winning_pool + losing_pool)
    // This ensures proportional distribution of the total pool to winners
    let total_pool = winning_pool
        .checked_add(losing_pool)
        .ok_or(ZypherError::Overflow)?;

    let user_share = (user_stake as u128)
        .checked_mul(total_pool as u128)
        .ok_or(ZypherError::Overflow)?
        .checked_div(winning_pool as u128)
        .ok_or(ZypherError::Overflow)?;

    require!(
        user_share <= u64::MAX as u128,
        ZypherError::Overflow
    );

    Ok(user_share as u64)
}

/// Calculates the implied probability for each side of the market
pub fn calculate_implied_probability(yes_pool: u64, no_pool: u64) -> (f64, f64) {
    let total = (yes_pool + no_pool) as f64;
    if total == 0.0 {
        return (0.5, 0.5); // Equal probability if no bets
    }

    let yes_prob = yes_pool as f64 / total;
    let no_prob = no_pool as f64 / total;

    (yes_prob, no_prob)
}

/// Validates market state before allowing operations
pub fn validate_market_state(
    resolved: bool,
    resolution_time: i64,
    current_time: i64,
    operation: MarketOperation,
) -> Result<()> {
    match operation {
        MarketOperation::Bet => {
            require!(!resolved, ZypherError::MarketResolved);
            require!(
                current_time < resolution_time,
                ZypherError::InvalidResolutionTime
            );
        }
        MarketOperation::Settle => {
            require!(!resolved, ZypherError::MarketResolved);
            require!(
                current_time >= resolution_time,
                ZypherError::ResolutionTimeNotReached
            );
        }
        MarketOperation::Claim => {
            require!(resolved, ZypherError::MarketResolved);
        }
    }

    Ok(())
}

pub enum MarketOperation {
    Bet,
    Settle,
    Claim,
}

/// Calculates optimal bet size for market maker
/// This can be used by AI agents to determine hedge amounts
pub fn calculate_optimal_hedge_amount(
    current_yes_pool: u64,
    current_no_pool: u64,
    target_probability: f64,
    max_slippage: f64,
) -> Result<(bool, u64)> {
    let (current_yes_prob, _) = calculate_implied_probability(current_yes_pool, current_no_pool);
    
    // Determine which side to bet on
    let bet_on_yes = target_probability > current_yes_prob;
    
    // Calculate amount needed to move probability to target
    let total_pool = current_yes_pool
        .checked_add(current_no_pool)
        .ok_or(ZypherError::Overflow)? as f64;
    
    let bet_amount = if bet_on_yes {
        let target_yes = target_probability * (total_pool + 1.0);
        let amount = target_yes - current_yes_pool as f64;
        amount.max(0.0)
    } else {
        let target_no = (1.0 - target_probability) * (total_pool + 1.0);
        let amount = target_no - current_no_pool as f64;
        amount.max(0.0)
    };

    // Apply slippage protection
    let max_bet = (total_pool * max_slippage) as u64;
    let final_amount = (bet_amount as u64).min(max_bet);

    Ok((bet_on_yes, final_amount))
}

/// Validates that market creation parameters are reasonable
pub fn validate_market_parameters(
    yes_pool: u64,
    no_pool: u64,
    resolution_time: i64,
    current_time: i64,
) -> Result<()> {
    // Markets should start with zero or equal pools
    if yes_pool != 0 || no_pool != 0 {
        require_eq!(yes_pool, no_pool, ZypherError::InvalidMarket);
    }

    // Resolution time must be in future
    require!(
        resolution_time > current_time,
        ZypherError::InvalidResolutionTime
    );

    // Resolution time should be reasonable (not too far in future)
    let max_future = current_time + (365 * 24 * 3600); // 1 year max
    require!(
        resolution_time <= max_future,
        ZypherError::InvalidResolutionTime
    );

    Ok(())
}

/// Calculates market liquidity depth
pub fn calculate_market_depth(yes_pool: u64, no_pool: u64) -> u64 {
    yes_pool
        .checked_add(no_pool)
        .unwrap_or(0)
}

/// Determines if a market has sufficient liquidity for operations
pub fn check_market_liquidity(
    yes_pool: u64,
    no_pool: u64,
    min_liquidity: u64,
) -> bool {
    let total_liquidity = yes_pool.saturating_add(no_pool);
    total_liquidity >= min_liquidity
}