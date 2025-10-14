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
    
    #[msg("Invalid collateral list")]
    InvalidCollateralList = 108,
    
    #[msg("Oracle accounts must match collateral list")]
    OracleMismatch = 109,
    
    #[msg("Duplicate collateral in list")]
    DuplicateCollateral = 110,
    
    #[msg("Invalid collateral index")]
    InvalidCollateralIndex = 111,
    
    #[msg("Amount cannot be zero")]
    ZeroAmount = 112,
    
    #[msg("Insufficient balance")]
    InsufficientBalance = 113,
    
    #[msg("Resolution time must be at least 1 hour in future")]
    InvalidResolutionTime = 114,
    
    #[msg("Resolution time not yet reached")]
    ResolutionTimeNotReached = 115,
    
    #[msg("Position not eligible for liquidation")]
    NotLiquidatable = 116,
    
    #[msg("Hedge triggered too frequently, wait at least 1 hour")]
    HedgeTooFrequent = 117,
    
    #[msg("Oracle price is stale")]
    StaleOraclePrice = 118,
    
    #[msg("Oracle consensus not reached")]
    OracleConsensusFailure = 119,
    
    #[msg("Invalid market parameters")]
    InvalidMarket = 120,
    
    #[msg("Invalid MPC parameters (n >= t, t > 0)")]
    InvalidMPCParams = 121,
    
    #[msg("Too few shares for MPC reconstruction")]
    TooFewShares = 122,
    
    #[msg("Serialization error")]
    SerializationError = 123,
    
    #[msg("Deserialization error")]
    DeserializationError = 124,
}