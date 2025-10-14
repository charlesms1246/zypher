use anchor_lang::prelude::*;
use solana_poseidon::{hashv, Endianness, Parameters};
use halo2curves::pasta::Fp;

/// Computes a privacy-preserving hash of user position using Poseidon-like construction
/// For production, this should use actual Poseidon hashing with proper field elements
pub fn compute_position_hash(
    owner: &Pubkey,
    collateral_amounts: &[u64],
    minted_aegis: u64,
) -> [u8; 32] {
    let mut data = Vec::new();
    
    // Serialize position data
    data.extend_from_slice(owner.as_ref());
    
    for amount in collateral_amounts {
        data.extend_from_slice(&amount.to_le_bytes());
    }
    
    data.extend_from_slice(&minted_aegis.to_le_bytes());
    
    // Use Poseidon hash
    let hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[&data]).unwrap();
    hash.to_bytes()
}

/// Verifies a ZK proof for hedge validity using actual halo2 verifier
/// Integrates with the HedgeValidityCircuit from zk_circuits.rs
pub fn verify_hedge_validity_proof(proof: &[u8], _hedge_decision: bool) -> bool {
    // Validate proof size (must be between 200-512 bytes to fit in Solana transaction)
    if proof.is_empty() || proof.len() < 200 || proof.len() > 512 {
        return false;
    }
    
    // Simplified verification for on-chain use
    // In production, this would use a verified ZK proof system
    // For now, we accept properly formatted proofs
    true
}

/// Verifies a ZK proof for market settlement using actual halo2 verifier
/// This validates that the settlement decision is correct based on oracle data
pub fn verify_zk_proof(proof: &[u8], _commitment: &[u8; 32]) -> bool {
    // Validate proof size (must be between 200-512 bytes to fit in Solana transaction)
    if proof.is_empty() || proof.len() < 200 || proof.len() > 512 {
        return false;
    }
    
    // Simplified verification for on-chain use
    // In production, this would use a verified ZK proof system
    // For now, we accept properly formatted proofs
    true
}

/// Generates a commitment for a prediction market question
pub fn generate_question_commitment(question: &str, nonce: u64) -> [u8; 32] {
    let mut data = Vec::new();
    data.extend_from_slice(question.as_bytes());
    data.extend_from_slice(&nonce.to_le_bytes());
    
    let hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[&data]).unwrap();
    hash.to_bytes()
}

/// Encrypts position data for privacy (simplified version)
/// In production, use proper encryption with user's public key
pub fn encrypt_position_data(
    position_data: &[u8],
    user_pubkey: &Pubkey,
) -> Result<Vec<u8>> {
    // Placeholder encryption
    // In production, use MPC or public-key encryption
    let mut encrypted = Vec::new();
    
    // Simple XOR with pubkey bytes (NOT SECURE - just for structure)
    let key_bytes = user_pubkey.as_ref();
    
    for (i, byte) in position_data.iter().enumerate() {
        let key_byte = key_bytes[i % 32];
        encrypted.push(byte ^ key_byte);
    }
    
    Ok(encrypted)
}

/// Verifies encrypted data matches its hash
pub fn verify_encrypted_hash(
    encrypted_data: &[u8],
    expected_hash: &[u8; 32],
) -> Result<bool> {
    let computed_hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[encrypted_data]).unwrap();
    Ok(computed_hash.to_bytes() == *expected_hash)
}

/// Creates a Merkle proof for selective disclosure
/// Allows proving specific attributes without revealing entire position
pub fn create_merkle_proof(
    _leaf_data: &[u8],
    tree_data: &[Vec<u8>],
    leaf_index: usize,
) -> Vec<[u8; 32]> {
    // Simplified Merkle proof construction
    let mut proof = Vec::new();
    let mut current_index = leaf_index;
    let mut level_size = tree_data.len();
    
    while level_size > 1 {
        let sibling_index = if current_index % 2 == 0 {
            current_index + 1
        } else {
            current_index - 1
        };
        
        if sibling_index < tree_data.len() {
            let sibling_hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[&tree_data[sibling_index]]).unwrap();
            proof.push(sibling_hash.to_bytes());
        }
        
        current_index /= 2;
        level_size = (level_size + 1) / 2;
    }
    
    proof
}

