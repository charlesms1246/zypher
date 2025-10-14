use anchor_lang::prelude::*;

#[error_code]
pub enum AegisError {
    #[msg("Collateral ratio below minimum")]
    UnderCollateralized = 100,
    
    #[msg("Stale or mismatched oracle data")]
    InvalidOracle = 101,
    
    #[msg("Market already settled")]
    MarketResolved = 102,
    
    #[msg("ZK proof verification failed")]
    InvalidProof = 103,
    
    #[msg("Signer not authorized")]
    Unauthorized = 104,
    
    #[msg("Arithmetic overflow")]
    Overflow = 105,
    
    #[msg("Hash does not match encrypted data")]
    EncryptionMismatch = 106,
    
    #[msg("Invalid collateral ratio configuration")]
    InvalidRatio = 107,
    
    #[msg("Hedge cooldown active: wait before next hedge")]
    HedgeCooldown = 108,
    
    #[msg("Hedge interval out of bounds: must be 300-86400 seconds")]
    InvalidInterval = 109,
    
    #[msg("Invalid collateral list")]
    InvalidCollateralList = 110,
    
    #[msg("Oracle accounts must match collateral list")]
    OracleMismatch = 111,
    
    #[msg("Duplicate collateral in list")]
    DuplicateCollateral = 112,
    
    #[msg("Invalid collateral index")]
    InvalidCollateralIndex = 113,
    
    #[msg("Amount cannot be zero")]
    ZeroAmount = 114,
    
    #[msg("Insufficient balance")]
    InsufficientBalance = 115,
    
    #[msg("No active position to hedge")]
    InvalidOperation = 116,
    
    #[msg("Resolution time must be at least 1 hour in future")]
    InvalidResolutionTime = 117,
    
    #[msg("Resolution time not yet reached")]
    ResolutionTimeNotReached = 118,
    
    #[msg("Position not eligible for liquidation")]
    NotLiquidatable = 119,
    
    #[msg("Hedge triggered too frequently, wait at least 1 hour")]
    HedgeTooFrequent = 120,
    
    #[msg("Oracle price is stale")]
    StaleOraclePrice = 121,
    
    #[msg("Oracle consensus not reached")]
    OracleConsensusFailure = 122,
    
    #[msg("Invalid market parameters")]
    InvalidMarket = 123,
    
    #[msg("Invalid MPC parameters (n >= t, t > 0)")]
    InvalidMPCParams = 124,
    
    #[msg("Too few shares for MPC reconstruction")]
    TooFewShares = 125,
    
    #[msg("Serialization error")]
    SerializationError = 126,
    
    #[msg("Deserialization error")]
    DeserializationError = 127,
}
