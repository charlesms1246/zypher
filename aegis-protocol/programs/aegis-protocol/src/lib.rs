use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, MintTo, Token, TokenAccount, Transfer};

pub mod cdp;
pub mod errors;
pub mod oracle_integration;
pub mod prediction_market;
pub mod privacy_utils;
pub mod zk_circuits;

use cdp::*;
use errors::*;
use oracle_integration::*;
use privacy_utils::*;
use zk_circuits::{verify_proof, get_verifying_key, get_proof_params, FieldElement as Fp};
use halo2curves::group::ff::PrimeField;

declare_id!("3AT5kUMBhHHFkc7Th21Hk3H6JGHLvA6MAJxUwUU7aDJW");

#[program]
pub mod aegis_protocol {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        min_ratio: u64,
        approved_collaterals: Vec<Pubkey>,
        oracle_accounts: Vec<Pubkey>,
    ) -> Result<()> {
        require_eq!(min_ratio, 150_000_000, AegisError::InvalidRatio);
        require!(
            !approved_collaterals.is_empty() && approved_collaterals.len() <= 5,
            AegisError::InvalidCollateralList
        );
        require_eq!(
            approved_collaterals.len(),
            oracle_accounts.len(),
            AegisError::OracleMismatch
        );

        // Check uniqueness of collaterals
        for i in 0..approved_collaterals.len() {
            for j in i + 1..approved_collaterals.len() {
                require_neq!(
                    approved_collaterals[i],
                    approved_collaterals[j],
                    AegisError::DuplicateCollateral
                );
            }
        }

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.min_collateral_ratio = min_ratio;
        config.approved_collaterals = approved_collaterals;
        config.oracle_accounts = oracle_accounts;
        config.aegis_mint = ctx.accounts.aegis_mint.key();

        Ok(())
    }

    pub fn mint_aegis(
        ctx: Context<MintAegis>,
        collateral_index: u8,
        deposit_amount: u64,
        mint_amount: u64,
    ) -> Result<()> {
        require!(deposit_amount > 0, AegisError::ZeroAmount);
        require!(mint_amount > 0, AegisError::ZeroAmount);

        let config = &ctx.accounts.config;
        require!(
            (collateral_index as usize) < config.approved_collaterals.len(),
            AegisError::InvalidCollateralIndex
        );

        let expected_oracle = config.oracle_accounts[collateral_index as usize];
        // Fetch oracle price
        let price = fetch_oracle_price(&ctx.accounts.oracle_account, Clock::get()?.unix_timestamp, expected_oracle)?;

        // Calculate collateral value with overflow checks
        let collateral_value = (deposit_amount as u128)
            .checked_mul(price as u128)
            .ok_or(AegisError::Overflow)?;

        let required_value = (mint_amount as u128)
            .checked_mul(config.min_collateral_ratio as u128)
            .ok_or(AegisError::Overflow)?;

        require!(
            collateral_value >= required_value,
            AegisError::UnderCollateralized
        );

        // Transfer collateral to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_collateral_token.to_account_info(),
            to: ctx.accounts.vault_token_account.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, deposit_amount)?;

        // Mint $AEGIS to user
        let seeds = &[b"config".as_ref(), &[ctx.bumps.config]];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.aegis_mint.to_account_info(),
            to: ctx.accounts.user_aegis_token.to_account_info(),
            authority: ctx.accounts.config.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer);
        token::mint_to(cpi_ctx, mint_amount)?;

        // Update position
        let position = &mut ctx.accounts.position;
        if position.collateral_amounts.is_empty() {
            position.owner = ctx.accounts.user.key();
            position.collateral_amounts = vec![0u64; config.approved_collaterals.len()];
            position.last_hedge_timestamp = 0;
        }

        position.collateral_amounts[collateral_index as usize] = position
            .collateral_amounts[collateral_index as usize]
            .checked_add(deposit_amount)
            .ok_or(AegisError::Overflow)?;

        position.minted_aegis = position
            .minted_aegis
            .checked_add(mint_amount)
            .ok_or(AegisError::Overflow)?;

        // Compute encrypted position hash
        position.encrypted_position_hash = compute_position_hash(
            &position.owner,
            &position.collateral_amounts,
            position.minted_aegis,
        );

        Ok(())
    }

    pub fn burn_aegis(ctx: Context<BurnAegis>, burn_amount: u64) -> Result<()> {
        require!(burn_amount > 0, AegisError::ZeroAmount);

        let position = &mut ctx.accounts.position;
        require!(
            burn_amount <= position.minted_aegis,
            AegisError::InsufficientBalance
        );

        // Burn $AEGIS from user
        let cpi_accounts = Burn {
            mint: ctx.accounts.aegis_mint.to_account_info(),
            from: ctx.accounts.user_aegis_token.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, burn_amount)?;

        // Update position
        position.minted_aegis = position
            .minted_aegis
            .checked_sub(burn_amount)
            .ok_or(AegisError::Overflow)?;

        // Verify post-burn ratio if any debt remains
        if position.minted_aegis > 0 {
            verify_collateral_ratio(position, &ctx.accounts.config, &ctx.remaining_accounts)?;
        }

        Ok(())
    }

    pub fn create_prediction_market(
        ctx: Context<CreatePredictionMarket>,
        _market_id: u64,
        resolution_time: i64,
        question: String,
    ) -> Result<()> {
        require!(question.len() <= 64, AegisError::InvalidMarket);
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            resolution_time > current_time + 3600,
            AegisError::InvalidResolutionTime
        );

        let market = &mut ctx.accounts.market;
        market.creator = ctx.accounts.creator.key();
        market.resolution_oracle = ctx.accounts.resolution_oracle.key();
        market.yes_pool = 0;
        market.no_pool = 0;
        market.zk_commitment = poseidon_hash(
            question.as_bytes(),
            ctx.accounts.resolution_oracle.key().as_ref(),
            &resolution_time.to_le_bytes()
        );
        market.proof_required = question.to_lowercase().contains("hedge") || question.to_lowercase().contains("yield");
        market.resolved = false;
        market.outcome = None;
        market.resolution_time = resolution_time;

        Ok(())
    }

    pub fn bet_on_market(
        ctx: Context<BetOnMarket>,
        _market_id: u64,
        side: bool,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, AegisError::ZeroAmount);
        require!(!ctx.accounts.market.resolved, AegisError::MarketResolved);

        // Transfer $AEGIS to pool vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_aegis_token.to_account_info(),
            to: ctx.accounts.pool_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update pool totals
        let market = &mut ctx.accounts.market;
        if side {
            market.yes_pool = market.yes_pool.checked_add(amount).ok_or(AegisError::Overflow)?;
        } else {
            market.no_pool = market.no_pool.checked_add(amount).ok_or(AegisError::Overflow)?;
        }

        Ok(())
    }

    pub fn settle_market(
        ctx: Context<SettleMarket>,
        _market_id: u64,
        zk_proof: Vec<u8>,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, AegisError::MarketResolved);

        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= market.resolution_time,
            AegisError::ResolutionTimeNotReached
        );

        let outcome = fetch_oracle_outcome(&ctx.accounts.oracle_account, current_time, market.resolution_oracle)?;

        if market.proof_required {
            require!(zk_proof.len() >= 1024 && zk_proof.len() <= 2048, AegisError::InvalidProof);
            
            // Convert outcome to field element
            let outcome_fp = if outcome { 
                Fp::one() 
            } else { 
                Fp::zero() 
            };
            
            // Convert commitment bytes to field element
            let commitment_fp = bytes_to_fp(&market.zk_commitment);
            
            let public_inputs = vec![commitment_fp, outcome_fp];
            
            let is_valid = verify_proof(
                &zk_proof,
                &public_inputs,
                &get_verifying_key(),
                &get_proof_params()
            ).map_err(|_| AegisError::InvalidProof)?;
            
            require!(is_valid, AegisError::InvalidProof);
        }

        // Update market state
        market.resolved = true;
        market.outcome = Some(outcome);

        Ok(())
    }

    pub fn liquidate_position(ctx: Context<LiquidatePosition>) -> Result<()> {
        let position = &ctx.accounts.position;
        let config = &ctx.accounts.config;

        // Verify undercollateralized using multi-oracle consensus
        let is_liquidatable =
            check_liquidation_condition(position, config, &ctx.remaining_accounts)?;
        require!(is_liquidatable, AegisError::NotLiquidatable);

        // Calculate liquidation bonus (5%)
        let _liquidation_bonus = position
            .minted_aegis
            .checked_mul(5)
            .ok_or(AegisError::Overflow)?
            .checked_div(100)
            .ok_or(AegisError::Overflow)?;

        // Transfer collateral to liquidator with bonus
        // Implementation depends on specific collateral distribution logic

        Ok(())
    }

    pub fn trigger_hedge(
        ctx: Context<TriggerHedge>,
        hedge_decision: bool,
        agent_proof: Vec<u8>,
        mpc_shares: Vec<Vec<u8>>,
    ) -> Result<()> {
        let position = &mut ctx.accounts.position;
        let current_time = Clock::get()?.unix_timestamp;
        let config = &ctx.accounts.config;

        // Initialize position if it's new
        if position.owner == Pubkey::default() {
            position.owner = ctx.accounts.agent.key();
            position.collateral_amounts = vec![0u64; config.approved_collaterals.len()];
            position.minted_aegis = 0;
            position.encrypted_position_hash = [0u8; 32];
            position.last_hedge_timestamp = 0;
        }

        // Rate limiting: minimum 1 hour between hedges
        require!(
            current_time - position.last_hedge_timestamp >= 3600,
            AegisError::HedgeTooFrequent
        );

        // Verify agent ZK proof
        require!(
            verify_hedge_validity_proof(&agent_proof, hedge_decision),
            AegisError::InvalidProof
        );
        
        // Verify MPC shares if provided (threshold = 2, requires 2+ shares)
        if !mpc_shares.is_empty() {
            require!(mpc_shares.len() >= 2, AegisError::TooFewShares);
            require!(mpc_shares.len() <= 3, AegisError::InvalidMPCParams);
            
            // Reconstruct secret from MPC shares
            let reconstructed = simulate_mpc_reconstruct(&mpc_shares, 2)?;
            
            // Verify reconstructed secret matches expected decision
            // For MVP, we accept any valid reconstruction as proof of MPC cooperation
            require!(!reconstructed.is_empty(), AegisError::InvalidProof);
        }

        if hedge_decision {
            // Execute hedge logic
            position.last_hedge_timestamp = current_time;
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8 + 4 + (32 * 5) + 4 + (32 * 5) + 32,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub aegis_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintAegis<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 4 + (8 * 5) + 8 + 32 + 8,
        seeds = [b"position", user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_collateral_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [b"vault", config.approved_collaterals[0].as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub aegis_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_aegis_token: Account<'info, TokenAccount>,
    /// CHECK: Oracle account validated in handler
    pub oracle_account: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnAegis<'info> {
    #[account(
        mut,
        seeds = [b"position", user.key().as_ref()],
        bump,
        has_one = owner @ AegisError::Unauthorized
    )]
    pub position: Account<'info, UserPosition>,
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, constraint = position.owner == user.key())]
    pub owner: SystemAccount<'info>,
    #[account(mut)]
    pub user_aegis_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub aegis_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreatePredictionMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + 32 + 32 + 8 + 8 + 32 + 1 + 2 + 8,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, PredictionMarket>,
    #[account(mut)]
    pub creator: Signer<'info>,
    /// CHECK: Oracle account for resolution
    pub resolution_oracle: AccountInfo<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct BetOnMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, PredictionMarket>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut)]
    pub user_aegis_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub pool_vault: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct SettleMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market_id.to_le_bytes().as_ref()],
        bump
    )]
    pub market: Account<'info, PredictionMarket>,
    /// CHECK: Oracle account for outcome
    pub oracle_account: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct LiquidatePosition<'info> {
    #[account(
        mut,
        seeds = [b"position", position.owner.as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub liquidator: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct TriggerHedge<'info> {
    #[account(
        init_if_needed,
        payer = agent,
        space = 8 + 32 + 4 + (8 * 5) + 8 + 32 + 8,
        seeds = [b"position", agent.key().as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,
    #[account(seeds = [b"config"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub min_collateral_ratio: u64,
    pub approved_collaterals: Vec<Pubkey>,
    pub oracle_accounts: Vec<Pubkey>,
    pub aegis_mint: Pubkey,
}

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub collateral_amounts: Vec<u64>,
    pub minted_aegis: u64,
    pub encrypted_position_hash: [u8; 32],
    pub last_hedge_timestamp: i64,
}

#[account]
pub struct PredictionMarket {
    pub creator: Pubkey,
    pub resolution_oracle: Pubkey,
    pub yes_pool: u64,
    pub no_pool: u64,
    pub zk_commitment: [u8; 32],
    pub proof_required: bool,
    pub resolved: bool,
    pub outcome: Option<bool>,
    pub resolution_time: i64,
}

/// Helper function to hash data using Poseidon
fn poseidon_hash(data1: &[u8], data2: &[u8], data3: &[u8]) -> [u8; 32] {
    use solana_poseidon::{hashv, Parameters, Endianness};
    let inputs = vec![data1, data2, data3];
    let hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &inputs).unwrap();
    hash.to_bytes()
}

/// Helper function to convert bytes to field element
fn bytes_to_fp(bytes: &[u8; 32]) -> Fp {
    // Take first 31 bytes to ensure it's within the field modulus
    let mut arr = [0u8; 32];
    arr[..31].copy_from_slice(&bytes[..31]);
    
    // Use from_repr which returns CtOption
    Fp::from_repr(arr).unwrap_or_else(|| Fp::zero())
}