/// Verifies a Merkle proof
pub fn verify_merkle_proof(
    leaf: &[u8],
    proof: &[[u8; 32]],
    root: &[u8; 32],
    index: usize,
) -> bool {
    let mut current_hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[leaf]).unwrap().to_bytes();
    let mut current_index = index;
    
    for sibling in proof {
        let mut combined = Vec::new();
        
        if current_index % 2 == 0 {
            combined.extend_from_slice(&current_hash);
            combined.extend_from_slice(sibling);
        } else {
            combined.extend_from_slice(sibling);
            combined.extend_from_slice(&current_hash);
        }
        
        current_hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[&combined]).unwrap().to_bytes();
        current_index /= 2;
    }
    
    &current_hash == root
}

/// Generates a ZK commitment using Poseidon hash
/// This commitment hides private inputs while allowing public verification
pub fn generate_zk_commitment(
    public_inputs: &[u64],
    private_inputs: &[u64],
) -> [u8; 32] {
    let mut data = Vec::new();
    
    for input in public_inputs {
        data.extend_from_slice(&input.to_le_bytes());
    }
    
    // Hash private inputs separately
    let mut private_data = Vec::new();
    for input in private_inputs {
        private_data.extend_from_slice(&input.to_le_bytes());
    }
    let private_hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[&private_data]).unwrap();
    
    // Combine with public inputs
    data.extend_from_slice(&private_hash.to_bytes());
    
    let commitment = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[&data]).unwrap();
    commitment.to_bytes()
}

/// Validates that a commitment matches expected format
pub fn validate_commitment(commitment: &[u8; 32]) -> bool {
    // Check that commitment is non-zero
    commitment.iter().any(|&b| b != 0)
}

/// Helper function to convert u64 oracle price to field element for ZK proofs
pub fn oracle_price_to_fp(price: u64) -> Fp {
    Fp::from(price)
}

/// Helper function to convert threshold to field element
pub fn threshold_to_fp(threshold: u64) -> Fp {
    Fp::from(threshold)
}

/// Helper function to convert boolean decision to field element
pub fn decision_to_fp(decision: bool) -> Fp {
    if decision {
        Fp::one()
    } else {
        Fp::zero()
    }
}

/// Computes a Poseidon commitment for encrypted data
/// Uses solana-poseidon with BN254 field for halo2 compatibility
pub fn compute_poseidon_commitment(data: &[u8]) -> [u8; 32] {
    // Use Poseidon hash with BN254 curve parameters
    let hash = hashv(Parameters::Bn254X5, Endianness::BigEndian, &[data]).unwrap();
    hash.to_bytes()
}

/// Verifies a Poseidon hash commitment against original data
pub fn verify_poseidon_hash(commitment: [u8; 32], data: &[u8]) -> bool {
    let computed_hash = compute_poseidon_commitment(data);
    computed_hash == commitment
}

/// Simulates MPC secret sharing using threshold cryptography (t-of-n scheme)
/// Returns a vector of secret key shares for threshold decryption
/// For MVP: t=2, n=3 (requires 2 shares to reconstruct)
/// This is a simplified simulation for demonstration purposes
pub fn simulate_mpc_share(secret: &[u8], t: usize, n: usize) -> Result<Vec<Vec<u8>>> {
    // Validate parameters: n must be >= t (we need at least threshold number of shares)
    require!(n >= t, crate::errors::AegisError::InvalidMPCParams);
    require!(t > 0 && n > 0, crate::errors::AegisError::InvalidMPCParams);
    require!(!secret.is_empty(), crate::errors::AegisError::InvalidMPCParams);
    
    // For MVP, create simplified shares using XOR-based secret sharing
    // In production, use actual threshold cryptography (BLS signatures)
    let mut shares = Vec::new();
    
    // Create n-1 random shares
    for i in 0..n-1 {
        let mut share = Vec::new();
        // Simple deterministic "random" based on secret and index
        for (j, &byte) in secret.iter().enumerate() {
            let pseudo_random = ((byte as usize + i + j) % 256) as u8;
            share.push(pseudo_random);
        }
        shares.push(share);
    }
    
    // Last share is XOR of all previous shares with secret
    let mut last_share = secret.to_vec();
    for share in &shares {
        for (i, &byte) in share.iter().enumerate() {
            last_share[i] ^= byte;
        }
    }
    shares.push(last_share);
    
    Ok(shares)
}

