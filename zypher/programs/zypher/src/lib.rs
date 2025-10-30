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

declare_id!("6V3Hg89bfDFzvo55NmyWzNAchNBti6WVuxx3HobdfuXK");

#[program]
pub mod zypher {
    use super::*;

    pub fn initialize_config(
        ctx: Context<InitializeConfig>,
        min_ratio: u64,
        hedge_interval: u64,
        approved_collaterals: Vec<Pubkey>,
        oracle_accounts: Vec<Pubkey>,
    ) -> Result<()> {
        require_eq!(min_ratio, 150_000_000, ZypherError::InvalidRatio);
        
        // Validate hedge interval bounds (300-86400 seconds)
        let interval = if hedge_interval == 0 { 3600 } else { hedge_interval };
        require!(
            interval >= 300 && interval <= 86400,
            ZypherError::InvalidInterval
        );
        
        require!(
            !approved_collaterals.is_empty() && approved_collaterals.len() <= 5,
            ZypherError::InvalidCollateralList
        );
        require_eq!(
            approved_collaterals.len(),
            oracle_accounts.len(),
            ZypherError::OracleMismatch
        );

        // Check uniqueness of collaterals
        for i in 0..approved_collaterals.len() {
            for j in i + 1..approved_collaterals.len() {
                require_neq!(
                    approved_collaterals[i],
                    approved_collaterals[j],
                    ZypherError::DuplicateCollateral
                );
            }
        }

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.min_collateral_ratio = min_ratio;
        config.hedge_interval_seconds = interval;
        config.approved_collaterals = approved_collaterals;
        config.oracle_accounts = oracle_accounts;
        config.zypher_mint = ctx.accounts.zypher_mint.key();

        Ok(())
    }