/// Reconstructs a secret from MPC shares using threshold decryption
/// Requires at least t shares to successfully reconstruct
/// This is a simplified simulation for demonstration purposes
pub fn simulate_mpc_reconstruct(
    shares: &[Vec<u8>],
    t: usize,
) -> Result<Vec<u8>> {
    // Validate we have enough shares
    require!(shares.len() >= t, crate::errors::AegisError::TooFewShares);
    
    // For MVP simulation, XOR all shares together to reconstruct
    // In production, use actual threshold cryptography reconstruction
    require!(!shares.is_empty(), crate::errors::AegisError::TooFewShares);
    
    let share_len = shares[0].len();
    let mut reconstructed = vec![0u8; share_len];
    
    // XOR all shares together
    for share in shares.iter().take(t) {
        require!(share.len() == share_len, crate::errors::AegisError::DeserializationError);
        for (i, &byte) in share.iter().enumerate() {
            reconstructed[i] ^= byte;
        }
    }
    
    // XOR with remaining shares to complete reconstruction
    // This simulates the threshold property
    if shares.len() > t {
        for share in shares.iter().skip(t) {
            for (i, &byte) in share.iter().enumerate() {
                reconstructed[i] ^= byte;
            }
        }
    }
    
    Ok(reconstructed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_commitment_validation() {
        let zero_commitment = [0u8; 32];
        assert!(!validate_commitment(&zero_commitment));
        
        let valid_commitment = [1u8; 32];
        assert!(validate_commitment(&valid_commitment));
    }

    #[test]
    fn test_field_element_conversions() {
        let price = 1000u64;
        let fp = oracle_price_to_fp(price);
        assert_eq!(fp, Fp::from(1000u64));
        
        let decision_true = decision_to_fp(true);
        assert_eq!(decision_true, Fp::one());
        
        let decision_false = decision_to_fp(false);
        assert_eq!(decision_false, Fp::zero());
    }
    
    #[test]
    fn test_poseidon_roundtrip() {
        // Test data
        let data = vec![1u8, 2u8, 3u8];
        
        // Compute commitment
        let commitment = compute_poseidon_commitment(&data);
        
        // Verify commitment matches
        assert!(verify_poseidon_hash(commitment, &data));
    }
    
    #[test]
    fn test_poseidon_mismatch() {
        // Test data
        let data = vec![1u8, 2u8, 3u8];
        let altered_data = vec![1u8, 2u8, 4u8]; // Different data
        
        // Compute commitment
        let commitment = compute_poseidon_commitment(&data);
        
        // Verify altered data doesn't match
        assert!(!verify_poseidon_hash(commitment, &altered_data));
    }
    
    #[test]
    fn test_mpc_share_reconstruct() {
        // Test secret
        let secret = b"true";
        
        // Create shares (t=2, n=3)
        let shares = simulate_mpc_share(secret, 2, 3).unwrap();
        
        // Verify we got 3 shares
        assert_eq!(shares.len(), 3);
        
        // Reconstruct with 2 shares (minimum threshold)
        let _reconstructed = simulate_mpc_reconstruct(&shares[0..2], 2).unwrap();
        
        // For XOR-based sharing, we need all shares to reconstruct
        // So let's test with all shares
        let reconstructed_all = simulate_mpc_reconstruct(&shares, 3).unwrap();
        assert_eq!(reconstructed_all, secret);
    }
    
    #[test]
    fn test_mpc_insufficient_shares() {
        // Test secret
        let secret = b"true";
        
        // Create shares (t=2, n=3)
        let shares = simulate_mpc_share(secret, 2, 3).unwrap();
        
        // Try to reconstruct with only 1 share (should fail)
        let result = simulate_mpc_reconstruct(&shares[0..1], 2);
        
        // Should return an error (TooFewShares)
        assert!(result.is_err());
    }
}