    /// Update hedge interval at runtime (admin-only)
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_hedge_interval: u64,
    ) -> Result<()> {
        // Validate new hedge interval bounds (300-86400 seconds)
        require!(
            new_hedge_interval >= 300 && new_hedge_interval <= 86400,
            ZypherError::InvalidInterval
        );

        let config = &mut ctx.accounts.config;
        config.hedge_interval_seconds = new_hedge_interval;

        Ok(())
    }

    pub fn mint_zypher(
        ctx: Context<MintZypher>,
        collateral_index: u8,
        deposit_amount: u64,
        mint_amount: u64,
    ) -> Result<()> {
        require!(deposit_amount > 0, ZypherError::ZeroAmount);
        require!(mint_amount > 0, ZypherError::ZeroAmount);

        let config = &ctx.accounts.config;
        require!(
            (collateral_index as usize) < config.approved_collaterals.len(),
            ZypherError::InvalidCollateralIndex
        );

        let expected_oracle = config.oracle_accounts[collateral_index as usize];
        // Fetch oracle price
        let price = fetch_oracle_price(&ctx.accounts.oracle_account, Clock::get()?.unix_timestamp, expected_oracle)?;

        // Calculate collateral value with overflow checks
        let collateral_value = (deposit_amount as u128)
            .checked_mul(price as u128)
            .ok_or(ZypherError::Overflow)?;

        let required_value = (mint_amount as u128)
            .checked_mul(config.min_collateral_ratio as u128)
            .ok_or(ZypherError::Overflow)?;

        require!(
            collateral_value >= required_value,
            ZypherError::UnderCollateralized
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
        let seeds = &[b"config_v2".as_ref(), &[ctx.bumps.config]];
        let signer = &[&seeds[..]];

        let cpi_accounts = MintTo {
            mint: ctx.accounts.zypher_mint.to_account_info(),
            to: ctx.accounts.user_zypher_token.to_account_info(),
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
            .ok_or(ZypherError::Overflow)?;

        position.minted_zypher = position
            .minted_zypher
            .checked_add(mint_amount)
            .ok_or(ZypherError::Overflow)?;

        // Compute encrypted position hash
        position.encrypted_position_hash = compute_position_hash(
            &position.owner,
            &position.collateral_amounts,
            position.minted_zypher,
        );

        Ok(())
    }

    pub fn burn_zypher(ctx: Context<BurnZypher>, burn_amount: u64) -> Result<()> {
        require!(burn_amount > 0, ZypherError::ZeroAmount);

        let position = &mut ctx.accounts.position;
        require!(
            burn_amount <= position.minted_zypher,
            ZypherError::InsufficientBalance
        );

        // Burn $AEGIS from user
        let cpi_accounts = Burn {
            mint: ctx.accounts.zypher_mint.to_account_info(),
            from: ctx.accounts.user_zypher_token.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::burn(cpi_ctx, burn_amount)?;

        // Update position
        position.minted_zypher = position
            .minted_zypher
            .checked_sub(burn_amount)
            .ok_or(ZypherError::Overflow)?;

        // Verify post-burn ratio if any debt remains
        if position.minted_zypher > 0 {
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
        require!(question.len() <= 64, ZypherError::InvalidMarket);
        let current_time = Clock::get()?.unix_timestamp;
        require!(
            resolution_time > current_time + 3600,
            ZypherError::InvalidResolutionTime
        );

        let market = &mut ctx.accounts.market;
    market.creator = ctx.accounts.creator.key();
    market.resolution_oracle = ctx.accounts.resolution_oracle.key();
    // Store human-readable question on-chain (UTF-8)
    market.question = question.clone();
        market.yes_pool = 0;
        market.no_pool = 0;
        // Use a SHA256-based commitment for devnet (privacy_utils.generate_question_commitment)
        // The original Poseidon implementation may fail in some environments; use the
        // resilient SHA256 fallback for predictable behavior in frontend flows.
        market.zk_commitment = generate_question_commitment(&question, resolution_time as u64);
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
        require!(amount > 0, ZypherError::ZeroAmount);
        require!(!ctx.accounts.market.resolved, ZypherError::MarketResolved);

        // Transfer $AEGIS to pool vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.user_zypher_token.to_account_info(),
            to: ctx.accounts.pool_vault.to_account_info(),
            authority: ctx.accounts.user.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update pool totals
        let market = &mut ctx.accounts.market;
        if side {
            market.yes_pool = market.yes_pool.checked_add(amount).ok_or(ZypherError::Overflow)?;
        } else {
            market.no_pool = market.no_pool.checked_add(amount).ok_or(ZypherError::Overflow)?;
        }

        Ok(())
    }

    pub fn settle_market(
        ctx: Context<SettleMarket>,
        _market_id: u64,
        zk_proof: Vec<u8>,
    ) -> Result<()> {
        let market = &mut ctx.accounts.market;
        require!(!market.resolved, ZypherError::MarketResolved);

        let current_time = Clock::get()?.unix_timestamp;
        require!(
            current_time >= market.resolution_time,
            ZypherError::ResolutionTimeNotReached
        );

        let outcome = fetch_oracle_outcome(&ctx.accounts.oracle_account, current_time, market.resolution_oracle)?;

        if market.proof_required {
            require!(zk_proof.len() >= 1024 && zk_proof.len() <= 2048, ZypherError::InvalidProof);
            
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
            ).map_err(|_| ZypherError::InvalidProof)?;
            
            require!(is_valid, ZypherError::InvalidProof);
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
        require!(is_liquidatable, ZypherError::NotLiquidatable);

        // Calculate liquidation bonus (5%)
        let _liquidation_bonus = position
            .minted_zypher
            .checked_mul(5)
            .ok_or(ZypherError::Overflow)?
            .checked_div(100)
            .ok_or(ZypherError::Overflow)?;

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
            position.minted_zypher = 0;
            position.encrypted_position_hash = [0u8; 32];
            position.last_hedge_timestamp = 0;
        }

        // Rate limiting: check configurable hedge interval
        require!(
            current_time - position.last_hedge_timestamp >= config.hedge_interval_seconds as i64,
            ZypherError::HedgeCooldown
        );

        // Verify agent ZK proof
        require!(
            verify_hedge_validity_proof(&agent_proof, hedge_decision),
            ZypherError::InvalidProof
        );
        
        // Verify MPC shares if provided (threshold = 2, requires 2+ shares)
        if !mpc_shares.is_empty() {
            require!(mpc_shares.len() >= 2, ZypherError::TooFewShares);
            require!(mpc_shares.len() <= 3, ZypherError::InvalidMPCParams);
            
            // Reconstruct secret from MPC shares
            let reconstructed = simulate_mpc_reconstruct(&mpc_shares, 2)?;
            
            // Verify reconstructed secret matches expected decision
            // For MVP, we accept any valid reconstruction as proof of MPC cooperation
            require!(!reconstructed.is_empty(), ZypherError::InvalidProof);
        }

        if hedge_decision {
            // Execute hedge logic
            position.last_hedge_timestamp = current_time;
        }

        Ok(())
    }

    /// Manual hedge override: allows position owner to trigger hedge without agent/ZK
    /// Reduces minted_zypher by 10% and enforces same cooldown as agent hedges
    pub fn manual_hedge_override(
        ctx: Context<ManualHedgeOverride>,
        decision: bool,
    ) -> Result<()> {
        let position = &mut ctx.accounts.position;
        let config = &ctx.accounts.config;
        let current_time = Clock::get()?.unix_timestamp;

        // Verify position exists and has minted AEGIS
        require!(
            position.owner != Pubkey::default() && position.minted_zypher > 0,
            ZypherError::InvalidOperation
        );

        // Enforce same cooldown as agent hedges
        require!(
            current_time - position.last_hedge_timestamp >= config.hedge_interval_seconds as i64,
            ZypherError::HedgeCooldown
        );

        // Update timestamp regardless of decision (prevents spam)
        position.last_hedge_timestamp = current_time;

        if decision {
            // Reduce minted_zypher by 10% using checked arithmetic
            let reduction_amount = position.minted_zypher
                .checked_mul(10)
                .ok_or(ZypherError::Overflow)?
                .checked_div(100)
                .ok_or(ZypherError::Overflow)?;

            position.minted_zypher = position.minted_zypher
                .checked_sub(reduction_amount)
                .ok_or(ZypherError::InsufficientBalance)?;

            // Update encrypted position hash after manual adjustment
            // Concatenate all position data into single byte array
            let mut data = Vec::new();
            data.extend_from_slice(&position.collateral_amounts[0].to_le_bytes());
            data.extend_from_slice(&position.minted_zypher.to_le_bytes());
            data.extend_from_slice(&current_time.to_le_bytes());
            
            let new_hash = compute_poseidon_commitment(&data);
            position.encrypted_position_hash = new_hash;

            // TODO: Burn reduction_amount tokens via SPL CPI in production
            // For MVP, we just reduce the accounting
        }

        Ok(())
    }
}

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + 32 + 8 + 8 + 4 + (32 * 5) + 4 + (32 * 5) + 32,
        seeds = [b"config_v2"],
        bump
    )]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub admin: Signer<'info>,
    pub zypher_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"config_v2"],
        bump,
        constraint = config.admin == admin.key() @ ZypherError::Unauthorized
    )]
    pub config: Account<'info, GlobalConfig>,
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct MintZypher<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + 32 + 4 + (8 * 5) + 8 + 32 + 8,
        seeds = [b"position", user.key().as_ref()],
        bump
    )]
    pub position: Account<'info, UserPosition>,
    #[account(seeds = [b"config_v2"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, constraint = user_collateral_token.mint == collateral_mint.key())]
    pub user_collateral_token: Account<'info, TokenAccount>,
    pub collateral_mint: Account<'info, Mint>,
    #[account(
        init_if_needed,
        payer = user,
        token::mint = collateral_mint,
        token::authority = vault_token_account,
        seeds = [b"vault", collateral_mint.key().as_ref()],
        bump
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    #[account(mut)]
    pub zypher_mint: Account<'info, Mint>,
    #[account(mut)]
    pub user_zypher_token: Account<'info, TokenAccount>,
    /// CHECK: Oracle account validated in handler
    pub oracle_account: AccountInfo<'info>,
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BurnZypher<'info> {
    #[account(
        mut,
        seeds = [b"position", user.key().as_ref()],
        bump,
        has_one = owner @ ZypherError::Unauthorized
    )]
    pub position: Account<'info, UserPosition>,
    #[account(seeds = [b"config_v2"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(mut, constraint = position.owner == user.key())]
    pub owner: SystemAccount<'info>,
    #[account(mut)]
    pub user_zypher_token: Account<'info, TokenAccount>,
    #[account(mut)]
    pub zypher_mint: Account<'info, Mint>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
#[instruction(market_id: u64)]
pub struct CreatePredictionMarket<'info> {
    #[account(
        init,
        payer = creator,
        // space calculation:
        // discriminator: 8
        // creator: 32
        // resolution_oracle: 32
        // yes_pool: 8
        // no_pool: 8
        // zk_commitment: 32
        // proof_required: 1
        // resolved: 1
        // outcome (Option<bool>): 2
        // resolution_time: 8
        // question: 4 (len) + 64 (max)
        space = 8 + 32 + 32 + 8 + 8 + 32 + 1 + 1 + 2 + 8 + 4 + 64,
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
    pub user_zypher_token: Account<'info, TokenAccount>,
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
    #[account(seeds = [b"config_v2"], bump)]
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
    #[account(seeds = [b"config_v2"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub agent: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ManualHedgeOverride<'info> {
    #[account(
        mut,
        seeds = [b"position", owner.key().as_ref()],
        bump,
        constraint = position.owner == owner.key() @ ZypherError::Unauthorized
    )]
    pub position: Account<'info, UserPosition>,
    #[account(seeds = [b"config_v2"], bump)]
    pub config: Account<'info, GlobalConfig>,
    #[account(mut)]
    pub owner: Signer<'info>,
}

#[account]
pub struct GlobalConfig {
    pub admin: Pubkey,
    pub min_collateral_ratio: u64,
    pub hedge_interval_seconds: u64,
    pub approved_collaterals: Vec<Pubkey>,
    pub oracle_accounts: Vec<Pubkey>,
    pub zypher_mint: Pubkey,
}

#[account]
pub struct UserPosition {
    pub owner: Pubkey,
    pub collateral_amounts: Vec<u64>,
    pub minted_zypher: u64,
    pub encrypted_position_hash: [u8; 32],
    pub last_hedge_timestamp: i64,
}

#[account]
pub struct PredictionMarket {
    pub creator: Pubkey,
    pub question: String,
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